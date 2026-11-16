#!/usr/bin/env python3
"""
Comprehensive ML Benchmark and Comparison Suite for SnP-Axiom.
Trains, Platt-calibrates, evaluates, and exports Pine Scripts for:
1. Option A (LightGBM Benchmark GBDT)
2. Random Forest (RF Ensemble)
3. HistGradientBoosting (HGBM / XGBoost-style GBDT)
4. Multilayer Perceptron (MLP Deep Neural Network)
5. Support Vector Machine (Linear / Calibrated SGD-SVM)

Evaluations performed:
- Canonical Out-of-Sample Test Set (14,521 bars)
- Previous Week Per-Day Sessions (Nov 09, 10, 11, 12, 13, 2026)
- TradingView Pine Script v6 strategy generation for all methods
"""

import os
import sys
import pickle
import json
import math
import re
import time
from pathlib import Path
from typing import Dict, Any, List, Tuple
from zoneinfo import ZoneInfo

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np
import pandas as pd
import torch
import yfinance as yf
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import (
    RandomForestRegressor,
    RandomForestClassifier,
    HistGradientBoostingRegressor,
    HistGradientBoostingClassifier,
)
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.linear_model import SGDRegressor, SGDClassifier
from sklearn.metrics import brier_score_loss, mean_squared_error, mean_absolute_error, precision_recall_fscore_support

torch.set_num_threads(1)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.evaluation.walk_forward import generate_walk_forward_splits
from src.models.lightgbm import LightGBMBenchmark
from src.models.spx_adaptive_v2 import SPXAdaptiveAIv2Model
from src.models.calibration import ProbabilityCalibrator
from src.trading.paper_engine import PaperTradingEngine
from src.features.pipeline import FeaturePipeline

MODELS_DIR = PROJECT_ROOT / "artifacts" / "models" / "comparison"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
COMPARISON_SCRIPTS_DIR = SCRIPTS_DIR / "comparison"
COMPARISON_SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
EVAL_STATS_DIR = PROJECT_ROOT / "artifacts" / "models" / "evaluation_stats"
EVAL_STATS_DIR.mkdir(parents=True, exist_ok=True)


def _sigmoid(z: float) -> float:
    z_clamped = max(-20.0, min(20.0, float(z)))
    return 1.0 / (1.0 + math.exp(-z_clamped))


class GenericMLWrapper:
    """Standardized multi-task ML model wrapper for inference and evaluation."""
    def __init__(self, name: str, models: Dict[str, Any], scaler: StandardScaler, platt: ProbabilityCalibrator):
        self.name = name
        self.models = models
        self.scaler = scaler
        self.platt = platt
        self.feature_names: List[str] = []

    def predict(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        X_clean = X[self.feature_names].copy().fillna(0.0)
        X_scaled = self.scaler.transform(X_clean)

        preds: Dict[str, np.ndarray] = {}

        # 1. Close-up
        if "y_close_up" in self.models:
            m = self.models["y_close_up"]
            if hasattr(m, "predict_proba"):
                preds["p_close_up"] = m.predict_proba(X_scaled)[:, 1]
            elif hasattr(m, "decision_function"):
                df = m.decision_function(X_scaled)
                preds["p_close_up"] = 1.0 / (1.0 + np.exp(-np.clip(df, -20.0, 20.0)))
            else:
                preds["p_close_up"] = np.clip(m.predict(X_scaled), 0.0, 1.0)
        else:
            preds["p_close_up"] = np.full(len(X), 0.50)

        # 2. Touch-up
        if "y_touch_up" in self.models:
            m = self.models["y_touch_up"]
            if hasattr(m, "predict_proba"):
                raw_touch = m.predict_proba(X_scaled)[:, 1]
            elif hasattr(m, "decision_function"):
                df = m.decision_function(X_scaled)
                raw_touch = 1.0 / (1.0 + np.exp(-np.clip(df, -20.0, 20.0)))
            else:
                raw_touch = np.clip(m.predict(X_scaled), 0.0, 1.0)
            preds["raw_p_touch_up"] = raw_touch
            preds["p_touch_up"] = self.platt.calibrate(raw_touch)
        else:
            preds["p_touch_up"] = np.full(len(X), 0.90)

        # 3. r_1
        if "r_1" in self.models:
            preds["r_1"] = self.models["r_1"].predict(X_scaled)
        else:
            preds["r_1"] = np.zeros(len(X))

        # 4. r_path_30m
        if "r_path_30m" in self.models:
            preds["r_path_30m"] = self.models["r_path_30m"].predict(X_scaled)
        else:
            preds["r_path_30m"] = preds["r_1"] * 6.0

        return preds

    def evaluate_bar(
        self,
        feat_row: pd.Series,
        v2_raw_score: float,
        vol_ok: bool,
        in_entry: bool,
        tp_points: float,
        sl_points: float,
        ref_price: float,
    ) -> Dict[str, Any]:
        df_single = pd.DataFrame([feat_row])
        preds = self.predict(df_single)

        ml_r1 = float(preds["r_1"][0])
        p_close_up = float(preds["p_close_up"][0])
        p_touch_up = float(preds["p_touch_up"][0])
        ml_path_30m = float(preds["r_path_30m"][0])

        ml_score = (
            0.50 * (p_close_up - 0.50) * 4.0
            + 0.30 * np.clip(ml_r1 * 2500.0, -2.0, 2.0)
            + 0.20 * np.clip(ml_path_30m * 1000.0, -2.0, 2.0)
        )

        v2_norm = float(np.clip(v2_raw_score / 3.50, -1.0, 1.0))
        hybrid_score = 0.55 * ml_score + 0.45 * v2_norm

        can_trade = vol_ok and in_entry

        if can_trade and hybrid_score >= 0.32 and ml_score >= 0.04:
            action = "LONG"
            direction = "UP"
        elif can_trade and hybrid_score <= -0.32 and ml_score <= -0.04:
            action = "SHORT"
            direction = "DOWN"
        else:
            action = "HOLD"
            direction = "UP" if hybrid_score >= 0 else "DOWN"

        return {
            "name": self.name,
            "hybrid_score": round(float(hybrid_score), 4),
            "ml_score": round(float(ml_score), 4),
            "p_touch_up": round(float(p_touch_up), 4),
            "p_close_up": round(float(p_close_up), 4),
            "ml_r1": ml_r1,
            "action": action,
            "direction": direction,
            "expected_price_5m": round(ref_price * (1.0 + ml_r1), 2),
            "tp_points": tp_points,
            "sl_points": sl_points,
        }


def train_all_models() -> Tuple[List[GenericMLWrapper], pd.DataFrame, pd.DataFrame, List[int], List[str]]:
    print("Loading canonical features and targets...")
    df_feat = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "features.parquet")
    df_tgt = pd.read_parquet(PROJECT_ROOT / "data" / "labels" / "targets.parquet")

    feature_cols = [c for c in df_feat.columns if c != "timestamp"]
    total_rows = len(df_feat)
    train_idx, val_idx, test_idx = generate_walk_forward_splits(total_rows, 0.60, 0.20, 0.20, 6, 2)

    X_train = df_feat.iloc[train_idx][feature_cols].copy().fillna(0.0)
    y_train = df_tgt.iloc[train_idx]
    X_val = df_feat.iloc[val_idx][feature_cols].copy().fillna(0.0)
    y_val = df_tgt.iloc[val_idx]

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # Masks for finite targets
    mask_tr_r1 = ~y_train["r_1"].isna()
    mask_tr_close = ~y_train["y_close_up"].isna()
    mask_tr_path = ~y_train["r_path_30m"].isna()
    mask_tr_touch = ~y_train["y_touch_up"].isna()

    mask_val_tu = ~y_val["y_touch_up"].isna()
    y_val_tu = y_val.loc[mask_val_tu, "y_touch_up"].astype(int).values

    # 1. Option A (LightGBM)
    print("\n[1/5] Training Option A (LightGBM Benchmark GBDT)...")
    opt_a_benchmark = LightGBMBenchmark(random_seed=42)
    opt_a_benchmark.fit(df_feat.iloc[train_idx], y_train, feature_cols=feature_cols)
    val_preds_lgb = opt_a_benchmark.predict(df_feat.iloc[val_idx])
    platt_opt_a = ProbabilityCalibrator(method="platt").fit(y_val_tu, val_preds_lgb["p_touch_up"][mask_val_tu])
    wrapper_opt_a = GenericMLWrapper("Option A (LightGBM)", opt_a_benchmark.models, opt_a_benchmark.scaler, platt_opt_a)
    wrapper_opt_a.feature_names = feature_cols

    # 2. Random Forest (RF)
    print("\n[2/5] Training Random Forest (RF Ensemble)...")
    rf_models = {}
    rf_r1 = RandomForestRegressor(n_estimators=35, max_depth=6, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    rf_models["r_1"] = rf_r1

    rf_close = RandomForestClassifier(n_estimators=30, max_depth=6, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_close.fit(X_train_scaled[mask_tr_close], y_train.loc[mask_tr_close, "y_close_up"].astype(int))
    rf_models["y_close_up"] = rf_close

    rf_path = RandomForestRegressor(n_estimators=25, max_depth=6, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_path.fit(X_train_scaled[mask_tr_path], y_train.loc[mask_tr_path, "r_path_30m"])
    rf_models["r_path_30m"] = rf_path

    rf_touch = RandomForestClassifier(n_estimators=20, max_depth=5, min_samples_leaf=40, n_jobs=-1, random_state=42)
    rf_touch.fit(X_train_scaled[mask_tr_touch], y_train.loc[mask_tr_touch, "y_touch_up"].astype(int))
    rf_models["y_touch_up"] = rf_touch

    rf_val_touch = rf_touch.predict_proba(X_val_scaled)[:, 1]
    platt_rf = ProbabilityCalibrator(method="platt").fit(y_val_tu, rf_val_touch[mask_val_tu])
    wrapper_rf = GenericMLWrapper("Random Forest (RF)", rf_models, scaler, platt_rf)
    wrapper_rf.feature_names = feature_cols

    # 3. HistGradientBoosting (HGBM / XGBoost-style GBDT)
    print("\n[3/5] Training HistGradientBoosting (HGBM / XGBoost-style GBDT)...")
    hgbm_models = {}
    hgbm_r1 = HistGradientBoostingRegressor(max_iter=35, max_depth=5, min_samples_leaf=40, random_state=42)
    hgbm_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    hgbm_models["r_1"] = hgbm_r1

    hgbm_close = HistGradientBoostingClassifier(max_iter=30, max_depth=5, min_samples_leaf=40, random_state=42)
    hgbm_close.fit(X_train_scaled[mask_tr_close], y_train.loc[mask_tr_close, "y_close_up"].astype(int))
    hgbm_models["y_close_up"] = hgbm_close

    hgbm_path = HistGradientBoostingRegressor(max_iter=25, max_depth=5, min_samples_leaf=40, random_state=42)
    hgbm_path.fit(X_train_scaled[mask_tr_path], y_train.loc[mask_tr_path, "r_path_30m"])
    hgbm_models["r_path_30m"] = hgbm_path

    hgbm_touch = HistGradientBoostingClassifier(max_iter=20, max_depth=4, min_samples_leaf=40, random_state=42)
    hgbm_touch.fit(X_train_scaled[mask_tr_touch], y_train.loc[mask_tr_touch, "y_touch_up"].astype(int))
    hgbm_models["y_touch_up"] = hgbm_touch

    hgbm_val_touch = hgbm_touch.predict_proba(X_val_scaled)[:, 1]
    platt_hgbm = ProbabilityCalibrator(method="platt").fit(y_val_tu, hgbm_val_touch[mask_val_tu])
    wrapper_hgbm = GenericMLWrapper("HistGradientBoosting (HGBM)", hgbm_models, scaler, platt_hgbm)
    wrapper_hgbm.feature_names = feature_cols

    # 4. Multilayer Perceptron (MLP Neural Network)
    print("\n[4/5] Training Multilayer Perceptron (MLP Deep Neural Network)...")
    mlp_models = {}
    mlp_r1 = MLPRegressor(hidden_layer_sizes=(32, 16), activation="relu", max_iter=30, batch_size=256, random_state=42)
    mlp_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    mlp_models["r_1"] = mlp_r1

    mlp_close = MLPClassifier(hidden_layer_sizes=(32, 16), activation="relu", max_iter=30, batch_size=256, random_state=42)
    mlp_close.fit(X_train_scaled[mask_tr_close], y_train.loc[mask_tr_close, "y_close_up"].astype(int))
    mlp_models["y_close_up"] = mlp_close

    mlp_path = MLPRegressor(hidden_layer_sizes=(24, 12), activation="relu", max_iter=25, batch_size=256, random_state=42)
    mlp_path.fit(X_train_scaled[mask_tr_path], y_train.loc[mask_tr_path, "r_path_30m"])
    mlp_models["r_path_30m"] = mlp_path

    mlp_touch = MLPClassifier(hidden_layer_sizes=(24, 12), activation="relu", max_iter=20, batch_size=256, random_state=42)
    mlp_touch.fit(X_train_scaled[mask_tr_touch], y_train.loc[mask_tr_touch, "y_touch_up"].astype(int))
    mlp_models["y_touch_up"] = mlp_touch

    mlp_val_touch = mlp_touch.predict_proba(X_val_scaled)[:, 1]
    platt_mlp = ProbabilityCalibrator(method="platt").fit(y_val_tu, mlp_val_touch[mask_val_tu])
    wrapper_mlp = GenericMLWrapper("Multilayer Perceptron (MLP)", mlp_models, scaler, platt_mlp)
    wrapper_mlp.feature_names = feature_cols

    # 5. Support Vector Machine (Linear / Calibrated SGD-SVM)
    print("\n[5/5] Training Support Vector Machine (Linear / SGD-SVM)...")
    svm_models = {}
    svm_r1 = SGDRegressor(loss="squared_error", penalty="l2", alpha=1e-4, max_iter=40, random_state=42)
    svm_r1.fit(X_train_scaled[mask_tr_r1], y_train.loc[mask_tr_r1, "r_1"])
    svm_models["r_1"] = svm_r1

    svm_close = SGDClassifier(loss="log_loss", penalty="l2", alpha=1e-4, max_iter=40, random_state=42)
    svm_close.fit(X_train_scaled[mask_tr_close], y_train.loc[mask_tr_close, "y_close_up"].astype(int))
    svm_models["y_close_up"] = svm_close

    svm_path = SGDRegressor(loss="squared_error", penalty="l2", alpha=1e-4, max_iter=40, random_state=42)
    svm_path.fit(X_train_scaled[mask_tr_path], y_train.loc[mask_tr_path, "r_path_30m"])
    svm_models["r_path_30m"] = svm_path

    svm_touch = SGDClassifier(loss="log_loss", penalty="l2", alpha=1e-4, max_iter=40, random_state=42)
    svm_touch.fit(X_train_scaled[mask_tr_touch], y_train.loc[mask_tr_touch, "y_touch_up"].astype(int))
    svm_models["y_touch_up"] = svm_touch

    svm_val_touch = svm_touch.predict_proba(X_val_scaled)[:, 1]
    platt_svm = ProbabilityCalibrator(method="platt").fit(y_val_tu, svm_val_touch[mask_val_tu])
    wrapper_svm = GenericMLWrapper("Support Vector Machine (SVM)", svm_models, scaler, platt_svm)
    wrapper_svm.feature_names = feature_cols

    all_wrappers = [wrapper_opt_a, wrapper_rf, wrapper_hgbm, wrapper_mlp, wrapper_svm]

    # Save wrapper artifacts
    for w in all_wrappers:
        slug = w.name.split()[0].lower()
        if "option" in slug:
            slug = "option_a"
        if slug == "random":
            save_path = PROJECT_ROOT / "artifacts" / "models" / f"{slug}_wrapper.pkl"
        else:
            save_path = MODELS_DIR / f"{slug}_wrapper.pkl"
        with open(save_path, "wb") as f:
            pickle.dump(w, f)
        print(f"Saved: {save_path}")

    return all_wrappers, df_feat, df_tgt, test_idx, feature_cols


def precompute_v2_signals(df: pd.DataFrame) -> pd.DataFrame:
    """Precompute technical signals, regimes, scores, and brackets across the entire DataFrame."""
    df_sig = df[["timestamp", "open", "high", "low", "close"]].copy()
    df_sig["timestamp"] = pd.to_datetime(df_sig["timestamp"], utc=True)
    ny_tz = ZoneInfo("America/New_York")
    df_sig["ny_time"] = df_sig["timestamp"].dt.tz_convert(ny_tz)
    df_sig["date_ny"] = df_sig["ny_time"].dt.date
    df_sig["time_str"] = df_sig["ny_time"].dt.strftime("%H:%M")

    # EMAs
    df_sig["ema_fast"] = df_sig["close"].ewm(span=9, adjust=False).mean()
    df_sig["ema_mid"] = df_sig["close"].ewm(span=21, adjust=False).mean()
    df_sig["ema_slow"] = df_sig["close"].ewm(span=50, adjust=False).mean()

    # Returns
    df_sig["ret3"] = df_sig["close"].pct_change(3).fillna(0.0)
    df_sig["ret6"] = df_sig["close"].pct_change(6).fillna(0.0)
    df_sig["ret12"] = df_sig["close"].pct_change(12).fillna(0.0)

    # ATR & Volatility
    highs = df_sig["high"].values
    lows = df_sig["low"].values
    closes = df_sig["close"].values
    prev_close = np.roll(closes, 1)
    prev_close[0] = closes[0]
    tr = np.maximum(highs - lows, np.maximum(np.abs(highs - prev_close), np.abs(lows - prev_close)))
    df_sig["atr"] = pd.Series(tr, index=df_sig.index).ewm(alpha=1.0 / 14, adjust=False).mean()
    df_sig["atr_slow"] = df_sig["atr"].rolling(156, min_periods=20).mean().fillna(df_sig["atr"])
    df_sig["vol_ratio"] = df_sig["atr"] / df_sig["atr_slow"].replace(0, np.nan).fillna(1.0)
    df_sig["vol_ok"] = (df_sig["vol_ratio"] >= 0.45) & (df_sig["vol_ratio"] <= 2.50)

    # DMI and ADX
    up_move = np.diff(highs, prepend=highs[0])
    down_move = -np.diff(lows, prepend=lows[0])
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
    tr_smooth = pd.Series(tr, index=df_sig.index).ewm(alpha=1.0 / 14, adjust=False).mean().values
    plus_di = 100.0 * pd.Series(plus_dm, index=df_sig.index).ewm(alpha=1.0 / 14, adjust=False).mean() / np.maximum(tr_smooth, 1e-8)
    minus_di = 100.0 * pd.Series(minus_dm, index=df_sig.index).ewm(alpha=1.0 / 14, adjust=False).mean() / np.maximum(tr_smooth, 1e-8)
    dx_denom = plus_di + minus_di
    dx = 100.0 * (plus_di - minus_di).abs() / dx_denom.replace(0, np.nan).fillna(1.0)
    df_sig["adx"] = dx.ewm(alpha=1.0 / 14, adjust=False).mean().fillna(18.0)
    df_sig["di_plus"] = plus_di
    df_sig["di_minus"] = minus_di

    # RSI
    deltas = np.diff(closes, prepend=closes[0])
    gains = np.maximum(deltas, 0.0)
    losses = np.maximum(-deltas, 0.0)
    avg_gain = pd.Series(gains, index=df_sig.index).ewm(alpha=1.0 / 14, adjust=False).mean()
    avg_loss = pd.Series(losses, index=df_sig.index).ewm(alpha=1.0 / 14, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan).fillna(1e-8)
    df_sig["rsi"] = (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)

    # Intraday cumulative VWAP (TWAP for SPX)
    df_sig["hlc3"] = (df_sig["high"] + df_sig["low"] + df_sig["close"]) / 3.0
    df_sig["vwap"] = df_sig.groupby("date_ny")["hlc3"].transform(lambda s: s.expanding().mean())
    df_sig["vwap_dist_atr"] = (df_sig["close"] - df_sig["vwap"]) / df_sig["atr"].replace(0, np.nan).fillna(1.0)

    # Prior Day High & Low
    day_highs = df_sig.groupby("date_ny")["high"].max()
    day_lows = df_sig.groupby("date_ny")["low"].min()
    unique_dates = sorted(list(df_sig["date_ny"].unique()))
    prior_high_map = {unique_dates[i]: (day_highs[unique_dates[i - 1]] if i > 0 else day_highs[unique_dates[0]]) for i in range(len(unique_dates))}
    prior_low_map = {unique_dates[i]: (day_lows[unique_dates[i - 1]] if i > 0 else day_lows[unique_dates[0]]) for i in range(len(unique_dates))}
    df_sig["prior_day_high"] = df_sig["date_ny"].map(prior_high_map)
    df_sig["prior_day_low"] = df_sig["date_ny"].map(prior_low_map)

    # Opening Range (09:30 - 10:00)
    or_bars = df_sig[(df_sig["time_str"] >= "09:30") & (df_sig["time_str"] <= "10:00")]
    or_high_map = or_bars.groupby("date_ny")["high"].max().to_dict()
    or_low_map = or_bars.groupby("date_ny")["low"].min().to_dict()
    df_sig["or_high"] = df_sig["date_ny"].map(or_high_map).fillna(df_sig["high"])
    df_sig["or_low"] = df_sig["date_ny"].map(or_low_map).fillna(df_sig["low"])
    df_sig["or_ready"] = df_sig["time_str"] > "10:00"

    # Regime & Scores
    df_sig["trend_regime"] = (
        (df_sig["adx"] >= 20.0)
        & (df_sig["ema_mid"] != 0)
        & ((df_sig["ema_mid"] - df_sig["ema_slow"]).abs() / df_sig["ema_mid"] > 0.00015)
    )

    # Trend score weights: [0.40, 0.70, 0.30, 0.25, 0.65, 0.35, 0.45, 0.75, 0.30]
    w_trend = [0.40, 0.70, 0.30, 0.25, 0.65, 0.35, 0.45, 0.75, 0.30]
    t_score = np.zeros(len(df_sig))
    t_score += np.where(df_sig["ema_fast"] > df_sig["ema_mid"], w_trend[0], -w_trend[0])
    t_score += np.where(df_sig["ema_mid"] > df_sig["ema_slow"], w_trend[1], -w_trend[1])
    t_score += np.where(df_sig["ret3"] > 0, w_trend[2], -w_trend[2])
    t_score += np.where(df_sig["ret6"] > 0, w_trend[3], -w_trend[3])
    t_score += np.where(df_sig["ret12"] > 0, w_trend[4], -w_trend[4])
    t_score += np.where(df_sig["di_plus"] > df_sig["di_minus"], w_trend[5], -w_trend[5])
    t_score += np.where(df_sig["close"] > df_sig["vwap"], w_trend[6], -w_trend[6])
    t_score += np.where(df_sig["or_ready"] & (df_sig["close"] > df_sig["or_high"]), w_trend[7], 0.0)
    t_score -= np.where(df_sig["or_ready"] & (df_sig["close"] < df_sig["or_low"]), w_trend[7], 0.0)
    t_score += np.where(df_sig["close"] > df_sig["prior_day_high"], w_trend[8], 0.0)
    t_score -= np.where(df_sig["close"] < df_sig["prior_day_low"], w_trend[8], 0.0)

    # Range score weights: [0.60, 1.10, 0.20, 0.15]
    w_range = [0.60, 1.10, 0.20, 0.15]
    r_score = np.zeros(len(df_sig))
    r_score += np.where(df_sig["vwap_dist_atr"] < -0.90, w_range[0], 0.0)
    r_score -= np.where(df_sig["vwap_dist_atr"] > 0.90, w_range[0], 0.0)
    r_score += np.where(df_sig["rsi"] < 32.0, w_range[1], 0.0)
    r_score -= np.where(df_sig["rsi"] > 68.0, w_range[1], 0.0)
    r_score += np.where(df_sig["close"] > df_sig["ema_fast"], w_range[2], -w_range[2])
    r_score += np.where(df_sig["di_plus"] > df_sig["di_minus"], w_range[3], -w_range[3])

    df_sig["v2_raw_score"] = np.where(df_sig["trend_regime"], t_score, r_score)
    df_sig["in_entry"] = (df_sig["time_str"] >= "09:35") & (df_sig["time_str"] <= "15:50")
    df_sig["tp_points"] = (2.0 * df_sig["atr"]).round(2)
    df_sig["sl_points"] = (1.0 * df_sig["atr"]).round(2)

    return df_sig


def evaluate_backtest_simulation(
    wrapper: GenericMLWrapper,
    df_feat_slice: pd.DataFrame,
    df_sig_slice: pd.DataFrame,
) -> Dict[str, Any]:
    """Execute chronological paper trading backtest using the PaperTradingEngine."""
    preds = wrapper.predict(df_feat_slice)
    ml_r1 = preds["r_1"]
    p_close_up = preds["p_close_up"]
    ml_path_30m = preds["r_path_30m"]

    ml_score = (
        0.50 * (p_close_up - 0.50) * 4.0
        + 0.30 * np.clip(ml_r1 * 2500.0, -2.0, 2.0)
        + 0.20 * np.clip(ml_path_30m * 1000.0, -2.0, 2.0)
    )

    v2_raw = df_sig_slice["v2_raw_score"].values
    v2_norm = np.clip(v2_raw / 3.50, -1.0, 1.0)
    hybrid_score = 0.55 * ml_score + 0.45 * v2_norm

    vol_ok = df_sig_slice["vol_ok"].values
    in_entry = df_sig_slice["in_entry"].values
    can_trade = vol_ok & in_entry

    actions = np.full(len(df_sig_slice), "HOLD", dtype=object)
    long_mask = can_trade & (hybrid_score >= 0.32) & (ml_score >= 0.04)
    short_mask = can_trade & (hybrid_score <= -0.32) & (ml_score <= -0.04)
    actions[long_mask] = "LONG"
    actions[short_mask] = "SHORT"

    engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=0.15,
        slippage_points=0.0,
        take_profit_points=None,
        stop_loss_points=None,
        max_bars_held=6,
    )

    n_bars = len(df_sig_slice)
    for i in range(n_bars - 1):
        next_bar = df_sig_slice.iloc[i + 1]
        ts = pd.to_datetime(next_bar["timestamp"]).to_pydatetime()
        act = actions[i]

        if engine.active_trade is None:
            engine.take_profit_points = float(df_sig_slice["tp_points"].iloc[i])
            engine.stop_loss_points = float(df_sig_slice["sl_points"].iloc[i])

        engine.process_decision(
            forecast_id=f"{wrapper.name}-{i}",
            timestamp=ts,
            action=act,
            fill_price=float(next_bar["open"]),
            high=float(next_bar["high"]),
            low=float(next_bar["low"]),
        )

    # Close active trade at the end of simulation
    if engine.active_trade is not None:
        last_bar = df_sig_slice.iloc[-1]
        engine.close_all_positions(
            pd.to_datetime(last_bar["timestamp"]).to_pydatetime(),
            float(last_bar["close"]),
        )

    perf = engine.get_performance_summary()

    return {
        "model": wrapper.name,
        "net_pnl_pts": round(perf.net_pnl, 2),
        "gross_pnl_pts": round(perf.gross_pnl, 2),
        "win_rate_pct": round(perf.win_rate * 100.0, 2),
        "profit_factor": round(perf.profit_factor, 3) if perf.profit_factor != float("inf") else 99.99,
        "max_drawdown_pts": round(perf.max_drawdown, 2),
        "total_trades": perf.total_trades,
        "long_trades": int(np.sum(actions == "LONG")),
        "short_trades": int(np.sum(actions == "SHORT")),
        "hold_bars": int(np.sum(actions == "HOLD")),
    }


def evaluate_statistical_metrics(
    wrapper: GenericMLWrapper,
    df_feat_test: pd.DataFrame,
    df_tgt_test: pd.DataFrame,
) -> Dict[str, Any]:
    """Calculate out-of-sample ML classification & regression statistics."""
    preds = wrapper.predict(df_feat_test)

    # 1. Classification metrics on y_close_up
    mask_cu = ~df_tgt_test["y_close_up"].isna()
    y_true_cu = df_tgt_test.loc[mask_cu, "y_close_up"].astype(int).values
    p_pred_cu = preds["p_close_up"][mask_cu]
    y_pred_cu = (p_pred_cu >= 0.50).astype(int)

    dir_acc = float(np.mean(y_pred_cu == y_true_cu)) * 100.0
    brier_cu = float(brier_score_loss(y_true_cu, p_pred_cu))
    prec, rec, f1, _ = precision_recall_fscore_support(y_true_cu, y_pred_cu, average="binary", zero_division=0)

    # 2. Touch-up Brier score
    mask_tu = ~df_tgt_test["y_touch_up"].isna()
    y_true_tu = df_tgt_test.loc[mask_tu, "y_touch_up"].astype(int).values
    p_pred_tu = preds["p_touch_up"][mask_tu]
    brier_tu = float(brier_score_loss(y_true_tu, p_pred_tu))

    # 3. Regression metrics on r_1
    mask_r1 = ~df_tgt_test["r_1"].isna()
    y_true_r1 = df_tgt_test.loc[mask_r1, "r_1"].values
    r1_pred = preds["r_1"][mask_r1]
    rmse_r1 = float(np.sqrt(mean_squared_error(y_true_r1, r1_pred)))
    mae_r1 = float(mean_absolute_error(y_true_r1, r1_pred))

    return {
        "model": wrapper.name,
        "directional_accuracy_pct": round(dir_acc, 2),
        "brier_close_up": round(brier_cu, 4),
        "brier_touch_up_calibrated": round(brier_tu, 4),
        "precision_up": round(float(prec) * 100.0, 2),
        "recall_up": round(float(rec) * 100.0, 2),
        "f1_score_up": round(float(f1), 4),
        "r1_rmse": round(rmse_r1, 6),
        "r1_mae": round(mae_r1, 6),
    }


def evaluate_previous_week_daily(
    all_wrappers: List[GenericMLWrapper],
    feature_cols: List[str],
) -> Dict[str, Dict[str, Any]]:
    """Run bar-by-bar evaluation across each session of the previous week (Nov 09 - Nov 13, 2026)."""
    print("\nDownloading and preparing previous week 5m bars from Yahoo Finance...")
    yf_df = yf.Ticker("^GSPC").history(period="12d", interval="5m").reset_index()
    yf_df = yf_df.rename(
        columns={"Datetime": "timestamp", "Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"}
    )
    ny_tz = ZoneInfo("America/New_York")
    yf_df["timestamp"] = pd.to_datetime(yf_df["timestamp"]).dt.tz_convert(ny_tz)
    yf_df["date"] = yf_df["timestamp"].dt.strftime("%Y-%m-%d")

    week_dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]
    pipe = FeaturePipeline()

    # Pre-warm history from canonical dataset up to Nov 06 close
    df_canon = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "spx_5m_canonical.parquet")
    df_canon["timestamp"] = pd.to_datetime(df_canon["timestamp"], utc=True).dt.tz_convert(ny_tz)
    cutoff_warmup = pd.to_datetime("2026-11-09 00:00:00-05:00")
    canon_warmup = df_canon[df_canon["timestamp"] < cutoff_warmup].tail(250).copy()

    combined_history = pd.concat([canon_warmup, yf_df[yf_df["date"].isin(week_dates)]], ignore_index=True)
    combined_history = combined_history.sort_values("timestamp").reset_index(drop=True)

    # Compute features and v2 signals across the entire combined week history
    full_feats = pipe.compute_features(combined_history)
    full_sigs = precompute_v2_signals(combined_history)

    daily_results: Dict[str, Dict[str, Any]] = {d: {} for d in week_dates}

    for d in week_dates:
        mask_day = full_sigs["date_ny"].astype(str) == d
        day_sigs = full_sigs[mask_day].copy()
        day_feats = full_feats[mask_day].copy()

        if len(day_sigs) == 0:
            print(f"Warning: No bars found for {d}")
            continue

        for wrapper in all_wrappers:
            bt = evaluate_backtest_simulation(wrapper, day_feats[feature_cols], day_sigs)
            daily_results[d][wrapper.name] = {
                "net_pnl_pts": bt["net_pnl_pts"],
                "gross_pnl_pts": bt["gross_pnl_pts"],
                "win_rate_pct": bt["win_rate_pct"],
                "total_trades": bt["total_trades"],
                "long_trades": bt["long_trades"],
                "short_trades": bt["short_trades"],
            }

    return daily_results


# =============================================================================
# PINE SCRIPT EXPORTERS FOR ALL METHODS
# =============================================================================

def _sktree_to_dict(tree, node_id: int = 0) -> dict:
    if tree.children_left[node_id] == -1 and tree.children_right[node_id] == -1:
        return {"leaf_value": float(tree.value[node_id][0, 0])}
    return {
        "split_feature": int(tree.feature[node_id]),
        "threshold": float(tree.threshold[node_id]),
        "left_child": _sktree_to_dict(tree, tree.children_left[node_id]),
        "right_child": _sktree_to_dict(tree, tree.children_right[node_id]),
    }


def _hgbm_nodes_to_dict(nodes, idx: int = 0) -> dict:
    n = nodes[idx]
    if n["is_leaf"]:
        return {"leaf_value": float(n["value"])}
    return {
        "split_feature": int(n["feature_idx"]),
        "threshold": float(n["num_threshold"]),
        "left_child": _hgbm_nodes_to_dict(nodes, int(n["left"])),
        "right_child": _hgbm_nodes_to_dict(nodes, int(n["right"])),
    }


def _compile_tree_to_expr(node: dict, sc_mean: List[float], sc_scale: List[float]) -> str:
    if "leaf_value" in node:
        return f"{float(node['leaf_value']):.6g}"
    f = int(node["split_feature"])
    thr_raw = float(sc_mean[f]) + float(sc_scale[f]) * float(node["threshold"])
    left_s = _compile_tree_to_expr(node["left_child"], sc_mean, sc_scale)
    right_s = _compile_tree_to_expr(node["right_child"], sc_mean, sc_scale)
    return f"(x{f} <= {thr_raw:.7g} ? {left_s} : {right_s})"


def export_random_forest_pine(
    wrapper: GenericMLWrapper,
    output_path: Path,
) -> None:
    """Generate SPX_Adaptive_v2_ML_RandomForest.pine with unrolled native RF trees."""
    scaler = wrapper.scaler
    sc_mean = [float(v) for v in scaler.mean_]
    sc_scale = [float(v) for v in scaler.scale_]
    platt_coef = float(wrapper.platt.model.coef_[0][0])
    platt_intercept = float(wrapper.platt.model.intercept_[0])

    # Convert RF trees
    code_blocks = []
    heads = [("r1", "r_1", wrapper.models["r_1"]), ("cu", "y_close_up", wrapper.models["y_close_up"]),
             ("p30", "r_path_30m", wrapper.models["r_path_30m"]), ("tu", "y_touch_up", wrapper.models["y_touch_up"])]

    for tag, name, model in heads:
        trees = model.estimators_
        fn_calls = []
        fn_defs = []
        chunk_size = 5
        for b_idx, start in enumerate(range(0, len(trees), chunk_size)):
            chunk = trees[start : start + chunk_size]
            exprs = []
            used_feats = set()
            for t in chunk:
                td = _sktree_to_dict(t.tree_)
                exprs.append(_compile_tree_to_expr(td, sc_mean, sc_scale))
            # extract used feats
            for e in exprs:
                for match in re.findall(r'x(\d+)', e):
                    used_feats.add(int(match))
            loads = [f"    float x{f} = array.get(x, {f})" for f in sorted(used_feats)]
            adds = [f"    acc += {e}" for e in exprs]
            fn_name = f"f_{tag}_{b_idx}"
            fn_calls.append(f"{fn_name}(x)")
            body = "\n".join(loads + ["    float acc = 0.0"] + adds + ["    acc"])
            fn_defs.append(f"{fn_name}(array<float> x) =>\n{body}")

        sum_expr = " + ".join(fn_calls)
        n_t = len(trees)
        fn_defs.append(f"f_eval_{tag}(array<float> x) =>\n    ({sum_expr}) / {float(n_t):.1f}")
        code_blocks.append("\n\n".join(fn_defs))

    trees_code = "\n\n".join(code_blocks)

    pine_template = f'''//@version=6
strategy(
     title="SPX Adaptive v2 + Trained Random Forest ML [Native Pine]",
     shorttitle="SPX v2+RF",
     overlay=true,
     initial_capital=100000,
     default_qty_type=strategy.fixed,
     default_qty_value=1,
     commission_type=strategy.commission.cash_per_order,
     commission_value=0.15,
     slippage=0,
     pyramiding=0,
     calc_on_every_tick=false,
     process_orders_on_close=false,
     max_bars_back=500)

// =============================================================================
// METHOD 1: NATIVE RANDOM FOREST ENSEMBLE + ADAPTIVE v2 (FAST COMPILED TREES)
// -----------------------------------------------------------------------------
// Model: RandomForestRegressor & RandomForestClassifier (35 r1, 30 cu, 25 p30, 20 tu trees)
// Unscaled StandardScaler folded into tree split thresholds. Zero runtime dependencies.
// Platt Calibrator: coef={platt_coef:.8f}, intercept={platt_intercept:.8f}
// =============================================================================

grpSess = "Session"
tz              = input.string("America/New_York", "Session timezone", group=grpSess)
entrySession    = input.session("0935-1550:23456", "Entry window", group=grpSess)
flatSession     = input.session("1555-1600:23456", "Flatten window", group=grpSess)
openingSession  = input.session("0930-1000:23456", "Opening range window", group=grpSess)

grpHybrid = "Hybrid Fusion (Adaptive v2 + Random Forest)"
mlWeight        = input.float(0.55, "ML weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
adaptiveWeight  = input.float(0.45, "Adaptive v2 weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
fusionThr       = input.float(0.32, "Hybrid entry threshold", minval=0.05, maxval=1.0, step=0.02, group=grpHybrid)
minMlConfirm    = input.float(0.04, "Minimum ML score confirmation", minval=0.0, maxval=0.5, step=0.01, group=grpHybrid)

grpRisk = "Risk Management"
tpAtr           = input.float(2.00, "Take profit (ATR)", minval=0.25, step=0.05, group=grpRisk)
slAtr           = input.float(1.00, "Stop loss (ATR)", minval=0.25, step=0.05, group=grpRisk)
maxHoldBars     = input.int(6, "Maximum holding bars", minval=1, maxval=24, group=grpRisk)

// ─── Technical Indicators ────────────────────────────────────────────────────
inEntryWindow = not na(time(timeframe.period, entrySession, tz))
isFlatTime    = not na(time(timeframe.period, flatSession, tz))
inOpening     = not na(time(timeframe.period, openingSession, tz))

emaFast = ta.ema(close, 9)
emaMid  = ta.ema(close, 21)
emaSlow = ta.ema(close, 50)
atr14   = ta.atr(14)
atrSlow = ta.sma(atr14, 156)
rsi14   = ta.rsi(close, 14)
[diPlus, diMinus, adx14] = ta.dmi(14, 14)

volRatio = (atrSlow > 0 ? atr14 / atrSlow : 1.0)
volOk    = volRatio >= 0.45 and volRatio <= 2.50

var float sessHlcSum = 0.0
var int   sessHlcCnt = 0
if ta.change(time("D", tz)) != 0
    sessHlcSum := 0.0
    sessHlcCnt := 0
sessHlcSum += (high + low + close) / 3.0
sessHlcCnt += 1
sessVwap = sessHlcSum / sessHlcCnt

var float orHigh = na
var float orLow  = na
var bool  orReady = false
if ta.change(time("D", tz)) != 0
    orHigh  := na
    orLow   := na
    orReady := false

if inOpening
    orHigh := na(orHigh) ? high : math.max(orHigh, high)
    orLow  := na(orLow)  ? low  : math.min(orLow, low)
else if not na(orHigh)
    orReady := true

var float pdHigh = na
var float pdLow  = na
if ta.change(time("D", tz)) != 0
    pdHigh := high[1]
    pdLow  := low[1]

trendRegime = adx14 >= 20.0 and emaMid != 0 and (math.abs(emaMid - emaSlow) / emaMid > 0.00015)

// Adaptive v2 Score
float trendScore = 0.0
trendScore += (emaFast > emaMid ? 0.40 : -0.40)
trendScore += (emaMid > emaSlow ? 0.70 : -0.70)
trendScore += (close > close[3] ? 0.30 : -0.30)
trendScore += (close > close[6] ? 0.25 : -0.25)
trendScore += (close > close[12] ? 0.65 : -0.65)
trendScore += (diPlus > diMinus ? 0.35 : -0.35)
trendScore += (close > sessVwap ? 0.45 : -0.45)
if orReady
    trendScore += (close > orHigh ? 0.75 : (close < orLow ? -0.75 : 0.0))
trendScore += (close > pdHigh ? 0.30 : (close < pdLow ? -0.30 : 0.0))

float rangeScore = 0.0
float vwapDistAtr = atr14 > 0 ? (close - sessVwap) / atr14 : 0.0
if vwapDistAtr < -0.90
    rangeScore += 0.60
else if vwapDistAtr > 0.90
    rangeScore -= 0.60
if rsi14 < 32.0
    rangeScore += 1.10
else if rsi14 > 68.0
    rangeScore -= 1.10
rangeScore += (close > emaFast ? 0.20 : -0.20)
rangeScore += (diPlus > diMinus ? 0.15 : -0.15)

float v2Score = trendRegime ? trendScore : rangeScore
float v2Norm  = math.min(1.0, math.max(-1.0, v2Score / 3.50))

// ─── 36 Features ─────────────────────────────────────────────────────────────
float logRet1   = close[1] > 0 ? math.log(close / close[1]) : 0.0
float rollVol6  = nz(ta.stdev(logRet1, 6))
float rollVol12 = nz(ta.stdev(logRet1, 12))
float rollVol36 = nz(ta.stdev(logRet1, 36))

var array<float> x = array.new_float(36, 0.0)
f_update_features() =>
    array.set(x, 0, (close - close[1]) / math.max(close[1], 1.0))
    array.set(x, 1, (close - close[3]) / math.max(close[3], 1.0))
    array.set(x, 2, (close - close[6]) / math.max(close[6], 1.0))
    array.set(x, 3, (close - close[12]) / math.max(close[12], 1.0))
    float trRange = math.max(high - low, 1e-6)
    array.set(x, 4, trRange / close)
    array.set(x, 5, math.abs(close - open) / trRange)
    array.set(x, 6, (high - math.max(open, close)) / trRange)
    array.set(x, 7, (math.min(open, close) - low) / trRange)
    array.set(x, 8, (emaFast - emaMid) / close)
    array.set(x, 9, (emaMid - emaSlow) / close)
    array.set(x, 10, (close - emaFast) / close)
    array.set(x, 11, (close - emaMid) / close)
    array.set(x, 12, (close - emaSlow) / close)
    array.set(x, 13, (rsi14 - 50.0) / 50.0)
    array.set(x, 14, adx14 / 100.0)
    array.set(x, 15, diPlus / 100.0)
    array.set(x, 16, diMinus / 100.0)
    array.set(x, 17, (diPlus - diMinus) / 100.0)
    array.set(x, 18, atr14 / close)
    array.set(x, 19, volRatio)
    array.set(x, 20, (close - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 21, orReady ? (close - orHigh) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 22, orReady ? (close - orLow) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 23, (close - pdHigh) / math.max(atr14, 1.0))
    array.set(x, 24, (close - pdLow) / math.max(atr14, 1.0))
    int tod = hour(time, tz) * 60 + minute(time, tz) - (9 * 60 + 30)
    array.set(x, 25, math.sin(2.0 * math.pi * tod / 390.0))
    array.set(x, 26, math.cos(2.0 * math.pi * tod / 390.0))
    array.set(x, 27, float(dayofweek(time, tz)))
    array.set(x, 28, rollVol6)
    array.set(x, 29, rollVol12)
    array.set(x, 30, rollVol36)
    array.set(x, 31, trendRegime ? 1.0 : 0.0)
    array.set(x, 32, (high - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 33, (low - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 34, math.abs(high - close[1]) / close)
    array.set(x, 35, math.abs(low - close[1]) / close)

// ─── Native Random Forest Trees ──────────────────────────────────────────────
{trees_code}

f_sigmoid(float z) => 1.0 / (1.0 + math.exp(-math.max(-20.0, math.min(20.0, z))))

// ─── Execution ───────────────────────────────────────────────────────────────
f_update_features()

float ml_r1 = f_eval_r1(x)
float ml_cu = f_eval_cu(x)
float ml_p30 = f_eval_p30(x)
float ml_tu_raw = f_eval_tu(x)

float p_close_up = math.min(1.0, math.max(0.0, ml_cu))
float raw_touch  = math.min(0.9999, math.max(0.0001, ml_tu_raw))
float platt_touch = f_sigmoid({platt_coef:.8f} * math.log(raw_touch / (1.0 - raw_touch)) + {platt_intercept:.8f})

float ml_score = 0.50 * (p_close_up - 0.50) * 4.0 + 0.30 * math.min(2.0, math.max(-2.0, ml_r1 * 2500.0)) + 0.20 * math.min(2.0, math.max(-2.0, ml_p30 * 1000.0))
float hybridScore = mlWeight * ml_score + adaptiveWeight * v2Norm

canEnter = inEntryWindow and volOk

if canEnter and hybridScore >= fusionThr and ml_score >= minMlConfirm
    strategy.entry("RF_Long", strategy.long)
if canEnter and hybridScore <= -fusionThr and ml_score <= -minMlConfirm
    strategy.entry("RF_Short", strategy.short)

float tpPoints = tpAtr * atr14
float slPoints = slAtr * atr14

strategy.exit("Exit_RF_Long", "RF_Long", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)
strategy.exit("Exit_RF_Short", "RF_Short", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)

var int barsHeld = 0
if strategy.position_size != 0
    barsHeld += 1
else
    barsHeld := 0

if barsHeld >= maxHoldBars or isFlatTime
    strategy.close_all("Hold_Timeout_Or_EOD")

// Visual HUD
var table hud = table.new(position.top_right, 2, 6, bgcolor=color.new(color.black, 20), border_color=color.gray, border_width=1)
if barstate.islast
    table.cell(hud, 0, 0, "Model", text_color=color.white)
    table.cell(hud, 1, 0, "Random Forest Ensemble", text_color=color.yellow)
    table.cell(hud, 0, 1, "Hybrid Score", text_color=color.white)
    table.cell(hud, 1, 1, str.tostring(hybridScore, "#.###"), text_color=hybridScore >= 0.32 ? color.green : (hybridScore <= -0.32 ? color.red : color.gray))
    table.cell(hud, 0, 2, "ML Score", text_color=color.white)
    table.cell(hud, 1, 2, str.tostring(ml_score, "#.###"), text_color=color.aqua)
    table.cell(hud, 0, 3, "P(Close UP)", text_color=color.white)
    table.cell(hud, 1, 3, str.tostring(p_close_up * 100, "#.#") + "%", text_color=color.white)
    table.cell(hud, 0, 4, "Regime", text_color=color.white)
    table.cell(hud, 1, 4, trendRegime ? "TREND" : "RANGE", text_color=trendRegime ? color.green : color.orange)
    table.cell(hud, 0, 5, "Position", text_color=color.white)
    table.cell(hud, 1, 5, strategy.position_size > 0 ? "LONG" : (strategy.position_size < 0 ? "SHORT" : "FLAT"), text_color=strategy.position_size > 0 ? color.green : (strategy.position_size < 0 ? color.red : color.silver))
'''
    output_path.write_text(pine_template, encoding="utf-8")
    print(f"Generated Pine Script: {output_path}")


def export_hist_gbm_pine(
    wrapper: GenericMLWrapper,
    output_path: Path,
) -> None:
    """Generate SPX_Adaptive_v2_ML_HistGBM.pine with unrolled native HistGBM trees."""
    scaler = wrapper.scaler
    sc_mean = [float(v) for v in scaler.mean_]
    sc_scale = [float(v) for v in scaler.scale_]
    platt_coef = float(wrapper.platt.model.coef_[0][0])
    platt_intercept = float(wrapper.platt.model.intercept_[0])

    code_blocks = []
    heads = [("r1", "r_1", wrapper.models["r_1"]), ("cu", "y_close_up", wrapper.models["y_close_up"]),
             ("p30", "r_path_30m", wrapper.models["r_path_30m"]), ("tu", "y_touch_up", wrapper.models["y_touch_up"])]

    for tag, name, model in heads:
        predictors = [p[0] for p in model._predictors]
        fn_calls = []
        fn_defs = []
        chunk_size = 5
        base_raw = float(np.ravel(model._baseline_prediction)[0]) if hasattr(model, "_baseline_prediction") else 0.0

        for b_idx, start in enumerate(range(0, len(predictors), chunk_size)):
            chunk = predictors[start : start + chunk_size]
            exprs = []
            used_feats = set()
            for pred in chunk:
                td = _hgbm_nodes_to_dict(pred.nodes)
                exprs.append(_compile_tree_to_expr(td, sc_mean, sc_scale))
            for e in exprs:
                for match in re.findall(r'x(\d+)', e):
                    used_feats.add(int(match))
            loads = [f"    float x{f} = array.get(x, {f})" for f in sorted(used_feats)]
            adds = [f"    acc += {e}" for e in exprs]
            fn_name = f"f_{tag}_{b_idx}"
            fn_calls.append(f"{fn_name}(x)")
            body = "\n".join(loads + ["    float acc = 0.0"] + adds + ["    acc"])
            fn_defs.append(f"{fn_name}(array<float> x) =>\n{body}")

        sum_expr = " + ".join(fn_calls)
        fn_defs.append(f"f_eval_{tag}(array<float> x) =>\n    {base_raw:.6g} + ({sum_expr})")
        code_blocks.append("\n\n".join(fn_defs))

    trees_code = "\n\n".join(code_blocks)

    pine_template = f'''//@version=6
strategy(
     title="SPX Adaptive v2 + Trained HistGradientBoosting ML [Native Pine]",
     shorttitle="SPX v2+HGBM",
     overlay=true,
     initial_capital=100000,
     default_qty_type=strategy.fixed,
     default_qty_value=1,
     commission_type=strategy.commission.cash_per_order,
     commission_value=0.15,
     slippage=0,
     pyramiding=0,
     calc_on_every_tick=false,
     process_orders_on_close=false,
     max_bars_back=500)

// =============================================================================
// METHOD 2: NATIVE HISTGRADIENTBOOSTING (XGBOOST/GBDT STYLE) + ADAPTIVE v2
// -----------------------------------------------------------------------------
// Model: HistGradientBoostingRegressor & Classifier (35 r1, 30 cu, 25 p30, 20 tu trees)
// Unscaled StandardScaler folded into tree split thresholds. Zero runtime dependencies.
// Platt Calibrator: coef={platt_coef:.8f}, intercept={platt_intercept:.8f}
// =============================================================================

grpSess = "Session"
tz              = input.string("America/New_York", "Session timezone", group=grpSess)
entrySession    = input.session("0935-1550:23456", "Entry window", group=grpSess)
flatSession     = input.session("1555-1600:23456", "Flatten window", group=grpSess)
openingSession  = input.session("0930-1000:23456", "Opening range window", group=grpSess)

grpHybrid = "Hybrid Fusion (Adaptive v2 + HistGradientBoosting)"
mlWeight        = input.float(0.55, "ML weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
adaptiveWeight  = input.float(0.45, "Adaptive v2 weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
fusionThr       = input.float(0.32, "Hybrid entry threshold", minval=0.05, maxval=1.0, step=0.02, group=grpHybrid)
minMlConfirm    = input.float(0.04, "Minimum ML score confirmation", minval=0.0, maxval=0.5, step=0.01, group=grpHybrid)

grpRisk = "Risk Management"
tpAtr           = input.float(2.00, "Take profit (ATR)", minval=0.25, step=0.05, group=grpRisk)
slAtr           = input.float(1.00, "Stop loss (ATR)", minval=0.25, step=0.05, group=grpRisk)
maxHoldBars     = input.int(6, "Maximum holding bars", minval=1, maxval=24, group=grpRisk)

// ─── Technical Indicators ────────────────────────────────────────────────────
inEntryWindow = not na(time(timeframe.period, entrySession, tz))
isFlatTime    = not na(time(timeframe.period, flatSession, tz))
inOpening     = not na(time(timeframe.period, openingSession, tz))

emaFast = ta.ema(close, 9)
emaMid  = ta.ema(close, 21)
emaSlow = ta.ema(close, 50)
atr14   = ta.atr(14)
atrSlow = ta.sma(atr14, 156)
rsi14   = ta.rsi(close, 14)
[diPlus, diMinus, adx14] = ta.dmi(14, 14)

volRatio = (atrSlow > 0 ? atr14 / atrSlow : 1.0)
volOk    = volRatio >= 0.45 and volRatio <= 2.50

var float sessHlcSum = 0.0
var int   sessHlcCnt = 0
if ta.change(time("D", tz)) != 0
    sessHlcSum := 0.0
    sessHlcCnt := 0
sessHlcSum += (high + low + close) / 3.0
sessHlcCnt += 1
sessVwap = sessHlcSum / sessHlcCnt

var float orHigh = na
var float orLow  = na
var bool  orReady = false
if ta.change(time("D", tz)) != 0
    orHigh  := na
    orLow   := na
    orReady := false

if inOpening
    orHigh := na(orHigh) ? high : math.max(orHigh, high)
    orLow  := na(orLow)  ? low  : math.min(orLow, low)
else if not na(orHigh)
    orReady := true

var float pdHigh = na
var float pdLow  = na
if ta.change(time("D", tz)) != 0
    pdHigh := high[1]
    pdLow  := low[1]

trendRegime = adx14 >= 20.0 and emaMid != 0 and (math.abs(emaMid - emaSlow) / emaMid > 0.00015)

// Adaptive v2 Score
float trendScore = 0.0
trendScore += (emaFast > emaMid ? 0.40 : -0.40)
trendScore += (emaMid > emaSlow ? 0.70 : -0.70)
trendScore += (close > close[3] ? 0.30 : -0.30)
trendScore += (close > close[6] ? 0.25 : -0.25)
trendScore += (close > close[12] ? 0.65 : -0.65)
trendScore += (diPlus > diMinus ? 0.35 : -0.35)
trendScore += (close > sessVwap ? 0.45 : -0.45)
if orReady
    trendScore += (close > orHigh ? 0.75 : (close < orLow ? -0.75 : 0.0))
trendScore += (close > pdHigh ? 0.30 : (close < pdLow ? -0.30 : 0.0))

float rangeScore = 0.0
float vwapDistAtr = atr14 > 0 ? (close - sessVwap) / atr14 : 0.0
if vwapDistAtr < -0.90
    rangeScore += 0.60
else if vwapDistAtr > 0.90
    rangeScore -= 0.60
if rsi14 < 32.0
    rangeScore += 1.10
else if rsi14 > 68.0
    rangeScore -= 1.10
rangeScore += (close > emaFast ? 0.20 : -0.20)
rangeScore += (diPlus > diMinus ? 0.15 : -0.15)

float v2Score = trendRegime ? trendScore : rangeScore
float v2Norm  = math.min(1.0, math.max(-1.0, v2Score / 3.50))

// ─── 36 Features ─────────────────────────────────────────────────────────────
float logRet1   = close[1] > 0 ? math.log(close / close[1]) : 0.0
float rollVol6  = nz(ta.stdev(logRet1, 6))
float rollVol12 = nz(ta.stdev(logRet1, 12))
float rollVol36 = nz(ta.stdev(logRet1, 36))

var array<float> x = array.new_float(36, 0.0)
f_update_features() =>
    array.set(x, 0, (close - close[1]) / math.max(close[1], 1.0))
    array.set(x, 1, (close - close[3]) / math.max(close[3], 1.0))
    array.set(x, 2, (close - close[6]) / math.max(close[6], 1.0))
    array.set(x, 3, (close - close[12]) / math.max(close[12], 1.0))
    float trRange = math.max(high - low, 1e-6)
    array.set(x, 4, trRange / close)
    array.set(x, 5, math.abs(close - open) / trRange)
    array.set(x, 6, (high - math.max(open, close)) / trRange)
    array.set(x, 7, (math.min(open, close) - low) / trRange)
    array.set(x, 8, (emaFast - emaMid) / close)
    array.set(x, 9, (emaMid - emaSlow) / close)
    array.set(x, 10, (close - emaFast) / close)
    array.set(x, 11, (close - emaMid) / close)
    array.set(x, 12, (close - emaSlow) / close)
    array.set(x, 13, (rsi14 - 50.0) / 50.0)
    array.set(x, 14, adx14 / 100.0)
    array.set(x, 15, diPlus / 100.0)
    array.set(x, 16, diMinus / 100.0)
    array.set(x, 17, (diPlus - diMinus) / 100.0)
    array.set(x, 18, atr14 / close)
    array.set(x, 19, volRatio)
    array.set(x, 20, (close - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 21, orReady ? (close - orHigh) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 22, orReady ? (close - orLow) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 23, (close - pdHigh) / math.max(atr14, 1.0))
    array.set(x, 24, (close - pdLow) / math.max(atr14, 1.0))
    int tod = hour(time, tz) * 60 + minute(time, tz) - (9 * 60 + 30)
    array.set(x, 25, math.sin(2.0 * math.pi * tod / 390.0))
    array.set(x, 26, math.cos(2.0 * math.pi * tod / 390.0))
    array.set(x, 27, float(dayofweek(time, tz)))
    array.set(x, 28, rollVol6)
    array.set(x, 29, rollVol12)
    array.set(x, 30, rollVol36)
    array.set(x, 31, trendRegime ? 1.0 : 0.0)
    array.set(x, 32, (high - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 33, (low - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 34, math.abs(high - close[1]) / close)
    array.set(x, 35, math.abs(low - close[1]) / close)

// ─── Native HistGradientBoosting Trees ───────────────────────────────────────
{trees_code}

f_sigmoid(float z) => 1.0 / (1.0 + math.exp(-math.max(-20.0, math.min(20.0, z))))

// ─── Execution ───────────────────────────────────────────────────────────────
f_update_features()

float ml_r1 = f_eval_r1(x)
float ml_cu_raw = f_eval_cu(x)
float ml_p30 = f_eval_p30(x)
float ml_tu_raw = f_eval_tu(x)

float p_close_up = f_sigmoid(ml_cu_raw)
float raw_touch  = f_sigmoid(ml_tu_raw)
float platt_touch = f_sigmoid({platt_coef:.8f} * math.log(math.max(0.0001, math.min(0.9999, raw_touch)) / (1.0 - math.max(0.0001, math.min(0.9999, raw_touch)))) + {platt_intercept:.8f})

float ml_score = 0.50 * (p_close_up - 0.50) * 4.0 + 0.30 * math.min(2.0, math.max(-2.0, ml_r1 * 2500.0)) + 0.20 * math.min(2.0, math.max(-2.0, ml_p30 * 1000.0))
float hybridScore = mlWeight * ml_score + adaptiveWeight * v2Norm

canEnter = inEntryWindow and volOk

if canEnter and hybridScore >= fusionThr and ml_score >= minMlConfirm
    strategy.entry("HGBM_Long", strategy.long)
if canEnter and hybridScore <= -fusionThr and ml_score <= -minMlConfirm
    strategy.entry("HGBM_Short", strategy.short)

float tpPoints = tpAtr * atr14
float slPoints = slAtr * atr14

strategy.exit("Exit_HGBM_Long", "HGBM_Long", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)
strategy.exit("Exit_HGBM_Short", "HGBM_Short", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)

var int barsHeld = 0
if strategy.position_size != 0
    barsHeld += 1
else
    barsHeld := 0

if barsHeld >= maxHoldBars or isFlatTime
    strategy.close_all("Hold_Timeout_Or_EOD")

// Visual HUD
var table hud = table.new(position.top_right, 2, 6, bgcolor=color.new(color.black, 20), border_color=color.gray, border_width=1)
if barstate.islast
    table.cell(hud, 0, 0, "Model", text_color=color.white)
    table.cell(hud, 1, 0, "HistGradientBoosting (GBDT)", text_color=color.yellow)
    table.cell(hud, 0, 1, "Hybrid Score", text_color=color.white)
    table.cell(hud, 1, 1, str.tostring(hybridScore, "#.###"), text_color=hybridScore >= 0.32 ? color.green : (hybridScore <= -0.32 ? color.red : color.gray))
    table.cell(hud, 0, 2, "ML Score", text_color=color.white)
    table.cell(hud, 1, 2, str.tostring(ml_score, "#.###"), text_color=color.aqua)
    table.cell(hud, 0, 3, "P(Close UP)", text_color=color.white)
    table.cell(hud, 1, 3, str.tostring(p_close_up * 100, "#.#") + "%", text_color=color.white)
    table.cell(hud, 0, 4, "Regime", text_color=color.white)
    table.cell(hud, 1, 4, trendRegime ? "TREND" : "RANGE", text_color=trendRegime ? color.green : color.orange)
    table.cell(hud, 0, 5, "Position", text_color=color.white)
    table.cell(hud, 1, 5, strategy.position_size > 0 ? "LONG" : (strategy.position_size < 0 ? "SHORT" : "FLAT"), text_color=strategy.position_size > 0 ? color.green : (strategy.position_size < 0 ? color.red : color.silver))
'''
    output_path.write_text(pine_template, encoding="utf-8")
    print(f"Generated Pine Script: {output_path}")


def export_mlp_pine(
    wrapper: GenericMLWrapper,
    output_path: Path,
) -> None:
    """Generate SPX_Adaptive_v2_ML_MLP.pine with unrolled feedforward neural network weights."""
    scaler = wrapper.scaler
    sc_mean = [float(v) for v in scaler.mean_]
    sc_scale = [float(v) for v in scaler.scale_]
    platt_coef = float(wrapper.platt.model.coef_[0][0])
    platt_intercept = float(wrapper.platt.model.intercept_[0])

    # Pre-scale MLP W1 so runtime features do not need manual scaling loops
    # W1_unscaled[i, j] = W1[i, j] / scale[i]
    # b1_unscaled[j] = b1[j] - sum_i( W1[i, j] * mean[i] / scale[i] )
    def _export_mlp_head_pine(name: str, mlp_model) -> str:
        W1 = mlp_model.coefs_[0]  # (36, H1)
        b1 = mlp_model.intercepts_[0]  # (H1,)
        W2 = mlp_model.coefs_[1]  # (H1, H2)
        b2 = mlp_model.intercepts_[1]  # (H2,)
        W3 = mlp_model.coefs_[2]  # (H2, 1)
        b3 = mlp_model.intercepts_[2]  # (1,)

        H1 = W1.shape[1]
        H2 = W2.shape[1]

        W1_adj = np.zeros_like(W1)
        b1_adj = np.copy(b1)
        for j in range(H1):
            shift = 0.0
            for i in range(36):
                w_ij = W1[i, j] / sc_scale[i]
                W1_adj[i, j] = w_ij
                shift += (W1[i, j] * sc_mean[i]) / sc_scale[i]
            b1_adj[j] -= shift

        # Emit Pine functions for Layer 1
        l1_lines = []
        for j in range(H1):
            terms = [f"{W1_adj[i, j]:.5g} * array.get(x, {i})" for i in range(36) if abs(W1_adj[i, j]) > 1e-6]
            terms_expr = " + ".join(terms) if terms else "0.0"
            l1_lines.append(f"    float h1_{j} = math.max(0.0, {b1_adj[j]:.5g} + {terms_expr})")

        # Emit Layer 2
        l2_lines = []
        for k in range(H2):
            terms2 = [f"{W2[j, k]:.5g} * h1_{j}" for j in range(H1) if abs(W2[j, k]) > 1e-6]
            terms2_expr = " + ".join(terms2) if terms2 else "0.0"
            l2_lines.append(f"    float h2_{k} = math.max(0.0, {b2[k]:.5g} + {terms2_expr})")

        # Emit Output
        out_terms = [f"{W3[k, 0]:.5g} * h2_{k}" for k in range(H2) if abs(W3[k, 0]) > 1e-6]
        out_expr = " + ".join(out_terms) if out_terms else "0.0"
        out_line = f"    float out = {b3[0]:.5g} + {out_expr}\n    out"

        full_fn = f"f_mlp_eval_{name}(array<float> x) =>\n" + "\n".join(l1_lines) + "\n" + "\n".join(l2_lines) + "\n" + out_line
        return full_fn

    mlp_r1_code = _export_mlp_head_pine("r1", wrapper.models["r_1"])
    mlp_cu_code = _export_mlp_head_pine("cu", wrapper.models["y_close_up"])
    mlp_p30_code = _export_mlp_head_pine("p30", wrapper.models["r_path_30m"])
    mlp_tu_code = _export_mlp_head_pine("tu", wrapper.models["y_touch_up"])

    mlp_all_code = "\n\n".join([mlp_r1_code, mlp_cu_code, mlp_p30_code, mlp_tu_code])

    pine_template = f'''//@version=6
strategy(
     title="SPX Adaptive v2 + Trained MLP Neural Network ML [Native Pine]",
     shorttitle="SPX v2+MLP",
     overlay=true,
     initial_capital=100000,
     default_qty_type=strategy.fixed,
     default_qty_value=1,
     commission_type=strategy.commission.cash_per_order,
     commission_value=0.15,
     slippage=0,
     pyramiding=0,
     calc_on_every_tick=false,
     process_orders_on_close=false,
     max_bars_back=500)

// =============================================================================
// METHOD 3: NATIVE MULTILAYER PERCEPTRON (MLP NEURAL NETWORK) + ADAPTIVE v2
// -----------------------------------------------------------------------------
// Model: Deep Feedforward Neural Net (Layer 1 ReLU -> Layer 2 ReLU -> Output Linear)
// Weights mathematically pre-folded with StandardScaler parameters.
// Platt Calibrator: coef={platt_coef:.8f}, intercept={platt_intercept:.8f}
// =============================================================================

grpSess = "Session"
tz              = input.string("America/New_York", "Session timezone", group=grpSess)
entrySession    = input.session("0935-1550:23456", "Entry window", group=grpSess)
flatSession     = input.session("1555-1600:23456", "Flatten window", group=grpSess)
openingSession  = input.session("0930-1000:23456", "Opening range window", group=grpSess)

grpHybrid = "Hybrid Fusion (Adaptive v2 + Multilayer Perceptron)"
mlWeight        = input.float(0.55, "ML weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
adaptiveWeight  = input.float(0.45, "Adaptive v2 weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
fusionThr       = input.float(0.32, "Hybrid entry threshold", minval=0.05, maxval=1.0, step=0.02, group=grpHybrid)
minMlConfirm    = input.float(0.04, "Minimum ML score confirmation", minval=0.0, maxval=0.5, step=0.01, group=grpHybrid)

grpRisk = "Risk Management"
tpAtr           = input.float(2.00, "Take profit (ATR)", minval=0.25, step=0.05, group=grpRisk)
slAtr           = input.float(1.00, "Stop loss (ATR)", minval=0.25, step=0.05, group=grpRisk)
maxHoldBars     = input.int(6, "Maximum holding bars", minval=1, maxval=24, group=grpRisk)

// ─── Technical Indicators ────────────────────────────────────────────────────
inEntryWindow = not na(time(timeframe.period, entrySession, tz))
isFlatTime    = not na(time(timeframe.period, flatSession, tz))
inOpening     = not na(time(timeframe.period, openingSession, tz))

emaFast = ta.ema(close, 9)
emaMid  = ta.ema(close, 21)
emaSlow = ta.ema(close, 50)
atr14   = ta.atr(14)
atrSlow = ta.sma(atr14, 156)
rsi14   = ta.rsi(close, 14)
[diPlus, diMinus, adx14] = ta.dmi(14, 14)

volRatio = (atrSlow > 0 ? atr14 / atrSlow : 1.0)
volOk    = volRatio >= 0.45 and volRatio <= 2.50

var float sessHlcSum = 0.0
var int   sessHlcCnt = 0
if ta.change(time("D", tz)) != 0
    sessHlcSum := 0.0
    sessHlcCnt := 0
sessHlcSum += (high + low + close) / 3.0
sessHlcCnt += 1
sessVwap = sessHlcSum / sessHlcCnt

var float orHigh = na
var float orLow  = na
var bool  orReady = false
if ta.change(time("D", tz)) != 0
    orHigh  := na
    orLow   := na
    orReady := false

if inOpening
    orHigh := na(orHigh) ? high : math.max(orHigh, high)
    orLow  := na(orLow)  ? low  : math.min(orLow, low)
else if not na(orHigh)
    orReady := true

var float pdHigh = na
var float pdLow  = na
if ta.change(time("D", tz)) != 0
    pdHigh := high[1]
    pdLow  := low[1]

trendRegime = adx14 >= 20.0 and emaMid != 0 and (math.abs(emaMid - emaSlow) / emaMid > 0.00015)

// Adaptive v2 Score
float trendScore = 0.0
trendScore += (emaFast > emaMid ? 0.40 : -0.40)
trendScore += (emaMid > emaSlow ? 0.70 : -0.70)
trendScore += (close > close[3] ? 0.30 : -0.30)
trendScore += (close > close[6] ? 0.25 : -0.25)
trendScore += (close > close[12] ? 0.65 : -0.65)
trendScore += (diPlus > diMinus ? 0.35 : -0.35)
trendScore += (close > sessVwap ? 0.45 : -0.45)
if orReady
    trendScore += (close > orHigh ? 0.75 : (close < orLow ? -0.75 : 0.0))
trendScore += (close > pdHigh ? 0.30 : (close < pdLow ? -0.30 : 0.0))

float rangeScore = 0.0
float vwapDistAtr = atr14 > 0 ? (close - sessVwap) / atr14 : 0.0
if vwapDistAtr < -0.90
    rangeScore += 0.60
else if vwapDistAtr > 0.90
    rangeScore -= 0.60
if rsi14 < 32.0
    rangeScore += 1.10
else if rsi14 > 68.0
    rangeScore -= 1.10
rangeScore += (close > emaFast ? 0.20 : -0.20)
rangeScore += (diPlus > diMinus ? 0.15 : -0.15)

float v2Score = trendRegime ? trendScore : rangeScore
float v2Norm  = math.min(1.0, math.max(-1.0, v2Score / 3.50))

// ─── 36 Features ─────────────────────────────────────────────────────────────
float logRet1   = close[1] > 0 ? math.log(close / close[1]) : 0.0
float rollVol6  = nz(ta.stdev(logRet1, 6))
float rollVol12 = nz(ta.stdev(logRet1, 12))
float rollVol36 = nz(ta.stdev(logRet1, 36))

var array<float> x = array.new_float(36, 0.0)
f_update_features() =>
    array.set(x, 0, (close - close[1]) / math.max(close[1], 1.0))
    array.set(x, 1, (close - close[3]) / math.max(close[3], 1.0))
    array.set(x, 2, (close - close[6]) / math.max(close[6], 1.0))
    array.set(x, 3, (close - close[12]) / math.max(close[12], 1.0))
    float trRange = math.max(high - low, 1e-6)
    array.set(x, 4, trRange / close)
    array.set(x, 5, math.abs(close - open) / trRange)
    array.set(x, 6, (high - math.max(open, close)) / trRange)
    array.set(x, 7, (math.min(open, close) - low) / trRange)
    array.set(x, 8, (emaFast - emaMid) / close)
    array.set(x, 9, (emaMid - emaSlow) / close)
    array.set(x, 10, (close - emaFast) / close)
    array.set(x, 11, (close - emaMid) / close)
    array.set(x, 12, (close - emaSlow) / close)
    array.set(x, 13, (rsi14 - 50.0) / 50.0)
    array.set(x, 14, adx14 / 100.0)
    array.set(x, 15, diPlus / 100.0)
    array.set(x, 16, diMinus / 100.0)
    array.set(x, 17, (diPlus - diMinus) / 100.0)
    array.set(x, 18, atr14 / close)
    array.set(x, 19, volRatio)
    array.set(x, 20, (close - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 21, orReady ? (close - orHigh) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 22, orReady ? (close - orLow) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 23, (close - pdHigh) / math.max(atr14, 1.0))
    array.set(x, 24, (close - pdLow) / math.max(atr14, 1.0))
    int tod = hour(time, tz) * 60 + minute(time, tz) - (9 * 60 + 30)
    array.set(x, 25, math.sin(2.0 * math.pi * tod / 390.0))
    array.set(x, 26, math.cos(2.0 * math.pi * tod / 390.0))
    array.set(x, 27, float(dayofweek(time, tz)))
    array.set(x, 28, rollVol6)
    array.set(x, 29, rollVol12)
    array.set(x, 30, rollVol36)
    array.set(x, 31, trendRegime ? 1.0 : 0.0)
    array.set(x, 32, (high - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 33, (low - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 34, math.abs(high - close[1]) / close)
    array.set(x, 35, math.abs(low - close[1]) / close)

// ─── Native MLP Neural Network Evaluators ────────────────────────────────────
{mlp_all_code}

f_sigmoid(float z) => 1.0 / (1.0 + math.exp(-math.max(-20.0, math.min(20.0, z))))

// ─── Execution ───────────────────────────────────────────────────────────────
f_update_features()

float ml_r1 = f_mlp_eval_r1(x)
float ml_cu_raw = f_mlp_eval_cu(x)
float ml_p30 = f_mlp_eval_p30(x)
float ml_tu_raw = f_mlp_eval_tu(x)

float p_close_up = f_sigmoid(ml_cu_raw)
float raw_touch  = f_sigmoid(ml_tu_raw)
float platt_touch = f_sigmoid({platt_coef:.8f} * math.log(math.max(0.0001, math.min(0.9999, raw_touch)) / (1.0 - math.max(0.0001, math.min(0.9999, raw_touch)))) + {platt_intercept:.8f})

float ml_score = 0.50 * (p_close_up - 0.50) * 4.0 + 0.30 * math.min(2.0, math.max(-2.0, ml_r1 * 2500.0)) + 0.20 * math.min(2.0, math.max(-2.0, ml_p30 * 1000.0))
float hybridScore = mlWeight * ml_score + adaptiveWeight * v2Norm

canEnter = inEntryWindow and volOk

if canEnter and hybridScore >= fusionThr and ml_score >= minMlConfirm
    strategy.entry("MLP_Long", strategy.long)
if canEnter and hybridScore <= -fusionThr and ml_score <= -minMlConfirm
    strategy.entry("MLP_Short", strategy.short)

float tpPoints = tpAtr * atr14
float slPoints = slAtr * atr14

strategy.exit("Exit_MLP_Long", "MLP_Long", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)
strategy.exit("Exit_MLP_Short", "MLP_Short", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)

var int barsHeld = 0
if strategy.position_size != 0
    barsHeld += 1
else
    barsHeld := 0

if barsHeld >= maxHoldBars or isFlatTime
    strategy.close_all("Hold_Timeout_Or_EOD")

// Visual HUD
var table hud = table.new(position.top_right, 2, 6, bgcolor=color.new(color.black, 20), border_color=color.gray, border_width=1)
if barstate.islast
    table.cell(hud, 0, 0, "Model", text_color=color.white)
    table.cell(hud, 1, 0, "Multilayer Perceptron (MLP)", text_color=color.yellow)
    table.cell(hud, 0, 1, "Hybrid Score", text_color=color.white)
    table.cell(hud, 1, 1, str.tostring(hybridScore, "#.###"), text_color=hybridScore >= 0.32 ? color.green : (hybridScore <= -0.32 ? color.red : color.gray))
    table.cell(hud, 0, 2, "ML Score", text_color=color.white)
    table.cell(hud, 1, 2, str.tostring(ml_score, "#.###"), text_color=color.aqua)
    table.cell(hud, 0, 3, "P(Close UP)", text_color=color.white)
    table.cell(hud, 1, 3, str.tostring(p_close_up * 100, "#.#") + "%", text_color=color.white)
    table.cell(hud, 0, 4, "Regime", text_color=color.white)
    table.cell(hud, 1, 4, trendRegime ? "TREND" : "RANGE", text_color=trendRegime ? color.green : color.orange)
    table.cell(hud, 0, 5, "Position", text_color=color.white)
    table.cell(hud, 1, 5, strategy.position_size > 0 ? "LONG" : (strategy.position_size < 0 ? "SHORT" : "FLAT"), text_color=strategy.position_size > 0 ? color.green : (strategy.position_size < 0 ? color.red : color.silver))
'''
    output_path.write_text(pine_template, encoding="utf-8")
    print(f"Generated Pine Script: {output_path}")


def export_svm_pine(
    wrapper: GenericMLWrapper,
    output_path: Path,
) -> None:
    """Generate SPX_Adaptive_v2_ML_SVM.pine with linear dot product weights."""
    scaler = wrapper.scaler
    sc_mean = [float(v) for v in scaler.mean_]
    sc_scale = [float(v) for v in scaler.scale_]
    platt_coef = float(wrapper.platt.model.coef_[0][0])
    platt_intercept = float(wrapper.platt.model.intercept_[0])

    def _export_svm_head_pine(name: str, svm_model) -> str:
        coef = svm_model.coef_.flatten()
        intercept = float(svm_model.intercept_[0])
        w_adj = coef / np.array(sc_scale)
        b_adj = intercept - np.sum((coef * np.array(sc_mean)) / np.array(sc_scale))

        terms = [f"{w_adj[i]:.6g} * array.get(x, {i})" for i in range(36) if abs(w_adj[i]) > 1e-7]
        terms_expr = " + ".join(terms) if terms else "0.0"
        return f"f_svm_eval_{name}(array<float> x) =>\n    {b_adj:.6g} + {terms_expr}"

    svm_r1_code = _export_svm_head_pine("r1", wrapper.models["r_1"])
    svm_cu_code = _export_svm_head_pine("cu", wrapper.models["y_close_up"])
    svm_p30_code = _export_svm_head_pine("p30", wrapper.models["r_path_30m"])
    svm_tu_code = _export_svm_head_pine("tu", wrapper.models["y_touch_up"])

    svm_all_code = "\n\n".join([svm_r1_code, svm_cu_code, svm_p30_code, svm_tu_code])

    pine_template = f'''//@version=6
strategy(
     title="SPX Adaptive v2 + Trained Support Vector Machine ML [Native Pine]",
     shorttitle="SPX v2+SVM",
     overlay=true,
     initial_capital=100000,
     default_qty_type=strategy.fixed,
     default_qty_value=1,
     commission_type=strategy.commission.cash_per_order,
     commission_value=0.15,
     slippage=0,
     pyramiding=0,
     calc_on_every_tick=false,
     process_orders_on_close=false,
     max_bars_back=500)

// =============================================================================
// METHOD 4: NATIVE SUPPORT VECTOR MACHINE (LINEAR / SGD-SVM) + ADAPTIVE v2
// -----------------------------------------------------------------------------
// Model: Maximum-Margin Hyperplane (SGDClassifier & SGDRegressor)
// Weights mathematically pre-folded with StandardScaler parameters. Ultra-fast dot product.
// Platt Calibrator: coef={platt_coef:.8f}, intercept={platt_intercept:.8f}
// =============================================================================

grpSess = "Session"
tz              = input.string("America/New_York", "Session timezone", group=grpSess)
entrySession    = input.session("0935-1550:23456", "Entry window", group=grpSess)
flatSession     = input.session("1555-1600:23456", "Flatten window", group=grpSess)
openingSession  = input.session("0930-1000:23456", "Opening range window", group=grpSess)

grpHybrid = "Hybrid Fusion (Adaptive v2 + Support Vector Machine)"
mlWeight        = input.float(0.55, "ML weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
adaptiveWeight  = input.float(0.45, "Adaptive v2 weight", minval=0.0, maxval=1.0, step=0.05, group=grpHybrid)
fusionThr       = input.float(0.32, "Hybrid entry threshold", minval=0.05, maxval=1.0, step=0.02, group=grpHybrid)
minMlConfirm    = input.float(0.04, "Minimum ML score confirmation", minval=0.0, maxval=0.5, step=0.01, group=grpHybrid)

grpRisk = "Risk Management"
tpAtr           = input.float(2.00, "Take profit (ATR)", minval=0.25, step=0.05, group=grpRisk)
slAtr           = input.float(1.00, "Stop loss (ATR)", minval=0.25, step=0.05, group=grpRisk)
maxHoldBars     = input.int(6, "Maximum holding bars", minval=1, maxval=24, group=grpRisk)

// ─── Technical Indicators ────────────────────────────────────────────────────
inEntryWindow = not na(time(timeframe.period, entrySession, tz))
isFlatTime    = not na(time(timeframe.period, flatSession, tz))
inOpening     = not na(time(timeframe.period, openingSession, tz))

emaFast = ta.ema(close, 9)
emaMid  = ta.ema(close, 21)
emaSlow = ta.ema(close, 50)
atr14   = ta.atr(14)
atrSlow = ta.sma(atr14, 156)
rsi14   = ta.rsi(close, 14)
[diPlus, diMinus, adx14] = ta.dmi(14, 14)

volRatio = (atrSlow > 0 ? atr14 / atrSlow : 1.0)
volOk    = volRatio >= 0.45 and volRatio <= 2.50

var float sessHlcSum = 0.0
var int   sessHlcCnt = 0
if ta.change(time("D", tz)) != 0
    sessHlcSum := 0.0
    sessHlcCnt := 0
sessHlcSum += (high + low + close) / 3.0
sessHlcCnt += 1
sessVwap = sessHlcSum / sessHlcCnt

var float orHigh = na
var float orLow  = na
var bool  orReady = false
if ta.change(time("D", tz)) != 0
    orHigh  := na
    orLow   := na
    orReady := false

if inOpening
    orHigh := na(orHigh) ? high : math.max(orHigh, high)
    orLow  := na(orLow)  ? low  : math.min(orLow, low)
else if not na(orHigh)
    orReady := true

var float pdHigh = na
var float pdLow  = na
if ta.change(time("D", tz)) != 0
    pdHigh := high[1]
    pdLow  := low[1]

trendRegime = adx14 >= 20.0 and emaMid != 0 and (math.abs(emaMid - emaSlow) / emaMid > 0.00015)

// Adaptive v2 Score
float trendScore = 0.0
trendScore += (emaFast > emaMid ? 0.40 : -0.40)
trendScore += (emaMid > emaSlow ? 0.70 : -0.70)
trendScore += (close > close[3] ? 0.30 : -0.30)
trendScore += (close > close[6] ? 0.25 : -0.25)
trendScore += (close > close[12] ? 0.65 : -0.65)
trendScore += (diPlus > diMinus ? 0.35 : -0.35)
trendScore += (close > sessVwap ? 0.45 : -0.45)
if orReady
    trendScore += (close > orHigh ? 0.75 : (close < orLow ? -0.75 : 0.0))
trendScore += (close > pdHigh ? 0.30 : (close < pdLow ? -0.30 : 0.0))

float rangeScore = 0.0
float vwapDistAtr = atr14 > 0 ? (close - sessVwap) / atr14 : 0.0
if vwapDistAtr < -0.90
    rangeScore += 0.60
else if vwapDistAtr > 0.90
    rangeScore -= 0.60
if rsi14 < 32.0
    rangeScore += 1.10
else if rsi14 > 68.0
    rangeScore -= 1.10
rangeScore += (close > emaFast ? 0.20 : -0.20)
rangeScore += (diPlus > diMinus ? 0.15 : -0.15)

float v2Score = trendRegime ? trendScore : rangeScore
float v2Norm  = math.min(1.0, math.max(-1.0, v2Score / 3.50))

// ─── 36 Features ─────────────────────────────────────────────────────────────
float logRet1   = close[1] > 0 ? math.log(close / close[1]) : 0.0
float rollVol6  = nz(ta.stdev(logRet1, 6))
float rollVol12 = nz(ta.stdev(logRet1, 12))
float rollVol36 = nz(ta.stdev(logRet1, 36))

var array<float> x = array.new_float(36, 0.0)
f_update_features() =>
    array.set(x, 0, (close - close[1]) / math.max(close[1], 1.0))
    array.set(x, 1, (close - close[3]) / math.max(close[3], 1.0))
    array.set(x, 2, (close - close[6]) / math.max(close[6], 1.0))
    array.set(x, 3, (close - close[12]) / math.max(close[12], 1.0))
    float trRange = math.max(high - low, 1e-6)
    array.set(x, 4, trRange / close)
    array.set(x, 5, math.abs(close - open) / trRange)
    array.set(x, 6, (high - math.max(open, close)) / trRange)
    array.set(x, 7, (math.min(open, close) - low) / trRange)
    array.set(x, 8, (emaFast - emaMid) / close)
    array.set(x, 9, (emaMid - emaSlow) / close)
    array.set(x, 10, (close - emaFast) / close)
    array.set(x, 11, (close - emaMid) / close)
    array.set(x, 12, (close - emaSlow) / close)
    array.set(x, 13, (rsi14 - 50.0) / 50.0)
    array.set(x, 14, adx14 / 100.0)
    array.set(x, 15, diPlus / 100.0)
    array.set(x, 16, diMinus / 100.0)
    array.set(x, 17, (diPlus - diMinus) / 100.0)
    array.set(x, 18, atr14 / close)
    array.set(x, 19, volRatio)
    array.set(x, 20, (close - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 21, orReady ? (close - orHigh) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 22, orReady ? (close - orLow) / math.max(atr14, 1.0) : 0.0)
    array.set(x, 23, (close - pdHigh) / math.max(atr14, 1.0))
    array.set(x, 24, (close - pdLow) / math.max(atr14, 1.0))
    int tod = hour(time, tz) * 60 + minute(time, tz) - (9 * 60 + 30)
    array.set(x, 25, math.sin(2.0 * math.pi * tod / 390.0))
    array.set(x, 26, math.cos(2.0 * math.pi * tod / 390.0))
    array.set(x, 27, float(dayofweek(time, tz)))
    array.set(x, 28, rollVol6)
    array.set(x, 29, rollVol12)
    array.set(x, 30, rollVol36)
    array.set(x, 31, trendRegime ? 1.0 : 0.0)
    array.set(x, 32, (high - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 33, (low - sessVwap) / math.max(atr14, 1.0))
    array.set(x, 34, math.abs(high - close[1]) / close)
    array.set(x, 35, math.abs(low - close[1]) / close)

// ─── Native SVM Hyperplane Evaluators ────────────────────────────────────────
{svm_all_code}

f_sigmoid(float z) => 1.0 / (1.0 + math.exp(-math.max(-20.0, math.min(20.0, z))))

// ─── Execution ───────────────────────────────────────────────────────────────
f_update_features()

float ml_r1 = f_svm_eval_r1(x)
float ml_cu_raw = f_svm_eval_cu(x)
float ml_p30 = f_svm_eval_p30(x)
float ml_tu_raw = f_svm_eval_tu(x)

float p_close_up = f_sigmoid(ml_cu_raw)
float raw_touch  = f_sigmoid(ml_tu_raw)
float platt_touch = f_sigmoid({platt_coef:.8f} * math.log(math.max(0.0001, math.min(0.9999, raw_touch)) / (1.0 - math.max(0.0001, math.min(0.9999, raw_touch)))) + {platt_intercept:.8f})

float ml_score = 0.50 * (p_close_up - 0.50) * 4.0 + 0.30 * math.min(2.0, math.max(-2.0, ml_r1 * 2500.0)) + 0.20 * math.min(2.0, math.max(-2.0, ml_p30 * 1000.0))
float hybridScore = mlWeight * ml_score + adaptiveWeight * v2Norm

canEnter = inEntryWindow and volOk

if canEnter and hybridScore >= fusionThr and ml_score >= minMlConfirm
    strategy.entry("SVM_Long", strategy.long)
if canEnter and hybridScore <= -fusionThr and ml_score <= -minMlConfirm
    strategy.entry("SVM_Short", strategy.short)

float tpPoints = tpAtr * atr14
float slPoints = slAtr * atr14

strategy.exit("Exit_SVM_Long", "SVM_Long", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)
strategy.exit("Exit_SVM_Short", "SVM_Short", profit=tpPoints/syminfo.mintick, loss=slPoints/syminfo.mintick)

var int barsHeld = 0
if strategy.position_size != 0
    barsHeld += 1
else
    barsHeld := 0

if barsHeld >= maxHoldBars or isFlatTime
    strategy.close_all("Hold_Timeout_Or_EOD")

// Visual HUD
var table hud = table.new(position.top_right, 2, 6, bgcolor=color.new(color.black, 20), border_color=color.gray, border_width=1)
if barstate.islast
    table.cell(hud, 0, 0, "Model", text_color=color.white)
    table.cell(hud, 1, 0, "Support Vector Machine (SVM)", text_color=color.yellow)
    table.cell(hud, 0, 1, "Hybrid Score", text_color=color.white)
    table.cell(hud, 1, 1, str.tostring(hybridScore, "#.###"), text_color=hybridScore >= 0.32 ? color.green : (hybridScore <= -0.32 ? color.red : color.gray))
    table.cell(hud, 0, 2, "ML Score", text_color=color.white)
    table.cell(hud, 1, 2, str.tostring(ml_score, "#.###"), text_color=color.aqua)
    table.cell(hud, 0, 3, "P(Close UP)", text_color=color.white)
    table.cell(hud, 1, 3, str.tostring(p_close_up * 100, "#.#") + "%", text_color=color.white)
    table.cell(hud, 0, 4, "Regime", text_color=color.white)
    table.cell(hud, 1, 4, trendRegime ? "TREND" : "RANGE", text_color=trendRegime ? color.green : color.orange)
    table.cell(hud, 0, 5, "Position", text_color=color.white)
    table.cell(hud, 1, 5, strategy.position_size > 0 ? "LONG" : (strategy.position_size < 0 ? "SHORT" : "FLAT"), text_color=strategy.position_size > 0 ? color.green : (strategy.position_size < 0 ? color.red : color.silver))
'''
    output_path.write_text(pine_template, encoding="utf-8")
    print(f"Generated Pine Script: {output_path}")


def main():
    print("=" * 80)
    print("STARTING FULL ML METHODS BENCHMARK, COMPARISON & EXPORT SUITE")
    print("=" * 80)

    # 1. Train all models
    t0 = time.time()
    wrappers, df_feat, df_tgt, test_idx, feature_cols = train_all_models()
    print(f"\nAll models trained in {time.time() - t0:.2f}s")

    # 2. Canonical Test Set Evaluation
    print(f"\nEvaluating Out-of-Sample Test Set ({len(test_idx)} bars)...")
    df_canon = pd.read_parquet(PROJECT_ROOT / "data" / "processed" / "spx_5m_canonical.parquet")
    df_sig_full = precompute_v2_signals(df_canon)

    df_feat_test = df_feat.iloc[test_idx][feature_cols].copy().fillna(0.0)
    df_tgt_test = df_tgt.iloc[test_idx].copy()
    df_sig_test = df_sig_full.iloc[test_idx].copy().reset_index(drop=True)

    stat_results = []
    bt_results = []

    for w in wrappers:
        print(f"  -> Testing {w.name}...")
        s_res = evaluate_statistical_metrics(w, df_feat_test, df_tgt_test)
        b_res = evaluate_backtest_simulation(w, df_feat_test, df_sig_test)
        stat_results.append(s_res)
        bt_results.append(b_res)

    df_stats = pd.DataFrame(stat_results)
    df_bts = pd.DataFrame(bt_results)

    print("\n--- Canonical Out-of-Sample Test Set: Statistical Metrics ---")
    print(df_stats.to_string(index=False))

    print("\n--- Canonical Out-of-Sample Test Set: Paper Trading Backtest (0.15 pts cost) ---")
    print(df_bts.to_string(index=False))

    # 3. Previous Week Day-by-Day Evaluation
    print("\nEvaluating Previous Week (Nov 09 - Nov 13, 2026) Day-by-Day Sessions...")
    daily_results = evaluate_previous_week_daily(wrappers, feature_cols)

    # Format daily comparison table
    daily_rows = []
    for d, d_data in daily_results.items():
        for mname, m_res in d_data.items():
            daily_rows.append({
                "Date": d,
                "Model": mname,
                "Net P&L (pts)": m_res["net_pnl_pts"],
                "Win Rate (%)": m_res["win_rate_pct"],
                "Trades": m_res["total_trades"],
                "Longs": m_res["long_trades"],
                "Shorts": m_res["short_trades"],
            })
    df_daily = pd.DataFrame(daily_rows)
    print("\n--- Previous Week Day-by-Day Performance ---")
    print(df_daily.to_string(index=False))

    # 4. Generate Pine Script strategies for all methods
    print("\nGenerating Pine Script v6 strategies for all methods...")
    # RF
    rf_wrapper = [w for w in wrappers if "Random Forest" in w.name][0]
    export_random_forest_pine(rf_wrapper, SCRIPTS_DIR / "SPX_Adaptive_v2_ML_RandomForest.pine")

    # HGBM
    hgbm_wrapper = [w for w in wrappers if "HistGradient" in w.name][0]
    export_hist_gbm_pine(hgbm_wrapper, COMPARISON_SCRIPTS_DIR / "SPX_Adaptive_v2_ML_HistGBM.pine")

    # MLP
    mlp_wrapper = [w for w in wrappers if "Multilayer" in w.name][0]
    export_mlp_pine(mlp_wrapper, COMPARISON_SCRIPTS_DIR / "SPX_Adaptive_v2_ML_MLP.pine")

    # SVM
    svm_wrapper = [w for w in wrappers if "Support Vector" in w.name][0]
    export_svm_pine(svm_wrapper, COMPARISON_SCRIPTS_DIR / "SPX_Adaptive_v2_ML_SVM.pine")

    # Save complete JSON report
    report_data = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "test_set_stats": stat_results,
        "test_set_backtest": bt_results,
        "daily_breakdown": daily_results,
    }
    report_path = EVAL_STATS_DIR / "ml_methods_comparison_report.json"
    with open(report_path, "w") as f:
        json.dump(report_data, f, indent=2)
    print(f"\nSaved full comparison report to: {report_path}")

    print("\n" + "=" * 80)
    print("ALL ML METHODS EVALUATED AND PINE SCRIPTS GENERATED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    main()
