# Agent Instructions

## Primary Directives
- You have to commit regularly. No commit should exceed 1000 loc (lines of code).
- While writing any doc file, readme, or log file, read and follow the humanizer skill (`/Users/prateekgupta/.agents/skills/humanizer/SKILL.md`).

## Project Guidelines
Please refer to [AGENT_HANDOFF.md](AGENT_HANDOFF.md) for full context, constraints, and architecture.
Key constraints:
- Target instrument is the S&P 500 cash index (SPX).
- Do not silently substitute SPY, ES futures, a CFD or another proxy.
- The main model is the LSTM multi-task forecaster described in architecture.md.
- LightGBM is the benchmark and fallback candidate.
- Commit regularly. No commit should exceed 1000 loc.
- Decisions are hypothetical only. No broker integration or real orders.
- Follow tasks.md sequentially and update tasks.md as work progresses.
- Maintain plain, natural documentation that avoids robotic AI patterns, em dashes, forced triads, and filler.
