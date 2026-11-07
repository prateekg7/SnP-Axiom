from datetime import datetime, timezone
import pytest
from src.data.sessions import get_session_close_dt, is_regular_session, to_new_york


def test_regular_session_hours():
    # 10:00 AM NY on a Wednesday (regular session)
    dt_reg = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    assert is_regular_session(dt_reg) is True

    # 09:15 AM NY on a Wednesday (pre-market)
    dt_pre = datetime(2026, 10, 14, 13, 15, tzinfo=timezone.utc)
    assert is_regular_session(dt_pre) is False

    # 16:30 PM NY on a Wednesday (after-hours)
    dt_post = datetime(2026, 10, 14, 20, 30, tzinfo=timezone.utc)
    assert is_regular_session(dt_post) is False

    # 12:00 PM NY on a Saturday (weekend)
    dt_weekend = datetime(2026, 10, 17, 16, 0, tzinfo=timezone.utc)
    assert is_regular_session(dt_weekend) is False


def test_timezone_conversion():
    utc_dt = datetime(2026, 10, 14, 13, 30, tzinfo=timezone.utc)
    ny_dt = to_new_york(utc_dt)
    assert ny_dt.hour == 9
    assert ny_dt.minute == 30


def test_session_close_datetime():
    utc_dt = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    close_dt = get_session_close_dt(utc_dt)
    close_ny = to_new_york(close_dt)
    assert close_ny.hour == 16
    assert close_ny.minute == 0
