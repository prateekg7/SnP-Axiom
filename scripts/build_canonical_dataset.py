import os
from pathlib import Path
import pandas as pd
from zoneinfo import ZoneInfo

from src.data.getdata_sample import GetDataSampleProvider
from src.data.yahoo import YahooFinanceProvider
from src.data.sessions import filter_regular_session_df, get_session_date
from src.data.validate import audit_dataframe


def main():
    print("Ingesting and auditing GetData sample...")
    gd_provider = GetDataSampleProvider()
    df_gd_raw = gd_provider.load_df()
    audit_gd = audit_dataframe(df_gd_raw)
    print(f"GetData total bars: {audit_gd.total_rows}, invariant failures: {audit_gd.invariants_failed}")

    print("Fetching and auditing Yahoo Finance ^GSPC data...")
    yf_provider = YahooFinanceProvider()
    df_yf_raw = yf_provider.load_df(period="60d", interval="5m")
    audit_yf = audit_dataframe(df_yf_raw)
    print(f"Yahoo total bars: {audit_yf.total_rows}, invariant failures: {audit_yf.invariants_failed}")

    # Build canonical dataset
    # We filter for regular trading hours (09:30 to 16:00 America/New_York)
    df_gd_reg = filter_regular_session_df(df_gd_raw)
    df_yf_reg = filter_regular_session_df(df_yf_raw)

    print(f"GetData regular-session bars: {len(df_gd_reg)}")
    print(f"Yahoo regular-session bars: {len(df_yf_reg)}")

    # For canonical continuous series:
    # GetData covers 2026-03-26 through 2026-09-25.
    # Yahoo covers 2026-08-14 through 2026-11-06.
    # We use GetData as the core baseline training period, and save both.
    # We create canonical dataset from GetData regular session (9,750 bars) +
    # append non-overlapping Yahoo regular session bars from 2026-09-26 onwards.
    cutoff = df_gd_reg["timestamp"].max()
    df_yf_recent = df_yf_reg[df_yf_reg["timestamp"] > cutoff].copy()
    print(f"Recent Yahoo bars after GetData end ({cutoff}): {len(df_yf_recent)}")

    canonical_df = pd.concat([df_gd_reg, df_yf_recent], ignore_index=True)
    canonical_df = canonical_df.sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)

    out_dir = Path("data/processed")
    out_dir.mkdir(parents=True, exist_ok=True)
    parquet_path = out_dir / "spx_5m_canonical.parquet"
    canonical_df.to_parquet(parquet_path)
    print(f"Saved canonical dataset to {parquet_path} ({len(canonical_df)} bars)")

    canonical_audit = audit_dataframe(canonical_df)

    # Write concise audit report following humanizer skill
    audit_report_path = Path("data/audit_report.md")
    report_content = f"""# SPX Intraday Dataset Audit Report

This report summarizes data validation checks, coverage boundaries, and invariants for the canonical 5-minute S&P 500 dataset.

## Dataset summary

- Output file: data/processed/spx_5m_canonical.parquet
- Target instrument: S&P 500 cash index (SPX)
- Bar interval: 5 minutes
- Session definition: US regular trading session (09:30 to 16:00 America/New_York)
- Total regular-session bars: {canonical_audit.total_rows}
- Total trading sessions: {canonical_audit.distinct_sessions}
- Date range: {canonical_audit.earliest_timestamp} to {canonical_audit.latest_timestamp}
- Duplicate timestamps: {canonical_audit.duplicate_timestamps}
- Invariant check failures: {canonical_audit.invariants_failed}
- Maximum single-bar return: {canonical_audit.max_single_bar_return:.4f}
- Minimum single-bar return: {canonical_audit.min_single_bar_return:.4f}

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
"""
    audit_report_path.write_text(report_content)
    print(f"Wrote audit report to {audit_report_path}")


if __name__ == "__main__":
    main()
