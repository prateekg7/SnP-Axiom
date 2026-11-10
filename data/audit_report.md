# SPX Intraday Dataset Audit Report

This report summarizes data validation checks, coverage boundaries, and invariants for the canonical 5-minute S&P 500 dataset.

## Dataset summary

- Output file: data/processed/spx_5m_canonical.parquet
- Target instrument: S&P 500 cash index (SPX)
- Bar interval: 5 minutes
- Session definition: US regular trading session (09:30 to 16:00 America/New_York)
- Total regular-session bars: 72681
- Total trading sessions: 937
- Date range: 2023-02-14 18:20:00+00:00 to 2026-11-09 20:55:00+00:00
- Duplicate timestamps: 0
- Invariant check failures: 0
- Maximum single-bar return: 0.0375
- Minimum single-bar return: -0.0400

## Data provenance

1. Primary institutional source: London Strategic Edge (LSE) Data 3.0 index ledger (2023-02-14 to 2026-11-09, raw file: data/raw/spx_indices_5m_export.parquet).
2. Session coverage: Strictly US regular trading hours (09:30 to 16:00 ET / 14:30 to 21:00 UTC).
3. Inclusion: Includes all regular-session bars up through 2026-11-09.

## Invariant checks

All bars satisfy the required structural invariants:
- High is greater than or equal to Open, Low, and Close.
- Low is less than or equal to Open, High, and Close.
- All Open, High, Low, and Close prices are strictly positive.
- Timestamps are stored in UTC with timezone awareness.

## Volume semantics

Index values do not have natively traded exchange shares.
- Volume numbers reflect recorded trade activity or tick counts.
- To prevent spurious model artifacts, models do not use raw volume as a feature for SPX predictions.
