import pickle
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler


class LightGBMBenchmark:
    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed
        self.scaler = StandardScaler()
        self.feature_names: List[str] = []
        self.models: Dict[str, Any] = {}

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.DataFrame,
        feature_cols: List[str],
        early_stopping_rounds: int = 20,
    ) -> "LightGBMBenchmark":
        self.feature_names = feature_cols
        X_clean = X_train[feature_cols].copy().fillna(0.0)
        X_scaled = self.scaler.fit_transform(X_clean)

        # 1. Touch-up classifier
        mask_touch = ~y_train["y_touch_up"].isna()
        if mask_touch.sum() > 0:
            clf_touch = lgb.LGBMClassifier(
                n_estimators=100,
                learning_rate=0.05,
                max_depth=4,
                num_leaves=15,
                n_jobs=1,
                random_state=self.random_seed,
                verbose=-1,
            )
            clf_touch.fit(X_scaled[mask_touch], y_train.loc[mask_touch, "y_touch_up"])
            self.models["y_touch_up"] = clf_touch

        # 2. Close-up diagnostic classifier
        mask_close = ~y_train["y_close_up"].isna()
        if mask_close.sum() > 0:
            clf_close = lgb.LGBMClassifier(
                n_estimators=100,
                learning_rate=0.05,
                max_depth=4,
                num_leaves=15,
                n_jobs=1,
                random_state=self.random_seed,
                verbose=-1,
            )
            clf_close.fit(X_scaled[mask_close], y_train.loc[mask_close, "y_close_up"])
            self.models["y_close_up"] = clf_close

        # 3. Regression targets: r_1, y_high30, y_low30, rv_30, y_eod, and r_path
        reg_targets = ["r_1", "y_high30", "y_low30", "rv_30", "y_eod"] + [f"r_path_{m}m" for m in [5, 10, 15, 20, 25, 30]]
        for tgt in reg_targets:
            if tgt in y_train.columns:
                mask = ~y_train[tgt].isna()
                if mask.sum() > 0:
                    reg = lgb.LGBMRegressor(
                        n_estimators=100,
                        learning_rate=0.05,
                        max_depth=4,
                        num_leaves=15,
                        n_jobs=1,
                        random_state=self.random_seed,
                        verbose=-1,
                    )
                    reg.fit(X_scaled[mask], y_train.loc[mask, tgt])
                    self.models[tgt] = reg

        return self

    def predict(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        X_clean = X[self.feature_names].copy().fillna(0.0)
        X_scaled = self.scaler.transform(X_clean)

        preds: Dict[str, np.ndarray] = {}
        if "y_touch_up" in self.models:
            preds["p_touch_up"] = self.models["y_touch_up"].predict_proba(X_scaled)[:, 1]
        if "y_close_up" in self.models:
            preds["p_close_up"] = self.models["y_close_up"].predict_proba(X_scaled)[:, 1]

        for tgt, model in self.models.items():
            if tgt not in ["y_touch_up", "y_close_up"]:
                preds[tgt] = model.predict(X_scaled)

        # Enforce invariant: low30 <= high30
        if "y_low30" in preds and "y_high30" in preds:
            preds["y_low30"] = np.minimum(preds["y_low30"], preds["y_high30"])

        return preds

    def save(self, filepath: str) -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"models": self.models, "scaler": self.scaler, "features": self.feature_names}, f)

    @classmethod
    def load(cls, filepath: str) -> "LightGBMBenchmark":
        with open(filepath, "rb") as f:
            data = pickle.load(f)
        obj = cls()
        obj.models = data["models"]
        obj.scaler = data["scaler"]
        obj.feature_names = data["features"]
        return obj
