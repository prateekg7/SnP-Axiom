from typing import Dict, Tuple
import numpy as np
import pandas as pd


class BaseRateClassifier:
    def __init__(self):
        self.base_rate = 0.5

    def fit(self, y_train: np.ndarray) -> "BaseRateClassifier":
        clean = y_train[~np.isnan(y_train)]
        self.base_rate = float(np.mean(clean)) if len(clean) > 0 else 0.5
        return self

    def predict_proba(self, n: int) -> np.ndarray:
        return np.full(n, self.base_rate)


class MomentumDirectionBaseline:
    def predict_proba(self, log_ret_1: np.ndarray) -> np.ndarray:
        # If previous bar return is positive, higher probability of touching up
        probs = np.where(log_ret_1 > 0, 0.98, 0.94)
        return probs

    def predict_signal(self, log_ret_1: np.ndarray) -> np.ndarray:
        return np.where(log_ret_1 > 0, "LONG", "SHORT")


class RSIRuleStrategy:
    def predict_signal(self, rsi: np.ndarray, oversold: float = 0.30, overbought: float = 0.70) -> np.ndarray:
        signals = np.full(len(rsi), "HOLD", dtype=object)
        signals[rsi < oversold] = "LONG"
        signals[rsi > overbought] = "SHORT"
        return signals


class MACDCrossoverStrategy:
    def predict_signal(self, macd_diff: np.ndarray) -> np.ndarray:
        signals = np.full(len(macd_diff), "HOLD", dtype=object)
        signals[macd_diff > 0] = "LONG"
        signals[macd_diff < 0] = "SHORT"
        return signals


class MovingAverageTrendStrategy:
    def predict_signal(self, ema_dist: np.ndarray) -> np.ndarray:
        signals = np.full(len(ema_dist), "HOLD", dtype=object)
        signals[ema_dist > 0] = "LONG"
        signals[ema_dist < 0] = "SHORT"
        return signals
