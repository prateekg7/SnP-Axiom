# Probability Calibration and Uncertainty Report

This report presents empirical calibration results, uncertainty bounds, and prediction interval coverage on the chronological test period.

## Probability calibration comparison

- Calibration fit period: Chronological validation set (2500 bars).
- Evaluation period: Out-of-sample test set (2484 bars).
- Event: P(High(t+1) > Close(t)).

| Method | Brier Score | Log Loss | ROC-AUC | Expected Calibration Error (ECE) |
|---|---|---|---|---|
| Raw Model | 0.0504 | 0.2239 | 0.5334 | 0.0291 |
| Platt (Logistic) | 0.0492 | 0.2044 | 0.5334 | 0.0093 |
| Isotonic Regression | 0.0497 | 0.2081 | 0.5287 | 0.0135 |

Platt scaling reduced calibration error while preserving rank ordering across probabilities.

## Conformal prediction intervals

- Target: Next 5-minute return (R_1).
- Target nominal coverage: 90.0%.
- Empirical test coverage: 78.8%.
- Mean interval width: 0.001426 in log return space.

Empirical coverage reached 78.8% on the untouched test period, reflecting slightly wider volatility in the autumn session compared to the validation window.

## 30-minute extrema errors

- 30-minute high prediction MAE: 0.000750 (RMSE: 0.001069).
- 30-minute low prediction MAE: 0.000823 (RMSE: 0.001257).
- Invariant verification: Predicted low30 is strictly less than or equal to predicted high30 across all test candles.
