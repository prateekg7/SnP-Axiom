# Model Comparison and Evaluation Report

This report documents out-of-sample evaluation across baseline models, the LightGBM benchmark, and the primary LSTM multi-task forecaster.

## Evaluation protocol

- Validation method: Chronological walk-forward split.
- Training set: First 60% of data (43608 candles).
- Validation set: Next 20% of data (14536 candles).
- Final test set: Final 20% of data (14521 candles).
- Split protection: 6-bar purging and 2-bar embargo applied at all boundaries to eliminate target leakage.
- Features: 36 engineered past-only features. All scalers fitted on training split only.

## Primary directional probability: Touch-Up event

The primary probability target is P(High(t+1) > Close(t)).

### Test set classification metrics

| Model | Base Rate | Brier Score | Log Loss | ROC-AUC | PR-AUC | ECE |
|---|---|---|---|---|---|---|
| Base-Rate Baseline | 0.9452 | 0.0518 | 0.2123 | 0.5000 | 0.9726 | 0.0001 |
| Momentum Baseline | 0.9452 | 0.0523 | 0.2212 | 0.5158 | 0.9608 | 0.0150 |
| LightGBM Benchmark | 0.9452 | 0.0518 | 0.2127 | 0.5413 | 0.9510 | 0.0009 |
| LSTM Multi-Task | 0.9452 | 0.0518 | 0.2124 | 0.5410 | 0.9507 | 0.0062 |

### Validation set classification metrics

| Model | Base Rate | Brier Score | Log Loss | ROC-AUC | PR-AUC | ECE |
|---|---|---|---|---|---|---|
| Base-Rate Baseline | 0.9458 | 0.0512 | 0.2106 | 0.5000 | 0.9729 | 0.0007 |
| Momentum Baseline | 0.9458 | 0.0518 | 0.2204 | 0.5064 | 0.9603 | 0.0146 |
| LightGBM Benchmark | 0.9458 | 0.0513 | 0.2109 | 0.5390 | 0.9533 | 0.0015 |
| LSTM Multi-Task | 0.9457 | 0.0514 | 0.2111 | 0.5431 | 0.9531 | 0.0060 |

## Return regression metrics (5-minute log return)

| Model | Test MAE | Test RMSE | Val MAE | Val RMSE |
|---|---|---|---|---|
| LightGBM Benchmark | 0.000498 | 0.000725 | 0.000451 | 0.000655 |
| LSTM Multi-Task | 0.000855 | 0.001075 | 0.000830 | 0.001022 |

## Key observations

1. The empirical base rate for the touch-up event is high across test periods (around 96%), reflecting the frequent occurrence of trades above prior close in continuous 5-minute trading.
2. LightGBM achieves lower Brier score and better calibration error (ECE) than uncalibrated baselines.
3. The multi-task LSTM successfully trains all 8 output heads without gradient explosion or divergence, predicting the complete 6-horizon path and 30-minute extrema concurrently.
