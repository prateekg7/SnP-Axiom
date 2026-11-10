# Probability Calibration and Uncertainty Report

This report presents empirical calibration results, uncertainty bounds, and prediction interval coverage on the chronological test period.

## Probability calibration comparison

- Calibration fit period: Chronological validation set (14536 bars).
- Evaluation period: Out-of-sample test set (14521 bars).
- Event: P(High(t+1) > Close(t)).

| Method | Brier Score | Log Loss | ROC-AUC | Expected Calibration Error (ECE) |
|---|---|---|---|---|
| Raw Model | 0.0518 | 0.2127 | 0.5413 | 0.0009 |
| Platt (Logistic) | 0.0517 | 0.2119 | 0.5413 | 0.0004 |
| Isotonic Regression | 0.0518 | 0.2183 | 0.5369 | 0.0003 |

Platt scaling reduced calibration error while preserving rank ordering across probabilities.

## Conformal prediction intervals

- Target: Next 5-minute return (R_1).
- Target nominal coverage: 90.0%.
- Empirical test coverage: 88.1%.
- Mean interval width: 0.002043 in log return space.

Empirical coverage reached 88.1% on the untouched test period, reflecting slightly wider volatility in the autumn session compared to the validation window.

## 30-minute extrema errors

- 30-minute high prediction MAE: 0.000751 (RMSE: 0.001103).
- 30-minute low prediction MAE: 0.000834 (RMSE: 0.001194).
- Invariant verification: Predicted low30 is strictly less than or equal to predicted high30 across all test candles.
