from pathlib import Path
from typing import Optional
import pandas as pd
import requests

from src.data.base import VolumeSemantics

GETDATA_URL = "https://raw.githubusercontent.com/getdata-finance/spx500-5m-ohlcv-index-historical-data/main/SPX500_5m.csv"


class GetDataSampleProvider:
    def __init__(self, raw_cache_path: str = "data/raw/spx500_5m_getdata_raw.csv"):
        self.raw_cache_path = Path(raw_cache_path)

    def fetch_raw_csv(self, url: str = GETDATA_URL, force_download: bool = False) -> Path:
        if self.raw_cache_path.exists() and not force_download:
            return self.raw_cache_path

        self.raw_cache_path.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        self.raw_cache_path.write_bytes(response.content)
        return self.raw_cache_path

    def load_df(self) -> pd.DataFrame:
        csv_path = self.fetch_raw_csv()
        df = pd.read_csv(csv_path)

        df["timestamp"] = pd.to_datetime(df["datetime"], utc=True)
        df["instrument"] = "SPX"
        df["provider_symbol"] = "SPX500"
        df["bar_interval"] = "5m"
        df["volume_semantics"] = VolumeSemantics.TICK_VOLUME.value
        df["source"] = "getdata_sample"
        df["is_final"] = True

        df = df.rename(columns={"open": "open", "high": "high", "low": "low", "close": "close"})
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
        df = df[cols].sort_values("timestamp").drop_duplicates(subset=["timestamp"]).reset_index(drop=True)
        return df
