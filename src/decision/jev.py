import os
from typing import Optional
import uuid

from src.decision.base import Action, DecisionContext, DecisionProvider, DecisionRecord
from src.decision.safe_hold import SafeHoldDecisionProvider


class JevDecisionProvider(DecisionProvider):
    """
    Adapter for the hidden Jev decision layer.
    As per architecture specifications, Jev contracts are not invented without verified credentials.
    When JEV_API_KEY is not configured or interface is unverified, falls back safely to SafeHoldDecisionProvider.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("JEV_API_KEY")
        self.base_url = base_url or os.getenv("JEV_BASE_URL", "https://api.typesafe.com/jev/v1")
        self.fallback = SafeHoldDecisionProvider()

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def decide(self, context: DecisionContext, forecast_id: str) -> DecisionRecord:
        if not self.is_configured():
            # Safe documented fallback when Jev credentials are not present
            record = self.fallback.decide(context, forecast_id)
            return DecisionRecord(
                decision_id=record.decision_id,
                forecast_id=record.forecast_id,
                as_of=record.as_of,
                action=record.action,
                provider="jev_fallback_hold",
                decision_version="v1.0",
                reason_code="JEV_UNCONFIGURED_SAFE_HOLD",
                validation_status="fallback",
            )

        # In production when credentials exist, query verified Jev interface here.
        # Until verified, safely default to HOLD.
        return self.fallback.decide(context, forecast_id)
