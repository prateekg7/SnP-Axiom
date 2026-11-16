"""
SPX Adaptive v2 + Native LightGBM ML Strategy (Option A).

Exact Python counterpart of `scripts/SPX_Adaptive_v2_ML_Native.pine` for
live-testing and API evaluation using:
  - LightGBMBenchmark (`artifacts/models/lightgbm_benchmark.pkl` + `StandardScaler`):
      * `r_1` (45 trees), `y_close_up` (35 trees), `r_path_30m` (25 trees), `y_touch_up` (20 trees)
  - ProbabilityCalibrator (`artifacts/models/calibrator_platt.pkl`)
  - Exact 36 `FeaturePipeline` features
  - `SPXAdaptiveAIv2Model` regime, intraday structure, and ATR risk brackets
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
import pandas as pd

from src.features.pipeline import FeaturePipeline
from src.models.calibration import ConformalIntervalCalibrator, ProbabilityCalibrator
from src.models.lightgbm import LightGBMBenchmark
from src.models.spx_adaptive_v2 import SPXAdaptiveAIv2Model

DEFAULT_MODELS_DIR = Path("artifacts/models")


def _sigmoid(z: float) -> float:
    z_clamped = max(-20.0, min(20.0, float(z)))
    return 1.0 / (1.0 + math.exp(-z_clamped))


class SPXOptionAMLModel:
    """Option A unified ML + Adaptive v2 live-testing model."""

    def __init__(
        self,
        lgb_model: Optional[LightGBMBenchmark] = None,
        platt_cal: Optional[ProbabilityCalibrator] = None,
        interval_cal: Optional[ConformalIntervalCalibrator] = None,
        feature_pipeline: Optional[FeaturePipeline] = None,
        v2_model: Optional[SPXAdaptiveAIv2Model] = None,
        trees_r1: int = 45,
        trees_close: int = 35,
        trees_path30: int = 25,
        trees_touch: int = 20,
        ml_weight: float = 0.55,
        adaptive_weight: float = 0.45,
        fusion_thr: float = 0.32,
        min_ml_confirm: float = 0.04,
    ) -> None:
        self.lgb_model = lgb_model or LightGBMBenchmark.load(str(DEFAULT_MODELS_DIR / "lightgbm_benchmark.pkl"))
        self.platt_cal = platt_cal or joblib.load(DEFAULT_MODELS_DIR / "calibrator_platt.pkl")
        if interval_cal is not None:
            self.interval_cal = interval_cal
        else:
            interval_path = DEFAULT_MODELS_DIR / "interval_calibrator.pkl"
            self.interval_cal = joblib.load(interval_path) if interval_path.exists() else None

        self.feature_pipeline = feature_pipeline or FeaturePipeline()
        self.v2_model = v2_model or SPXAdaptiveAIv2Model()

        self.trees_r1 = trees_r1
        self.trees_close = trees_close
        self.trees_path30 = trees_path30
        self.trees_touch = trees_touch

        self.ml_weight = ml_weight
        self.adaptive_weight = adaptive_weight
        self.fusion_thr = fusion_thr
        self.min_ml_confirm = min_ml_confirm

    def _platt_calibrate(self, raw_p: float) -> float:
        p_clamped = min(1.0 - 1e-6, max(1e-6, float(raw_p)))
        if self.platt_cal is not None and hasattr(self.platt_cal, "model"):
            coef = float(self.platt_cal.model.coef_[0][0])
            intercept = float(self.platt_cal.model.intercept_[0])
            log_odds = math.log(p_clamped / (1.0 - p_clamped))
            return _sigmoid(coef * log_odds + intercept)
        return p_clamped

    def evaluate_window(self, df_window: pd.DataFrame) -> Dict[str, Any]:
        """Evaluate latest bar with Option A's LightGBM + Platt + Adaptive v2 fusion."""
        window = df_window.tail(260).copy() if len(df_window) > 260 else df_window.copy()
        v2_eval = self.v2_model.evaluate_window(window)
        v2_tel = v2_eval.get("telemetry", {})

        feat_df = self.feature_pipeline.compute_features(window)
        last_feat = feat_df.iloc[-1].fillna(0.0)
        X_raw = feat_df[self.lgb_model.feature_names].iloc[[-1]].fillna(0.0)
        X_scaled = self.lgb_model.scaler.transform(X_raw)

        ml_r1 = float(
            self.lgb_model.models["r_1"].booster_.predict(
                X_scaled, num_iteration=self.trees_r1, raw_score=True
            )[0]
        )
        cu_raw = float(
            self.lgb_model.models["y_close_up"].booster_.predict(
                X_scaled, num_iteration=self.trees_close, raw_score=True
            )[0]
        )
        p_close_up = _sigmoid(cu_raw)
        ml_path30 = float(
            self.lgb_model.models["r_path_30m"].booster_.predict(
                X_scaled, num_iteration=self.trees_path30, raw_score=True
            )[0]
        )
        tu_raw = float(
            self.lgb_model.models["y_touch_up"].booster_.predict(
                X_scaled, num_iteration=self.trees_touch, raw_score=True
            )[0]
        )
        raw_p_touch = _sigmoid(tu_raw)
        cal_p_touch = self._platt_calibrate(raw_p_touch)

        r1_z = math.tanh(ml_r1 / 0.00005)
        close_up_z = math.tanh((p_close_up - 0.5) * 6.0)
        path30_z = math.tanh(ml_path30 / 0.00015)
        ml_score = 0.50 * r1_z + 0.35 * close_up_z + 0.15 * path30_z

        v2_raw_score = float(v2_eval["raw_score"])
        v2_norm = math.tanh(v2_raw_score / 1.5)
        hybrid_score = self.ml_weight * ml_score + self.adaptive_weight * v2_norm

        f15_rsi_14 = float(last_feat.get("rsi_14", 0.5))
        f20_bb_pband = float(last_feat.get("bb_pband", 0.5))

        coupled_long = (ml_r1 > 0.00008) and (cal_p_touch >= 0.95) and (f15_rsi_14 < 0.58) and (f20_bb_pband < 0.85)
        coupled_short = (ml_r1 < -0.00008) and (f15_rsi_14 > 0.42) and (f20_bb_pband > 0.15)

        long_ml_confirm = (ml_score >= self.min_ml_confirm) or (ml_r1 > 0.0 and p_close_up >= 0.505) or coupled_long
        short_ml_confirm = (ml_score <= -self.min_ml_confirm) or (ml_r1 < 0.0 and p_close_up <= 0.495) or coupled_short

        ml_vetoes_long = (ml_score <= -0.10) or (ml_r1 < -0.00003 and p_close_up < 0.485)
        ml_vetoes_short = (ml_score >= 0.10) or (ml_r1 > 0.00003 and p_close_up > 0.515)

        in_entry = bool(v2_tel.get("in_entry_window", True))
        vol_ok = bool(v2_tel.get("vol_ok", True))
        trade_allowed = in_entry and vol_ok

        v2_action = v2_eval.get("action", "HOLD")
        v2_long = v2_action == "LONG"
        v2_short = v2_action == "SHORT"

        enter_long = trade_allowed and (hybrid_score >= self.fusion_thr or (v2_long and long_ml_confirm)) and long_ml_confirm and not ml_vetoes_long
        enter_short = trade_allowed and (hybrid_score <= -self.fusion_thr or (v2_short and short_ml_confirm)) and short_ml_confirm and not ml_vetoes_short

        action = "LONG" if enter_long else ("SHORT" if enter_short else "HOLD")
        direction = "UP" if hybrid_score > 0 else ("DOWN" if hybrid_score < 0 else ("UP" if ml_r1 >= 0 else "DOWN"))

        c = float(window["close"].iloc[-1])
        expected_ret_5m = 0.60 * ml_r1 + 0.40 * (hybrid_score * 0.00025)
        expected_p_5m = c * (1.0 + expected_ret_5m)

        tp_pts = float(v2_eval.get("tp_points", 3.0))
        sl_pts = float(v2_eval.get("sl_points", 1.5))
        vol_30m = float(v2_eval.get("volatility_30m", 0.0008))

        path_ret_30m = 0.60 * ml_path30 + 0.40 * (hybrid_score * 0.0006)
        path_30m = []
        for step_idx in range(1, 7):
            h_min = step_idx * 5
            frac = step_idx / 6.0
            step_ret = (1.0 - frac) * expected_ret_5m + frac * path_ret_30m
            path_30m.append({"horizon_minutes": h_min, "expected_close": round(c * (1.0 + step_ret), 2)})

        q_err = float(getattr(self.interval_cal, "q_error", 0.00102155)) if self.interval_cal is not None else 0.00102155
        half_width = max(tp_pts, sl_pts, q_err * c)
        pred_high_30m = max([p["expected_close"] for p in path_30m] + [c + half_width])
        pred_low_30m = min([p["expected_close"] for p in path_30m] + [c - half_width])

        hybrid_conf = _sigmoid(abs(hybrid_score) * 2.2)
        regime_label = v2_eval.get("regime_label", "RANGE")
        veto_note = " ML_VETO_LONG" if (v2_long and ml_vetoes_long) else (" ML_VETO_SHORT" if (v2_short and ml_vetoes_short) else "")
        reason = (
            f"Option A (LGBM+Platt+v2): hybrid={hybrid_score:+.3f} "
            f"[ml={ml_score:+.3f}, r1={ml_r1 * 1e4:+.2f}bps, pUp={p_close_up * 100:.1f}%, "
            f"calTouch={cal_p_touch * 100:.1f}%, v2={v2_raw_score:+.2f} {regime_label}]{veto_note}"
        )

        merged_telemetry = dict(v2_tel)
        merged_telemetry["option_a_ml"] = {
            "ml_r1": round(ml_r1, 8),
            "ml_r1_bps": round(ml_r1 * 10000.0, 3),
            "p_close_up": round(p_close_up, 4),
            "ml_path_30m": round(ml_path30, 8),
            "raw_p_touch_up": round(raw_p_touch, 4),
            "cal_p_touch_up": round(cal_p_touch, 4),
            "ml_score": round(ml_score, 4),
            "v2_raw_score": round(v2_raw_score, 4),
            "v2_norm": round(v2_norm, 4),
            "hybrid_score": round(hybrid_score, 4),
            "tree_counts": {
                "r_1": self.trees_r1,
                "y_close_up": self.trees_close,
                "r_path_30m": self.trees_path30,
                "y_touch_up": self.trees_touch,
            },
        }

        return {
            "raw_score": round(hybrid_score, 4),
            "score_confidence": round(hybrid_conf, 4),
            "p_touch_up_next_5m": round(cal_p_touch, 4),
            "raw_p_touch_up": round(raw_p_touch, 4),
            "trend_regime": bool(v2_eval.get("trend_regime", False)),
            "regime_label": regime_label,
            "action": action,
            "direction": direction,
            "expected_return_5m": round(expected_ret_5m, 6),
            "expected_price_5m": round(expected_p_5m, 2),
            "path_30m": path_30m,
            "predicted_high_30m": round(pred_high_30m, 2),
            "predicted_low_30m": round(pred_low_30m, 2),
            "volatility_30m": round(vol_30m, 6),
            "tp_points": round(tp_pts, 2),
            "sl_points": round(sl_pts, 2),
            "conformal_half_width": round(half_width, 2),
            "decision_reason": reason,
            "telemetry": merged_telemetry,
        }

