from pathlib import Path
from typing import Optional
import pandas as pd
import yfinance as yf

from src.data.base import VolumeSemantics


class YahooFinanceProvider:
    def __init__(self, raw_cache_path: str = "data/raw/spx_5m_yahoo_raw.parquet"):
        self.raw_cache_path = Path(raw_cache_path)

    def fetch_data(
        self,
        symbol: str = "^GSPC",
        period: str = "60d",
        interval: str = "5m",
        force_download: bool = False,
    ) -> pd.DataFrame:
        if self.raw_cache_path.exists() and not force_download:
            return pd.read_parquet(self.raw_cache_path)

        ticker = yf.Ticker(symbol)
        raw_df = ticker.history(period=period, interval=interval)
        if raw_df.empty:
            raise RuntimeError(f"Yahoo Finance returned no data for symbol {symbol}")

        self.raw_cache_path.parent.mkdir(parents=True, exist_ok=True)
        raw_df.to_parquet(self.raw_cache_path)
        return raw_df

    def load_df(
        self,
        symbol: str = "^GSPC",
        period: str = "60d",
        interval: str = "5m",
        force_download: bool = False,
    ) -> pd.DataFrame:
        raw_df = self.fetch_data(symbol=symbol, period=period, interval=interval, force_download=force_download)
        df = raw_df.reset_index()

        datetime_col = "Datetime" if "Datetime" in df.columns else df.columns[0]
        df["timestamp"] = pd.to_datetime(df[datetime_col], utc=True)
        df["instrument"] = "SPX"
        df["provider_symbol"] = symbol
        df["bar_interval"] = interval
        df["open"] = df["Open"].astype(float)
        df["high"] = df["High"].astype(float)
        df["low"] = df["Low"].astype(float)
        df["close"] = df["Close"].astype(float)
        df["volume"] = df["Volume"].astype(float)
        df["volume_semantics"] = VolumeSemantics.AGGREGATE_SHARES.value
        df["source"] = "yahoo_finance"
        df["is_final"] = True

        cols = [
            "timestamp",
            "instrument",
            "provider_symbol",
            "bar_interval",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "volume_semantics",
            "source",
            "is_final",
        ]
        return df[cols].sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
