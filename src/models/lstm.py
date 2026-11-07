from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler


class LSTMNet(nn.Module):
    def __init__(self, num_features: int, hidden_size: int = 64, num_layers: int = 1, dropout: float = 0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=num_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)

        # Multi-task heads
        self.head_touch_up = nn.Linear(hidden_size, 1)
        self.head_close_up = nn.Linear(hidden_size, 1)
        self.head_r1 = nn.Linear(hidden_size, 1)
        self.head_path = nn.Linear(hidden_size, 6)
        self.head_extrema = nn.Linear(hidden_size, 2)
        self.head_eod = nn.Linear(hidden_size, 1)
        self.head_vol = nn.Sequential(nn.Linear(hidden_size, 1), nn.Softplus())

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        out, _ = self.lstm(x)
        # Use representation from last time-step
        last = self.dropout(out[:, -1, :])

        touch_up = torch.sigmoid(self.head_touch_up(last)).squeeze(-1)
        close_up = torch.sigmoid(self.head_close_up(last)).squeeze(-1)
        r1 = self.head_r1(last).squeeze(-1)
        path = self.head_path(last)
        extrema = self.head_extrema(last)
        eod = self.head_eod(last).squeeze(-1)
        vol = self.head_vol(last).squeeze(-1)

        return {
            "p_touch_up": touch_up,
            "p_close_up": close_up,
            "r_1": r1,
            "r_path": path,
            "y_high30": extrema[:, 0],
            "y_low30": extrema[:, 1],
            "y_eod": eod,
            "rv_30": vol,
        }


class LSTMMultiTaskForecaster:
    def __init__(
        self,
        sequence_length: int = 60,
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.2,
        lr: float = 0.001,
        device: Optional[str] = None,
    ):
        self.sequence_length = sequence_length
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.dropout = dropout
        self.lr = lr
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.scaler = StandardScaler()
        self.feature_names: List[str] = []
        self.model: Optional[LSTMNet] = None

    def _prepare_sequences(
        self, X: np.ndarray, y: Optional[pd.DataFrame] = None
    ) -> Tuple[torch.Tensor, Optional[Dict[str, torch.Tensor]]]:
        n = len(X)
        seq_len = self.sequence_length
        if n < seq_len:
            raise ValueError(f"Length {n} is less than sequence length {seq_len}")

        # Fast vectorized sliding window
        seqs = np.lib.stride_tricks.sliding_window_view(X, (seq_len, X.shape[1])).squeeze(1)
        x_tensor = torch.from_numpy(np.ascontiguousarray(seqs, dtype=np.float32))

        if y is None:
            return x_tensor, None

        # Align targets to sequence endpoint (i + seq_len - 1)
        aligned_y = y.iloc[seq_len - 1 :].reset_index(drop=True)
        path_cols = [f"r_path_{m}m" for m in [5, 10, 15, 20, 25, 30]]

        targets = {
            "p_touch_up": torch.from_numpy(aligned_y["y_touch_up"].values.astype(np.float32)),
            "p_close_up": torch.from_numpy(aligned_y["y_close_up"].values.astype(np.float32)),
            "r_1": torch.from_numpy(aligned_y["r_1"].values.astype(np.float32)),
            "r_path": torch.from_numpy(aligned_y[path_cols].values.astype(np.float32)),
            "y_high30": torch.from_numpy(aligned_y["y_high30"].values.astype(np.float32)),
            "y_low30": torch.from_numpy(aligned_y["y_low30"].values.astype(np.float32)),
            "y_eod": torch.from_numpy(aligned_y["y_eod"].values.astype(np.float32)),
            "rv_30": torch.from_numpy(aligned_y["rv_30"].values.astype(np.float32)),
        }
        return x_tensor, targets

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.DataFrame,
        feature_cols: List[str],
        batch_size: int = 128,
        epochs: int = 10,
        val_data: Optional[Tuple[pd.DataFrame, pd.DataFrame]] = None,
    ) -> "LSTMMultiTaskForecaster":
        self.feature_names = feature_cols
        X_clean = X_train[feature_cols].copy().fillna(0.0).values
        X_scaled = self.scaler.fit_transform(X_clean)

        x_seq, y_tensors = self._prepare_sequences(X_scaled, y_train)

        self.model = LSTMNet(
            num_features=len(feature_cols),
            hidden_size=self.hidden_size,
            num_layers=self.num_layers,
            dropout=self.dropout,
        ).to(self.device)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
        bce_loss = nn.BCELoss()
        huber_loss = nn.SmoothL1Loss()

        n_samples = len(x_seq)
        for epoch in range(epochs):
            self.model.train()
            perm = torch.randperm(n_samples)
            total_loss = 0.0

            for start in range(0, n_samples, batch_size):
                idx = perm[start : start + batch_size]
                batch_x = x_seq[idx].to(self.device)

                preds = self.model(batch_x)
                loss = torch.tensor(0.0, device=self.device)

                # Touch up
                y_tu = y_tensors["p_touch_up"][idx].to(self.device)
                m_tu = ~torch.isnan(y_tu)
                if m_tu.sum() > 0:
                    loss = loss + 1.0 * bce_loss(preds["p_touch_up"][m_tu], y_tu[m_tu])

                # Close up
                y_cu = y_tensors["p_close_up"][idx].to(self.device)
                m_cu = ~torch.isnan(y_cu)
                if m_cu.sum() > 0:
                    loss = loss + 0.5 * bce_loss(preds["p_close_up"][m_cu], y_cu[m_cu])

                # r1 return
                y_r1 = y_tensors["r_1"][idx].to(self.device)
                m_r1 = ~torch.isnan(y_r1)
                if m_r1.sum() > 0:
                    loss = loss + 100.0 * huber_loss(preds["r_1"][m_r1], y_r1[m_r1])

                # extrema
                y_h = y_tensors["y_high30"][idx].to(self.device)
                y_l = y_tensors["y_low30"][idx].to(self.device)
                m_ext = ~torch.isnan(y_h) & ~torch.isnan(y_l)
                if m_ext.sum() > 0:
                    loss = loss + 50.0 * (huber_loss(preds["y_high30"][m_ext], y_h[m_ext]) + huber_loss(preds["y_low30"][m_ext], y_l[m_ext]))

                # rv30
                y_rv = y_tensors["rv_30"][idx].to(self.device)
                m_rv = ~torch.isnan(y_rv)
                if m_rv.sum() > 0:
                    loss = loss + 50.0 * huber_loss(preds["rv_30"][m_rv], y_rv[m_rv])

                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimizer.step()
                total_loss += loss.item()

            avg_loss = total_loss / (n_samples / batch_size)
            print(f"  LSTM Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f}")

        return self

    def predict(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        if self.model is None:
            raise RuntimeError("Model has not been trained")

        X_clean = X[self.feature_names].copy().fillna(0.0).values
        X_scaled = self.scaler.transform(X_clean)
        x_seq, _ = self._prepare_sequences(X_scaled)

        self.model.eval()
        with torch.no_grad():
            preds = self.model(x_seq.to(self.device))

        out: Dict[str, np.ndarray] = {
            "p_touch_up": preds["p_touch_up"].cpu().numpy(),
            "p_close_up": preds["p_close_up"].cpu().numpy(),
            "r_1": preds["r_1"].cpu().numpy(),
            "r_path": preds["r_path"].cpu().numpy(),
            "y_high30": preds["y_high30"].cpu().numpy(),
            "y_low30": preds["y_low30"].cpu().numpy(),
            "y_eod": preds["y_eod"].cpu().numpy(),
            "rv_30": preds["rv_30"].cpu().numpy(),
        }
        # Invariant enforcement: low <= high
        out["y_low30"] = np.minimum(out["y_low30"], out["y_high30"])
        return out
