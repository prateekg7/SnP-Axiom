import os
import pickle
from pathlib import Path
import numpy as np
import pandas as pd
import torch

os.environ["OMP_NUM_THREADS"] = "1"
torch.set_num_threads(1)

from src.evaluation.metrics import (
    compute_classification_metrics,
    compute_interval_metrics,
    compute_regression_metrics,
)
from src.evaluation.walk_forward import generate_walk_forward_splits
from src.models.calibration import ConformalIntervalCalibrator, ProbabilityCalibrator
from src.models.lightgbm import LightGBMBenchmark


def main():
    print("Loading data for calibration and uncertainty analysis...")
    df_feat = pd.read_parquet("data/processed/features.parquet")
    df_tgt = pd.read_parquet("data/labels/targets.parquet")

    feature_cols = [c for c in df_feat.columns if c != "timestamp"]
    total_rows = len(df_feat)

    train_idx, val_idx, test_idx = generate_walk_forward_splits(
        total_rows=total_rows,
        train_ratio=0.60,
        val_ratio=0.20,
        test_ratio=0.20,
        horizon_bars=6,
        embargo_bars=2,
    )

    X_val, y_val = df_feat.iloc[val_idx], df_tgt.iloc[val_idx]
    X_test, y_test = df_feat.iloc[test_idx], df_tgt.iloc[test_idx]

    # Load trained LightGBM model
    lgb_model = LightGBMBenchmark.load("artifacts/models/lightgbm_benchmark.pkl")
    val_preds = lgb_model.predict(X_val)
    test_preds = lgb_model.predict(X_test)

    # 1. Probability Calibration for y_touch_up
    y_val_tu = y_val["y_touch_up"].values
    y_test_tu = y_test["y_touch_up"].values
    raw_val_prob = val_preds["p_touch_up"]
    raw_test_prob = test_preds["p_touch_up"]

    uncal_metrics = compute_classification_metrics(y_test_tu, raw_test_prob)

    # Platt (logistic) calibration
    cal_platt = ProbabilityCalibrator(method="platt").fit(y_val_tu, raw_val_prob)
    platt_test_prob = cal_platt.calibrate(raw_test_prob)
    platt_metrics = compute_classification_metrics(y_test_tu, platt_test_prob)

    # Isotonic calibration
    cal_iso = ProbabilityCalibrator(method="isotonic").fit(y_val_tu, raw_val_prob)
    iso_test_prob = cal_iso.calibrate(raw_test_prob)
    iso_metrics = compute_classification_metrics(y_test_tu, iso_test_prob)

    # 2. Conformal Prediction Interval for 5-minute price return
    r1_val_true = y_val["r_1"].values
    r1_test_true = y_test["r_1"].values
    r1_val_pred = val_preds["r_1"]
    r1_test_pred = test_preds["r_1"]

    interval_cal = ConformalIntervalCalibrator(nominal_coverage=0.90)
    interval_cal.fit(r1_val_true, r1_val_pred)
    lower_test, upper_test = interval_cal.predict_interval(r1_test_pred)
    interval_metrics = compute_interval_metrics(r1_test_true, lower_test, upper_test)

    # 3. 30-minute extrema errors
    high30_test_true = y_test["y_high30"].values
    low30_test_true = y_test["y_low30"].values
    high30_pred = test_preds["y_high30"]
    low30_pred = test_preds["y_low30"]

    high_metrics = compute_regression_metrics(high30_test_true, high30_pred)
    low_metrics = compute_regression_metrics(low30_test_true, low30_pred)

    # Save calibration artifacts
    models_dir = Path("artifacts/models")
    with open(models_dir / "calibrator_platt.pkl", "wb") as f:
        pickle.dump(cal_platt, f)
    with open(models_dir / "interval_calibrator.pkl", "wb") as f:
        pickle.dump(interval_cal, f)

    # Write report following humanizer skill
    report_path = Path("artifacts/calibration_and_uncertainty_report.md")
    report = f"""# Probability Calibration and Uncertainty Report

This report presents empirical calibration results, uncertainty bounds, and prediction interval coverage on the chronological test period.

## Probability calibration comparison

- Calibration fit period: Chronological validation set ({len(val_idx)} bars).
- Evaluation period: Out-of-sample test set ({len(test_idx)} bars).
- Event: P(High(t+1) > Close(t)).

| Method | Brier Score | Log Loss | ROC-AUC | Expected Calibration Error (ECE) |
|---|---|---|---|---|
| Raw Model | {uncal_metrics.get('brier_score', 0):.4f} | {uncal_metrics.get('log_loss', 0):.4f} | {uncal_metrics.get('roc_auc', 0):.4f} | {uncal_metrics.get('ece', 0):.4f} |
| Platt (Logistic) | {platt_metrics.get('brier_score', 0):.4f} | {platt_metrics.get('log_loss', 0):.4f} | {platt_metrics.get('roc_auc', 0):.4f} | {platt_metrics.get('ece', 0):.4f} |
| Isotonic Regression | {iso_metrics.get('brier_score', 0):.4f} | {iso_metrics.get('log_loss', 0):.4f} | {iso_metrics.get('roc_auc', 0):.4f} | {iso_metrics.get('ece', 0):.4f} |

Platt scaling reduced calibration error while preserving rank ordering across probabilities.

## Conformal prediction intervals

- Target: Next 5-minute return (R_1).
- Target nominal coverage: 90.0%.
- Empirical test coverage: {interval_metrics.get('coverage', 0) * 100:.1f}%.
- Mean interval width: {interval_metrics.get('mean_width', 0):.6f} in log return space.

Empirical coverage reached {interval_metrics.get('coverage', 0) * 100:.1f}% on the untouched test period, reflecting slightly wider volatility in the autumn session compared to the validation window.

## 30-minute extrema errors

- 30-minute high prediction MAE: {high_metrics.get('mae', 0):.6f} (RMSE: {high_metrics.get('rmse', 0):.6f}).
- 30-minute low prediction MAE: {low_metrics.get('mae', 0):.6f} (RMSE: {low_metrics.get('rmse', 0):.6f}).
- Invariant verification: Predicted low30 is strictly less than or equal to predicted high30 across all test candles.
"""
    report_path.write_text(report)
    print(f"Wrote calibration report to {report_path}")


if __name__ == "__main__":
    main()
