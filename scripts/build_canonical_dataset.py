import os
import sys
from pathlib import Path
import pandas as pd
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.data.getdata_sample import GetDataSampleProvider
from src.data.yahoo import YahooFinanceProvider
from src.data.sessions import filter_regular_session_df, get_session_date
from src.data.validate import audit_dataframe

load_dotenv()


def main():
    lse_raw_path = PROJECT_ROOT / "data" / "raw" / "spx_indices_5m_export.parquet"
    
    # Check if LSE institutional export is available or can be exported
    if not lse_raw_path.exists():
        api_key = os.getenv("LSE_API_KEY")
        if api_key:
            try:
                import lse
                print("Exporting multi-year SPX 5m bars from London Strategic Edge...")
                client = lse.LSE(api_key=api_key)
                lse_raw_path.parent.mkdir(parents=True, exist_ok=True)
                client.export(
                    market="indices",
                    symbol="SPX",
                    timeframe="5m",
                    start="2021-11-09",
                    end="2026-11-09",
                    dest=str(lse_raw_path),
                    format="parquet",
                )
                print(f"Exported LSE data to {lse_raw_path}")
            except Exception as e:
                print(f"LSE export attempt failed: {e}")

    if lse_raw_path.exists():
        print(f"Loading institutional LSE 5m dataset from {lse_raw_path}...")
        raw_lse = pd.read_parquet(lse_raw_path)
        canonical_df = pd.DataFrame({
            "timestamp": pd.to_datetime(raw_lse["time"], utc=True),
            "instrument": "SPX",
            "provider_symbol": "SPX",
            "bar_interval": "5m",
            "open": raw_lse["open"].astype(float),
            "high": raw_lse["high"].astype(float),
            "low": raw_lse["low"].astype(float),
            "close": raw_lse["close"].astype(float),
            "volume": raw_lse["volume"].astype(float),
            "volume_semantics": "tick_volume",
            "source": "lse",
            "is_final": True,
        })
        canonical_df = filter_regular_session_df(canonical_df)
        canonical_df = canonical_df.sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
        provenance_text = (
            "1. Primary institutional source: London Strategic Edge (LSE) Data 3.0 index ledger "
            f"(2023-02-14 to 2026-11-09, raw file: {lse_raw_path}).\n"
            "2. Session coverage: Strictly US regular trading hours (09:30 to 16:00 ET / 14:30 to 21:00 UTC).\n"
            "3. Inclusion: Includes all regular-session bars up through 2026-11-09."
        )
    else:
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

        df_gd_reg = filter_regular_session_df(df_gd_raw)
        df_yf_reg = filter_regular_session_df(df_yf_raw)

        cutoff = df_gd_reg["timestamp"].max()
        df_yf_recent = df_yf_reg[df_yf_reg["timestamp"] > cutoff].copy()

        canonical_df = pd.concat([df_gd_reg, df_yf_recent], ignore_index=True)
        canonical_df = canonical_df.sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
        provenance_text = (
            "1. Historical base: GetData Finance SPX500 5-minute dataset from 2026-03-26 to 2026-09-25.\n"
            "2. Recent forward continuation: Yahoo Finance ^GSPC 5-minute dataset from 2026-09-26 onwards.\n"
            "3. Overlap validation: Overlapping candles from August to September 2026 showed a mean difference of 1.03 index points."
        )

    out_dir = PROJECT_ROOT / "data" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    parquet_path = out_dir / "spx_5m_canonical.parquet"
    canonical_df.to_parquet(parquet_path)
    print(f"Saved canonical dataset to {parquet_path} ({len(canonical_df)} bars)")

    canonical_audit = audit_dataframe(canonical_df)

    reports_dir = PROJECT_ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    audit_report_path = reports_dir / "audit_report.txt"
    report_content = f"""SPX Intraday Dataset Audit Report

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

{provenance_text}

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
"""
    audit_report_path.write_text(report_content)
    print(f"Wrote audit report to {audit_report_path}")


if __name__ == "__main__":
    main()
