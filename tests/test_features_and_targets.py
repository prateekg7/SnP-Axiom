import numpy as np
import pandas as pd
import pytest
from src.features.pipeline import FeaturePipeline
from src.labels.targets import compute_targets


def test_feature_pipeline_computation():
    dates = pd.date_range("2026-10-01 13:30", periods=120, freq="5min", tz="UTC")
    np.random.seed(42)
    prices = 5000.0 + np.cumsum(np.random.randn(120) * 2.0)
    df = pd.DataFrame({
        "timestamp": dates,
        "open": prices - 0.5,
        "high": prices + 1.5,
        "low": prices - 1.5,
        "close": prices,
        "volume": np.random.randint(100, 1000, size=120),
    })

    pipeline = FeaturePipeline()
    features = pipeline.compute_features(df)
    assert len(features) == 120
    assert "log_ret_1" in features.columns
    assert "rsi_14" in features.columns
    assert "macd_line" in features.columns
    assert "bb_wband" in features.columns
    assert "session_progress" in features.columns
    assert not features.iloc[-1].isna().any()


def test_target_definitions():
    df = pd.DataFrame({
        "timestamp": pd.date_range("2026-10-01 13:30", periods=10, freq="5min", tz="UTC"),
        "open": [100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0, 109.0],
        "high": [102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0, 109.0, 110.0, 111.0],
        "low": [99.0, 100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0],
        "close": [101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0, 109.0, 110.0],
        "volume": [1000] * 10,
    })

    targets = compute_targets(df)
    # y_touch_up at row 0 is (high at row 1 (103) > close at row 0 (101)) -> True (1)
    assert targets["y_touch_up"].iloc[0] == 1.0
    # r_1 at row 0 is ln(102 / 101)
    assert np.isclose(targets["r_1"].iloc[0], np.log(102.0 / 101.0))
