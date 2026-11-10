import math
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from zoneinfo import ZoneInfo


class SPXAdaptiveAIv2Model:
    """SPX Adaptive AI v2 quantitative regime and structural decision model.
    
    Implements the exact dual-regime scoring, confidence mapping, and bracket
    rules as defined in SPX_Adaptive_AI_v2.pine with retrained empirical weights.
    """

    def __init__(
        self,
        ema_fast_len: int = 9,
        ema_mid_len: int = 21,
        ema_slow_len: int = 50,
        rsi_len: int = 14,
        dmi_len: int = 14,
        adx_smooth: int = 14,
        atr_len: int = 14,
        trend_adx: float = 20.0,
        min_score: float = 2.20,
        min_confidence: float = 0.65,
        use_opening_range: bool = True,
        use_vwap_filter: bool = True,
        tp_atr: float = 2.00,
        sl_atr: float = 1.00,
        max_hold_bars: int = 6,
        min_vol_ratio: float = 0.45,
        max_vol_ratio: float = 2.50,
        slow_atr_len: int = 156,
        # Retrained weights calibrated on multi-year SPX data
        w_trend: Optional[List[float]] = None,
        w_range: Optional[List[float]] = None,
    ):
        self.ema_fast_len = ema_fast_len
        self.ema_mid_len = ema_mid_len
        self.ema_slow_len = ema_slow_len
        self.rsi_len = rsi_len
        self.dmi_len = dmi_len
        self.adx_smooth = adx_smooth
        self.atr_len = atr_len
        self.trend_adx = trend_adx
        self.min_score = min_score
        self.min_confidence = min_confidence
        self.use_opening_range = use_opening_range
        self.use_vwap_filter = use_vwap_filter
        self.tp_atr = tp_atr
        self.sl_atr = sl_atr
        self.max_hold_bars = max_hold_bars
        self.min_vol_ratio = min_vol_ratio
        self.max_vol_ratio = max_vol_ratio
        self.slow_atr_len = slow_atr_len

        # 9 trend weights: fast_mid, mid_slow, ret3, ret6, ret12, di_cross, vwap, or_breakout, prior_day
        self.w_trend = w_trend or [0.40, 0.70, 0.30, 0.25, 0.65, 0.35, 0.45, 0.75, 0.30]
        # 4 range weights: vwap_fade, rsi_fade, fast_ema, di_cross
        self.w_range = w_range or [0.60, 1.10, 0.20, 0.15]

    def evaluate_window(self, df_window: pd.DataFrame) -> Dict[str, Any]:
        """Compute technical features, regime score, confidence, and action on the latest bar."""
        if len(df_window) < 30:
            ref_p = float(df_window["close"].iloc[-1]) if not df_window.empty else 7500.0
            return {
                "raw_score": 0.0,
                "score_confidence": 0.50,
                "trend_regime": False,
                "regime_label": "RANGE",
                "action": "HOLD",
                "direction": "FLAT",
                "expected_return_5m": 0.0,
                "expected_price_5m": ref_p,
                "path_30m": [{"horizon_minutes": (i + 1) * 5, "expected_close": ref_p} for i in range(6)],
                "predicted_high_30m": ref_p + 3.0,
                "predicted_low_30m": ref_p - 3.0,
                "volatility_30m": 0.001,
                "tp_points": 3.0,
                "sl_points": 1.5,
                "decision_reason": "Warming up: insufficient window bars",
            }

        df = df_window.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        ny_tz = ZoneInfo("America/New_York")
        df["ny_time"] = df["timestamp"].dt.tz_convert(ny_tz)
        df["date_ny"] = df["ny_time"].dt.date
        df["time_str"] = df["ny_time"].dt.strftime("%H:%M")

        # 1. EMAs
        closes = df["close"].values
        df["ema_fast"] = df["close"].ewm(span=self.ema_fast_len, adjust=False).mean()
        df["ema_mid"] = df["close"].ewm(span=self.ema_mid_len, adjust=False).mean()
        df["ema_slow"] = df["close"].ewm(span=self.ema_slow_len, adjust=False).mean()

        # 2. Returns
        df["ret3"] = df["close"].pct_change(3).fillna(0.0)
        df["ret6"] = df["close"].pct_change(6).fillna(0.0)
        df["ret12"] = df["close"].pct_change(12).fillna(0.0)

        # 3. ATR & Volatility
        highs = df["high"].values
        lows = df["low"].values
        high_low = highs - lows
        prev_close = np.roll(closes, 1)
        prev_close[0] = closes[0]
        high_close = np.abs(highs - prev_close)
        low_close = np.abs(lows - prev_close)
        tr = np.maximum(high_low, np.maximum(high_close, low_close))
        df["tr"] = tr
        df["atr"] = df["tr"].ewm(alpha=1.0 / self.atr_len, adjust=False).mean()
        df["atr_slow"] = df["atr"].rolling(min(len(df), self.slow_atr_len), min_periods=20).mean()
        atr_val = float(df["atr"].iloc[-1])
        atr_slow_val = float(df["atr_slow"].iloc[-1]) if not pd.isna(df["atr_slow"].iloc[-1]) else atr_val
        vol_ratio = (atr_val / atr_slow_val) if atr_slow_val > 0 else 1.0

        # 4. DMI and ADX
        up_move = np.diff(highs, prepend=highs[0])
        down_move = -np.diff(lows, prepend=lows[0])
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
        tr_smooth = df["tr"].ewm(alpha=1.0 / self.dmi_len, adjust=False).mean().values
        plus_di_series = 100.0 * pd.Series(plus_dm, index=df.index).ewm(alpha=1.0 / self.dmi_len, adjust=False).mean() / np.maximum(tr_smooth, 1e-8)
        minus_di_series = 100.0 * pd.Series(minus_dm, index=df.index).ewm(alpha=1.0 / self.dmi_len, adjust=False).mean() / np.maximum(tr_smooth, 1e-8)
        dx_denom = plus_di_series + minus_di_series
        dx = 100.0 * (plus_di_series - minus_di_series).abs() / dx_denom.replace(0, np.nan).fillna(1.0)
        adx_series = dx.ewm(alpha=1.0 / self.adx_smooth, adjust=False).mean()

        di_plus = float(plus_di_series.iloc[-1])
        di_minus = float(minus_di_series.iloc[-1])
        adx_val = float(adx_series.iloc[-1]) if not pd.isna(adx_series.iloc[-1]) else 18.0

        # 5. RSI
        deltas = np.diff(closes, prepend=closes[0])
        gains = np.maximum(deltas, 0.0)
        losses = np.maximum(-deltas, 0.0)
        avg_gain = pd.Series(gains).ewm(alpha=1.0 / self.rsi_len, adjust=False).mean()
        avg_loss = pd.Series(losses).ewm(alpha=1.0 / self.rsi_len, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan).fillna(1e-8)
        rsi_val = float((100.0 - (100.0 / (1.0 + rs))).iloc[-1])

        # 6. Session VWAP
        hlc3 = (highs + lows + closes) / 3.0
        df["hlc3"] = hlc3
        curr_date = df["date_ny"].iloc[-1]
        session_mask = df["date_ny"] == curr_date
        vwap_val = float(df.loc[session_mask, "hlc3"].mean())
        vwap_dist_atr = ((closes[-1] - vwap_val) / atr_val) if atr_val > 0 else 0.0

        # 7. Opening Range
        or_mask = session_mask & (df["time_str"] >= "09:30") & (df["time_str"] <= "10:00")
        opening_ready = (df["time_str"].iloc[-1] > "10:00") and (or_mask.sum() > 0)
        opening_high = float(df.loc[or_mask, "high"].max()) if opening_ready else float(highs[-1])
        opening_low = float(df.loc[or_mask, "low"].min()) if opening_ready else float(lows[-1])

        # 8. Prior Day High / Low
        prior_dates = [d for d in df["date_ny"].unique() if d < curr_date]
        if prior_dates:
            prior_date = prior_dates[-1]
            prior_mask = df["date_ny"] == prior_date
            prior_day_high = float(df.loc[prior_mask, "high"].max())
            prior_day_low = float(df.loc[prior_mask, "low"].min())
        else:
            prior_day_high = float(highs[-1])
            prior_day_low = float(lows[-1])

        # 9. Regime classification
        ema_fast = float(df["ema_fast"].iloc[-1])
        ema_mid = float(df["ema_mid"].iloc[-1])
        ema_slow = float(df["ema_slow"].iloc[-1])
        c = float(closes[-1])

        trend_regime = (adx_val >= self.trend_adx) and (ema_mid != 0) and (abs(ema_mid - ema_slow) / ema_mid > 0.00015)
        regime_label = "TREND" if trend_regime else "RANGE"

        # 10. Trend Score
        trend_score = 0.0
        trend_score += self.w_trend[0] if ema_fast > ema_mid else -self.w_trend[0]
        trend_score += self.w_trend[1] if ema_mid > ema_slow else -self.w_trend[1]
        trend_score += self.w_trend[2] if float(df["ret3"].iloc[-1]) > 0 else -self.w_trend[2]
        trend_score += self.w_trend[3] if float(df["ret6"].iloc[-1]) > 0 else -self.w_trend[3]
        trend_score += self.w_trend[4] if float(df["ret12"].iloc[-1]) > 0 else -self.w_trend[4]
        trend_score += self.w_trend[5] if di_plus > di_minus else -self.w_trend[5]
        if self.use_vwap_filter:
            trend_score += self.w_trend[6] if c > vwap_val else -self.w_trend[6]
        if self.use_opening_range and opening_ready:
            if c > opening_high:
                trend_score += self.w_trend[7]
            elif c < opening_low:
                trend_score -= self.w_trend[7]
        if c > prior_day_high:
            trend_score += self.w_trend[8]
        elif c < prior_day_low:
            trend_score -= self.w_trend[8]

        # 11. Range Score
        range_score = 0.0
        if vwap_dist_atr < -0.90:
            range_score += self.w_range[0]
        elif vwap_dist_atr > 0.90:
            range_score -= self.w_range[0]

        if rsi_val < 32:
            range_score += self.w_range[1]
        elif rsi_val > 68:
            range_score -= self.w_range[1]

        range_score += self.w_range[2] if c > ema_fast else -self.w_range[2]
        range_score += self.w_range[3] if di_plus > di_minus else -self.w_range[3]

        raw_score = trend_score if trend_regime else range_score
        score_conf = 1.0 / (1.0 + math.exp(-max(-8.0, min(8.0, abs(raw_score) * 0.65))))

        # Filters
        time_str = df["time_str"].iloc[-1]
        in_entry = ("09:35" <= time_str <= "15:50")
        vol_ok = (self.min_vol_ratio <= vol_ratio <= self.max_vol_ratio)
        trade_allowed = in_entry and vol_ok

        long_sig = (raw_score >= self.min_score) and (score_conf >= self.min_confidence) and trade_allowed
        short_sig = (raw_score <= -self.min_score) and (score_conf >= self.min_confidence) and trade_allowed

        action = "LONG" if long_sig else ("SHORT" if short_sig else "HOLD")
        direction = "UP" if raw_score > 0 else ("DOWN" if raw_score < 0 else "FLAT")

        # Expected price and trajectory
        drift_rate = (raw_score / 10.0) * 0.0004
        expected_p_5m = c * (1.0 + drift_rate)

        tp_pts = max(1.0, self.tp_atr * atr_val)
        sl_pts = max(1.0, self.sl_atr * atr_val)

        path_30m = []
        for step_idx in range(1, 7):
            h_min = step_idx * 5
            h_p = c * (1.0 + drift_rate * math.sqrt(step_idx))
            path_30m.append({"horizon_minutes": h_min, "expected_close": round(h_p, 2)})

        pred_high_30m = c + max(tp_pts, 0.0015 * c)
        pred_low_30m = c - max(sl_pts, 0.0015 * c)

        reason = (
            f"SPX Adaptive v2: score={raw_score:+.2f} conf={score_conf * 100.0:.1f}% "
            f"[{regime_label}] ADX={adx_val:.1f} VolRatio={vol_ratio:.2f}"
        )

        return {
            "raw_score": round(raw_score, 2),
            "score_confidence": round(score_conf, 4),
            "trend_regime": trend_regime,
            "regime_label": regime_label,
            "action": action,
            "direction": direction,
            "expected_return_5m": round(drift_rate, 6),
            "expected_price_5m": round(expected_p_5m, 2),
            "path_30m": path_30m,
            "predicted_high_30m": round(pred_high_30m, 2),
            "predicted_low_30m": round(pred_low_30m, 2),
            "volatility_30m": round(atr_val / c, 6),
            "tp_points": round(tp_pts, 2),
            "sl_points": round(sl_pts, 2),
            "decision_reason": reason,
        }
