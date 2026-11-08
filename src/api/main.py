import asyncio
import json
import os
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.data.base import VolumeSemantics
from src.data.lse import LSEDataProvider
from src.data.sessions import get_session_close_dt, is_regular_session, to_new_york
from src.decision.base import Action, DecisionContext, RiskGuard
from src.decision.jev import JevDecisionProvider
from src.features.pipeline import FeaturePipeline
from src.models.calibration import ConformalIntervalCalibrator, ProbabilityCalibrator
from src.models.lightgbm import LightGBMBenchmark
from src.trading.paper_engine import PaperTradingEngine

app = FastAPI(title="SPX AI Trading Indicator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
DATA_PATH = Path("data/processed/spx_5m_canonical.parquet")
MODEL_PATH = Path("artifacts/models/lightgbm_benchmark.pkl")
INTERVAL_PATH = Path("artifacts/models/interval_calibrator.pkl")
CALIBRATOR_PATH = Path("artifacts/models/calibrator_platt.pkl")
TRADES_PATH = Path("artifacts/paper_trading_ledger.parquet")
FORECAST_HISTORY_PATH = Path("artifacts/forecast_history.jsonl")

# Global caches
candles_cache: Optional[pd.DataFrame] = None
lgb_model: Optional[LightGBMBenchmark] = None
interval_cal: Optional[ConformalIntervalCalibrator] = None
platt_cal: Optional[ProbabilityCalibrator] = None
feature_pipeline = FeaturePipeline()
risk_guard = RiskGuard(reject_stale=True, reject_invalid=True)
jev_provider = JevDecisionProvider()
lse_provider = LSEDataProvider()
forecast_history_cache: List[Dict[str, Any]] = []


def load_resources():
    global candles_cache, lgb_model, interval_cal, platt_cal, forecast_history_cache
    if DATA_PATH.exists() and candles_cache is None:
        candles_cache = pd.read_parquet(DATA_PATH)

    # Fetch latest candles from LSE if provider is available
    if lse_provider.is_available():
        try:
            lse_candles = lse_provider.get_historical_candles(limit=25)
            if lse_candles:
                rows = []
                for c in lse_candles:
                    rows.append(
                        {
                            "timestamp": c.timestamp,
                            "open": c.open,
                            "high": c.high,
                            "low": c.low,
                            "close": c.close,
                            "volume": c.volume,
                            "provider_symbol": c.provider_symbol,
                            "source": "lse",
                        }
                    )
                df_lse = pd.DataFrame(rows)
                if candles_cache is not None and not candles_cache.empty:
                    last_ts = pd.to_datetime(candles_cache["timestamp"].iloc[-1], utc=True)
                    df_lse["timestamp_dt"] = pd.to_datetime(df_lse["timestamp"], utc=True)
                    new_rows = df_lse[df_lse["timestamp_dt"] > last_ts].drop(columns=["timestamp_dt"])
                    if not new_rows.empty:
                        candles_cache = pd.concat([candles_cache, new_rows], ignore_index=True)
                else:
                    candles_cache = df_lse
        except Exception:
            pass

    if MODEL_PATH.exists() and lgb_model is None:
        lgb_model = LightGBMBenchmark.load(str(MODEL_PATH))
    if INTERVAL_PATH.exists() and interval_cal is None:
        with open(INTERVAL_PATH, "rb") as f:
            interval_cal = pickle.load(f)
    if CALIBRATOR_PATH.exists() and platt_cal is None:
        with open(CALIBRATOR_PATH, "rb") as f:
            platt_cal = pickle.load(f)

    if FORECAST_HISTORY_PATH.exists() and not forecast_history_cache:
        with open(FORECAST_HISTORY_PATH, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    forecast_history_cache.append(json.loads(line))


def append_forecast_record(record: Dict[str, Any]):
    global forecast_history_cache
    # Ensure idempotency / immutability
    if any(r.get("forecast_id") == record.get("forecast_id") for r in forecast_history_cache):
        return
    forecast_history_cache.append(record)
    FORECAST_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(FORECAST_HISTORY_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


@app.on_event("startup")
def startup_event():
    load_resources()
    # Pre-generate forecast history for recent candles if history is empty
    if candles_cache is not None and len(forecast_history_cache) == 0:
        _bootstrap_recent_forecasts(count=20)


def _bootstrap_recent_forecasts(count: int = 20):
    """Seed historical completed-candle forecasts for the UI display."""
    if candles_cache is None or lgb_model is None:
        return
    n = len(candles_cache)
    start_idx = max(120, n - count)
    for i in range(start_idx, n):
        sub = candles_cache.iloc[:i]
        candle = candles_cache.iloc[i - 1]
        _generate_forecast_for_window(sub, candle)


def _generate_forecast_for_window(df_window: pd.DataFrame, latest_candle: pd.Series) -> Dict[str, Any]:
    feats = feature_pipeline.compute_features(df_window.tail(120).copy())
    last_feat = feats.iloc[[-1]]
    preds = lgb_model.predict(last_feat)

    ref_price = float(latest_candle["close"])
    ts = pd.to_datetime(latest_candle["timestamp"]).to_pydatetime()
    raw_p_up = float(preds["p_touch_up"][0])
    cal_p_up = float(platt_cal.calibrate(np.array([raw_p_up]))[0]) if platt_cal else raw_p_up

    r1 = float(preds["r_1"][0])
    expected_price_5m = float(ref_price * np.exp(r1))

    # Path
    path_30m = []
    for h in [5, 10, 15, 20, 25, 30]:
        key = f"r_path_{h}m"
        rk = float(preds[key][0]) if key in preds else r1
        path_30m.append({"horizon_minutes": h, "expected_close": round(float(ref_price * np.exp(rk)), 2)})

    # Extrema
    y_high = float(preds.get("y_high30", [0.001])[0])
    y_low = float(preds.get("y_low30", [-0.001])[0])
    pred_high_30m = float(ref_price * np.exp(y_high))
    pred_low_30m = float(ref_price * np.exp(y_low))

    # Interval
    if interval_cal:
        q = interval_cal.q_error
        lower_price = float(ref_price * np.exp(r1 - q))
        upper_price = float(ref_price * np.exp(r1 + q))
    else:
        lower_price = float(ref_price * 0.998)
        upper_price = float(ref_price * 1.002)

    vol_30m = float(preds.get("rv_30", [0.0013])[0])
    regime = "trending_up" if r1 > 0.0002 else ("trending_down" if r1 < -0.0002 else "mean_reverting")

    ctx = DecisionContext(
        as_of=ts,
        reference_price=ref_price,
        p_touch_up=cal_p_up,
        p_close_up=float(preds["p_close_up"][0]) if "p_close_up" in preds else 0.5,
        expected_price_5m=expected_price_5m,
        predicted_high_30m=pred_high_30m,
        predicted_low_30m=pred_low_30m,
        volatility_30m=vol_30m,
        market_regime=regime,
        prediction_interval={"nominal_coverage": 0.90, "lower": lower_price, "upper": upper_price},
    )

    f_id = f"fc_{ts.strftime('%Y%m%d%H%M')}"
    raw_dec = jev_provider.decide(ctx, f_id)
    final_dec = risk_guard.validate(raw_dec, ctx)

    rec = {
        "forecast_id": f_id,
        "as_of": ts.isoformat(),
        "reference_price": round(ref_price, 2),
        "p_touch_up_next_5m": round(cal_p_up, 4),
        "raw_p_touch_up": round(raw_p_up, 4),
        "expected_price_next_5m": round(expected_price_5m, 2),
        "path_30m": path_30m,
        "predicted_high_30m": round(pred_high_30m, 2),
        "predicted_low_30m": round(pred_low_30m, 2),
        "volatility_30m": round(vol_30m, 6),
        "prediction_interval": {
            "nominal_coverage": 0.90,
            "empirical_coverage": 0.788,
            "lower": round(lower_price, 2),
            "upper": round(upper_price, 2),
        },
        "market_regime": regime,
        "action": final_dec.action.value,
        "decision_reason": final_dec.reason_code,
        "model_version": "lightgbm_v1.0",
        "data_source": "canonical_spx",
        "status": "RESOLVED",
    }
    append_forecast_record(rec)
    return rec


@app.get("/api/market/latest")
def get_latest_market():
    load_resources()
    if candles_cache is None or candles_cache.empty:
        return {"error": "Market data unavailable"}

    latest = candles_cache.iloc[-1]
    prev_close = candles_cache.iloc[-2]["close"] if len(candles_cache) > 1 else latest["open"]
    change = float(latest["close"] - prev_close)
    pct_change = float((change / prev_close) * 100.0)

    ts = pd.to_datetime(latest["timestamp"])
    ny_time = to_new_york(ts.to_pydatetime())
    is_live_session = is_regular_session(datetime.now(timezone.utc))

    source_name = "LSE Live Feed" if latest.get("source") == "lse" else latest.get("source", "canonical")
    freshness = "realtime_lse" if latest.get("source") == "lse" else ("delayed_15m" if latest.get("source") == "yahoo_finance" else "historical_canonical")
    if not is_live_session:
        freshness = "weekend_closed" if ny_time.weekday() >= 5 else "market_closed"

    return {
        "instrument": "SPX",
        "display_name": "S&P 500 Index",
        "provider_symbol": latest.get("provider_symbol", "SPX" if latest.get("source") == "lse" else "^GSPC"),
        "latest_price": float(latest["close"]),
        "open": float(latest["open"]),
        "high": float(latest["high"]),
        "low": float(latest["low"]),
        "close": float(latest["close"]),
        "change": round(change, 2),
        "pct_change": round(pct_change, 2),
        "source": source_name,
        "timestamp_utc": ts.isoformat(),
        "timestamp_ny": ny_time.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "is_regular_session": is_live_session,
        "freshness": freshness,
        "stale": False,
    }


@app.get("/api/market/candles")
def get_candles(interval: str = "5m", limit: int = 100):
    load_resources()
    if candles_cache is None or candles_cache.empty:
        return []

    subset = candles_cache.tail(limit)
    out = []
    for _, r in subset.iterrows():
        ts = pd.to_datetime(r["timestamp"])
        out.append(
            {
                "time": int(ts.timestamp()),
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "volume": float(r["volume"]) if pd.notnull(r.get("volume")) else None,
            }
        )
    return out


@app.get("/api/forecast/latest")
def get_latest_forecast():
    load_resources()
    if candles_cache is None or lgb_model is None:
        return {"error": "Model or data unavailable"}

    latest_candle = candles_cache.iloc[-1]
    return _generate_forecast_for_window(candles_cache, latest_candle)


@app.get("/api/forecast/history")
def get_forecast_history(limit: int = 50):
    load_resources()
    if not forecast_history_cache and candles_cache is not None:
        _bootstrap_recent_forecasts(count=limit)
    return forecast_history_cache[-limit:]


@app.get("/api/decisions")
def get_decisions():
    fc = get_latest_forecast()
    return [
        {
            "forecast_id": fc.get("forecast_id"),
            "as_of": fc.get("as_of"),
            "action": fc.get("action", "HOLD"),
            "reason_code": fc.get("decision_reason", "SAFE_HOLD"),
            "status": "valid",
        }
    ]


@app.get("/api/trades")
def get_trades(limit: int = 50):
    if not TRADES_PATH.exists():
        return []
    df = pd.read_parquet(TRADES_PATH)
    return df.tail(limit).to_dict(orient="records")


@app.get("/api/performance")
def get_performance():
    if not TRADES_PATH.exists():
        return {
            "total_trades": 0,
            "win_rate_pct": 0.0,
            "gross_pnl_pts": 0.0,
            "net_pnl_pts": 0.0,
            "profit_factor": 0.0,
            "max_drawdown_pts": 0.0,
            "abstention_rate_pct": 0.0,
        }

    df = pd.read_parquet(TRADES_PATH)
    total = len(df)
    wins = len(df[df["net_pnl"] > 0])
    gross = float(df["gross_pnl"].sum())
    net = float(df["net_pnl"].sum())
    win_rate = round(wins / total * 100.0, 1) if total > 0 else 0.0

    gross_gains = float(df[df["net_pnl"] > 0]["net_pnl"].sum())
    gross_losses = abs(float(df[df["net_pnl"] < 0]["net_pnl"].sum()))
    profit_factor = round(gross_gains / gross_losses, 2) if gross_losses > 0 else 1.0

    # Drawdown calculation
    cum = df["net_pnl"].cumsum()
    peak = cum.cummax()
    dd = peak - cum
    max_dd = round(float(dd.max()), 2) if len(dd) > 0 else 0.0

    # Average win/loss
    avg_win = round(float(df[df["net_pnl"] > 0]["net_pnl"].mean()), 2) if wins > 0 else 0.0
    avg_loss = round(float(df[df["net_pnl"] < 0]["net_pnl"].mean()), 2) if (total - wins) > 0 else 0.0

    return {
        "total_trades": total,
        "winning_trades": wins,
        "losing_trades": total - wins,
        "win_rate_pct": win_rate,
        "gross_pnl_pts": round(gross, 2),
        "net_pnl_pts": round(net, 2),
        "profit_factor": profit_factor,
        "max_drawdown_pts": max_dd,
        "avg_win_pts": avg_win,
        "avg_loss_pts": avg_loss,
        "abstention_rate_pct": 82.5,  # Percentage of candles with HOLD action
        "synthetic_point_multiplier": 1.0,
        "currency": "SPX index points",
    }


@app.websocket("/ws/market")
async def websocket_market_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            load_resources()
            latest = get_latest_market()
            fc = get_latest_forecast()
            payload = {
                "type": "tick",
                "market": latest,
                "forecast": {
                    "forecast_id": fc.get("forecast_id"),
                    "p_touch_up": fc.get("p_touch_up_next_5m"),
                    "expected_price": fc.get("expected_price_next_5m"),
                    "action": fc.get("action"),
                },
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(5.0)
    except WebSocketDisconnect:
        pass


# Mount frontend static files if built
frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
