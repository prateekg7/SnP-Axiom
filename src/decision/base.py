from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Protocol
import uuid


class Action(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    HOLD = "HOLD"


@dataclass(frozen=True)
class DecisionContext:
    as_of: datetime
    reference_price: float
    p_touch_up: float
    p_close_up: float
    expected_price_5m: float
    predicted_high_30m: float
    predicted_low_30m: float
    volatility_30m: float
    market_regime: str
    current_position: str = "FLAT"
    is_stale: bool = False
    is_valid_forecast: bool = True
    prediction_interval: Dict[str, float] = field(default_factory=dict)
    strategy_signals: Dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class DecisionRecord:
    decision_id: str
    forecast_id: str
    as_of: datetime
    action: Action
    provider: str
    decision_version: str
    reason_code: str
    validation_status: str


class DecisionProvider(Protocol):
    def decide(self, context: DecisionContext, forecast_id: str) -> DecisionRecord:
        ...


class RiskGuard:
    def __init__(self, reject_stale: bool = True, reject_invalid: bool = True):
        self.reject_stale = reject_stale
        self.reject_invalid = reject_invalid

    def validate(self, decision: DecisionRecord, context: DecisionContext) -> DecisionRecord:
        if self.reject_stale and context.is_stale:
            return DecisionRecord(
                decision_id=str(uuid.uuid4()),
                forecast_id=decision.forecast_id,
                as_of=decision.as_of,
                action=Action.HOLD,
                provider="risk_guard",
                decision_version="v1.0",
                reason_code="REJECTED_STALE_DATA",
                validation_status="overridden",
            )

        if self.reject_invalid and not context.is_valid_forecast:
            return DecisionRecord(
                decision_id=str(uuid.uuid4()),
                forecast_id=decision.forecast_id,
                as_of=decision.as_of,
                action=Action.HOLD,
                provider="risk_guard",
                decision_version="v1.0",
                reason_code="REJECTED_INVALID_FORECAST",
                validation_status="overridden",
            )

        if decision.action not in [Action.LONG, Action.SHORT, Action.HOLD]:
            return DecisionRecord(
                decision_id=str(uuid.uuid4()),
                forecast_id=decision.forecast_id,
                as_of=decision.as_of,
                action=Action.HOLD,
                provider="risk_guard",
                decision_version="v1.0",
                reason_code="REJECTED_UNKNOWN_ACTION",
                validation_status="overridden",
            )

        return decision
