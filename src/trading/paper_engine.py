from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
import numpy as np
import pandas as pd


class PositionState(str, Enum):
    FLAT = "FLAT"
    LONG = "LONG"
    SHORT = "SHORT"


@dataclass
class Trade:
    trade_id: str
    entry_time: datetime
    exit_time: Optional[datetime]
    position: PositionState
    entry_price: float
    exit_price: Optional[float]
    units: float = 1.0
    gross_pnl: float = 0.0
    net_pnl: float = 0.0
    is_closed: bool = False


@dataclass
class PerformanceSummary:
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    gross_pnl: float
    net_pnl: float
    profit_factor: float
    max_drawdown: float
    avg_trade_pnl: float


class PaperTradingEngine:
    def __init__(
        self,
        synthetic_point_value: float = 1.0,
        cost_per_side_points: float = 0.0,
        slippage_points: float = 0.0,
        max_units: float = 1.0,
        take_profit_points: Optional[float] = None,
        stop_loss_points: Optional[float] = None,
        max_bars_held: Optional[int] = None,
    ):
        self.point_value = synthetic_point_value
        self.cost_per_side = cost_per_side_points
        self.slippage = slippage_points
        self.max_units = max_units
        self.take_profit_points = take_profit_points
        self.stop_loss_points = stop_loss_points
        self.max_bars_held = max_bars_held

        self.current_position: PositionState = PositionState.FLAT
        self.active_trade: Optional[Trade] = None
        self.active_bars_held: int = 0
        self.trades: List[Trade] = []
        self.processed_forecast_ids: set = set()

    def _close_position(
        self,
        timestamp: datetime,
        fill_price: float,
        apply_slippage: bool = True,
    ) -> Optional[Trade]:
        if self.current_position == PositionState.FLAT or self.active_trade is None:
            return None

        slip = self.slippage if apply_slippage else 0.0
        exit_fill = fill_price - slip if self.current_position == PositionState.LONG else fill_price + slip
        self.active_trade.exit_time = timestamp
        self.active_trade.exit_price = exit_fill
        self.active_trade.is_closed = True

        if self.current_position == PositionState.LONG:
            pts = exit_fill - self.active_trade.entry_price
        else:
            pts = self.active_trade.entry_price - exit_fill

        total_costs = 2 * (self.cost_per_side + self.slippage)
        self.active_trade.gross_pnl = pts * self.point_value * self.active_trade.units
        self.active_trade.net_pnl = (pts - total_costs) * self.point_value * self.active_trade.units

        self.trades.append(self.active_trade)
        closed_trade = self.active_trade
        self.active_trade = None
        self.current_position = PositionState.FLAT
        self.active_bars_held = 0
        return closed_trade

    def process_decision(
        self,
        forecast_id: str,
        timestamp: datetime,
        action: str,
        fill_price: float,
        high: Optional[float] = None,
        low: Optional[float] = None,
    ) -> Optional[Trade]:
        if forecast_id in self.processed_forecast_ids:
            return None

        self.processed_forecast_ids.add(forecast_id)
        action = action.upper()
        closed_trade = None

        # 1. Check bracket exits (Take-Profit, Stop-Loss, Max Hold Bars) on active position
        if self.active_trade is not None and self.current_position != PositionState.FLAT:
            self.active_bars_held += 1
            bracket_exit_price = None

            if self.current_position == PositionState.LONG:
                if self.take_profit_points is not None and high is not None and high >= (self.active_trade.entry_price + self.take_profit_points):
                    bracket_exit_price = self.active_trade.entry_price + self.take_profit_points
                elif self.stop_loss_points is not None and low is not None and low <= (self.active_trade.entry_price - self.stop_loss_points):
                    bracket_exit_price = self.active_trade.entry_price - self.stop_loss_points
                elif self.max_bars_held is not None and self.active_bars_held >= self.max_bars_held:
                    bracket_exit_price = fill_price
            elif self.current_position == PositionState.SHORT:
                if self.take_profit_points is not None and low is not None and low <= (self.active_trade.entry_price - self.take_profit_points):
                    bracket_exit_price = self.active_trade.entry_price - self.take_profit_points
                elif self.stop_loss_points is not None and high is not None and high >= (self.active_trade.entry_price + self.stop_loss_points):
                    bracket_exit_price = self.active_trade.entry_price + self.stop_loss_points
                elif self.max_bars_held is not None and self.active_bars_held >= self.max_bars_held:
                    bracket_exit_price = fill_price

            if bracket_exit_price is not None:
                closed_trade = self._close_position(timestamp, bracket_exit_price, apply_slippage=False)
                # If target was hit, abstain from immediate re-entry this bar
                if action == closed_trade.position.value:
                    return closed_trade

        # 2. If action matches current active position, maintain position
        if action == self.current_position.value:
            return closed_trade

        # 3. If action is HOLD or opposite direction, close existing position
        if self.current_position != PositionState.FLAT and self.active_trade is not None:
            closed_trade = self._close_position(timestamp, fill_price, apply_slippage=True)

        # 4. Open new position if action is LONG or SHORT
        if action in ["LONG", "SHORT"]:
            new_pos = PositionState.LONG if action == "LONG" else PositionState.SHORT
            entry_fill = fill_price + self.slippage if new_pos == PositionState.LONG else fill_price - self.slippage
            trade_id = f"trade_{len(self.trades) + 1}_{timestamp.strftime('%Y%m%d%H%M')}"
            self.active_trade = Trade(
                trade_id=trade_id,
                entry_time=timestamp,
                exit_time=None,
                position=new_pos,
                entry_price=entry_fill,
                exit_price=None,
                units=self.max_units,
                gross_pnl=0.0,
                net_pnl=0.0,
                is_closed=False,
            )
            self.current_position = new_pos
            self.active_bars_held = 0

        return closed_trade

    def close_all_positions(self, timestamp: datetime, fill_price: float) -> Optional[Trade]:
        if self.current_position != PositionState.FLAT and self.active_trade is not None:
            return self.process_decision("session_eod_close", timestamp, "HOLD", fill_price)
        return None

    def get_performance_summary(self) -> PerformanceSummary:
        if not self.trades:
            return PerformanceSummary(0, 0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)

        pnls = [t.net_pnl for t in self.trades]
        gross_pnls = [t.gross_pnl for t in self.trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]

        total_trades = len(pnls)
        winning_trades = len(wins)
        losing_trades = len(losses)
        win_rate = winning_trades / total_trades if total_trades > 0 else 0.0
        gross_pnl = float(np.sum(gross_pnls))
        net_pnl = float(np.sum(pnls))

        profit_factor = float(np.sum(wins) / abs(np.sum(losses))) if losses and np.sum(losses) != 0 else float("inf")

        # Max drawdown
        cum_pnl = np.cumsum(pnls)
        peak = np.maximum.accumulate(cum_pnl)
        drawdown = peak - cum_pnl
        max_dd = float(np.max(drawdown)) if len(drawdown) > 0 else 0.0

        avg_trade = float(np.mean(pnls)) if total_trades > 0 else 0.0

        return PerformanceSummary(
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            gross_pnl=gross_pnl,
            net_pnl=net_pnl,
            profit_factor=profit_factor,
            max_drawdown=max_dd,
            avg_trade_pnl=avg_trade,
        )
