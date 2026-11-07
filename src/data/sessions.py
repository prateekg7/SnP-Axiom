from datetime import date, datetime, time
from zoneinfo import ZoneInfo
import pandas as pd

NY_TZ = ZoneInfo("America/New_York")
UTC_TZ = ZoneInfo("UTC")

REGULAR_SESSION_OPEN = time(9, 30)
REGULAR_SESSION_CLOSE = time(16, 0)


def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC_TZ)
    return dt.astimezone(UTC_TZ)


def to_new_york(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC_TZ)
    return dt.astimezone(NY_TZ)


def is_regular_session(dt: datetime) -> bool:
    dt_ny = to_new_york(dt)
    if dt_ny.weekday() >= 5:
        return False
    t = dt_ny.time()
    return REGULAR_SESSION_OPEN <= t < REGULAR_SESSION_CLOSE


def get_session_date(dt: datetime) -> date:
    return to_new_york(dt).date()


def get_session_close_dt(dt: datetime) -> datetime:
    dt_ny = to_new_york(dt)
    close_ny = datetime.combine(dt_ny.date(), REGULAR_SESSION_CLOSE, tzinfo=NY_TZ)
    return close_ny.astimezone(UTC_TZ)


def filter_regular_session_df(df: pd.DataFrame, time_col: str = "timestamp") -> pd.DataFrame:
    utc_series = pd.to_datetime(df[time_col], utc=True)
    ny_series = utc_series.dt.tz_convert("America/New_York")
    
    is_weekday = ny_series.dt.weekday < 5
    is_after_open = (ny_series.dt.hour > 9) | ((ny_series.dt.hour == 9) & (ny_series.dt.minute >= 30))
    is_before_close = ny_series.dt.hour < 16
    
    mask = is_weekday & is_after_open & is_before_close
    return df[mask].copy()
