import math
from typing import Any, Dict, Optional, Tuple
import numpy as np
from scipy.stats import norm


def black_scholes_touch_probability(
    current_price: float,
    barrier_price: float,
    realized_vol_30m: float,
    horizon_minutes: float = 5.0,
    expected_return_5m: float = 0.0,
) -> float:
    """
    Computes analytical first-touch probability for an upper or lower barrier
    within the specified horizon using the Black-Scholes reflection principle
    for geometric Brownian motion.

    Parameters:
        current_price: Current reference price S_0.
        barrier_price: Target price level to touch.
        realized_vol_30m: Rolling realized volatility over 30 minutes (fractional).
        horizon_minutes: Forward time window in minutes (default: 5.0).
        expected_return_5m: Predicted directional drift over 5 minutes.

    Returns:
        float: Analytical first-passage probability in [0, 1].
    """
    if current_price <= 0 or barrier_price <= 0:
        return 0.5

    # Annualize volatility: 1 day = 78 5-min bars, 252 trading days = 19,656 5-min bars/year
    # 30-min volatility corresponds to 6 bars
    sigma_annual = max(1e-4, realized_vol_30m * math.sqrt(19656.0 / 6.0))
    dt_years = (horizon_minutes / 5.0) / 19656.0
    mu_annual = expected_return_5m * 19656.0

    if barrier_price >= current_price:
        # Upper barrier first-touch probability
        h = math.log(barrier_price / current_price)
        if h <= 1e-6:
            return 1.0
        mu_adj = mu_annual - 0.5 * (sigma_annual**2)
        vol_sqrt = sigma_annual * math.sqrt(dt_years)
        d1 = (-h + mu_adj * dt_years) / vol_sqrt
        d2 = (-h - mu_adj * dt_years) / vol_sqrt
        ratio = (barrier_price / current_price) ** (2.0 * mu_adj / (sigma_annual**2))
        prob = norm.cdf(d1) + ratio * norm.cdf(d2)
    else:
        # Lower barrier first-touch probability
        h = math.log(current_price / barrier_price)
        if h <= 1e-6:
            return 1.0
        mu_adj = -mu_annual - 0.5 * (sigma_annual**2)
        vol_sqrt = sigma_annual * math.sqrt(dt_years)
        d1 = (-h + mu_adj * dt_years) / vol_sqrt
        d2 = (-h - mu_adj * dt_years) / vol_sqrt
        ratio = (current_price / barrier_price) ** (2.0 * mu_adj / (sigma_annual**2))
        prob = norm.cdf(d1) + ratio * norm.cdf(d2)

    return float(np.clip(prob, 0.0, 1.0))


def monte_carlo_path_simulation(
    current_price: float,
    expected_return_5m: float,
    realized_vol_30m: float,
    horizon_bars: int = 6,
    num_paths: int = 2000,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Simulates forward price trajectories using geometric Brownian motion
    parameterized by the model's predicted drift and rolling realized volatility.

    Returns:
        dict containing median path, confidence bands, expected extrema, and empirical VaR.
    """
    rng = np.random.default_rng(seed)
    # Volatility per 5-minute bar derived from 30-minute realized volatility (sqrt(6) bars)
    sigma_bar = max(1e-5, realized_vol_30m / math.sqrt(6.0))
    mu_bar = expected_return_5m

    # Generate log return shocks [num_paths, horizon_bars]
    shocks = rng.normal(mu_bar, sigma_bar, size=(num_paths, horizon_bars))
    cum_returns = np.cumsum(shocks, axis=1)
    paths = current_price * np.exp(cum_returns)

    # Path statistics
    median_path = np.median(paths, axis=0).tolist()
    upper_90 = np.percentile(paths, 90, axis=0).tolist()
    lower_90 = np.percentile(paths, 10, axis=0).tolist()

    max_highs = np.max(paths, axis=1)
    min_lows = np.min(paths, axis=1)
    expected_max_high = float(np.mean(max_highs))
    expected_min_low = float(np.mean(min_lows))

    # Empirical Value at Risk (5% worst outcome at end of 30 minutes)
    terminal_prices = paths[:, -1]
    terminal_returns = (terminal_prices - current_price) / current_price
    var_95_pct = float(-np.percentile(terminal_returns, 5) * 100.0)

    # Probability of positive return after 5 minutes
    prob_up_5m = float(np.mean(paths[:, 0] > current_price))

    return {
        "median_path": [round(p, 2) for p in median_path],
        "upper_90": [round(p, 2) for p in upper_90],
        "lower_90": [round(p, 2) for p in lower_90],
        "expected_max_high": round(expected_max_high, 2),
        "expected_min_low": round(expected_min_low, 2),
        "var_95_pct": round(var_95_pct, 3),
        "monte_carlo_p_up_5m": round(prob_up_5m, 4),
    }


def coupled_ai_technical_decision(
    expected_return_5m: float,
    calibrated_p_touch: float,
    rsi_14: float,
    bb_pband: float,
    min_touch_prob: float = 0.95,
    min_return_drift: float = 0.00008,
) -> Tuple[str, str]:
    """
    Couples the statistical AI forecast with technical oscillator filters (RSI & Bollinger Bands)
    to prevent buying overbought tops and selling oversold bottoms in mean-reverting equity regimes.

    Returns:
        Tuple[str, str]: (action: 'LONG'|'SHORT'|'HOLD', reason_code: str)
    """
    # Long entry: Model bullish + RSI not overbought (< 0.58) + price not piercing upper Bollinger (< 0.85)
    if expected_return_5m > min_return_drift and calibrated_p_touch >= min_touch_prob:
        if rsi_14 >= 0.58:
            return "HOLD", "COUPLED_RSI_OVERBOUGHT_FILTER"
        if bb_pband >= 0.85:
            return "HOLD", "COUPLED_BB_UPPER_BAND_FILTER"
        return "LONG", "COUPLED_AI_RSI_BB_LONG"

    # Short entry: Model bearish + RSI not oversold (> 0.42) + price not piercing lower Bollinger (> 0.15)
    if expected_return_5m < -min_return_drift:
        if rsi_14 <= 0.42:
            return "HOLD", "COUPLED_RSI_OVERSOLD_FILTER"
        if bb_pband <= 0.15:
            return "HOLD", "COUPLED_BB_LOWER_BAND_FILTER"
        return "SHORT", "COUPLED_AI_RSI_BB_SHORT"

    return "HOLD", "COUPLED_SIGNAL_ABSTAIN"

