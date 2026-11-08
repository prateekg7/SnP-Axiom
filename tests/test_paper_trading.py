from datetime import datetime, timezone
import pytest
from src.trading.paper_engine import PaperTradingEngine, PositionState


def test_paper_engine_long_trade():
    engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=0.05,
        slippage_points=0.10,
    )

    t1 = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    # Open long at 5000.0 (entry fill with slippage = 5000.10)
    engine.process_decision("fc_1", t1, "LONG", 5000.0)
    assert engine.current_position == PositionState.LONG

    t2 = datetime(2026, 10, 14, 14, 30, tzinfo=timezone.utc)
    # Close long at 5010.0 (exit fill with slippage = 5009.90)
    closed = engine.process_decision("fc_2", t2, "HOLD", 5010.0)
    assert engine.current_position == PositionState.FLAT
    assert closed is not None
    assert closed.is_closed is True

    # Gross P&L on filled prices: 5009.90 - 5000.10 = 9.80 pts
    assert abs(closed.gross_pnl - 9.80) < 1e-4
    # Net P&L: 9.80 - (2 * 0.05) - (2 * 0.10) = 9.50 pts
    assert abs(closed.net_pnl - 9.50) < 1e-4


def test_paper_engine_duplicate_forecast_prevention():
    engine = PaperTradingEngine()
    t = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    engine.process_decision("fc_unique", t, "LONG", 5000.0)
    assert engine.current_position == PositionState.LONG

    # Same forecast ID should be ignored
    res = engine.process_decision("fc_unique", t, "HOLD", 5010.0)
    assert res is None
    assert engine.current_position == PositionState.LONG


def test_paper_engine_bracket_take_profit():
    engine = PaperTradingEngine(
        synthetic_point_value=1.0,
        cost_per_side_points=0.05,
        slippage_points=0.10,
        take_profit_points=3.0,
        stop_loss_points=1.5,
    )
    t1 = datetime(2026, 10, 14, 14, 0, tzinfo=timezone.utc)
    # Open long at 5000.0 (entry fill = 5000.10)
    engine.process_decision("fc_1", t1, "LONG", 5000.0)
    assert engine.current_position == PositionState.LONG

    t2 = datetime(2026, 10, 14, 14, 5, tzinfo=timezone.utc)
    # Next candle high reaches 5003.50 (hits TP at 5003.10)
    closed = engine.process_decision("fc_2", t2, "LONG", 5002.0, high=5003.50, low=4999.50)
    assert closed is not None
    assert closed.is_closed is True
    assert closed.exit_price == pytest.approx(5003.10)
    # Gross = 3.0 pts, costs = 2 * (0.05 + 0.10) = 0.30 -> Net = 2.70 pts
    assert closed.net_pnl == pytest.approx(2.70)
    assert engine.current_position == PositionState.FLAT
