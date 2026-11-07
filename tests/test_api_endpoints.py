from fastapi.testclient import TestClient
import pytest
from src.api.main import app

client = TestClient(app)


def test_api_market_latest():
    resp = client.get("/api/market/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["instrument"] == "SPX"
    assert "latest_price" in data
    assert "change" in data
    assert "freshness" in data


def test_api_market_candles():
    resp = client.get("/api/market/candles?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 10
    if len(data) > 0:
        assert "time" in data[0]
        assert "close" in data[0]


def test_api_forecast_latest():
    resp = client.get("/api/forecast/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert "p_touch_up_next_5m" in data
    assert "expected_price_next_5m" in data
    assert "predicted_high_30m" in data
    assert "predicted_low_30m" in data
    assert "action" in data


def test_api_forecast_history():
    resp = client.get("/api/forecast/history?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_api_performance():
    resp = client.get("/api/performance")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_trades" in data
    assert "win_rate_pct" in data
    assert "net_pnl_pts" in data


def test_frontend_root_serving():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "SPX AI Trading Indicator" in resp.text
