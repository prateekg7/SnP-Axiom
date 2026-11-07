# SPX AI Trading Indicator — Agent Handoff

This repository handoff defines an AI-assisted, paper-trading dashboard for the **S&P 500 cash index (SPX)**.

## Read these first

1. [`prd.md`](prd.md) — product goals, users, UI and requirements.
2. [`spec.md`](spec.md) — exact prediction targets, labels, metrics and data contracts.
3. [`architecture.md`](architecture.md) — primary architecture to implement.
4. [`tasks.md`](tasks.md) — implementation order and deliverables.
5. [`backup.md`](backup.md) — alternative modelling approaches and fallback plans.

## Important decisions already made

- Instrument: S&P 500 index level (SPX), not SPY or ES futures.
- Candle interval: 5 minutes.
- New forecast/decision cycle: after each completed 5-minute candle.
- Forecast window: next 30 minutes (six 5-minute bars).
- Next-bar directional event: probability that the next 5-minute bar trades above the current reference price (`next_high > current_close`).
- Also retain next-bar close-up probability as a separate diagnostic.
- Price forecasts: next 5-minute expected price; six-step 30-minute trajectory; 30-minute maximum-high and minimum-low estimates; end-of-session expected close.
- Trading: hypothetical only, long and short supported, no broker execution.
- Decision layer: Jev is a hidden backend component above the forecasting model(s). The frontend must not expose Jev branding or implementation details.
- UI: live/current SPX price where the chosen provider permits it, 5-minute forecast updates, predicted upper/lower levels and projected path, probability, expected price, volatility, market regime, prediction interval, trade log and hypothetical P&L.
- Data budget: free sources preferred/required for the initial implementation. Do not silently substitute SPY or futures for SPX.
- Do not claim that a delayed feed is real-time.

## Status and source-of-truth rule

This package is a specification, not evidence that any provider has been successfully connected. Provider claims must be rechecked against current documentation and the actual account/key. In particular, **LSE `SPX.IDX` identity, five-minute historical depth, WebSocket freshness, free-tier limits and redistribution rights remain validation items**.

If a requirement is ambiguous, preserve the decision already recorded here and raise a focused question rather than inventing a new product direction.
