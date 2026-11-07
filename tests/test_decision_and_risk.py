from datetime import datetime, timezone
import pytest
from src.decision.base import Action, DecisionContext, DecisionRecord, RiskGuard
from src.decision.safe_hold import SafeHoldDecisionProvider


def test_safe_hold_provider():
    provider = SafeHoldDecisionProvider()
    ctx = DecisionContext(
        as_of=datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc),
        reference_price=5000.0,
        p_touch_up=0.95,
        p_close_up=0.52,
        expected_price_5m=5002.0,
        predicted_high_30m=5010.0,
        predicted_low_30m=4990.0,
        volatility_30m=0.0012,
        market_regime="trending_up",
    )
    dec = provider.decide(ctx, forecast_id="fc_001")
    assert dec.action == Action.HOLD
    assert dec.reason_code == "DEFAULT_SAFE_HOLD"
    assert dec.forecast_id == "fc_001"


def test_risk_guard_rejects_stale_data():
    guard = RiskGuard(reject_stale=True, reject_invalid=True)
    dt = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    ctx = DecisionContext(
        as_of=dt,
        reference_price=5000.0,
        p_touch_up=0.95,
        p_close_up=0.52,
        expected_price_5m=5002.0,
        predicted_high_30m=5010.0,
        predicted_low_30m=4990.0,
        volatility_30m=0.0012,
        market_regime="trending_up",
        is_stale=True,
    )
    raw_dec = DecisionRecord(
        decision_id="dec_002",
        forecast_id="fc_002",
        as_of=dt,
        action=Action.LONG,
        provider="mock",
        decision_version="1.0",
        reason_code="UP_MOMENTUM",
        validation_status="VALID",
    )
    checked = guard.validate(raw_dec, ctx)
    assert checked.action == Action.HOLD
    assert "REJECTED_STALE_DATA" in checked.reason_code


def test_open_jev_decision_provider():
    from src.decision.jev import OpenJevDecisionProvider
    provider = OpenJevDecisionProvider(seed=42)
    dt = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    ctx = DecisionContext(
        as_of=dt,
        reference_price=5000.0,
        p_touch_up=0.95,
        p_close_up=0.52,
        expected_price_5m=5002.0,
        predicted_high_30m=5010.0,
        predicted_low_30m=4990.0,
        volatility_30m=0.0012,
        market_regime="trending_up",
        is_stale=False,
        is_valid_forecast=True,
    )
    dec = provider.decide(ctx, forecast_id="fc_jev_01")
    assert dec.forecast_id == "fc_jev_01"
    assert dec.provider == "open_jev"
    assert dec.action in (Action.HOLD, Action.LONG, Action.SHORT)
    assert dec.validation_status == "verified"
