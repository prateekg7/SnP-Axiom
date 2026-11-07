# SPX AI Trading Indicator

An AI-assisted forecasting and paper-trading system for the S&P 500 cash index (SPX), featuring a multi-task LightGBM and LSTM forecasting pipeline, conformal prediction calibration, and a real-time React dashboard.

All trades and portfolio metrics are hypothetical paper-trading simulations. The system does not place live orders or connect to brokerages.

## Architecture

The project implements an end-to-end quantitative pipeline:

- Data layer: Ingestion and validation of 5-minute SPX candles (`^GSPC`) with regular-session filtering (09:30 to 16:00 New York time). SPX has no native traded volume; volume entries represent aggregated constituent share counts.
- Feature pipeline: 36 technical, volatility, candle morphology, and session progress features.
- Multi-task forecasting: Models predicting next-candle touch-up probability (`next_high > current_close`), 5-minute expected return, 30-minute trajectory path, 30-minute extrema, end-of-session close, and realized volatility.
- Calibration: Platt probability scaling and conformal prediction intervals with a 90% nominal target.
- Decision layer: Pluggable decision provider with deterministic risk guards, cooldown timers, and safe hold fallbacks.
- Paper trading: Execution simulator accounting for conservative fill timing, synthetic notional values, bid-ask spread costs, and slippage.
- API and dashboard: FastAPI backend with REST and WebSocket endpoints serving an interactive React dashboard built with Lightweight Charts.

## Quick start

### Prerequisites

- Python 3.12
- Node.js (v18 or newer)
- uv package manager

### Installation

1. Create and activate a Python virtual environment:
```bash
uv venv .venv --python python3.12
source .venv/bin/activate
uv pip install -r requirements.txt
```

2. Build the React frontend:
```bash
cd frontend
npm install
npm run build
cd ..
```

### Running the application

Launch the FastAPI backend server:

```bash
PYTHONPATH=. .venv/bin/python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

Open `http://localhost:8000` in your browser. The backend serves the compiled dashboard and exposes the following endpoints:

- `GET /api/market/latest`: Current quote, day range, and provider freshness.
- `GET /api/market/candles`: Historical 5-minute OHLC bars.
- `GET /api/forecast/latest`: Current calibrated probabilities and multi-horizon price projections.
- `GET /api/forecast/history`: Immutable record of completed-candle forecasts.
- `GET /api/trades`: Simulated paper-trading ledger.
- `GET /api/performance`: Strategy metrics including net P&L, win rate, and drawdown.
- `WebSocket /ws/market`: Five-second streaming market and forecast updates.

For frontend development with hot module reloading:

```bash
cd frontend
npm run dev
```

## Documentation

- User guide: `docs/user_guide.md`
- Final evaluation and benchmark report: `artifacts/final_evaluation_report.md`
- Demonstration session replay log: `artifacts/demonstration_session_log.json`
- Model comparison report: `artifacts/model_comparison_report.md`
- Calibration report: `artifacts/calibration_and_uncertainty_report.md`
- Data audit report: `data/audit_report.md`
- Provider feasibility trial: `data/provider_trials.md`
