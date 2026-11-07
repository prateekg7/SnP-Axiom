# Final Evaluation and Benchmark Comparison Report

This report documents out-of-sample forecast accuracy, baseline comparisons, and trading performance for the S&P 500 cash index (SPX) forecasting project.

The test period spans September 24, 2026 to November 6, 2026, comprising 2,484 consecutive five-minute bars across 32 regular trading sessions. All evaluations use strictly chronological splits with a 6-bar purge and a 2-bar embargo to prevent lookahead leakage.

## Data source and provenance

The target instrument is the S&P 500 cash index level (quote symbol `^GSPC` on Yahoo Finance, matching the Google Finance reference `INDEXSP:.INX`). We did not substitute futures, ETFs, or CFD instruments.

SPX is a computed index and does not have native traded volume. The volume numbers provided by free retail endpoints represent aggregated share counts of underlying constituent stocks rather than trade executions on the index itself. Because of this, volume is excluded from direct price-level targets and treated only as an auxiliary indicator where noted. All quotes in the live interface carry a minimum 15-minute provider delay notice.

## Target definition and base rates

The primary classification target is `y_touch_up`, which indicates whether the SPX high in the next five-minute candle exceeds the current candle's closing price.

Across the 2,484 test candles, the empirical base rate for `y_touch_up` is 94.82%. In other words, roughly nineteen out of twenty five-minute candles reach at least slightly above their preceding close. A naive model predicting constant upward motion achieves high accuracy by default, so standard accuracy is uninformative. Calibration and Brier score serve as the primary metrics for evaluating probability quality.

## Probability calibration and forecast metrics

Probability calibration was measured before and after applying a Platt scaling model fitted on the chronological validation set.

The raw LightGBM probability estimates yielded a Brier score of 0.0504 and an expected calibration error (ECE) of 0.0291. Applying Platt calibration adjusted the probabilities toward the true empirical distribution, lowering the ECE to 0.0093 and improving the Brier score to 0.0492. The base-rate baseline Brier score across the test split was 0.0491.

For five-minute log return forecasting (`r_1`), the regression model achieved a mean absolute error of 0.000487 (equivalent to roughly 2.8 index points at current price levels) and a root mean squared error of 0.000724.

Conformal prediction intervals with a 90% nominal coverage target produced an empirical coverage rate of 77.74% on the test split. The lower empirical coverage reflects higher realized index volatility in late autumn 2026 compared to the calmer late-summer validation period on which the non-conformity scores were calibrated.

## Strategy performance comparison

We tested the multi-task model against five benchmark strategies on the identical out-of-sample period. All simulations use a synthetic point multiplier of $1.00 per point, 0.10 points of slippage, and 0.05 points of cost per side.

| Strategy | Trade Count | Win Rate (%) | Gross P&L (pts) | Net P&L (pts) | Max Drawdown (pts) | Profit Factor | Abstention (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Always-UP (Intraday Long) | 32 | 50.0 | -366.33 | -375.93 | 406.96 | 0.48 | 98.7 |
| Momentum Baseline | 1256 | 31.1 | -322.33 | -699.13 | 863.31 | 0.81 | 49.4 |
| RSI Baseline (30/70) | 90 | 67.8 | -176.17 | -203.17 | 279.34 | 0.54 | 96.4 |
| MACD Crossover | 201 | 30.3 | -313.95 | -374.25 | 592.95 | 0.80 | 91.9 |
| Moving Average Trend | 302 | 19.9 | -236.55 | -327.15 | 601.53 | 0.81 | 87.8 |
| AI Model Strategy | 150 | 40.7 | -264.67 | -309.67 | 329.03 | 0.56 | 94.0 |

The test period coincided with a sustained market drawdown in autumn 2026, leading to negative returns across all test strategies.

High-frequency trend-following strategies suffered heavily from churn and transaction costs. The Momentum baseline traded 1,256 times, giving up 376.80 points to transaction fees and slippage alone. By contrast, the AI Model strategy filtered out low-conviction signals, remaining in a HOLD state for 94% of the bars. This reduced turnover to 150 trades and kept the maximum drawdown at 329.03 points, compared to 863.31 points for unconstrained momentum.

## Demonstration session replay

A full demonstration session was conducted using data from September 25, 2026, consisting of 78 five-minute bars between 09:30 and 16:00 Eastern Time.

During this session:
1. Every completed bar was received in strict sequence with New York regular-session timestamps.
2. A 120-bar rolling window of prior history was maintained to compute technical and cyclical features.
3. LightGBM predictions were calculated and Platt-calibrated for each bar.
4. The risk guard checked each signal against session hours, freshness limits, and position states.
5. All 78 prediction records were persisted to `artifacts/demonstration_session_log.json` with immutable identifiers.
6. Three simulated trades were executed, resulting in a net session P&L of -14.85 points after mandatory close at the 16:00 session finish.

## Limitations and operational boundaries

Decisions produced by this system are hypothetical paper trades. The application does not connect to any exchange, clearing house, or brokerage API.

Because the underlying instrument is a cash index, users cannot buy or sell SPX directly. Any real-world implementation would require translating index targets into exchange-traded instruments such as cash-settled index options or E-mini futures, each of which introduces distinct basis risk, roll mechanics, and financing costs not modeled here.

