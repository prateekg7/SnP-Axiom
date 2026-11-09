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
    assert data.get("mode") == "live_session"
    assert "position_state" in data
    assert "realized_pnl_pts" in data
    assert "unrealized_pnl_pts" in data


def test_dynamic_directional_matrix_and_live_paper_trading():
    # 1. Reset live session state to 0
    reset_resp = client.post("/api/live/reset")
    assert reset_resp.status_code == 200
    r_data = reset_resp.json()
    assert r_data["matrix"]["total"] == 0
    assert r_data["matrix"]["TP"] == 0
    assert r_data["matrix"]["TN"] == 0

    # 2. Advance by one 5m bar via tick simulation
    tick_resp = client.post("/api/market/tick?simulate=true")
    assert tick_resp.status_code == 200
    t_data = tick_resp.json()
    assert t_data["advanced"] is True
    assert t_data["matrix"]["total"] == 1
    assert "latest_forecast" in t_data
    assert t_data["latest_forecast"]["status"] == "PENDING"

    # 3. Verify evaluation stats endpoint exposes the live matrix
    stats_resp = client.get("/api/evaluation/stats")
    assert stats_resp.status_code == 200
    s_data = stats_resp.json()
    assert "live_directional_matrix" in s_data
    assert s_data["live_directional_matrix"]["total"] == 1

    # 4. Advance another 5m bar
    tick_resp_2 = client.post("/api/market/tick?simulate=true")
    assert tick_resp_2.status_code == 200
    assert tick_resp_2.json()["matrix"]["total"] == 2

    # 5. Clean reset back to 0
    final_reset = client.post("/api/live/reset")
    assert final_reset.status_code == 200
    assert final_reset.json()["matrix"]["total"] == 0


def test_frontend_root_serving():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "SPX Quantitative Terminal" in resp.text
