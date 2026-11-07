from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, Protocol, Sequence


class VolumeSemantics(str, Enum):
    UNAVAILABLE = "unavailable"
    TICK_VOLUME = "tick_volume"
    PROXY_VOLUME = "proxy_volume"
    AGGREGATE_SHARES = "aggregate_shares"


@dataclass(frozen=True)
class Candle:
    instrument: str
    provider_symbol: str
    timestamp: datetime
    bar_interval: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = None
    volume_semantics: str = VolumeSemantics.UNAVAILABLE.value
    source: str = ""
    is_final: bool = True

    def validate_invariants(self) -> None:
        if self.high < self.low:
            raise ValueError(f"High {self.high} is lower than Low {self.low}")
        if self.high < self.open or self.high < self.close:
            raise ValueError(f"High {self.high} is less than open/close ({self.open}, {self.close})")
        if self.low > self.open or self.low > self.close:
            raise ValueError(f"Low {self.low} is greater than open/close ({self.open}, {self.close})")
        if self.open <= 0 or self.high <= 0 or self.low <= 0 or self.close <= 0:
            raise ValueError("Prices must be positive numbers")


class DataProvider(Protocol):
    def get_historical_candles(
        self,
        symbol: str,
        interval: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> Sequence[Candle]:
        ...

    def get_latest_candles(self, symbol: str, interval: str, limit: int = 100) -> Sequence[Candle]:
        ...
