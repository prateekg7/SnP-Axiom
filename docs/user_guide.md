# SPX AI Trading Indicator User Guide

This guide explains how to run, configure, and inspect the SPX AI Trading Indicator system.

## Overview

The application forecasts short-term price movements for the S&P 500 cash index (SPX) using 5-minute historical candles. It combines a machine learning model, a probability calibration layer, and a simulated paper-trading engine that displays recommendations and portfolio analytics in a web dashboard.

All trades and P&L calculations are strictly hypothetical. SPX is a non-tradable cash index level; no broker orders are placed.

## Prerequisites and setup

The project requires Python 3.12 and Node.js (version 18 or newer).

1. Activate the Python virtual environment:
```bash
source .venv/bin/activate
```

2. Verify that dependencies are installed:
```bash
uv pip install -r requirements.txt
```

3. Build the frontend dashboard:
```bash
cd frontend
npm install
npm run build
cd ..
```

## Running the application

Start the FastAPI application with Uvicorn from the project root:

```bash
PYTHONPATH=. .venv/bin/python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

Open `http://localhost:8000` in your web browser. The backend serves the compiled React single-page application at the root URL while exposing REST and WebSocket endpoints under `/api` and `/ws`.

For frontend development with live hot-reloading:

```bash
cd frontend
npm run dev
```

The Vite dev server runs at `http://localhost:3000` and automatically proxies `/api` and `/ws` requests to the FastAPI backend running on port 8000.

## API endpoints

The backend provides several JSON endpoints:

- `GET /api/market/latest`: Returns the latest 5-minute SPX quote, session state, day range, and data freshness tag.
- `GET /api/market/candles?limit=100`: Returns chronological candlestick data formatted for financial charting libraries.
- `GET /api/forecast/latest`: Generates and returns the latest multi-task forecast, including 5-minute touch probability, 30-minute expected path, predicted high and low, volatility, regime, and action recommendation.
- `GET /api/forecast/history?limit=50`: Returns the append-only log of immutable forecast records.
- `GET /api/decisions`: Returns current trade action signals and decision reason codes.
- `GET /api/trades?limit=50`: Returns the simulated execution history from the paper-trading ledger.
- `GET /api/performance`: Returns strategy statistics including total trades, win rate, gross and net P&L, profit factor, and maximum drawdown.
- `WebSocket /ws/market`: Streams price ticks and forecast updates every five seconds to connected clients.

## Dashboard interface

The web dashboard is organized into four main areas:

1. Market Header: Shows the current SPX index level, point change, percentage change, session status (Regular Session vs Closed), data source symbol (`^GSPC`), and provider freshness disclaimer.
2. Recommended Action Banner: Highlights the current action (LONG, SHORT, or HOLD) alongside validation status and rule codes.
3. Candlestick Chart and Forecast Overview: Displays interactive five-minute candlestick bars overlaid with the 30-minute projected trajectory, predicted 30-minute high and low guide lines, and the 90% conformal prediction interval band.
4. Trade Log and Performance Panel: Provides tabbed access to the immutable forecast log and simulated trade ledger, with metrics for cumulative P&L, win rate, profit factor, and drawdowns.

## Re-running pipeline tasks

To regenerate the canonical dataset, model weights, or evaluation figures:

1. Build canonical data:
```bash
PYTHONPATH=. .venv/bin/python scripts/build_canonical_dataset.py
```

2. Generate features and target labels:
```bash
PYTHONPATH=. .venv/bin/python scripts/build_features_and_labels.py
```

3. Train LightGBM benchmark and LSTM forecasters:
```bash
PYTHONPATH=. .venv/bin/python scripts/train_and_evaluate.py
```

4. Calibrate probabilities and prediction intervals:
```bash
PYTHONPATH=. .venv/bin/python scripts/run_calibration_and_uncertainty.py
```

5. Run out-of-sample evaluation and demonstration replay:
```bash
PYTHONPATH=. .venv/bin/python scripts/run_final_evaluation.py
```

