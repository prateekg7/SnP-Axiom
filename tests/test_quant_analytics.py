import pytest
from src.models.quant_analytics import (
    black_scholes_touch_probability,
    coupled_ai_technical_decision,
    monte_carlo_path_simulation,
)


def test_black_scholes_touch_probability_bounds():
    p_up = black_scholes_touch_probability(
        current_price=5800.0,
        barrier_price=5802.0,
        realized_vol_30m=0.0015,
        horizon_minutes=5.0,
    )
    assert 0.0 <= p_up <= 1.0
    assert p_up > 0.5  # Under positive drift or tight barrier, probability should be substantial

    # Barrier at current price should return 1.0 (already touching)
    assert black_scholes_touch_probability(5800.0, 5800.0, 0.0015) == 1.0
    # Distant barrier 10 points down in 5 minutes should have very low probability
    p_down = black_scholes_touch_probability(5800.0, 5790.0, 0.0015)
    assert 0.0 <= p_down <= 0.10


def test_monte_carlo_path_simulation_outputs():
    res = monte_carlo_path_simulation(
        current_price=5800.0,
        expected_return_5m=0.0002,
        realized_vol_30m=0.0015,
        horizon_bars=6,
        num_paths=500,
        seed=42,
    )
    assert len(res["median_path"]) == 6
    assert len(res["upper_90"]) == 6
    assert len(res["lower_90"]) == 6
    assert res["expected_max_high"] >= 5800.0
    assert res["expected_min_low"] <= 5800.0
    assert 0.0 <= res["monte_carlo_p_up_5m"] <= 1.0
    assert res["var_95_pct"] > 0.0


def test_coupled_ai_technical_decision():
    # Strong bullish forecast, but RSI is overbought (0.75) -> should filter to HOLD
    act, reason = coupled_ai_technical_decision(
        expected_return_5m=0.0005,
        calibrated_p_touch=0.96,
        rsi_14=0.75,
        bb_pband=0.50,
    )
    assert act == "HOLD"
    assert "RSI_OVERBOUGHT" in reason

    # Strong bullish forecast with neutral RSI (0.50) and low BB (0.60) -> should enter LONG
    act, reason = coupled_ai_technical_decision(
        expected_return_5m=0.0005,
        calibrated_p_touch=0.96,
        rsi_14=0.50,
        bb_pband=0.60,
    )
    assert act == "LONG"
    assert "LONG" in reason

    # Bearish forecast with oversold RSI (0.30) -> should filter to HOLD
    act, reason = coupled_ai_technical_decision(
        expected_return_5m=-0.0005,
        calibrated_p_touch=0.80,
        rsi_14=0.30,
        bb_pband=0.50,
    )
    assert act == "HOLD"
    assert "RSI_OVERSOLD" in reason
