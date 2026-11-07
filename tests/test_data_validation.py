from datetime import timezone
import pandas as pd
import pytest
from src.data.validate import audit_dataframe


def test_audit_dataframe_clean():
    df = pd.DataFrame({
        "timestamp": pd.date_range("2026-10-01 13:30", periods=5, freq="5min", tz="UTC"),
        "open": [5000.0, 5005.0, 5010.0, 5008.0, 5012.0],
        "high": [5010.0, 5015.0, 5012.0, 5014.0, 5020.0],
        "low": [4995.0, 5000.0, 5002.0, 5005.0, 5010.0],
        "close": [5005.0, 5010.0, 5008.0, 5012.0, 5018.0],
    })
    res = audit_dataframe(df)
    assert res.total_rows == 5
    assert res.invariants_failed == 0
    assert res.duplicate_timestamps == 0


def test_audit_dataframe_failure():
    # High < Low violation
    df_invalid = pd.DataFrame({
        "timestamp": pd.date_range("2026-10-01 13:30", periods=2, freq="5min", tz="UTC"),
        "open": [5000.0, 5010.0],
        "high": [4990.0, 5015.0],  # high < low
        "low": [5000.0, 5000.0],
        "close": [4995.0, 5010.0],
    })
    res = audit_dataframe(df_invalid)
    assert res.invariants_failed > 0
