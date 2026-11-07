from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd
from zoneinfo import ZoneInfo
import ta

from src.data.sessions import get_session_date, to_new_york

NY_TZ = ZoneInfo("America/New_York")


@dataclass
class FeatureMetadata:
    feature_names: List[str]
    version: str = "v1.0"


class FeaturePipeline:
    def __init__(self, version: str = "v1.0"):
        self.version = version
        self.feature_names: List[str] = []

    def compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Computes past-only technical, price-action, and regime features for each 5-minute bar.
        Does not use future information.
        """
        df = df.sort_values("timestamp").reset_index(drop=True).copy()
        features = pd.DataFrame(index=df.index)
        features["timestamp"] = df["timestamp"]

        close = df["close"]
        open_ = df["open"]
        high = df["high"]
        low = df["low"]

        # 1. Price and Return features
        for lag in [1, 2, 3, 6, 12, 24]:
            features[f"log_ret_{lag}"] = np.log(close / close.shift(lag))

        features["close_to_open"] = np.log(close / open_)
        bar_range = high - low
        features["normalized_range"] = bar_range / close

        # Candle body and wick ratios
        body = (close - open_).abs()
        denom = bar_range.replace(0, np.nan)
        features["body_ratio"] = (body / denom).fillna(0.0)
        upper_wick = high - np.maximum(open_, close)
        lower_wick = np.minimum(open_, close) - low
        features["upper_wick_ratio"] = (upper_wick / denom).fillna(0.0)
        features["lower_wick_ratio"] = (lower_wick / denom).fillna(0.0)

        # 2. Technical Indicators (using TA library)
        # Moving averages
        ema_9 = ta.trend.EMAIndicator(close=close, window=9).ema_indicator()
        ema_21 = ta.trend.EMAIndicator(close=close, window=21).ema_indicator()
        ema_50 = ta.trend.EMAIndicator(close=close, window=50).ema_indicator()

        features["ema_9_dist"] = (close - ema_9) / close
        features["ema_21_dist"] = (close - ema_21) / close
        features["ema_50_dist"] = (close - ema_50) / close
        features["ema_9_21_spread"] = (ema_9 - ema_21) / close

        # RSI
        features["rsi_14"] = ta.momentum.RSIIndicator(close=close, window=14).rsi() / 100.0

        # MACD
        macd = ta.trend.MACD(close=close, window_slow=26, window_fast=12, window_sign=9)
        features["macd_line"] = macd.macd() / close
        features["macd_signal"] = macd.macd_signal() / close
        features["macd_diff"] = macd.macd_diff() / close

        # ATR
        atr_14 = ta.volatility.AverageTrueRange(high=high, low=low, close=close, window=14).average_true_range()
        features["norm_atr_14"] = atr_14 / close

        # Bollinger Bands
        bb = ta.volatility.BollingerBands(close=close, window=20, window_dev=2)
        features["bb_pband"] = bb.bollinger_pband()
        features["bb_wband"] = bb.bollinger_wband()

        # Breakout distances from rolling extrema
        for window in [12, 36]:
            roll_high = high.rolling(window=window).max()
            roll_low = low.rolling(window=window).min()
            features[f"dist_high_{window}"] = (roll_high - close) / close
            features[f"dist_low_{window}"] = (close - roll_low) / close

        # 3. Volatility and Regime features
        ret_1 = features["log_ret_1"]
        for w in [6, 12, 24]:
            features[f"realized_vol_{w}"] = ret_1.rolling(window=w).std() * np.sqrt(w)

        features["range_expansion_12"] = bar_range / bar_range.rolling(12).mean().replace(0, np.nan)
        features["range_expansion_12"] = features["range_expansion_12"].fillna(1.0)

        # 4. Session and Time-of-Day features
        ny_times = df["timestamp"].apply(to_new_york)
        minute_of_day = ny_times.apply(lambda dt: dt.hour * 60 + dt.minute)
        # Regular trading hours: 09:30 is 570, 16:00 is 960 (390 minutes)
        session_minute = (minute_of_day - 570).clip(lower=0, upper=390)
        features["session_progress"] = session_minute / 390.0

        # Cyclical day of week
        dow = ny_times.apply(lambda dt: dt.weekday())
        features["dow_sin"] = np.sin(2 * np.pi * dow / 5.0)
        features["dow_cos"] = np.cos(2 * np.pi * dow / 5.0)

        # Session phases
        features["is_open_phase"] = (session_minute <= 30).astype(float)
        features["is_close_phase"] = (session_minute >= 360).astype(float)

        # Session cumulative return (from open of session)
        df["session_date"] = df["timestamp"].apply(get_session_date)
        session_opens = df.groupby("session_date")["open"].transform("first")
        features["session_cum_return"] = np.log(close / session_opens)

        feature_cols = [c for c in features.columns if c != "timestamp"]
        self.feature_names = feature_cols
        return features

    def get_feature_names(self) -> List[str]:
        return self.feature_names
