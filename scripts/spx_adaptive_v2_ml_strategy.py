#!/usr/bin/env python3
"""
SPX Adaptive v2 + Trained ML Unified Strategy (Hybrid Regime + ML Stack).

Combines BOTH strategies inside a single, non-bypassable execution pipeline:
1. Adaptive v2 Component (`SPXAdaptiveAIv2Model`):
   - Intraday regime detection (TREND vs RANGE via ADX + EMA21/EMA50 spread)
   - Session microstructure signals (Opening Range breakouts, Prior Day H/L, Session VWAP)
   - Volatility & RTH entry-window safety gates (`vol_ok`, `in_entry`)
   - Dynamic ATR-scaled 2:1 bracket geometry (`tp_points`, `sl_points`)

2. Explicitly Trained ML Stack (`artifacts/models/`):
   - `FeaturePipeline`: computes the exact 36 stationary market/TA features (`feature_schema.json`)
   - `LightGBMBenchmark` (`artifacts/models/lightgbm_benchmark.pkl`): 13 trained GBDT heads
     (`y_touch_up`, `y_close_up`, `r_1`, `y_high30`, `y_low30`, `rv_30`, `y_eod`, `r_path_5m..30m`)
   - `ProbabilityCalibrator` (`artifacts/models/calibrator_platt.pkl`): Platt probability scaling
   - `ConformalIntervalCalibrator` (`artifacts/models/interval_calibrator.pkl`): 90% conformal bounds
   - `OpenJevDecisionProvider` (`artifacts/models/open_jev_weights.pt`): 1.02M-param neural policy
   - `RiskGuard` + `coupled_ai_technical_decision`: hard validity & oscillator exhaustion filter

Running this script directly executes a 4-part verification & evaluation suite:
  [1] Artifact & Schema Audit (SHA-256 fingerprints, feature alignment, model head & param counts)
  [2] Walk-Forward Out-of-Sample Backtest (Adaptive-v2-Only vs Hybrid Adaptive-v2 + ML)
  [3] Causal ML Ablation Proof (real trained ML vs ablated ML on identical bars)
  [4] Live/Recent Window Trace Inspection (bar-by-bar telemetry & `ml_proof` verification)
"""

from __future__ import annotations

import os

# Critical macOS OpenMP guard before importing torch / lightgbm / numpy / pandas
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import argparse
import hashlib
import json
import math
import sys
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import torch

torch.set_num_threads(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.decision.base import Action, DecisionContext, RiskGuard
from src.decision.jev import OpenJevDecisionProvider
from src.features.pipeline import FeaturePipeline
from src.models.calibration import ConformalIntervalCalibrator, ProbabilityCalibrator
from src.models.lightgbm import LightGBMBenchmark
from src.models.quant_analytics import coupled_ai_technical_decision
from src.models.spx_adaptive_v2 import SPXAdaptiveAIv2Model
from src.trading.paper_engine import PaperTradingEngine


DEFAULT_MODELS_DIR = PROJECT_ROOT / "artifacts" / "models"
DEFAULT_SCHEMA_PATH = PROJECT_ROOT / "data" / "processed" / "feature_schema.json"
DEFAULT_DATASET_PATH = PROJECT_ROOT / "data" / "processed" / "spx_5m_canonical.parquet"
DEFAULT_REPORT_PATH = PROJECT_ROOT / "artifacts" / "models" / "evaluation_stats" / "spx_adaptive_v2_ml_verification.json"


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass(frozen=True)
class MLArtifactManifest:
    lgb_path: str
    lgb_sha256: str
    lgb_total_trees: int
    lgb_feature_count: int
    lgb_model_heads: List[str]
    platt_path: str
    platt_sha256: str
    platt_coef: float
    platt_intercept: float
    interval_path: str
    interval_sha256: str
    interval_q_error: float
    jev_path: str
    jev_sha256: str
    jev_param_count: int
    jev_tensor_count: int


class SPXAdaptiveV2MLStrategy:
    """
    Unified Adaptive v2 + Trained ML Strategy.

    Both Adaptive v2 and the trained ML pipeline execute on every evaluated window
    and jointly determine expected returns, 30m price paths, confidence/intervals,
    and trading actions (LONG / SHORT / HOLD).
    """

    def __init__(
        self,
        models_dir: Path = DEFAULT_MODELS_DIR,
        schema_path: Path = DEFAULT_SCHEMA_PATH,
        ml_weight: float = 0.55,
        adaptive_weight: float = 0.45,
        fusion_entry_threshold: float = 0.32,
        min_ml_score_confirm: float = 0.04,
        feature_window_bars: int = 240,
    ):
        self.models_dir = Path(models_dir)
        self.schema_path = Path(schema_path)
        self.ml_weight = float(ml_weight)
        self.adaptive_weight = float(adaptive_weight)
        self.fusion_entry_threshold = float(fusion_entry_threshold)
        self.min_ml_score_confirm = float(min_ml_score_confirm)
        self.feature_window_bars = int(feature_window_bars)

        # 1. Adaptive v2 structural/regime engine
        self.adaptive_v2 = SPXAdaptiveAIv2Model()

        # 2. Explicitly trained ML stack (fail loudly if any artifact is missing)
        self.lgb_path = self.models_dir / "lightgbm_benchmark.pkl"
        self.platt_path = self.models_dir / "calibrator_platt.pkl"
        self.interval_path = self.models_dir / "interval_calibrator.pkl"
        self.jev_path = self.models_dir / "open_jev_weights.pt"

        for p in (self.lgb_path, self.platt_path, self.interval_path, self.jev_path):
            if not p.exists():
                raise FileNotFoundError(f"Required trained ML artifact missing: {p}")

        self.feature_pipeline = FeaturePipeline()
        self.lgb_model = LightGBMBenchmark.load(str(self.lgb_path))
        self.platt_cal: ProbabilityCalibrator = joblib.load(self.platt_path)
        self.interval_cal: ConformalIntervalCalibrator = joblib.load(self.interval_path)
        self.jev_provider = OpenJevDecisionProvider(weights_path=str(self.jev_path))
        self.risk_guard = RiskGuard(reject_stale=True, reject_invalid=True)

        # Verify 36-feature schema alignment against trained LightGBM artifact
        self.expected_schema_features: List[str] = []
        if self.schema_path.exists():
            schema_data = json.loads(self.schema_path.read_text(encoding="utf-8"))
            self.expected_schema_features = list(schema_data.get("features", []))
            if self.expected_schema_features and list(self.lgb_model.feature_names) != self.expected_schema_features:
                raise ValueError(
                    "Feature mismatch between trained LightGBM artifact and feature_schema.json"
                )

        # Inspect trained weights & build immutable artifact manifest
        jev_params = int(sum(p.numel() for p in self.jev_provider.model.parameters()))
        jev_tensors = int(len(self.jev_provider.model.state_dict()))
        platt_coef = float(self.platt_cal.model.coef_[0][0])
        platt_intercept = float(self.platt_cal.model.intercept_[0])

        lgb_trees = int(sum(m.booster_.num_trees() for m in self.lgb_model.models.values()))
        self.manifest = MLArtifactManifest(
            lgb_path=str(self.lgb_path),
            lgb_sha256=_sha256_file(self.lgb_path),
            lgb_total_trees=lgb_trees,
            lgb_feature_count=len(self.lgb_model.feature_names),
            lgb_model_heads=sorted(list(self.lgb_model.models.keys())),
            platt_path=str(self.platt_path),
            platt_sha256=_sha256_file(self.platt_path),
            platt_coef=platt_coef,
            platt_intercept=platt_intercept,
            interval_path=str(self.interval_path),
            interval_sha256=_sha256_file(self.interval_path),
            interval_q_error=float(self.interval_cal.q_error),
            jev_path=str(self.jev_path),
            jev_sha256=_sha256_file(self.jev_path),
            jev_param_count=jev_params,
            jev_tensor_count=jev_tensors,
        )

    def _compute_ml_inference(
        self,
        df_window: pd.DataFrame,
        regime_label: str,
        adaptive_action: str,
        as_of: datetime,
        ref_price: float,
    ) -> Dict[str, Any]:
        """Run FeaturePipeline -> LightGBMBenchmark -> Platt + Conformal -> Open-Jev -> RiskGuard -> Coupled Filter."""
        slice_df = df_window.tail(self.feature_window_bars).copy()
        feat_df = self.feature_pipeline.compute_features(slice_df)
        missing_cols = [c for c in self.lgb_model.feature_names if c not in feat_df.columns]
        if missing_cols:
            raise KeyError(f"FeaturePipeline output missing LightGBM features: {missing_cols}")

        last_row = feat_df.iloc[-1]
        last_feat = feat_df[self.lgb_model.feature_names].iloc[[-1]].fillna(0.0)
        preds = self.lgb_model.predict(last_feat)

        raw_p_touch_up = float(np.clip(preds["p_touch_up"][0], 1e-6, 1.0 - 1e-6))
        cal_p_touch_up = float(np.clip(self.platt_cal.calibrate(np.array([raw_p_touch_up]))[0], 1e-6, 1.0 - 1e-6))
        p_close_up = float(np.clip(preds["p_close_up"][0], 1e-6, 1.0 - 1e-6))
        ml_r1 = float(preds["r_1"][0])
        ml_high30 = float(preds["y_high30"][0])
        ml_low30 = float(preds["y_low30"][0])
        ml_rv30 = max(1e-5, float(preds["rv_30"][0]))
        ml_eod = float(preds["y_eod"][0])

        q_err = float(self.interval_cal.q_error)
        conf_lower_r1 = ml_r1 - q_err
        conf_upper_r1 = ml_r1 + q_err
        conf_lower_price = float(ref_price * math.exp(conf_lower_r1))
        conf_upper_price = float(ref_price * math.exp(conf_upper_r1))

        ml_expected_price_5m = float(ref_price * math.exp(ml_r1))
        ml_pred_high_30m = float(ref_price * math.exp(max(0.0, ml_high30)))
        ml_pred_low_30m = float(ref_price * math.exp(min(0.0, ml_low30)))

        # Multi-horizon 30m return curve from trained LightGBM path heads
        ml_path_returns: Dict[int, float] = {}
        for horizon in (5, 10, 15, 20, 25, 30):
            key = f"r_path_{horizon}m"
            ml_path_returns[horizon] = float(preds[key][0]) if key in preds else ml_r1 * (horizon / 5.0)

        ctx = DecisionContext(
            as_of=as_of,
            reference_price=ref_price,
            p_touch_up=cal_p_touch_up,
            p_close_up=p_close_up,
            expected_price_5m=ml_expected_price_5m,
            predicted_high_30m=ml_pred_high_30m,
            predicted_low_30m=ml_pred_low_30m,
            volatility_30m=ml_rv30,
            market_regime=regime_label,
            prediction_interval={
                "lower_r1": conf_lower_r1,
                "upper_r1": conf_upper_r1,
                "lower_price": conf_lower_price,
                "upper_price": conf_upper_price,
                "q_error": q_err,
            },
            strategy_signals={"adaptive_v2": adaptive_action},
        )
        forecast_id = f"hybrid-{uuid.uuid4()}"
        jev_raw = self.jev_provider.decide(ctx, forecast_id)
        jev_dec = self.risk_guard.validate(jev_raw, ctx)

        rsi_14 = float(last_row.get("rsi_14", 0.5))
        bb_pband = float(last_row.get("bb_pband", 0.5))
        coupled_action, coupled_reason = coupled_ai_technical_decision(
            expected_return_5m=ml_r1,
            calibrated_p_touch=cal_p_touch_up,
            rsi_14=rsi_14,
            bb_pband=bb_pband,
        )

        # Signed normalized ML score combining trained GBDT heads & Open-Jev neural vote
        r1_z = float(np.tanh(ml_r1 / 0.00005))
        close_up_z = float(np.tanh((p_close_up - 0.5) * 6.0))
        path30_z = float(np.tanh(ml_path_returns[30] / 0.00015))
        jev_vote = 1.0 if jev_dec.action == Action.LONG else (-1.0 if jev_dec.action == Action.SHORT else 0.0)
        ml_score = float(0.45 * r1_z + 0.30 * close_up_z + 0.15 * path30_z + 0.10 * jev_vote)

        return {
            "feature_count": int(last_feat.shape[1]),
            "feature_sample": {
                "log_ret_1": float(last_row["log_ret_1"]),
                "rsi_14": rsi_14,
                "bb_pband": bb_pband,
                "norm_atr_14": float(last_row["norm_atr_14"]),
                "realized_vol_24": float(last_row["realized_vol_24"]),
            },
            "raw_p_touch_up": raw_p_touch_up,
            "calibrated_p_touch_up": cal_p_touch_up,
            "p_close_up": p_close_up,
            "ml_r1": ml_r1,
            "ml_high30": ml_high30,
            "ml_low30": ml_low30,
            "ml_rv30": ml_rv30,
            "ml_eod": ml_eod,
            "ml_expected_price_5m": ml_expected_price_5m,
            "ml_pred_high_30m": ml_pred_high_30m,
            "ml_pred_low_30m": ml_pred_low_30m,
            "ml_path_returns": ml_path_returns,
            "conformal": {
                "q_error": q_err,
                "lower_r1": conf_lower_r1,
                "upper_r1": conf_upper_r1,
                "lower_price": conf_lower_price,
                "upper_price": conf_upper_price,
            },
            "jev_action": jev_dec.action.value,
            "jev_provider": jev_dec.provider,
            "jev_reason_code": jev_dec.reason_code,
            "jev_validation_status": jev_dec.validation_status,
            "coupled_action": coupled_action,
            "coupled_reason": coupled_reason,
            "ml_score": ml_score,
        }

    def evaluate_window(self, df_window: pd.DataFrame) -> Dict[str, Any]:
        """
        Evaluate an OHLCV window using BOTH Adaptive v2 and the trained ML stack.
        Requires at least 60 bars so both Adaptive v2 indicators and FeaturePipeline rolling windows stabilize.
        """
        if df_window is None or len(df_window) < 60:
            raise ValueError(f"Need at least 60 bars for hybrid evaluation; received {0 if df_window is None else len(df_window)}")

        last_ts = pd.to_datetime(df_window["timestamp"].iloc[-1])
        as_of = last_ts.to_pydatetime() if hasattr(last_ts, "to_pydatetime") else datetime.now(timezone.utc)
        if as_of.tzinfo is None:
            as_of = as_of.replace(tzinfo=timezone.utc)
        ref_price = float(df_window["close"].iloc[-1])

        # Step 1: Adaptive v2 evaluation (regime, intraday levels, ATR risk brackets, vol/session gates)
        v2_eval = self.adaptive_v2.evaluate_window(df_window)
        v2_telem = v2_eval["telemetry"]
        v2_raw_score = float(v2_eval["raw_score"])
        adaptive_norm_score = float(np.tanh(v2_raw_score / 1.5))

        # Step 2: Explicitly trained ML pipeline evaluation
        ml_eval = self._compute_ml_inference(
            df_window=df_window,
            regime_label=str(v2_eval["regime_label"]),
            adaptive_action=str(v2_eval["action"]),
            as_of=as_of,
            ref_price=ref_price,
        )

        # Step 3: Joint ML + Adaptive Fusion
        ml_score = float(ml_eval["ml_score"])
        hybrid_score = float(self.ml_weight * ml_score + self.adaptive_weight * adaptive_norm_score)

        # Fused 5m expected return (65% LightGBM trained r_1, 35% Adaptive v2 structural drift)
        v2_r1 = float(v2_eval["expected_return_5m"])
        fused_r1 = float(0.65 * ml_eval["ml_r1"] + 0.35 * v2_r1)
        fused_expected_price_5m = float(ref_price * math.exp(fused_r1))

        # Fused 30m path combining ML path heads and Adaptive v2 path projection
        v2_path_map = {int(p["horizon_minutes"]): float(p["expected_close"]) for p in v2_eval["path_30m"]}
        fused_path_30m: List[Dict[str, Any]] = []
        for horizon in (5, 10, 15, 20, 25, 30):
            ml_close = float(ref_price * math.exp(ml_eval["ml_path_returns"][horizon]))
            v2_close = float(v2_path_map.get(horizon, ml_close))
            fused_close = float(0.65 * ml_close + 0.35 * v2_close)
            fused_path_30m.append({"horizon_minutes": horizon, "expected_close": fused_close})

        # Action gating: requires Adaptive session/vol gates AND non-conflicting ML edge
        vol_ok = bool(v2_telem.get("vol_ok", True))
        in_entry = bool(v2_telem.get("in_entry", True))
        ml_r1 = float(ml_eval["ml_r1"])
        p_close_up = float(ml_eval["p_close_up"])
        jev_action = str(ml_eval["jev_action"])
        coupled_action = str(ml_eval["coupled_action"])
        v2_action = str(v2_eval["action"])

        long_ml_confirm = (
            (ml_score >= self.min_ml_score_confirm)
            or (ml_r1 > 0.0 and p_close_up >= 0.505)
            or (jev_action == "LONG" and ml_score >= 0.0)
            or coupled_action == "LONG"
        )
        short_ml_confirm = (
            (ml_score <= -self.min_ml_score_confirm)
            or (ml_r1 < 0.0 and p_close_up <= 0.495)
            or (jev_action == "SHORT" and ml_score <= 0.0)
            or coupled_action == "SHORT"
        )

        # ML conflict veto: blocks blind TA entries when ML strongly predicts the opposite move
        ml_vetoes_long = (ml_score <= -0.10) or (ml_r1 < -0.00003 and p_close_up < 0.485)
        ml_vetoes_short = (ml_score >= 0.10) or (ml_r1 > 0.00003 and p_close_up > 0.515)

        if not in_entry:
            final_action = "HOLD"
            decision_reason = "HYBRID_HOLD_OUTSIDE_ENTRY_WINDOW"
        elif not vol_ok:
            final_action = "HOLD"
            decision_reason = "HYBRID_HOLD_LOW_VOLATILITY_GATE"
        elif ml_eval["jev_reason_code"] in ("REJECTED_STALE_DATA", "REJECTED_INVALID_FORECAST"):
            final_action = "HOLD"
            decision_reason = f"HYBRID_HOLD_{ml_eval['jev_reason_code']}"
        elif (hybrid_score >= self.fusion_entry_threshold or (v2_action == "LONG" and long_ml_confirm)) and long_ml_confirm and not ml_vetoes_long:
            final_action = "LONG"
            decision_reason = (
                "HYBRID_LONG_ML_ADAPTIVE_CONSENSUS"
                if v2_action == "LONG"
                else "HYBRID_LONG_ML_LEAD_REGIME_ALIGNED"
            )
        elif (hybrid_score <= -self.fusion_entry_threshold or (v2_action == "SHORT" and short_ml_confirm)) and short_ml_confirm and not ml_vetoes_short:
            final_action = "SHORT"
            decision_reason = (
                "HYBRID_SHORT_ML_ADAPTIVE_CONSENSUS"
                if v2_action == "SHORT"
                else "HYBRID_SHORT_ML_LEAD_REGIME_ALIGNED"
            )
        else:
            final_action = "HOLD"
            if v2_action in ("LONG", "SHORT") and ((v2_action == "LONG" and ml_vetoes_long) or (v2_action == "SHORT" and ml_vetoes_short)):
                decision_reason = f"HYBRID_ML_VETOED_ADAPTIVE_{v2_action}"
            else:
                decision_reason = "HYBRID_NEUTRAL_NO_CONSENSUS"

        direction = "UP" if fused_r1 > 1e-6 else ("DOWN" if fused_r1 < -1e-6 else "FLAT")

        # Confidence blends calibrated ML close conviction with Adaptive structural score
        ml_conf = max(p_close_up, 1.0 - p_close_up)
        fused_confidence = float(np.clip(0.65 * ml_conf + 0.35 * float(v2_eval["score_confidence"]), 0.0, 0.999))

        return {
            "strategy_version": "spx_adaptive_v2_ml_v1.0",
            "timestamp": as_of.isoformat(),
            "reference_price": ref_price,
            "action": final_action,
            "direction": direction,
            "decision_reason": decision_reason,
            "hybrid_score": round(hybrid_score, 6),
            "ml_score": round(ml_score, 6),
            "adaptive_norm_score": round(adaptive_norm_score, 6),
            "expected_return_5m": fused_r1,
            "expected_price_5m": fused_expected_price_5m,
            "score_confidence": fused_confidence,
            "p_touch_up_calibrated": ml_eval["calibrated_p_touch_up"],
            "p_close_up": ml_eval["p_close_up"],
            "predicted_high_30m": ml_eval["ml_pred_high_30m"],
            "predicted_low_30m": ml_eval["ml_pred_low_30m"],
            "volatility_30m": ml_eval["ml_rv30"],
            "prediction_interval": ml_eval["conformal"],
            "path_30m": fused_path_30m,
            "tp_points": float(v2_eval["tp_points"]),
            "sl_points": float(v2_eval["sl_points"]),
            "regime_label": str(v2_eval["regime_label"]),
            "trend_regime": bool(v2_eval["trend_regime"]),
            "adaptive_v2": {
                "action": v2_action,
                "direction": str(v2_eval["direction"]),
                "raw_score": v2_raw_score,
                "score_confidence": float(v2_eval["score_confidence"]),
                "expected_return_5m": v2_r1,
                "decision_reason": str(v2_eval["decision_reason"]),
                "telemetry": v2_telem,
            },
            "ml_component": ml_eval,
            "ml_proof": {
                "ml_executed": True,
                "lgb_model_sha256_prefix": self.manifest.lgb_sha256[:12],
                "lgb_total_trees": self.manifest.lgb_total_trees,
                "lgb_feature_count": ml_eval["feature_count"],
                "lgb_heads_used": ["p_touch_up", "p_close_up", "r_1", "y_high30", "y_low30", "rv_30", "r_path_5m..30m"],
                "platt_sha256_prefix": self.manifest.platt_sha256[:12],
                "interval_q_error": self.manifest.interval_q_error,
                "jev_sha256_prefix": self.manifest.jev_sha256[:12],
                "jev_param_count": self.manifest.jev_param_count,
                "jev_action": ml_eval["jev_action"],
                "coupled_action": ml_eval["coupled_action"],
            },
        }


def _evaluate_backtest_slice(
    strategy: SPXAdaptiveV2MLStrategy,
    df: pd.DataFrame,
    start_idx: int,
    end_idx: int,
    warmup_bars: int = 240,
) -> Dict[str, Any]:
    """Run bar-by-bar out-of-sample evaluation comparing Adaptive-v2-only vs Hybrid Adaptive-v2+ML."""
    hybrid_engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=0.25,
        slippage_points=0.10,
        take_profit_points=None,
        stop_loss_points=None,
        max_bars_held=12,
    )
    v2_engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=0.25,
        slippage_points=0.10,
        take_profit_points=None,
        stop_loss_points=None,
        max_bars_held=12,
    )

    hybrid_actions = {"LONG": 0, "SHORT": 0, "HOLD": 0}
    v2_actions = {"LONG": 0, "SHORT": 0, "HOLD": 0}
    ml_vetoed_count = 0
    ml_lead_count = 0

    hybrid_dir_hits = 0
    v2_dir_hits = 0
    hybrid_r1_sq_err = 0.0
    v2_r1_sq_err = 0.0
    eval_bars = 0

    recent_traces: List[Dict[str, Any]] = []

    for i in range(start_idx, end_idx - 1):
        win_start = max(0, i - warmup_bars + 1)
        df_win = df.iloc[win_start : i + 1]
        if len(df_win) < 60:
            continue

        res = strategy.evaluate_window(df_win)
        next_bar = df.iloc[i + 1]
        actual_r1 = float(math.log(float(next_bar["close"]) / float(res["reference_price"])))
        actual_up = actual_r1 > 0.0

        h_action = res["action"]
        v2_action = res["adaptive_v2"]["action"]
        hybrid_actions[h_action] = hybrid_actions.get(h_action, 0) + 1
        v2_actions[v2_action] = v2_actions.get(v2_action, 0) + 1

        if "ML_VETOED" in res["decision_reason"]:
            ml_vetoed_count += 1
        if "ML_LEAD" in res["decision_reason"]:
            ml_lead_count += 1

        if (res["expected_return_5m"] > 0) == actual_up:
            hybrid_dir_hits += 1
        if (res["adaptive_v2"]["expected_return_5m"] > 0) == actual_up:
            v2_dir_hits += 1

        hybrid_r1_sq_err += (res["expected_return_5m"] - actual_r1) ** 2
        v2_r1_sq_err += (res["adaptive_v2"]["expected_return_5m"] - actual_r1) ** 2
        eval_bars += 1

        ts = pd.to_datetime(next_bar["timestamp"]).to_pydatetime()
        fill_p = float(next_bar["open"])
        high_p = float(next_bar["high"])
        low_p = float(next_bar["low"])

        if hybrid_engine.active_trade is None:
            hybrid_engine.take_profit_points = res["tp_points"]
            hybrid_engine.stop_loss_points = res["sl_points"]
        if v2_engine.active_trade is None:
            v2_engine.take_profit_points = res["tp_points"]
            v2_engine.stop_loss_points = res["sl_points"]

        hybrid_engine.process_decision(
            forecast_id=f"hyb-{i}",
            timestamp=ts,
            action=h_action,
            fill_price=fill_p,
            high=high_p,
            low=low_p,
        )
        v2_engine.process_decision(
            forecast_id=f"v2-{i}",
            timestamp=ts,
            action=v2_action,
            fill_price=fill_p,
            high=high_p,
            low=low_p,
        )

        if i >= end_idx - 6:
            recent_traces.append(
                {
                    "timestamp": res["timestamp"],
                    "close": res["reference_price"],
                    "regime": res["regime_label"],
                    "adaptive_action": v2_action,
                    "adaptive_score": round(res["adaptive_v2"]["raw_score"], 4),
                    "ml_r1": round(res["ml_component"]["ml_r1"], 7),
                    "ml_p_close_up": round(res["ml_component"]["p_close_up"], 4),
                    "ml_p_touch_cal": round(res["ml_component"]["calibrated_p_touch_up"], 4),
                    "jev_action": res["ml_component"]["jev_action"],
                    "coupled_action": res["ml_component"]["coupled_action"],
                    "hybrid_score": res["hybrid_score"],
                    "final_action": h_action,
                    "reason": res["decision_reason"],
                }
            )

    return {
        "eval_bars": eval_bars,
        "adaptive_v2_only": {
            "actions": v2_actions,
            "direction_accuracy": round(v2_dir_hits / max(1, eval_bars), 4),
            "r1_rmse": round(math.sqrt(v2_r1_sq_err / max(1, eval_bars)), 7),
            "paper_trading": asdict(v2_engine.get_performance_summary()),
        },
        "hybrid_adaptive_v2_ml": {
            "actions": hybrid_actions,
            "direction_accuracy": round(hybrid_dir_hits / max(1, eval_bars), 4),
            "r1_rmse": round(math.sqrt(hybrid_r1_sq_err / max(1, eval_bars)), 7),
            "ml_vetoed_v2_trades": ml_vetoed_count,
            "ml_lead_trades": ml_lead_count,
            "paper_trading": asdict(hybrid_engine.get_performance_summary()),
        },
        "recent_traces": recent_traces,
    }


def run_ml_causal_ablation(
    strategy: SPXAdaptiveV2MLStrategy,
    df: pd.DataFrame,
    indices: List[int],
    warmup_bars: int = 240,
) -> Dict[str, Any]:
    """
    Causal Proof: compare real trained ML outputs vs an ablated neutral ML stub
    (zeroed returns, 0.50 probabilities, HOLD neural vote) on the exact same OHLCV windows.
    If ML is truly wired into the strategy, expected returns, scores, and actions MUST diverge.
    """
    real_outputs = []
    for idx in indices:
        win = df.iloc[max(0, idx - warmup_bars + 1) : idx + 1]
        real_outputs.append(strategy.evaluate_window(win))

    # Temporarily stub ML inference method ONLY inside this isolated verification check
    orig_fn = strategy._compute_ml_inference

    def _neutral_ml_stub(df_window, regime_label, adaptive_action, as_of, ref_price):
        base = orig_fn(df_window, regime_label, adaptive_action, as_of, ref_price)
        base["raw_p_touch_up"] = 0.5
        base["calibrated_p_touch_up"] = 0.5
        base["p_close_up"] = 0.5
        base["ml_r1"] = 0.0
        base["ml_expected_price_5m"] = ref_price
        base["ml_path_returns"] = {h: 0.0 for h in (5, 10, 15, 20, 25, 30)}
        base["jev_action"] = "HOLD"
        base["coupled_action"] = "HOLD"
        base["ml_score"] = 0.0
        return base

    try:
        strategy._compute_ml_inference = _neutral_ml_stub  # type: ignore[method-assign]
        ablated_outputs = []
        for idx in indices:
            win = df.iloc[max(0, idx - warmup_bars + 1) : idx + 1]
            ablated_outputs.append(strategy.evaluate_window(win))
    finally:
        strategy._compute_ml_inference = orig_fn  # type: ignore[method-assign]

    action_diffs = sum(1 for r, a in zip(real_outputs, ablated_outputs) if r["action"] != a["action"])
    r1_diffs = [abs(r["expected_return_5m"] - a["expected_return_5m"]) for r, a in zip(real_outputs, ablated_outputs)]
    score_diffs = [abs(r["hybrid_score"] - a["hybrid_score"]) for r, a in zip(real_outputs, ablated_outputs)]
    ml_scores_nonzero = sum(1 for r in real_outputs if abs(r["ml_score"]) > 1e-6)

    return {
        "bars_tested": len(indices),
        "bars_with_nonzero_ml_score": ml_scores_nonzero,
        "action_differences_on_ablation": action_diffs,
        "mean_abs_r1_shift": round(float(np.mean(r1_diffs)), 8),
        "max_abs_r1_shift": round(float(np.max(r1_diffs)), 8),
        "mean_abs_hybrid_score_shift": round(float(np.mean(score_diffs)), 6),
        "ml_causal_impact_verified": bool(ml_scores_nonzero > 0 and float(np.max(r1_diffs)) > 1e-6),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Unified SPX Adaptive v2 + Trained ML Strategy & Verification")
    parser.add_argument("--bars", type=int, default=600, help="Number of latest OOS test bars to evaluate (default: 600)")
    parser.add_argument("--save-report", type=str, default=str(DEFAULT_REPORT_PATH), help="Path to write JSON verification report")
    args = parser.parse_args()

    print("=" * 80)
    print("SPX ADAPTIVE v2 + TRAINED ML UNIFIED STRATEGY — VERIFICATION SUITE")
    print("=" * 80)

    strategy = SPXAdaptiveV2MLStrategy()
    m = strategy.manifest
    print("[1/4] Loaded Explicitly Trained ML Artifacts:")
    print(f"  - LightGBM      : {Path(m.lgb_path).name} (sha256={m.lgb_sha256[:16]}..., total_trees={m.lgb_total_trees}, features={m.lgb_feature_count}, heads={len(m.lgb_model_heads)})")
    print(f"  - Platt Calib   : {Path(m.platt_path).name} (sha256={m.platt_sha256[:16]}..., coef={m.platt_coef:.6f}, intercept={m.platt_intercept:.6f})")
    print(f"  - Conformal Int : {Path(m.interval_path).name} (sha256={m.interval_sha256[:16]}..., q_error={m.interval_q_error:.8f})")
    print(f"  - Open-Jev Torch: {Path(m.jev_path).name} (sha256={m.jev_sha256[:16]}..., params={m.jev_param_count:,}, tensors={m.jev_tensor_count})")

    df = pd.read_parquet(DEFAULT_DATASET_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    n_total = len(df)
    start_idx = max(240, n_total - int(args.bars))
    end_idx = n_total

    print(f"\n[2/4] Out-of-Sample Evaluation on Latest {end_idx - start_idx - 1} Canonical Bars ({df['timestamp'].iloc[start_idx]} -> {df['timestamp'].iloc[end_idx - 1]}):")
    bt = _evaluate_backtest_slice(strategy, df, start_idx=start_idx, end_idx=end_idx)
    v2_s = bt["adaptive_v2_only"]
    hyb_s = bt["hybrid_adaptive_v2_ml"]
    print(f"  - Adaptive v2 ONLY : dir_acc={v2_s['direction_accuracy']:.4f}, r1_rmse={v2_s['r1_rmse']:.7f}, actions={v2_s['actions']}")
    print(f"                       paper={v2_s['paper_trading']}")
    print(f"  - Hybrid v2 + ML   : dir_acc={hyb_s['direction_accuracy']:.4f}, r1_rmse={hyb_s['r1_rmse']:.7f}, actions={hyb_s['actions']}")
    print(f"                       ml_vetoed={hyb_s['ml_vetoed_v2_trades']}, ml_lead={hyb_s['ml_lead_trades']}, paper={hyb_s['paper_trading']}")

    print("\n[3/4] Causal ML Ablation Test (Real Trained ML vs Neutralized ML on Identical Bars):")
    ablation_indices = list(range(max(240, end_idx - 120), end_idx - 1))
    ablation = run_ml_causal_ablation(strategy, df, ablation_indices)
    for k, v in ablation.items():
        print(f"  - {k}: {v}")

    print("\n[4/4] Latest 5 Bar-by-Bar Hybrid Execution Traces:")
    for tr in bt["recent_traces"]:
        print(
            f"  {tr['timestamp']} | close={tr['close']:.2f} | {tr['regime']:5s} | "
            f"v2={tr['adaptive_action']:5s}({tr['adaptive_score']:+.3f}) | "
            f"ml_r1={tr['ml_r1']:+.6f} p_close_up={tr['ml_p_close_up']:.3f} jev={tr['jev_action']:5s} | "
            f"HYBRID={tr['final_action']:5s}({tr['hybrid_score']:+.3f}) [{tr['reason']}]"
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest": m.__dict__,
        "dataset": {
            "path": str(DEFAULT_DATASET_PATH),
            "total_rows": n_total,
            "eval_start": str(df["timestamp"].iloc[start_idx]),
            "eval_end": str(df["timestamp"].iloc[end_idx - 1]),
        },
        "backtest_comparison": bt,
        "ml_causal_ablation": ablation,
    }
    report_path = Path(args.save_report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"\nSaved full verification report to {report_path}")


if __name__ == "__main__":
    main()
