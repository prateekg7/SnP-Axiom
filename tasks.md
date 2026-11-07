# Implementation Tasks and Delivery Plan

This is an implementation roadmap, not an enterprise QA plan. Prioritize a working, understandable research-to-dashboard pipeline. Do not spend disproportionate time on elaborate smoke-test infrastructure.

---

## Phase 0 — Project setup and data feasibility

### 0.1 Repository setup
- [ ] Create the repository structure in `architecture.md`.
- [ ] Add README, configuration, environment template and dependency file.
- [ ] Keep API keys out of source control.
- [ ] Decide local Python environment and frontend package manager.

### 0.2 Provider investigation — perform sequentially
- [ ] Trial LSE first.
- [ ] Confirm exact SPX symbol identity.
- [ ] Retrieve sample 5-minute candles.
- [ ] Inspect earliest available 5-minute history.
- [ ] Inspect live WebSocket for this exact symbol.
- [ ] Verify source timestamp, delay and update cadence.
- [ ] Verify free-tier quotas and data redistribution terms.
- [ ] If LSE fails identity/history checks, trial free GetData GitHub sample.
- [ ] Trial Yahoo Finance `^GSPC` as a short-history comparison only.
- [ ] Record each provider result in `data/provider_trials.md`.
- [ ] Do not combine incompatible sources without a documented comparison.

**Deliverable:** Provider trial report and one chosen canonical SPX dataset.

### 0.3 Dataset audit
- [ ] Save immutable raw download.
- [ ] Normalize column names and timezone.
- [ ] Establish session calendar and five-minute bar semantics.
- [ ] Count rows, sessions, gaps, duplicates and missing values.
- [ ] Check OHLC invariants and outliers.
- [ ] Check whether volume is actual, tick volume, proxy or unavailable.
- [ ] Compare overlapping prices with an independent reference.
- [ ] Produce coverage report by year/month/session.
- [ ] Establish as-of-date training cutoff logic and label maturity rules.

**Deliverable:** Clean canonical Parquet dataset plus a concise audit report.

---

## Phase 1 — Targets and feature pipeline

- [ ] Implement next-five-minute touch-up target: `next_high > current_close`.
- [ ] Implement next-five-minute close-up diagnostic.
- [ ] Implement next-five-minute close return.
- [ ] Implement six-horizon future close/return targets.
- [ ] Implement next-30-minute maximum high and minimum low.
- [ ] Implement same-session end-of-day close target.
- [ ] Implement next-30-minute realized-volatility target.
- [ ] Ensure all labels are forward-looking only and are not used before maturity.
- [ ] Implement price/return/candle features.
- [ ] Add technical-strategy features (EMA, RSI, MACD, ATR, Bollinger, breakout).
- [ ] Add session/time-of-day features.
- [ ] Keep external proxy features out until separately validated.
- [ ] Save feature schema/version.

**Deliverable:** Reproducible feature and label dataset.

---

## Phase 2 — Baselines and primary models

- [ ] Implement base-rate/always-UP probability baseline.
- [ ] Implement previous-direction/momentum baseline.
- [ ] Implement RSI strategy baseline.
- [ ] Implement MACD crossover baseline.
- [ ] Implement moving-average trend baseline.
- [ ] Train LightGBM tabular benchmark.
- [ ] Train LSTM multi-task primary model.
- [ ] Compare multiple sequence-window lengths and modest model sizes.
- [ ] Use chronological walk-forward validation.
- [ ] Purge/embargo overlapping target windows at split boundaries.
- [ ] Save model, scaler, feature schema and training cutoff.
- [ ] Record classification, regression, extrema and volatility metrics.

**Deliverable:** Model comparison report. Do not add Jev until there are credible out-of-sample forecasts.

---

## Phase 3 — Calibration and uncertainty

- [ ] Evaluate probability calibration.
- [ ] Compare raw probabilities with Platt/logistic and isotonic calibration.
- [ ] Evaluate Brier score, log loss, ROC-AUC, PR-AUC and reliability diagrams.
- [ ] Generate prediction intervals for future price.
- [ ] Measure nominal versus empirical interval coverage.
- [ ] Evaluate 30-minute high/low errors.
- [ ] Evaluate performance by time-of-day and volatility regime.
- [ ] Keep final test period untouched.

**Deliverable:** Calibrated forecast package and uncertainty report.

---

## Phase 4 — Jev decision layer

- [ ] Read current TypeSafe Jev documentation and confirm access.
- [ ] Confirm supported input/output interface, latency, rate limits, availability and pricing.
- [ ] Design the Jev context payload using point-in-time model forecasts and trading state.
- [ ] Implement the decision-provider interface.
- [ ] Implement Jev adapter against verified contract only.
- [ ] Implement safe HOLD fallback.
- [ ] Validate all returned actions and reject invalid/late responses.
- [ ] Add deterministic risk guard.
- [ ] Compare Jev decisions against a conventional meta-classifier and simple threshold policy.
- [ ] Record decisions and reason/status codes.

**Deliverable:** Hidden decision layer with fallback and comparative evaluation.

---

## Phase 5 — Hypothetical trading and P&L

- [ ] Define configurable synthetic SPX point value/notional.
- [ ] Define long/short/hold state transitions.
- [ ] Define entry, exit, reversal, cooldown and end-of-day rules.
- [ ] Define conservative fill timing.
- [ ] Add configurable costs/slippage.
- [ ] Calculate gross and net P&L.
- [ ] Store all positions, fills and realized outcomes.
- [ ] Prevent duplicate trade actions for one forecast.
- [ ] Evaluate trade performance against baseline strategies.
- [ ] Include sensitivity analysis for costs and thresholds.

**Deliverable:** Reproducible paper-trading ledger and performance summary.

---

## Phase 6 — Backend and frontend

- [ ] Build FastAPI market-data endpoints.
- [ ] Build completed-candle forecast scheduler.
- [ ] Build live-price WebSocket/polling adapter according to provider capability.
- [ ] Expose freshness and provider timestamp.
- [ ] Build forecast-history and trade-log endpoints.
- [ ] Build React dashboard.
- [ ] Display price chart and forecast path.
- [ ] Display predicted 30-minute high/low.
- [ ] Display next-five-minute UP probability and expected price.
- [ ] Display EOD expected close, interval, volatility and regime.
- [ ] Display LONG/SHORT/HOLD action.
- [ ] Display prediction log and trade/P&L history.
- [ ] Ensure completed-candle forecast records are immutable.

**Deliverable:** Working local web application.

---

## Phase 7 — Final evaluation and demonstration

- [ ] Run a chronological out-of-sample backtest.
- [ ] Compare with always-UP, momentum, RSI, MACD and moving-average baselines.
- [ ] Report probability quality, forecast errors and interval coverage.
- [ ] Report hypothetical net P&L and drawdown under explicit assumptions.
- [ ] Run one full live/delayed-feed demonstration day.
- [ ] Clearly label provider delay and data limitations.
- [ ] Freeze model and configuration for the demonstration.
- [ ] Prepare a concise user guide and results report.

**Deliverable:** Reproducible project, model artifacts, working dashboard and evaluation report.

---

## Definition of done

The first complete version is done when:
- SPX data source and its limitations are documented;
- model predicts the specified next-five-minute and next-30-minute targets;
- every completed candle creates one immutable forecast;
- Jev or safe fallback generates a valid action;
- hypothetical long/short trades are logged;
- forecasts are resolved against actual prices;
- P&L is reproducible;
- baseline comparisons use the same data and timestamps.
