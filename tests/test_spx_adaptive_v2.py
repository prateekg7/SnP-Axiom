import numpy as np
import pandas as pd
import pytest

from src.models.spx_adaptive_v2 import SPXAdaptiveAIv2Model


def make_dummy_spx_window(n: int = 100) -> pd.DataFrame:
    base = 7500.0
    dates = pd.date_range("2026-11-09 09:30:00-05:00", periods=n, freq="5min")
    rng = np.random.default_rng(42)
    closes = base + np.cumsum(rng.normal(0.2, 1.5, n))
    highs = closes + rng.uniform(0.5, 2.0, n)
    lows = closes - rng.uniform(0.5, 2.0, n)
    opens = (highs + lows) / 2.0
    vols = rng.integers(500, 3000, n).astype(float)

    return pd.DataFrame({
        "timestamp": dates.tz_convert("UTC"),
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": vols,
        "instrument": "SPX",
        "provider_symbol": "SPX",
        "bar_interval": "5m",
        "source": "lse",
        "is_final": True,
    })


def test_spx_v2_evaluation_structure():
    model = SPXAdaptiveAIv2Model()
    df = make_dummy_spx_window(80)
    res = model.evaluate_window(df)

    assert "raw_score" in res
    assert "score_confidence" in res
    assert "regime_label" in res
    assert res["regime_label"] in ["TREND", "RANGE"]
    assert "action" in res
    assert res["action"] in ["LONG", "SHORT", "HOLD"]
    assert "direction" in res
    assert res["direction"] in ["UP", "DOWN", "FLAT"]
    assert "expected_price_5m" in res
    assert len(res["path_30m"]) == 6
    assert res["tp_points"] > 0
    assert res["sl_points"] > 0
    assert res["predicted_high_30m"] > res["predicted_low_30m"]


def test_spx_v2_short_window_fallback():
    model = SPXAdaptiveAIv2Model()
    df = make_dummy_spx_window(10)
    res = model.evaluate_window(df)

    assert res["action"] == "HOLD"
    assert res["raw_score"] == 0.0
    assert "Warming up" in res["decision_reason"]

