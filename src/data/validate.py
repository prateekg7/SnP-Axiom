from dataclasses import dataclass, asdict
from typing import Any, Dict, List
import numpy as np
import pandas as pd

from src.data.sessions import filter_regular_session_df, get_session_date


@dataclass
class AuditResult:
    total_rows: int
    regular_session_rows: int
    distinct_sessions: int
    earliest_timestamp: str
    latest_timestamp: str
    duplicate_timestamps: int
    missing_values: Dict[str, int]
    invariants_failed: int
    max_single_bar_return: float
    min_single_bar_return: float
    volume_semantics: str


def audit_dataframe(df: pd.DataFrame) -> AuditResult:
    if df.empty:
        raise ValueError("Cannot audit an empty DataFrame")

    total_rows = len(df)
    duplicates = int(df.duplicated(subset=["timestamp"]).sum())
    missing = df.isnull().sum().to_dict()

    # Check OHLC invariants
    invalid_high = (df["high"] < df["low"]) | (df["high"] < df["open"]) | (df["high"] < df["close"])
    invalid_low = (df["low"] > df["open"]) | (df["low"] > df["close"])
    non_positive = (df["open"] <= 0) | (df["high"] <= 0) | (df["low"] <= 0) | (df["close"] <= 0)
    invariants_failed = int((invalid_high | invalid_low | non_positive).sum())

    # Regular session breakdown
    df_reg = filter_regular_session_df(df, time_col="timestamp")
    reg_rows = len(df_reg)
    sessions = int(df_reg["timestamp"].apply(get_session_date).nunique())

    # Log returns
    log_returns = np.log(df["close"] / df["close"].shift(1)).dropna()
    max_ret = float(log_returns.max()) if not log_returns.empty else 0.0
    min_ret = float(log_returns.min()) if not log_returns.empty else 0.0

    vol_sem = str(df["volume_semantics"].iloc[0]) if "volume_semantics" in df.columns else "unknown"

    return AuditResult(
        total_rows=total_rows,
        regular_session_rows=reg_rows,
        distinct_sessions=sessions,
        earliest_timestamp=str(df["timestamp"].min()),
        latest_timestamp=str(df["timestamp"].max()),
        duplicate_timestamps=duplicates,
        missing_values=missing,
        invariants_failed=invariants_failed,
        max_single_bar_return=max_ret,
        min_single_bar_return=min_ret,
        volume_semantics=vol_sem,
    )
