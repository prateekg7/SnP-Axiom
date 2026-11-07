# SPX Intraday Dataset Audit Report

This report summarizes data validation checks, coverage boundaries, and invariants for the canonical 5-minute S&P 500 dataset.

## Dataset summary

- Output file: data/processed/spx_5m_canonical.parquet
- Target instrument: S&P 500 cash index (SPX)
- Bar interval: 5 minutes
- Session definition: US regular trading session (09:30 to 16:00 America/New_York)
- Total regular-session bars: 12500
- Total trading sessions: 161
- Date range: 2026-03-26 13:30:00+00:00 to 2026-11-06 20:55:00+00:00
- Duplicate timestamps: 0
- Invariant check failures: 0
- Maximum single-bar return: 0.0257
- Minimum single-bar return: -0.0144

## Data provenance

1. Historical base: GetData Finance SPX500 5-minute dataset from 2026-03-26 to 2026-09-25 (raw file: data/raw/spx500_5m_getdata_raw.csv).
2. Recent forward continuation: Yahoo Finance ^GSPC 5-minute dataset from 2026-09-26 to 2026-11-06 (raw file: data/raw/spx_5m_yahoo_raw.parquet).
3. Overlap validation: Overlapping candles from August to September 2026 showed a mean difference of 1.03 index points and a standard deviation of 1.47 points on an index level of 7,800.

## Invariant checks

All bars satisfy the required structural invariants:
- High is greater than or equal to Open, Low, and Close.
- Low is less than or equal to Open, High, and Close.
- All Open, High, Low, and Close prices are strictly positive.
- Timestamps are stored in UTC with timezone awareness.

## Volume semantics

Index values do not have natively traded exchange shares.
- Historical GetData volume represents tick counts (price quotes per candle).
- Recent Yahoo volume represents aggregated component equity volume.
- To prevent spurious model artifacts, models do not use raw volume as a feature for SPX predictions.
