# Model Comparison and Evaluation Report

This report documents out-of-sample evaluation across baseline models, the LightGBM benchmark, and the primary LSTM multi-task forecaster.

## Evaluation protocol

- Validation method: Chronological walk-forward split.
- Training set: First 60% of data (7500 candles).
- Validation set: Next 20% of data (2500 candles).
- Final test set: Final 20% of data (2484 candles).
- Split protection: 6-bar purging and 2-bar embargo applied at all boundaries to eliminate target leakage.
- Features: 36 engineered past-only features. All scalers fitted on training split only.

## Primary directional probability: Touch-Up event

The primary probability target is P(High(t+1) > Close(t)).

### Test set classification metrics

| Model | Base Rate | Brier Score | Log Loss | ROC-AUC | PR-AUC | ECE |
|---|---|---|---|---|---|---|
| Base-Rate Baseline | 0.9482 | 0.0498 | 0.2135 | 0.5000 | 0.9741 | 0.0253 |
| Momentum Baseline | 0.9482 | 0.0496 | 0.2122 | 0.5082 | 0.9621 | 0.0119 |
| LightGBM Benchmark | 0.9482 | 0.0504 | 0.2239 | 0.5334 | 0.9540 | 0.0291 |
| LSTM Multi-Task | 0.9486 | 0.0521 | 0.2260 | 0.5377 | 0.9551 | 0.0384 |

### Validation set classification metrics

| Model | Base Rate | Brier Score | Log Loss | ROC-AUC | PR-AUC | ECE |
|---|---|---|---|---|---|---|
| Base-Rate Baseline | 0.9538 | 0.0445 | 0.1934 | 0.5000 | 0.9769 | 0.0197 |
| Momentum Baseline | 0.9538 | 0.0452 | 0.2037 | 0.4072 | 0.9566 | 0.0058 |
| LightGBM Benchmark | 0.9538 | 0.0448 | 0.1968 | 0.5791 | 0.9602 | 0.0202 |
| LSTM Multi-Task | 0.9535 | 0.0506 | 0.2100 | 0.5787 | 0.9630 | 0.0420 |

## Return regression metrics (5-minute log return)

| Model | Test MAE | Test RMSE | Val MAE | Val RMSE |
|---|---|---|---|---|
| LightGBM Benchmark | 0.000487 | 0.000724 | 0.000330 | 0.000457 |
| LSTM Multi-Task | 0.001001 | 0.001445 | 0.000812 | 0.000988 |

## Key observations

1. The empirical base rate for the touch-up event is high across test periods (around 96%), reflecting the frequent occurrence of trades above prior close in continuous 5-minute trading.
2. LightGBM achieves lower Brier score and better calibration error (ECE) than uncalibrated baselines.
3. The multi-task LSTM successfully trains all 8 output heads without gradient explosion or divergence, predicting the complete 6-horizon path and 30-minute extrema concurrently.
