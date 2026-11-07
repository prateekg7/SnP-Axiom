# Implementation Tasks and Delivery Plan

This is an implementation roadmap, not an enterprise QA plan. Prioritize a working, understandable research-to-dashboard pipeline. Do not spend disproportionate time on elaborate smoke-test infrastructure.

---

## Phase 0 — Project setup and data feasibility

### 0.1 Repository setup
- [x] Create the repository structure in `architecture.md`.
- [x] Add README, configuration, environment template and dependency file.
- [x] Keep API keys out of source control.
- [x] Decide local Python environment and frontend package manager.

### 0.2 Provider investigation — perform sequentially
- [x] Trial LSE first.
- [x] Confirm exact SPX symbol identity.
- [x] Retrieve sample 5-minute candles.
- [x] Inspect earliest available 5-minute history.
- [x] Inspect live WebSocket for this exact symbol.
- [x] Verify source timestamp, delay and update cadence.
- [x] Verify free-tier quotas and data redistribution terms.
- [x] If LSE fails identity/history checks, trial free GetData GitHub sample.
- [x] Trial Yahoo Finance `^GSPC` as a short-history comparison only.
- [x] Record each provider result in `data/provider_trials.md`.
- [x] Do not combine incompatible sources without a documented comparison.

**Deliverable:** Provider trial report and one chosen canonical SPX dataset.

### 0.3 Dataset audit
- [x] Save immutable raw download.
- [x] Normalize column names and timezone.
- [x] Establish session calendar and five-minute bar semantics.
- [x] Count rows, sessions, gaps, duplicates and missing values.
- [x] Check OHLC invariants and outliers.
- [x] Check whether volume is actual, tick volume, proxy or unavailable.
- [x] Compare overlapping prices with an independent reference.
- [x] Produce coverage report by year/month/session.
- [x] Establish as-of-date training cutoff logic and label maturity rules.

**Deliverable:** Clean canonical Parquet dataset plus a concise audit report.

---

## Phase 1 — Targets and feature pipeline

- [x] Implement next-five-minute touch-up target: `next_high > current_close`.
- [x] Implement next-five-minute close-up diagnostic.
- [x] Implement next-five-minute close return.
- [x] Implement six-horizon future close/return targets.
- [x] Implement next-30-minute maximum high and minimum low.
- [x] Implement same-session end-of-day close target.
- [x] Implement next-30-minute realized-volatility target.
- [x] Ensure all labels are forward-looking only and are not used before maturity.
- [x] Implement price/return/candle features.
- [x] Add technical-strategy features (EMA, RSI, MACD, ATR, Bollinger, breakout).
- [x] Add session/time-of-day features.
- [x] Keep external proxy features out until separately validated.
- [x] Save feature schema/version.

**Deliverable:** Reproducible feature and label dataset.

---

## Phase 2 — Baselines and primary models

- [x] Implement base-rate/always-UP probability baseline.
- [x] Implement previous-direction/momentum baseline.
- [x] Implement RSI strategy baseline.
- [x] Implement MACD crossover baseline.
- [x] Implement moving-average trend baseline.
- [x] Train LightGBM tabular benchmark.
- [x] Train LSTM multi-task primary model.
- [x] Compare multiple sequence-window lengths and modest model sizes.
- [x] Use chronological walk-forward validation.
- [x] Purge/embargo overlapping target windows at split boundaries.
- [x] Save model, scaler, feature schema and training cutoff.
- [x] Record classification, regression, extrema and volatility metrics.

**Deliverable:** Model comparison report. Do not add Jev until there are credible out-of-sample forecasts.

---

## Phase 3 — Calibration and uncertainty

- [x] Evaluate probability calibration.
- [x] Compare raw probabilities with Platt/logistic and isotonic calibration.
- [x] Evaluate Brier score, log loss, ROC-AUC, PR-AUC and reliability diagrams.
- [x] Generate prediction intervals for future price.
- [x] Measure nominal versus empirical interval coverage.
- [x] Evaluate 30-minute high/low errors.
- [x] Evaluate performance by time-of-day and volatility regime.
- [x] Keep final test period untouched.

**Deliverable:** Calibrated forecast package and uncertainty report.

---

## Phase 4 — Jev decision layer

- [x] Read current TypeSafe Jev documentation and confirm access.
- [x] Confirm supported input/output interface, latency, rate limits, availability and pricing.
- [x] Design the Jev context payload using point-in-time model forecasts and trading state.
- [x] Implement the decision-provider interface.
- [x] Implement Jev adapter against verified contract only.
- [x] Implement safe HOLD fallback.
- [x] Validate all returned actions and reject invalid/late responses.
- [x] Add deterministic risk guard.
- [x] Compare Jev decisions against a conventional meta-classifier and simple threshold policy.
- [x] Record decisions and reason/status codes.

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
