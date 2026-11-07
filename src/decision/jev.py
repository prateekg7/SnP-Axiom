import os
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import torch

from src.decision.base import Action, DecisionContext, DecisionProvider, DecisionRecord
from src.decision.safe_hold import SafeHoldDecisionProvider
from src.decision.open_jev import Jev, JevConfig, Choice, Noul, Score, ChoiceAnswer, NoulAnswer, ScoreAnswer


class OpenJevDecisionProvider(DecisionProvider):
    """
    Open-source Jev decision layer powered by kyegomez/open-jev.
    Evaluates typed decision primitives (Choice, Noul, Score) over structured market state
    using a bidirectional encoder with parallel readout heads.
    """

    def __init__(self, seed: int = 42):
        self.config = JevConfig(
            vocab_size=2048,
            d_model=64,
            n_heads=2,
            d_ff=256,
            n_state_layers=2,
            n_readout_layers=3,
            n_slots=6,
        )
        torch.manual_seed(seed)
        self.model = Jev(self.config).eval()
        self.fallback = SafeHoldDecisionProvider()

    def build_state(self, context: DecisionContext) -> Dict[str, Any]:
        """Convert decision context and model signals into structured JSON state for Jev."""
        interval_data = context.prediction_interval or {}

        expected_delta = context.expected_price_5m - context.reference_price
        expected_ret = expected_delta / context.reference_price if context.reference_price else 0.0

        return {
            "instrument": "SPX",
            "market_state": {
                "reference_price": round(float(context.reference_price), 2),
                "p_touch_up_5m": round(float(context.p_touch_up), 4),
                "p_close_up_5m": round(float(context.p_close_up), 4),
                "expected_price_5m": round(float(context.expected_price_5m), 2),
                "expected_return_5m": round(float(expected_ret), 6),
                "volatility_30m": round(float(context.volatility_30m), 6),
                "market_regime": str(context.market_regime),
                "stale_flag": bool(context.is_stale),
            },
            "uncertainty": {
                "lower": float(interval_data.get("lower", context.reference_price * 0.998)),
                "upper": float(interval_data.get("upper", context.reference_price * 1.002)),
                "coverage": float(interval_data.get("empirical_coverage", 0.788)),
            },
            "policy": "SPX cash index simulated paper trading with strict risk guard.",
        }

    def decide(self, context: DecisionContext, forecast_id: str) -> DecisionRecord:
        # Check basic safety before running model forward pass
        if context.is_stale or not context.is_valid_forecast:
            return self.fallback.decide(context, forecast_id)

        state = self.build_state(context)

        questions = [
            Choice(
                "What is the recommended trade action for SPX given current probability and expected return?",
                options=["HOLD", "LONG", "SHORT"],
                key="action",
            ),
            Noul(
                "The calibrated touch-up probability and expected return warrant entering a simulated trade position.",
                key="is_actionable",
            ),
            Score(
                "Assess the risk severity of the entry given market volatility and prediction bounds.",
                labels=["minimal", "moderate", "high", "extreme"],
                key="risk_tier",
            ),
        ]

        try:
            with torch.no_grad():
                answers = self.model([state], questions)[0]

            action_ans = next((a for a in answers if a.key == "action" and isinstance(a, ChoiceAnswer)), None)
            noul_ans = next((a for a in answers if a.key == "is_actionable" and isinstance(a, NoulAnswer)), None)

            chosen_str = (action_ans.choice if action_ans else "HOLD").upper()
            action_enum = Action(chosen_str) if chosen_str in ("HOLD", "LONG", "SHORT") else Action.HOLD

            # If Jev chose a direction but noul is unconfirmed (< 0.45), abstain safely to HOLD
            if action_enum != Action.HOLD and noul_ans and noul_ans.noul < 0.45:
                action_enum = Action.HOLD
                reason_code = "OPEN_JEV_NOUL_ABSTAIN"
            else:
                reason_code = f"OPEN_JEV_{action_enum.value}"

            return DecisionRecord(
                decision_id=f"dec_{uuid.uuid4().hex[:12]}",
                forecast_id=forecast_id,
                as_of=datetime.now(timezone.utc),
                action=action_enum,
                provider="open_jev",
                decision_version="v1.0-open-jev",
                reason_code=reason_code,
                validation_status="verified",
            )
        except Exception:
            # Safe documented fallback if any exception occurs
            return self.fallback.decide(context, forecast_id)


class JevDecisionProvider(OpenJevDecisionProvider):
    """
    Default Jev decision provider delegating to open-jev architecture.
    Provides backward compatibility with the existing Jev interface.
    """
    pass
