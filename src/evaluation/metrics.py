from typing import Any, Dict, Optional
import numpy as np
from sklearn.metrics import brier_score_loss, log_loss, mean_absolute_error, mean_squared_error, roc_auc_score, precision_recall_curve, auc


def compute_classification_metrics(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, float]:
    mask = ~np.isnan(y_true) & ~np.isnan(y_prob)
    yt = y_true[mask]
    yp = np.clip(y_prob[mask], 1e-6, 1.0 - 1e-6)

    if len(yt) == 0:
        return {}

    base_rate = float(np.mean(yt))
    brier = float(brier_score_loss(yt, yp))

    # Log loss
    try:
        loss = float(log_loss(yt, yp))
    except Exception:
        loss = float("nan")

    # ROC AUC
    try:
        roc = float(roc_auc_score(yt, yp)) if len(np.unique(yt)) > 1 else float("nan")
    except Exception:
        roc = float("nan")

    # PR AUC
    try:
        precision, recall, _ = precision_recall_curve(yt, yp)
        pr_auc = float(auc(recall, precision))
    except Exception:
        pr_auc = float("nan")

    # ECE (Expected Calibration Error with 10 bins)
    bins = np.linspace(0, 1, 11)
    bin_indices = np.digitize(yp, bins) - 1
    ece = 0.0
    for b in range(10):
        in_bin = bin_indices == b
        if np.sum(in_bin) > 0:
            bin_acc = np.mean(yt[in_bin])
            bin_conf = np.mean(yp[in_bin])
            ece += np.sum(in_bin) / len(yt) * abs(bin_acc - bin_conf)

    return {
        "base_rate": base_rate,
        "brier_score": brier,
        "log_loss": loss,
        "roc_auc": roc,
        "pr_auc": pr_auc,
        "ece": float(ece),
    }


def compute_regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    yt = y_true[mask]
    yp = y_pred[mask]

    if len(yt) == 0:
        return {}

    mae = float(mean_absolute_error(yt, yp))
    rmse = float(np.sqrt(mean_squared_error(yt, yp)))
    return {"mae": mae, "rmse": rmse}


def compute_interval_metrics(y_true: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> Dict[str, float]:
    mask = ~np.isnan(y_true) & ~np.isnan(lower) & ~np.isnan(upper)
    yt = y_true[mask]
    l = lower[mask]
    u = upper[mask]

    if len(yt) == 0:
        return {}

    covered = (yt >= l) & (yt <= u)
    coverage = float(np.mean(covered))
    mean_width = float(np.mean(u - l))
    return {"coverage": coverage, "mean_width": mean_width}
