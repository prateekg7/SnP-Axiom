from dataclasses import dataclass
from typing import Generator, List, Optional, Tuple
import numpy as np
import pandas as pd


@dataclass
class SplitIndices:
    split_id: int
    train_indices: np.ndarray
    val_indices: np.ndarray
    test_indices: Optional[np.ndarray] = None


def purge_and_embargo(
    train_end_idx: int,
    horizon_bars: int = 6,
    embargo_bars: int = 2,
) -> int:
    """
    Returns the first valid index for validation/test after purging overlapping labels
    and applying a safety embargo buffer.
    """
    return train_end_idx + horizon_bars + embargo_bars


def generate_walk_forward_splits(
    total_rows: int,
    train_ratio: float = 0.60,
    val_ratio: float = 0.20,
    test_ratio: float = 0.20,
    horizon_bars: int = 6,
    embargo_bars: int = 2,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generates strict chronological train, validation, and test index sets
    with purging and embargoing at boundaries.
    """
    if train_ratio + val_ratio + test_ratio > 1.0 + 1e-6:
        raise ValueError("Ratios sum to more than 1.0")

    train_end = int(total_rows * train_ratio)
    val_start = purge_and_embargo(train_end, horizon_bars, embargo_bars)
    val_end = val_start + int(total_rows * val_ratio)
    test_start = purge_and_embargo(val_end, horizon_bars, embargo_bars)
    test_end = total_rows

    train_idx = np.arange(0, train_end)
    val_idx = np.arange(val_start, min(val_end, total_rows))
    test_idx = np.arange(test_start, total_rows) if test_start < total_rows else np.array([], dtype=int)

    return train_idx, val_idx, test_idx
