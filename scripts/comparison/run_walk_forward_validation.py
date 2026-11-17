#!/usr/bin/env python3
"""
Rigorous 5-Fold Expanding-Window Walk-Forward Validation (WFV) for SnP-Axiom.
Compares all 6 architectures across chronological out-of-sample folds
with strict label purging and embargo buffers at all split boundaries.
"""

import sys
import os
import time
import math
import json
from pathlib import Path
from typing import Dict, Any, List, Tuple
from zoneinfo import ZoneInfo

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import (
    RandomForestRegressor,
    RandomForestClassifier,
    HistGradientBoostingRegressor,
    HistGradientBoostingClassifier,
)
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.linear_model import SGDRegressor, SGDClassifier
from sklearn.metrics import brier_score_loss, mean_squared_error, mean_absolute_error

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.lightgbm import LightGBMBenchmark
from src.models.calibration import ProbabilityCalibrator
from src.trading.paper_engine import PaperTradingEngine
from scripts.comparison.train_and_compare_all_ml_methods import (
    GenericMLWrapper,
    precompute_v2_signals,
    evaluate_backtest_simulation
)

EVAL_DIR = PROJECT_ROOT / "artifacts" / "models" / "evaluation_stats"
EVAL_DIR.mkdir(parents=True, exist_ok=True)


def train_fold_models(
    df_feat: pd.DataFrame,
    df_tgt: pd.DataFrame,
    train_idx: np.ndarray,
    val_idx: np.ndarray,
    feature_cols: List[str]
) -> Dict[str, GenericMLWrapper]:
    """Train and calibrate all models strictly on the fold's training and validation data."""
    X_train = df_feat.iloc[train_idx][feature_cols].copy().fillna(0.0)
    y_train = df_tgt.iloc[train_idx]
    X_val = df_feat.iloc[val_idx][feature_cols].copy().fillna(0.0)
    y_val = df_tgt.iloc[val_idx]

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # Valid target masks
    mask_tr_r1 = ~y_train["r_1"].isna()
    mask_tr_cu = ~y_train["y_close_up"].isna()
    mask_tr_p30 = ~y_train["r_path_30m"].isna()
    mask_tr_tu = ~y_train["y_touch_up"].isna()

    mask_val_tu = ~y_val["y_touch_up"].isna()
    y_val_tu = y_val.loc[mask_val_tu, "y_touch_up"].astype(int).values

    wrappers = {}

    # 1. Random Forest (110 Trees)
    rf_models = {}
    rf_r1 = RandomForestRegressor(n_estimators=35, max_depth=6, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    rf_models["r_1"] = rf_r1

    rf_cu = RandomForestClassifier(n_estimators=30, max_depth=6, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_cu.fit(X_train_scaled[mask_tr_cu], y_train.loc[mask_tr_cu, "y_close_up"].astype(int))
    rf_models["y_close_up"] = rf_cu

    rf_p30 = RandomForestRegressor(n_estimators=25, max_depth=6, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_p30.fit(X_train_scaled[mask_tr_p30], y_train.loc[mask_tr_p30, "r_path_30m"])
    rf_models["r_path_30m"] = rf_p30

    rf_tu = RandomForestClassifier(n_estimators=20, max_depth=5, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_tu.fit(X_train_scaled[mask_tr_tu], y_train.loc[mask_tr_tu, "y_touch_up"].astype(int))
    rf_models["y_touch_up"] = rf_tu

    rf_val_tu = rf_tu.predict_proba(X_val_scaled)[:, 1]
    platt_rf = ProbabilityCalibrator(method="platt").fit(y_val_tu, rf_val_tu[mask_val_tu])
    w_rf = GenericMLWrapper("Random Forest Hybrid", rf_models, scaler, platt_rf)
    w_rf.feature_names = feature_cols
    wrappers["Random Forest Hybrid"] = w_rf

    # 2. HistGradientBoosting (HGBM)
    hgbm_models = {}
    h_r1 = HistGradientBoostingRegressor(max_iter=35, max_depth=5, min_samples_leaf=40, random_state=42)
    h_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    hgbm_models["r_1"] = h_r1

    h_cu = HistGradientBoostingClassifier(max_iter=30, max_depth=5, min_samples_leaf=40, random_state=42)
    h_cu.fit(X_train_scaled[mask_tr_cu], y_train.loc[mask_tr_cu, "y_close_up"].astype(int))
    hgbm_models["y_close_up"] = h_cu

    h_p30 = HistGradientBoostingRegressor(max_iter=25, max_depth=5, min_samples_leaf=40, random_state=42)
    h_p30.fit(X_train_scaled[mask_tr_p30], y_train.loc[mask_tr_p30, "r_path_30m"])
    hgbm_models["r_path_30m"] = h_p30

    h_tu = HistGradientBoostingClassifier(max_iter=20, max_depth=4, min_samples_leaf=40, random_state=42)
    h_tu.fit(X_train_scaled[mask_tr_tu], y_train.loc[mask_tr_tu, "y_touch_up"].astype(int))
    hgbm_models["y_touch_up"] = h_tu

    h_val_tu = h_tu.predict_proba(X_val_scaled)[:, 1]
    platt_hgbm = ProbabilityCalibrator(method="platt").fit(y_val_tu, h_val_tu[mask_val_tu])
    w_hgbm = GenericMLWrapper("HistGradientBoosting", hgbm_models, scaler, platt_hgbm)
    w_hgbm.feature_names = feature_cols
    wrappers["HistGradientBoosting"] = w_hgbm

    # 3. Multilayer Perceptron (MLP)
    mlp_models = {}
    m_r1 = MLPRegressor(hidden_layer_sizes=(32, 16), activation="relu", max_iter=30, batch_size=256, random_state=42)
    m_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    mlp_models["r_1"] = m_r1

    m_cu = MLPClassifier(hidden_layer_sizes=(32, 16), activation="relu", max_iter=30, batch_size=256, random_state=42)
    m_cu.fit(X_train_scaled[mask_tr_cu], y_train.loc[mask_tr_cu, "y_close_up"].astype(int))
    mlp_models["y_close_up"] = m_cu

    m_p30 = MLPRegressor(hidden_layer_sizes=(24, 12), activation="relu", max_iter=25, batch_size=256, random_state=42)
    m_p30.fit(X_train_scaled[mask_tr_p30], y_train.loc[mask_tr_p30, "r_path_30m"])
    mlp_models["r_path_30m"] = m_p30

    m_tu = MLPClassifier(hidden_layer_sizes=(24, 12), activation="relu", max_iter=20, batch_size=256, random_state=42)
    m_tu.fit(X_train_scaled[mask_tr_tu], y_train.loc[mask_tr_tu, "y_touch_up"].astype(int))
    mlp_models["y_touch_up"] = m_tu

    m_val_tu = m_tu.predict_proba(X_val_scaled)[:, 1]
    platt_mlp = ProbabilityCalibrator(method="platt").fit(y_val_tu, m_val_tu[mask_val_tu])
    w_mlp = GenericMLWrapper("Multi-Layer Perceptron", mlp_models, scaler, platt_mlp)
    w_mlp.feature_names = feature_cols
    wrappers["Multi-Layer Perceptron"] = w_mlp

    # 4. Option A (Native LightGBM)
    opt_a = LightGBMBenchmark(random_seed=42)
    opt_a.fit(df_feat.iloc[train_idx], y_train, feature_cols=feature_cols)
    val_preds_lgb = opt_a.predict(df_feat.iloc[val_idx])
    platt_opt_a = ProbabilityCalibrator(method="platt").fit(y_val_tu, val_preds_lgb["p_touch_up"][mask_val_tu])
    w_opt_a = GenericMLWrapper("Option A (LightGBM)", opt_a.models, opt_a.scaler, platt_opt_a)
    w_opt_a.feature_names = feature_cols
    wrappers["Option A (LightGBM)"] = w_opt_a

    # 5. Support Vector Machine (SGD-SVM)
    svm_models = {}
    s_r1 = SGDRegressor(loss="squared_error", penalty="l2", alpha=1e-4, max_iter=40, random_state=42)
    s_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    svm_models["r_1"] = s_r1

    s_cu = SGDClassifier(loss="log_loss", penalty="l2", alpha=1e-4, max_iter=40, random_state=42)
    s_cu.fit(X_train_scaled[mask_tr_cu], y_train.loc[mask_tr_cu, "y_close_up"].astype(int))
    svm_models["y_close_up"] = s_cu

    s_p30 = SGDRegressor(loss="squared_error", penalty="l2", alpha=1e-4, max_iter=30, random_state=42)
    s_p30.fit(X_train_scaled[mask_tr_p30], y_train.loc[mask_tr_p30, "r_path_30m"])
    svm_models["r_path_30m"] = s_p30

    s_tu = SGDClassifier(loss="log_loss", penalty="l2", alpha=1e-4, max_iter=30, random_state=42)
    s_tu.fit(X_train_scaled[mask_tr_tu], y_train.loc[mask_tr_tu, "y_touch_up"].astype(int))
    svm_models["y_touch_up"] = s_tu

    s_val_tu = s_tu.predict_proba(X_val_scaled)[:, 1]
    platt_svm = ProbabilityCalibrator(method="platt").fit(y_val_tu, s_val_tu[mask_val_tu])
    w_svm = GenericMLWrapper("Support Vector Machine", svm_models, scaler, platt_svm)
    w_svm.feature_names = feature_cols
    wrappers["Support Vector Machine"] = w_svm

    return wrappers


def evaluate_pure_v2(df_sig_slice: pd.DataFrame) -> Dict[str, Any]:
    """Evaluate rule-only Pure Adaptive v2 on the test slice."""
    v2_raw = df_sig_slice["v2_raw_score"].values
    v2_norm = np.clip(v2_raw / 3.50, -1.0, 1.0)
    vol_ok = df_sig_slice["vol_ok"].values
    in_entry = df_sig_slice["in_entry"].values
    can_trade = vol_ok & in_entry

    actions = np.full(len(df_sig_slice), "HOLD", dtype=object)
    actions[can_trade & (v2_norm >= 0.32)] = "LONG"
    actions[can_trade & (v2_norm <= -0.32)] = "SHORT"

    engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=0.15,
        slippage_points=0.0,
        max_bars_held=6,
    )

    n_bars = len(df_sig_slice)
    for i in range(n_bars - 1):
        next_bar = df_sig_slice.iloc[i + 1]
        ts = pd.to_datetime(next_bar["timestamp"]).to_pydatetime()
        act = actions[i]

        if engine.active_trade is None:
            engine.take_profit_points = float(df_sig_slice["tp_points"].iloc[i])
            engine.stop_loss_points = float(df_sig_slice["sl_points"].iloc[i])

        engine.process_decision(
            forecast_id=f"v2-{i}",
            timestamp=ts,
            action=act,
            fill_price=float(next_bar["open"]),
            high=float(next_bar["high"]),
            low=float(next_bar["low"]),
        )

    if engine.active_trade is not None:
        last_bar = df_sig_slice.iloc[-1]
        engine.close_all_positions(
            pd.to_datetime(last_bar["timestamp"]).to_pydatetime(),
            float(last_bar["close"]),
        )

    perf = engine.get_performance_summary()
    return {
        "model": "Pure Adaptive v2 (No ML)",
        "net_pnl_pts": round(perf.net_pnl, 2),
        "gross_pnl_pts": round(perf.gross_pnl, 2),
        "win_rate_pct": round(perf.win_rate * 100.0, 2),
        "profit_factor": round(perf.profit_factor, 3) if perf.profit_factor != float("inf") else 99.99,
        "max_drawdown_pts": round(perf.max_drawdown, 2),
        "total_trades": perf.total_trades,
        "long_trades": int(np.sum(actions == "LONG")),
        "short_trades": int(np.sum(actions == "SHORT")),
        "hold_bars": int(np.sum(actions == "HOLD")),
    }


def main():
    print("=" * 80)
    print("STARTING 5-FOLD EXPANDING-WINDOW WALK-FORWARD VALIDATION")
    print("=" * 80)

    # Load canonical data
    print("\n[Step 1] Loading canonical features, targets, and price signals...")
    df_canon = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "spx_5m_canonical.parquet")
    df_feat = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "features.parquet")
    df_tgt = pd.read_parquet(PROJECT_ROOT / "data" / "labels" / "targets.parquet")

    feature_cols = [c for c in df_feat.columns if c != "timestamp"]
    df_sig_full = precompute_v2_signals(df_canon)

    total_rows = len(df_feat)
    print(f"Total dataset bars: {total_rows} ({str(df_canon['timestamp'].iloc[0])[:10]} to {str(df_canon['timestamp'].iloc[-1])[:10]})")

    # Define 5 expanding folds
    test_total_ratio = 0.35  # ~25,400 bars for OOS walk-forward evaluation
    initial_train_end = int(total_rows * (1.0 - test_total_ratio))
    test_len_per_fold = int((total_rows - initial_train_end) / 5)
    horizon_purge = 6
    embargo_bars = 2
    total_buffer = horizon_purge + embargo_bars  # 8 bars

    folds_metadata = []
    fold_results: Dict[str, List[Dict[str, Any]]] = {
        "Random Forest Hybrid": [],
        "HistGradientBoosting": [],
        "Multi-Layer Perceptron": [],
        "Option A (LightGBM)": [],
        "Support Vector Machine": [],
        "Pure Adaptive v2 (No ML)": []
    }

    start_wfv_time = time.time()

    for fold in range(5):
        fold_id = fold + 1
        train_end = initial_train_end + fold * test_len_per_fold
        val_len = int(train_end * 0.15)  # 15% of training data for calibration
        train_core_end = train_end - val_len

        val_start = train_core_end + total_buffer
        val_end = train_end

        test_start = train_end + total_buffer
        test_end = min(total_rows, initial_train_end + (fold + 1) * test_len_per_fold)

        train_idx = np.arange(0, train_core_end)
        val_idx = np.arange(val_start, val_end)
        test_idx = np.arange(test_start, test_end)

        tr_start_str = str(df_canon["timestamp"].iloc[0])[:10]
        tr_end_str = str(df_canon["timestamp"].iloc[train_core_end - 1])[:10]
        te_start_str = str(df_canon["timestamp"].iloc[test_start])[:10]
        te_end_str = str(df_canon["timestamp"].iloc[test_end - 1])[:10]

        fold_meta = {
            "fold_id": fold_id,
            "train_bars": len(train_idx),
            "val_bars": len(val_idx),
            "test_bars": len(test_idx),
            "train_period": f"{tr_start_str} to {tr_end_str}",
            "test_period": f"{te_start_str} to {te_end_str}",
            "purged_buffer_bars": total_buffer,
        }
        folds_metadata.append(fold_meta)

        print("\n" + "-" * 75)
        print(f"FOLD {fold_id}/5: Train ({tr_start_str} to {tr_end_str}, {len(train_idx)} bars) | "
              f"Test ({te_start_str} to {te_end_str}, {len(test_idx)} bars)")
        print(f"Purge & Embargo Buffer: {total_buffer} bars between Train-Val and Val-Test.")
        print("-" * 75)

        t_fold = time.time()
        # Train ML models for this fold
        wrappers = train_fold_models(df_feat, df_tgt, train_idx, val_idx, feature_cols)

        df_feat_test = df_feat.iloc[test_idx][feature_cols].copy().fillna(0.0)
        df_sig_test = df_sig_full.iloc[test_idx].copy().reset_index(drop=True)

        # 1. Evaluate ML models
        for mname, wrapper in wrappers.items():
            res = evaluate_backtest_simulation(wrapper, df_feat_test, df_sig_test)
            res["fold_id"] = fold_id
            res["test_period"] = f"{te_start_str} to {te_end_str}"
            fold_results[mname].append(res)
            print(f"  -> {mname:25s} | Win Rate: {res['win_rate_pct']:5.1f}% | Net PnL: {res['net_pnl_pts']:+8.2f} pts | "
                  f"PF: {res['profit_factor']:5.2f} | Trades: {res['total_trades']:3d} | DD: {res['max_drawdown_pts']:5.2f} pts")

        # 2. Evaluate Pure Adaptive v2 Baseline
        res_v2 = evaluate_pure_v2(df_sig_test)
        res_v2["fold_id"] = fold_id
        res_v2["test_period"] = f"{te_start_str} to {te_end_str}"
        fold_results["Pure Adaptive v2 (No ML)"].append(res_v2)
        print(f"  -> {'Pure Adaptive v2 (No ML)':25s} | Win Rate: {res_v2['win_rate_pct']:5.1f}% | Net PnL: {res_v2['net_pnl_pts']:+8.2f} pts | "
              f"PF: {res_v2['profit_factor']:5.2f} | Trades: {res_v2['total_trades']:3d} | DD: {res_v2['max_drawdown_pts']:5.2f} pts")

        print(f"Fold {fold_id} completed in {time.time() - t_fold:.2f}s")

    print("\n" + "=" * 80)
    print("WALK-FORWARD VALIDATION COMPLETE (Total runtime: {:.1f}s)".format(time.time() - start_wfv_time))
    print("=" * 80)

    # Aggregate summaries across all 5 folds
    summary_table = []
    for model_name, res_list in fold_results.items():
        cum_net = sum(r["net_pnl_pts"] for r in res_list)
        cum_gross = sum(r["gross_pnl_pts"] for r in res_list)
        total_trades = sum(r["total_trades"] for r in res_list)
        total_wins = sum(int(round(r["win_rate_pct"] * r["total_trades"] / 100.0)) for r in res_list)
        overall_wr = round(total_wins / total_trades * 100.0, 2) if total_trades > 0 else 0.0
        avg_wr = round(np.mean([r["win_rate_pct"] for r in res_list]), 2)
        std_wr = round(np.std([r["win_rate_pct"] for r in res_list]), 2)
        max_dd = max(r["max_drawdown_pts"] for r in res_list)
        expectancy = round(cum_net / total_trades, 2) if total_trades > 0 else 0.0

        # Harmonic or weighted profit factor
        gross_profits = sum(max(0.0, r["gross_pnl_pts"]) for r in res_list)
        gross_losses = sum(abs(min(0.0, r["gross_pnl_pts"])) for r in res_list) + sum(0.30 * r["total_trades"] for r in res_list)
        overall_pf = round(np.mean([r["profit_factor"] for r in res_list if r["profit_factor"] < 50.0]), 2)

        summary_table.append({
            "model": model_name,
            "cumulative_net_pnl": round(cum_net, 2),
            "cumulative_gross_pnl": round(cum_gross, 2),
            "total_trades": total_trades,
            "overall_win_rate_pct": overall_wr,
            "mean_fold_win_rate_pct": avg_wr,
            "win_rate_std_dev": std_wr,
            "expectancy_pts_per_trade": expectancy,
            "worst_fold_drawdown_pts": max_dd,
            "mean_profit_factor": overall_pf,
            "folds": [
                {
                    "fold": r["fold_id"],
                    "test_period": r["test_period"],
                    "net_pnl": r["net_pnl_pts"],
                    "win_rate": r["win_rate_pct"],
                    "trades": r["total_trades"],
                    "profit_factor": r["profit_factor"],
                    "drawdown": r["max_drawdown_pts"],
                }
                for r in res_list
            ]
        })

    # Sort by cumulative net PnL descending
    summary_table.sort(key=lambda x: x["cumulative_net_pnl"], reverse=True)

    # Save to JSON artifact
    out_file = EVAL_DIR / "walk_forward_validation_results.json"
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "wfv_setup": {
            "validation_type": "5-Fold Expanding Window with Purging & Embargo",
            "prediction_horizon_bars": 6,
            "embargo_bars": 2,
            "total_oos_bars": 5 * test_len_per_fold,
            "friction_per_side_pts": 0.15,
            "take_profit_atr_mult": 2.0,
            "stop_loss_atr_mult": 1.0,
            "max_hold_bars": 6,
            "folds": folds_metadata,
        },
        "summary": summary_table
    }

    with open(out_file, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"\nSaved Walk-Forward Validation results to: {out_file}")

    # Print summary table
    print("\n" + "=" * 95)
    print("SUMMARY: 5-FOLD EXPANDING WALK-FORWARD VALIDATION RESULTS")
    print("=" * 95)
    header = f"{'Model Architecture':26s} | {'Cum Net P&L':11s} | {'Win Rate':9s} | {'WR StdDev':9s} | {'Expectancy':10s} | {'Trades':6s} | {'Max DD':8s} | {'Mean PF':7s}"
    print(header)
    print("-" * 95)
    for row in summary_table:
        print(f"{row['model']:26s} | {row['cumulative_net_pnl']:+9.2f} pts | {row['overall_win_rate_pct']:7.1f}% | {row['win_rate_std_dev']:7.2f}% | {row['expectancy_pts_per_trade']:+8.2f} pt | {row['total_trades']:6d} | {row['worst_fold_drawdown_pts']:6.2f} pt | {row['mean_profit_factor']:7.2f}")
    print("=" * 95)


if __name__ == "__main__":
    main()
