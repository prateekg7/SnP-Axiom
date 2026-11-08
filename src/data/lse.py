import os
from datetime import datetime
from typing import List, Optional
import pandas as pd

from src.data.base import Candle, VolumeSemantics


class LSEDataProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("LSE_API_KEY")

    def is_available(self) -> bool:
        return bool(self.api_key)

    def get_historical_candles(
        self,
        symbol: str = "SPX",
        interval: str = "5m",
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: int = 5000,
    ) -> List[Candle]:
        if not self.is_available():
            raise RuntimeError(
                "LSE provider is unavailable: LSE_API_KEY is not set. "
                "Obtain a key at https://londonstrategicedge.com/free-market-data-api/"
            )
        try:
            import lse
            client = lse.LSE(api_key=self.api_key)
            start_str = start.isoformat() if start else None
            end_str = end.isoformat() if end else None
            rows = client.candles(
                symbol=symbol,
                timeframe=interval,
                market="indices",
                start=start_str,
                end=end_str,
                limit=limit,
            )
            candles: List[Candle] = []
            for r in rows:
                c = Candle(
                    instrument="SPX",
                    provider_symbol=symbol,
                    timestamp=pd.to_datetime(r["timestamp"], utc=True).to_pydatetime(),
                    bar_interval=interval,
                    open=float(r["open"]),
                    high=float(r["high"]),
                    low=float(r["low"]),
                    close=float(r["close"]),
                    volume=float(r["volume"]) if "volume" in r and r["volume"] is not None else None,
                    volume_semantics=VolumeSemantics.UNAVAILABLE.value,
                    source="lse",
                    is_final=True,
                )
                c.validate_invariants()
                candles.append(c)
            return candles
        except Exception as err:
            raise RuntimeError(f"LSE query failed for {symbol}: {err}") from err
