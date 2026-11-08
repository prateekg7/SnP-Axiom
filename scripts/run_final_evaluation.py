import json
import os
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence
import numpy as np
import pandas as pd

# OpenMP single-threaded configuration to avoid conflict between torch and lightgbm
os.environ["OMP_NUM_THREADS"] = "1"

from src.data.sessions import to_new_york
from src.decision.base import Action, DecisionContext, RiskGuard
from src.decision.safe_hold import SafeHoldDecisionProvider
from src.evaluation.metrics import (
    compute_classification_metrics,
    compute_regression_metrics,
)
from src.evaluation.walk_forward import generate_walk_forward_splits
from src.features.pipeline import FeaturePipeline
from src.models.calibration import ConformalIntervalCalibrator, ProbabilityCalibrator
from src.models.lightgbm import LightGBMBenchmark
from src.trading.paper_engine import PaperTradingEngine


def run_strategy_backtest(
    actions: Sequence[str],
    timestamps: pd.Series,
    prices: pd.Series,
    cost_per_side: float = 0.05,
    slippage: float = 0.10,
) -> PaperTradingEngine:
    engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=cost_per_side,
        slippage_points=slippage,
    )
    n = len(actions)
    for i in range(n):
        f_id = f"fc_{timestamps.iloc[i].strftime('%Y%m%d%H%M')}"
        engine.process_decision(
            forecast_id=f_id,
            timestamp=timestamps.iloc[i],
            action=actions[i],
            fill_price=prices.iloc[i],
        )
    return engine


def summarize_engine(engine: PaperTradingEngine, total_bars: int) -> Dict[str, Any]:
    summary = engine.get_performance_summary()
    n_trades = summary.total_trades
    wins = [t.net_pnl for t in engine.trades if t.net_pnl > 0]
    losses = [abs(t.net_pnl) for t in engine.trades if t.net_pnl < 0]
    avg_win = float(np.mean(wins)) if wins else 0.0
    avg_loss = float(np.mean(losses)) if losses else 0.0

    abstention_rate = ((total_bars - n_trades) / total_bars * 100.0) if total_bars > 0 else 0.0

    return {
        "total_trades": summary.total_trades,
        "win_rate_pct": round(summary.win_rate * 100.0, 1),
        "gross_pnl": round(summary.gross_pnl, 2),
        "net_pnl": round(summary.net_pnl, 2),
        "profit_factor": round(summary.profit_factor, 2) if summary.profit_factor != float("inf") else 999.0,
        "max_drawdown": round(summary.max_drawdown, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "abstention_rate_pct": round(abstention_rate, 1),
    }


def main():
    print("=== Running Out-of-Sample Evaluation & Benchmark Comparison ===")
    df_feat = pd.read_parquet("data/processed/features.parquet")
    df_tgt = pd.read_parquet("data/labels/targets.parquet")
    df_raw = pd.read_parquet("data/processed/spx_5m_canonical.parquet")

    total_rows = len(df_feat)
    _, _, test_idx = generate_walk_forward_splits(
        total_rows=total_rows,
        train_ratio=0.60,
        val_ratio=0.20,
        test_ratio=0.20,
        horizon_bars=6,
        embargo_bars=2,
    )

    X_test = df_feat.iloc[test_idx].reset_index(drop=True)
    y_test = df_tgt.iloc[test_idx].reset_index(drop=True)
    raw_test = df_raw.iloc[test_idx].reset_index(drop=True)

    timestamps = raw_test["timestamp"]
    prices = raw_test["close"]
    n_test = len(X_test)
    print(f"Test period: {timestamps.iloc[0]} to {timestamps.iloc[-1]} ({n_test} 5-minute candles)")

    # Load model and calibrators
    lgb_model = LightGBMBenchmark.load("artifacts/models/lightgbm_benchmark.pkl")
    with open("artifacts/models/calibrator_platt.pkl", "rb") as f:
        platt_cal: ProbabilityCalibrator = pickle.load(f)
    with open("artifacts/models/interval_calibrator.pkl", "rb") as f:
        interval_cal: ConformalIntervalCalibrator = pickle.load(f)

    # 1. Evaluate Model Forecasts
    preds = lgb_model.predict(X_test)
    y_true_touch = y_test["y_touch_up"].values
    raw_p_touch = preds["p_touch_up"]
    cal_p_touch = platt_cal.calibrate(raw_p_touch)

    base_prob = float(np.nanmean(y_true_touch))
    m_base = compute_classification_metrics(y_true_touch, np.full_like(raw_p_touch, base_prob))
    m_raw = compute_classification_metrics(y_true_touch, raw_p_touch)
    m_cal = compute_classification_metrics(y_true_touch, cal_p_touch)

    brier_base = m_base["brier_score"]
    brier_raw = m_raw["brier_score"]
    brier_cal = m_cal["brier_score"]
    ece_raw = m_raw["ece"]
    ece_cal = m_cal["ece"]

    # Return error metrics
    r1_true = y_test["r_1"].values
    r1_pred = preds["r_1"]
    m_reg = compute_regression_metrics(r1_true, r1_pred)
    mae_r1 = m_reg["mae"]
    rmse_r1 = m_reg["rmse"]

    # Conformal interval coverage
    q = interval_cal.q_error
    lower_bounds = r1_pred - q
    upper_bounds = r1_pred + q
    cov_mask = (r1_true >= lower_bounds) & (r1_true <= upper_bounds)
    empirical_cov = float(np.mean(cov_mask))

    print(f"Touch-UP Base Rate: {base_prob:.4f}")
    print(f"Brier Scores: Base={brier_base:.4f}, Raw={brier_raw:.4f}, Calibrated={brier_cal:.4f}")
    print(f"ECE: Raw={ece_raw:.4f}, Calibrated={ece_cal:.4f}")
    print(f"Return MAE={mae_r1:.6f}, RMSE={rmse_r1:.6f}")
    print(f"90% Conformal Empirical Coverage: {empirical_cov:.4f}")

    # 2. Strategy Actions
    # Always-UP Intraday: Enter LONG at session open, exit at session close (15:55 bar)
    act_always_up = np.full(n_test, "HOLD", dtype=object)
    raw_test["time_ny"] = [to_new_york(pd.to_datetime(t).to_pydatetime()).strftime("%H:%M") for t in timestamps]
    for i in range(n_test):
        t_ny = raw_test["time_ny"].iloc[i]
        if t_ny == "15:55":
            act_always_up[i] = "HOLD"
        else:
            act_always_up[i] = "LONG"

    # Momentum
    act_momentum = np.where(X_test["log_ret_1"] > 0, "LONG", "SHORT")

    # RSI (30 / 70)
    rsi_vals = X_test["rsi_14"].values
    act_rsi = np.full(n_test, "HOLD", dtype=object)
    act_rsi[rsi_vals < 0.30] = "LONG"
    act_rsi[rsi_vals > 0.70] = "SHORT"

    # MACD Crossover
    act_macd = np.where(X_test["macd_diff"].values > 0, "LONG", "SHORT")

    # Moving Average Trend
    act_ma = np.where(X_test["ema_21_dist"].values > 0, "LONG", "SHORT")

    # AI Model Strategy
    act_model = np.full(n_test, "HOLD", dtype=object)
    act_model[(r1_pred > 0.0001) & (cal_p_touch > 0.95)] = "LONG"
    act_model[r1_pred < -0.0001] = "SHORT"

    # Coupled AI + Technical (RSI & Bollinger Filter)
    from src.models.quant_analytics import coupled_ai_technical_decision
    act_coupled = np.full(n_test, "HOLD", dtype=object)
    rsi_vals = X_test["rsi_14"].values
    bb_vals = X_test["bb_pband"].values
    for i in range(n_test):
        t_ny = raw_test["time_ny"].iloc[i]
        if t_ny == "15:55":
            act_coupled[i] = "HOLD"
            continue
        c_act, _ = coupled_ai_technical_decision(
            expected_return_5m=float(r1_pred[i]),
            calibrated_p_touch=float(cal_p_touch[i]),
            rsi_14=float(rsi_vals[i]),
            bb_pband=float(bb_vals[i]),
        )
        act_coupled[i] = c_act

    # Open-Jev Decision Strategy
    print("Evaluating Open-Jev Decision Layer over test split...")
    from src.decision.jev import OpenJevDecisionProvider
    open_jev_provider = OpenJevDecisionProvider(seed=42)
    act_open_jev = np.full(n_test, "HOLD", dtype=object)
    for i in range(n_test):
        t_ny = raw_test["time_ny"].iloc[i]
        if t_ny == "15:55":
            act_open_jev[i] = "HOLD"
            continue
        p_ref = float(prices.iloc[i])
        r1_v = float(r1_pred[i])
        p_touch = float(cal_p_touch[i])
        pred_h = float(p_ref * np.exp(float(preds["y_high30"][i])))
        pred_l = float(p_ref * np.exp(float(preds["y_low30"][i])))
        ctx = DecisionContext(
            as_of=timestamps.iloc[i],
            reference_price=p_ref,
            p_touch_up=p_touch,
            p_close_up=0.5,
            expected_price_5m=float(p_ref * np.exp(r1_v)),
            predicted_high_30m=pred_h,
            predicted_low_30m=pred_l,
            volatility_30m=float(preds["rv_30"][i]),
            market_regime="trending_up" if r1_v > 0.0002 else ("trending_down" if r1_v < -0.0002 else "mean_reverting"),
            prediction_interval={"nominal_coverage": 0.90, "lower": p_ref * np.exp(r1_v - q), "upper": p_ref * np.exp(r1_v + q), "empirical_coverage": empirical_cov},
        )
        dec = open_jev_provider.decide(ctx, forecast_id=f"test_{i}")
        act_open_jev[i] = dec.action.value

    # Run simulations
    strategies = {
        "Always-UP Baseline": act_always_up,
        "Momentum Baseline": act_momentum,
        "RSI Baseline": act_rsi,
        "MACD Baseline": act_macd,
        "MA Trend Baseline": act_ma,
        "AI Model Strategy": act_model,
        "Coupled AI + RSI/BB Strategy": act_coupled,
        "Open-Jev Strategy": act_open_jev,
    }

    results = {}
    for name, acts in strategies.items():
        eng = run_strategy_backtest(acts, timestamps, prices, cost_per_side=0.05, slippage=0.10)
        results[name] = summarize_engine(eng, n_test)

    # Print summary table
    print("\n=== Strategy Comparison (Test Split, Costs & Slippage Included) ===")
    print(f"{'Strategy':<22} | {'Trades':<6} | {'Win %':<6} | {'Gross P&L':<10} | {'Net P&L':<10} | {'Max DD':<8} | {'PF':<5}")
    print("-" * 75)
    for name, r in results.items():
        print(f"{name:<22} | {r['total_trades']:<6} | {r['win_rate_pct']:<6.1f} | {r['gross_pnl']:<10.2f} | {r['net_pnl']:<10.2f} | {r['max_drawdown']:<8.2f} | {r['profit_factor']:<5.2f}")

    # 3. Simulate Full Demonstration Day
    print("\n=== Running Live Feed Demonstration Day ===")
    # Pick a complete regular trading day from test period
    raw_test["date"] = pd.to_datetime(raw_test["timestamp"]).dt.date
    dates = raw_test["date"].unique()
    # Choose a day with 78 bars
    demo_date = None
    for d in dates:
        cnt = len(raw_test[raw_test["date"] == d])
        if cnt >= 70:
            demo_date = d
            break
    if demo_date is None:
        demo_date = dates[0]

    demo_indices = raw_test[raw_test["date"] == demo_date].index
    demo_df = raw_test.loc[demo_indices].copy().reset_index(drop=True)
    print(f"Selected demonstration session: {demo_date} ({len(demo_df)} candles)")

    demo_records = []
    demo_engine = PaperTradingEngine(synthetic_point_value=1.0, cost_per_side_points=0.05, slippage_points=0.10)
    risk_guard = RiskGuard(reject_stale=True, reject_invalid=True)
    fallback = SafeHoldDecisionProvider()
    pipe = FeaturePipeline()

    for pos, idx in enumerate(demo_indices):
        abs_raw_idx = test_idx[idx]
        sub_raw = df_raw.iloc[: (abs_raw_idx + 1)].copy()
        current_candle = raw_test.iloc[idx]
        ts = pd.to_datetime(current_candle["timestamp"]).to_pydatetime()
        ny_dt = to_new_york(ts)
        close_p = float(current_candle["close"])

        # Compute features
        feats = pipe.compute_features(sub_raw.tail(120).copy())
        last_f = feats.iloc[[-1]]
        m_preds = lgb_model.predict(last_f)

        raw_p = float(m_preds["p_touch_up"][0])
        cal_p = float(platt_cal.calibrate(np.array([raw_p]))[0])
        r1_val = float(m_preds["r_1"][0])
        exp_price = float(close_p * np.exp(r1_val))
        pred_h = float(close_p * np.exp(float(m_preds["y_high30"][0])))
        pred_l = float(close_p * np.exp(float(m_preds["y_low30"][0])))

        # Decision
        ctx = DecisionContext(
            as_of=ts,
            reference_price=close_p,
            p_touch_up=cal_p,
            p_close_up=0.5,
            expected_price_5m=exp_price,
            predicted_high_30m=pred_h,
            predicted_low_30m=pred_l,
            volatility_30m=float(m_preds["rv_30"][0]),
            market_regime="trending_up" if r1_val > 0.0002 else ("trending_down" if r1_val < -0.0002 else "mean_reverting"),
            prediction_interval={"nominal_coverage": 0.90, "lower": close_p * np.exp(r1_val - q), "upper": close_p * np.exp(r1_val + q)},
        )
        f_id = f"demo_{ts.strftime('%Y%m%d%H%M')}"
        raw_dec = open_jev_provider.decide(ctx, f_id)
        checked_dec = risk_guard.validate(raw_dec, ctx)
        action_chosen = checked_dec.action.value
        reason_code = checked_dec.reason_code

        # On last candle of the day, force close
        if pos == len(demo_indices) - 1:
            action_chosen = "HOLD"
            reason_code = "SESSION_EOD_CLOSE"

        demo_engine.process_decision(f_id, ts, action_chosen, close_p)

        demo_records.append({
            "step": pos + 1,
            "timestamp_utc": ts.isoformat(),
            "timestamp_ny": ny_dt.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "price": close_p,
            "p_touch_up_calibrated": round(cal_p, 4),
            "expected_price_5m": round(exp_price, 2),
            "action": action_chosen,
            "reason": reason_code,
        })

    demo_summary = demo_engine.get_performance_summary()
    print(f"Demonstration day finished: {len(demo_records)} steps logged, {demo_summary.total_trades} trades executed.")
    print(f"Session Gross P&L: {demo_summary.gross_pnl:.2f} pts, Net P&L: {demo_summary.net_pnl:.2f} pts")

    demo_summary_dict = {
        "total_trades": demo_summary.total_trades,
        "winning_trades": demo_summary.winning_trades,
        "losing_trades": demo_summary.losing_trades,
        "win_rate_pct": round(demo_summary.win_rate * 100.0, 1),
        "gross_pnl_pts": round(demo_summary.gross_pnl, 2),
        "net_pnl_pts": round(demo_summary.net_pnl, 2),
        "profit_factor": round(demo_summary.profit_factor, 2) if demo_summary.profit_factor != float("inf") else 999.0,
        "max_drawdown_pts": round(demo_summary.max_drawdown, 2),
    }

    # Save demonstration artifact
    with open("artifacts/demonstration_session_log.json", "w") as f:
        json.dump(
            {
                "session_date": str(demo_date),
                "total_steps": len(demo_records),
                "performance": demo_summary_dict,
                "records": demo_records,
            },
            f,
            indent=2,
        )

    # Save benchmark evaluation stats
    eval_stats = {
        "test_period": {
            "start": str(timestamps.iloc[0]),
            "end": str(timestamps.iloc[-1]),
            "n_bars": n_test,
        },
        "forecast_metrics": {
            "base_rate_brier": round(brier_base, 4),
            "raw_brier": round(brier_raw, 4),
            "calibrated_brier": round(brier_cal, 4),
            "raw_ece": round(ece_raw, 4),
            "calibrated_ece": round(ece_cal, 4),
            "return_mae": round(mae_r1, 6),
            "return_rmse": round(rmse_r1, 6),
            "conformal_empirical_coverage": round(empirical_cov, 4),
        },
        "strategy_results": results,
    }
    with open("artifacts/final_evaluation_stats.json", "w") as f:
        json.dump(eval_stats, f, indent=2)

    print("Final evaluation metrics and demonstration session saved.")


if __name__ == "__main__":
    main()
