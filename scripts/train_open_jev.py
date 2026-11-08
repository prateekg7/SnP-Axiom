import os

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from pathlib import Path
import time
import numpy as np
import pandas as pd
import torch

from src.decision.base import DecisionContext
from src.decision.jev import OpenJevDecisionProvider
from src.decision.open_jev import Choice, Jev, JevConfig, RLCDLoss
from src.evaluation.walk_forward import generate_walk_forward_splits
from src.models.lightgbm import LightGBMBenchmark


def main():
    print("=== Training Open-Jev Decision Layer on AI Forecaster Signals ===")
    t0 = time.time()

    df_feat = pd.read_parquet("data/processed/features.parquet")
    df_tgt = pd.read_parquet("data/labels/targets.parquet")
    df_raw = pd.read_parquet("data/processed/spx_5m_canonical.parquet")

    train_idx, _, _ = generate_walk_forward_splits(
        total_rows=len(df_feat),
        train_ratio=0.60,
        val_ratio=0.20,
        test_ratio=0.20,
        horizon_bars=6,
        embargo_bars=2,
    )

    lgb = LightGBMBenchmark.load("artifacts/models/lightgbm_benchmark.pkl")
    preds = lgb.predict(df_feat.iloc[train_idx])
    y_train = df_tgt.iloc[train_idx]
    raw_train = df_raw.iloc[train_idx]

    # Collect candidate indices for balanced training
    long_pool = []
    short_pool = []
    hold_pool = []

    for i in range(len(train_idx)):
        r1_val = float(preds["r_1"][i])
        actual_r1 = float(y_train["r_1"].iloc[i])
        p_touch = float(preds["p_touch_up"][i])

        if r1_val > 0.00008 and actual_r1 > 0.0001 and p_touch > 0.94:
            long_pool.append(i)
        elif r1_val < -0.00008 and actual_r1 < -0.0001:
            short_pool.append(i)
        elif abs(r1_val) <= 0.00004:
            hold_pool.append(i)

    print(f"Candidate pools: Long={len(long_pool)}, Short={len(short_pool)}, Hold={len(hold_pool)}")
    n_per_class = min(len(long_pool), len(short_pool), 350)

    np.random.seed(42)
    selected_long = np.random.choice(long_pool, size=n_per_class, replace=False)
    selected_short = np.random.choice(short_pool, size=n_per_class, replace=False)
    selected_hold = np.random.choice(hold_pool, size=n_per_class, replace=False)

    balanced_indices = np.concatenate([selected_long, selected_short, selected_hold])
    np.random.shuffle(balanced_indices)

    provider = OpenJevDecisionProvider(weights_path=None)
    states = []
    targets = []
    for idx in balanced_indices:
        r1_val = float(preds["r_1"][idx])
        p_ref = float(raw_train["close"].iloc[idx])
        p_touch = float(preds["p_touch_up"][idx])
        vol = float(preds["rv_30"][idx])
        regime = "trending_up" if r1_val > 0.0001 else ("trending_down" if r1_val < -0.0001 else "mean_reverting")

        ctx = DecisionContext(
            as_of=raw_train["timestamp"].iloc[idx],
            reference_price=p_ref,
            p_touch_up=p_touch,
            p_close_up=0.5,
            expected_price_5m=float(p_ref * np.exp(r1_val)),
            predicted_high_30m=float(p_ref * np.exp(float(preds["y_high30"][idx]))),
            predicted_low_30m=float(p_ref * np.exp(float(preds["y_low30"][idx]))),
            volatility_30m=vol,
            market_regime=regime,
            prediction_interval={"nominal_coverage": 0.90, "lower": p_ref * 0.998, "upper": p_ref * 1.002, "empirical_coverage": 0.788},
        )
        state = provider.build_state(ctx)
        states.append(state)

        if idx in selected_long:
            targets.append([0.10, 0.80, 0.10])
        elif idx in selected_short:
            targets.append([0.10, 0.10, 0.80])
        else:
            targets.append([0.80, 0.10, 0.10])

    target_tensor = torch.tensor(targets, dtype=torch.float32)

    question = Choice(
        "What is the recommended trade action for SPX given current probability and expected return?",
        options=["HOLD", "LONG", "SHORT"],
        key="action",
    )

    config = JevConfig(
        vocab_size=2048,
        d_model=64,
        n_heads=2,
        d_ff=256,
        n_state_layers=2,
        n_readout_layers=2,
        n_slots=6,
    )
    torch.manual_seed(42)
    model = Jev(config)
    loss_fn = RLCDLoss(w_nll=1.0, w_brier=0.5, w_evidential=0.3, w_ece=0.1, w_consistency=0.2)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1e-4)

    batch_size = 64
    n_samples = len(states)
    epochs = 25

    print(f"Training Jev on {n_samples} identical DecisionContext states ({n_per_class}/class) for {epochs} epochs...")
    model.train()
    for ep in range(epochs):
        perm = np.random.permutation(n_samples)
        ep_loss = 0.0
        n_batches = 0
        for b_start in range(0, n_samples, batch_size):
            b_idx = perm[b_start : b_start + batch_size]
            b_states = [states[j] for j in b_idx]
            b_tgts = [target_tensor[b_idx]]

            optimizer.zero_grad()
            loss = loss_fn(model, b_states, [question], b_tgts)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            ep_loss += loss.item()
            n_batches += 1

        avg_loss = ep_loss / max(1, n_batches)
        if (ep + 1) % 5 == 0 or ep == 0:
            print(f"Epoch {ep+1:02d}/{epochs:02d} - Loss: {avg_loss:.4f}")

    # Save weights
    out_dir = Path("artifacts/models")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "open_jev_weights.pt"
    torch.save(model.state_dict(), str(out_path))
    print(f"Model saved to {out_path} in {time.time() - t0:.2f} seconds.")


if __name__ == "__main__":
    main()
