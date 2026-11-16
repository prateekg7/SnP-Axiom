import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import math
from pathlib import Path
import re
import sys

import numpy as np
import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.spx_adaptive_v2_ml_strategy import (  # noqa: E402
    DEFAULT_DATASET_PATH,
    SPXAdaptiveV2MLStrategy,
    run_ml_causal_ablation,
)


@pytest.fixture(scope="module")
def hybrid_strategy():
    return SPXAdaptiveV2MLStrategy()


@pytest.fixture(scope="module")
def sample_canonical_df():
    df = pd.read_parquet(DEFAULT_DATASET_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values("timestamp").reset_index(drop=True).tail(400).reset_index(drop=True)


def test_ml_manifest_loaded_explicit_artifacts(hybrid_strategy: SPXAdaptiveV2MLStrategy):
    m = hybrid_strategy.manifest
    assert m.lgb_feature_count == 36
    assert len(m.lgb_model_heads) == 13
    assert m.lgb_total_trees == 1300
    assert m.jev_param_count == 1022805
    assert m.jev_tensor_count == 132
    assert m.interval_q_error > 0.0
    assert len(m.lgb_sha256) == 64
    assert len(m.jev_sha256) == 64


def test_evaluate_window_contains_both_adaptive_and_ml(
    hybrid_strategy: SPXAdaptiveV2MLStrategy,
    sample_canonical_df: pd.DataFrame,
):
    window = sample_canonical_df.iloc[:240]
    res = hybrid_strategy.evaluate_window(window)

    assert res["strategy_version"] == "spx_adaptive_v2_ml_v1.0"
    assert res["action"] in ("LONG", "SHORT", "HOLD")
    assert res["direction"] in ("UP", "DOWN", "FLAT")
    assert res["regime_label"] in ("TREND", "RANGE")
    assert res["tp_points"] > 0 and res["sl_points"] > 0
    assert len(res["path_30m"]) == 6

    # Explicit ML component & proof fields
    ml = res["ml_component"]
    assert ml["feature_count"] == 36
    assert 0.0 < ml["calibrated_p_touch_up"] < 1.0
    assert 0.0 < ml["p_close_up"] < 1.0
    assert ml["jev_action"] in ("LONG", "SHORT", "HOLD")
    assert ml["coupled_action"] in ("LONG", "SHORT", "HOLD")
    assert ml["conformal"]["lower_price"] < res["expected_price_5m"] < ml["conformal"]["upper_price"] or ml["conformal"]["q_error"] > 0

    proof = res["ml_proof"]
    assert proof["ml_executed"] is True
    assert proof["lgb_total_trees"] == 1300
    assert proof["jev_param_count"] == 1022805


def test_ml_causal_ablation_changes_outputs(
    hybrid_strategy: SPXAdaptiveV2MLStrategy,
    sample_canonical_df: pd.DataFrame,
):
    indices = list(range(300, 340))
    ablation = run_ml_causal_ablation(hybrid_strategy, sample_canonical_df, indices=indices, warmup_bars=240)
    assert ablation["bars_tested"] == 40
    assert ablation["bars_with_nonzero_ml_score"] > 0
    assert ablation["ml_causal_impact_verified"] is True
    assert ablation["max_abs_r1_shift"] > 0.0


def _extract_pine_array(pine_text: str, var_name: str, is_float: bool = False):
    chunks = re.findall(rf"f_push_(?:ints|floats)\({var_name},\s*\"([^\"]+)\"\)", pine_text)
    if not chunks:
        fn_names = re.findall(rf"^\s*(f_ld_\d+)\({re.escape(var_name)}\)\s*$", pine_text, re.M)
        for fn_name in fn_names:
            fn_match = re.search(
                rf"^{re.escape(fn_name)}\([^)]*\)\s*=>\n((?:    [^\n]+\n?)+)",
                pine_text,
                re.M,
            )
            assert fn_match is not None, f"Missing loader body for {fn_name}({var_name})"
            chunks.extend(re.findall(r'f_push_(?:ints|floats)\(dst,\s*"([^"]+)"\)', fn_match.group(1)))
    assert len(chunks) > 0, f"Missing embedded chunks for {var_name}"
    tokens = [t for c in chunks for t in c.split(",") if t]
    return [float(t) if is_float else int(t) for t in tokens]


def _eval_compiled_pine_forest(pine_text: str, prefix: str, X_raw: np.ndarray) -> tuple[int, np.ndarray]:
    """Parse and evaluate all compiled `f_{prefix}_{k}` ternary tree functions directly against raw features."""
    fn_bodies = re.findall(
        rf"^f_{re.escape(prefix)}_\d+\(array<float> x\) =>\n((?:    [^\n]+\n?)+)",
        pine_text,
        re.M,
    )
    assert len(fn_bodies) > 0, f"Missing compiled tree functions for f_{prefix}_*"
    tree_exprs: list = []
    for body in fn_bodies:
        tree_exprs.extend(re.findall(r"^\s*acc \+= (.+)$", body, re.M))
    assert len(tree_exprs) > 0

    def parse_tree(expr: str):
        tokens = re.findall(r"\(|\)|\?|<=|:|x\d+|[^\s()?:]+", expr)
        pos = 0

        def parse_node():
            nonlocal pos
            tok = tokens[pos]
            if tok == "(":
                pos += 1  # '('
                feat = int(tokens[pos][1:])
                pos += 1  # xk
                assert tokens[pos] == "<="
                pos += 1
                thr = float(tokens[pos])
                pos += 1
                assert tokens[pos] == "?"
                pos += 1
                left = parse_node()
                assert tokens[pos] == ":"
                pos += 1
                right = parse_node()
                assert tokens[pos] == ")"
                pos += 1
                return (feat, thr, left, right)
            pos += 1
            return float(tok)

        return parse_node()

    parsed = [parse_tree(e) for e in tree_exprs]

    def eval_node(node, row):
        while isinstance(node, tuple):
            f, thr, l, r = node
            node = l if row[f] <= thr else r
        return node

    preds = np.array([sum(eval_node(t, row) for t in parsed) for row in X_raw], dtype=np.float64)
    return len(parsed), preds


def test_exported_pine_native_roundtrip_parity(
    hybrid_strategy: SPXAdaptiveV2MLStrategy,
    sample_canonical_df: pd.DataFrame,
):
    pine_path = PROJECT_ROOT / "scripts" / "comparison" / "SPX_Adaptive_v2_ML_Native.pine"
    if not pine_path.exists():
        pine_path = PROJECT_ROOT / "scripts" / "SPX_Adaptive_v2_ML_Native.pine"
    assert pine_path.exists()
    pine_text = pine_path.read_text(encoding="utf-8")
    assert pine_text.startswith("//@version=6")
    assert "if canEnter or barstate.islast" in pine_text

    feat_df = hybrid_strategy.feature_pipeline.compute_features(sample_canonical_df)
    X_raw = feat_df[hybrid_strategy.lgb_model.feature_names].tail(40).fillna(0.0)
    X_scaled_py = hybrid_strategy.lgb_model.scaler.transform(X_raw)

    for prefix, head, k, is_prob in [
        ("r1", "r_1", 45, False),
        ("cu", "y_close_up", 35, True),
        ("p30", "r_path_30m", 25, False),
        ("tu", "y_touch_up", 20, True),
    ]:
        n_trees, raw_pine = _eval_compiled_pine_forest(pine_text, prefix, X_raw.values)
        assert n_trees == k
        pine_val = 1.0 / (1.0 + np.exp(-raw_pine)) if is_prob else raw_pine

        raw_py = hybrid_strategy.lgb_model.models[head].booster_.predict(X_scaled_py, raw_score=True, num_iteration=k)
        py_val = 1.0 / (1.0 + np.exp(-raw_py)) if is_prob else raw_py

        corr = float(np.corrcoef(pine_val, py_val)[0, 1]) if np.std(py_val) > 0 else 1.0
        assert corr > 0.999
        assert float(np.max(np.abs(pine_val - py_val))) < 1e-4


def test_exported_pine_replay_structure():
    replay_path = PROJECT_ROOT / "scripts" / "comparison" / "SPX_Adaptive_v2_ML_Replay.pine"
    if not replay_path.exists():
        replay_path = PROJECT_ROOT / "scripts" / "SPX_Adaptive_v2_ML_Replay.pine"
    assert replay_path.exists()
    replay_text = replay_path.read_text(encoding="utf-8")
    assert replay_text.startswith("//@version=6")

    ts_arr = _extract_pine_array(replay_text, "sigTs")
    act_arr = _extract_pine_array(replay_text, "sigAct")
    tp_arr = _extract_pine_array(replay_text, "sigTpPts", is_float=True)
    sl_arr = _extract_pine_array(replay_text, "sigSlPts", is_float=True)
    assert len(ts_arr) > 100
    assert len(ts_arr) == len(act_arr) == len(tp_arr) == len(sl_arr)
    assert ts_arr == sorted(ts_arr)
    assert set(act_arr).issubset({-1, 0, 1})
    assert 1 in act_arr and -1 in act_arr

