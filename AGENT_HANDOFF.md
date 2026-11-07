# Instructions for the Coding Agent

You are implementing the SPX AI Trading Indicator defined in this repository.

## Mandatory reading order
1. README.md
2. prd.md
3. spec.md
4. architecture.md
5. tasks.md
6. backup.md
7. data/README.md

## Non-negotiable constraints
- Target instrument is the S&P 500 cash index (SPX).
- Do not silently substitute SPY, ES futures, a CFD or another proxy.
- The main model is the LSTM multi-task forecaster described in architecture.md.
- LightGBM is the benchmark and fallback candidate.
- Jev is a hidden decision layer above the forecasting model; do not put Jev in the frontend.
- Do not invent Jev endpoints, SDK methods or response schemas. Verify its actual interface first.
- Decisions are hypothetical only. No broker integration or real orders.
- Support LONG, SHORT and HOLD.
- Generate a forecast after each completed five-minute candle.
- Forecast next 30 minutes as six five-minute bars.
- Primary probability is `P(next five-minute high > current completed close)`.
- Also record `P(next five-minute close > current completed close)` as a diagnostic.
- Store immutable forecast records and resolve them later against actual data.
- No future leakage, random time-series splits or labels used before maturity.
- Clearly label delayed/stale data.
- Do not claim a prediction interval is calibrated until coverage has been measured.
- SPX itself has no directly traded volume; never invent SPX volume.
- Commit regularly. No commit should exceed 1000 lines of code (LOC).
- While writing any doc file, readme, or log file, read and follow the humanizer skill (`/Users/prateekgupta/.agents/skills/humanizer/SKILL.md`).

## Working style
- Implement in task order.
- Commit regularly. No commit should exceed 1000 lines of code (LOC).
- While writing any doc file, readme, or log file, read and follow the humanizer skill.
- Do not over-engineer testing infrastructure. Focus on a useful data audit, reproducible model experiments, a working API/dashboard and a clear end-to-end demonstration.
- Before selecting a provider, run the trial steps in data/README.md and record evidence.
- If the provider does not meet the free/data-identity requirements, report the limitation rather than silently changing instruments.
- If any external API schema is uncertain, inspect its current official documentation and verify a minimal request before building around it.
- Keep configuration out of source code.
- Keep code modular but avoid unnecessary microservices.
- Update tasks.md as work is completed.
