from datetime import datetime
import uuid

from src.decision.base import Action, DecisionContext, DecisionProvider, DecisionRecord


class SafeHoldDecisionProvider(DecisionProvider):
    def __init__(self, version: str = "v1.0"):
        self.version = version

    def decide(self, context: DecisionContext, forecast_id: str) -> DecisionRecord:
        reason = "DEFAULT_SAFE_HOLD"
        if context.is_stale:
            reason = "DATA_STALE"
        elif not context.is_valid_forecast:
            reason = "FORECAST_INVALID"

        return DecisionRecord(
            decision_id=str(uuid.uuid4()),
            forecast_id=forecast_id,
            as_of=context.as_of,
            action=Action.HOLD,
            provider="safe_hold",
            decision_version=self.version,
            reason_code=reason,
            validation_status="valid",
        )
