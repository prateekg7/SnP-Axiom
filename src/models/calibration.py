from typing import Dict, Optional, Tuple
import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression


class ProbabilityCalibrator:
    def __init__(self, method: str = "platt"):
        self.method = method
        self.model: Optional[object] = None

    def fit(self, y_true: np.ndarray, raw_probs: np.ndarray) -> "ProbabilityCalibrator":
        mask = ~np.isnan(y_true) & ~np.isnan(raw_probs)
        yt = y_true[mask]
        yp = np.clip(raw_probs[mask], 1e-6, 1.0 - 1e-6)

        if self.method == "platt":
            # Logistic regression on log-odds
            log_odds = np.log(yp / (1.0 - yp)).reshape(-1, 1)
            clf = LogisticRegression(C=1.0, solver="lbfgs")
            clf.fit(log_odds, yt)
            self.model = clf
        elif self.method == "isotonic":
            iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
            iso.fit(yp, yt)
            self.model = iso
        else:
            raise ValueError(f"Unknown calibration method: {self.method}")

        return self

    def calibrate(self, raw_probs: np.ndarray) -> np.ndarray:
        if self.model is None:
            return raw_probs

        yp = np.clip(raw_probs, 1e-6, 1.0 - 1e-6)
        if self.method == "platt":
            log_odds = np.log(yp / (1.0 - yp)).reshape(-1, 1)
            return self.model.predict_proba(log_odds)[:, 1]
        elif self.method == "isotonic":
            return self.model.predict(yp)
        return yp


class ConformalIntervalCalibrator:
    def __init__(self, nominal_coverage: float = 0.90):
        self.nominal_coverage = nominal_coverage
        self.q_error = 0.0

    def fit(self, y_true: np.ndarray, y_pred: np.ndarray) -> "ConformalIntervalCalibrator":
        mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
        yt = y_true[mask]
        yp = y_pred[mask]

        if len(yt) == 0:
            self.q_error = 0.0
            return self

        # Absolute residuals
        abs_errors = np.abs(yt - yp)
        # Empirical quantile at nominal_coverage level with finite-sample correction
        n = len(abs_errors)
        level = min(1.0, np.ceil((n + 1) * self.nominal_coverage) / n)
        self.q_error = float(np.quantile(abs_errors, level))
        return self

    def predict_interval(self, y_pred: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        lower = y_pred - self.q_error
        upper = y_pred + self.q_error
        return lower, upper
