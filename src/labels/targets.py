from datetime import date
from typing import List, Tuple
import numpy as np
import pandas as pd

from src.data.sessions import get_session_date


def compute_targets(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes all forecast targets defined in spec.md:
    1. Y_touch_up: 1[High(t+1) > Close(t)]
    2. Y_close_up: 1[Close(t+1) > Close(t)]
    3. R_1: log(Close(t+1) / Close(t))
    4. R_1..R_6: six-horizon log returns
    5. y_high30: log(max(High(t+1)..High(t+6)) / Close(t))
    6. y_low30: log(min(Low(t+1)..Low(t+6)) / Close(t))
    7. y_eod: log(Session_Close / Close(t))
    8. rv_30: sqrt(sum(r_k^2)) for k=1..6

    Targets crossing session boundaries are masked as NaN.
    """
    df = df.sort_values("timestamp").reset_index(drop=True).copy()
    df["session_date"] = df["timestamp"].apply(get_session_date)

    n = len(df)
    close = df["close"].values
    high = df["high"].values
    low = df["low"].values
    session_dates = df["session_date"].values

    # Pre-allocate targets
    y_touch_up = np.full(n, np.nan)
    y_close_up = np.full(n, np.nan)
    r_1 = np.full(n, np.nan)
    r_path = np.full((n, 6), np.nan)
    y_high30 = np.full(n, np.nan)
    y_low30 = np.full(n, np.nan)
    y_eod = np.full(n, np.nan)
    rv_30 = np.full(n, np.nan)

    # Calculate session closes
    session_last_indices = {}
    for i, s_date in enumerate(session_dates):
        session_last_indices[s_date] = i

    for i in range(n):
        curr_session = session_dates[i]
        curr_close = close[i]

        # 1-bar lookahead
        if i + 1 < n and session_dates[i + 1] == curr_session:
            next_high = high[i + 1]
            next_close = close[i + 1]
            y_touch_up[i] = 1.0 if next_high > curr_close else 0.0
            y_close_up[i] = 1.0 if next_close > curr_close else 0.0
            r_1[i] = np.log(next_close / curr_close)

        # 6-bar lookahead (30-minute window)
        if i + 6 < n and session_dates[i + 6] == curr_session:
            window_highs = high[i + 1 : i + 7]
            window_lows = low[i + 1 : i + 7]
            window_closes = close[i + 1 : i + 7]

            for k in range(6):
                r_path[i, k] = np.log(window_closes[k] / curr_close)

            max_h = np.max(window_highs)
            min_l = np.min(window_lows)
            y_high30[i] = np.log(max_h / curr_close)
            y_low30[i] = np.log(min_l / curr_close)

            # Realized volatility over the 6 bars: r_k = log(C_k / C_{k-1})
            step_returns = [np.log(window_closes[0] / curr_close)]
            for k in range(1, 6):
                step_returns.append(np.log(window_closes[k] / window_closes[k - 1]))
            rv_30[i] = np.sqrt(np.sum(np.square(step_returns)))

        # EOD target: same-session regular close
        last_idx = session_last_indices[curr_session]
        if last_idx > i:
            session_close = close[last_idx]
            y_eod[i] = np.log(session_close / curr_close)

    targets_df = pd.DataFrame(
        {
            "timestamp": df["timestamp"],
            "y_touch_up": y_touch_up,
            "y_close_up": y_close_up,
            "r_1": r_1,
            "r_path_5m": r_path[:, 0],
            "r_path_10m": r_path[:, 1],
            "r_path_15m": r_path[:, 2],
            "r_path_20m": r_path[:, 3],
            "r_path_25m": r_path[:, 4],
            "r_path_30m": r_path[:, 5],
            "y_high30": y_high30,
            "y_low30": y_low30,
            "y_eod": y_eod,
            "rv_30": rv_30,
        }
    )
    return targets_df
