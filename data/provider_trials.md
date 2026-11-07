# Provider Trial Report

This document records trial findings for prospective S&P 500 (SPX) intraday market data providers. Evaluations follow the sequential order in data/README.md.

## Summary of trial results

| Provider | Candidate Symbol | Earliest 5m Bar | Latest 5m Bar | Session Coverage | Live Streaming | Access / Cost | Identity Match | Decision |
|---|---|---|---|---|---|---|---|---|
| London Strategic Edge (LSE) | SPX.IDX (indices market) | Unavailable without key | Unavailable without key | Unknown | WebSocket advertised (wss://data-ws.londonstrategicedge.com) | Free key required; HTTP 401 without key | Unverified | Blocked pending API key |
| GetData Finance | SPX500 | 2026-03-26 02:30:00 UTC | 2026-09-25 20:40:00 UTC | Global (24 hours) | Not included in sample | Free GitHub sample (36,108 bars); full archive paid | High (~1 pt spread vs GSPC) | Accepted for historical baseline |
| Yahoo Finance | ^GSPC | 2026-08-14 13:30:00 UTC | 2026-11-06 20:55:00 UTC | US Regular (09:30 to 16:00 ET) | Delayed snapshot / polling | Free via yfinance (rolling 60 days) | Exact cash index (^GSPC) | Accepted for recent data and verification |

## Detailed findings

### Trial 1: London Strategic Edge (LSE)

Web endpoints probed:
- Documentation site (https://londonstrategicedge.com/docs/api): HTTP 200.
- Data 3.0 API base (https://download.londonstrategicedge.com/v3): HTTP 401 (`key-missing`).
- Official Python client library: `lse-data` version 3.0 on PyPI.
- Candidate index market symbol: `SPX.IDX`.

Findings:
1. Every API call under `/v3` requires an `X-API-Key` header. Unauthenticated requests return `{"code":"key-missing","message":"send the key as X-API-Key or ?key="}`.
2. The environment does not contain `LSE_API_KEY`.
3. Without an active API key, we cannot query the catalogue, inspect historical five-minute depth, or connect to the live WebSocket.
4. LSE remains blocked until an account key is supplied.

### Trial 2: GetData Finance (GitHub sample)

Source evaluated:
- URL: https://raw.githubusercontent.com/getdata-finance/spx500-5m-ohlcv-index-historical-data/main/SPX500_5m.csv
- Format: CSV (datetime, open, high, low, close, volume).

Findings:
1. Row count: 36,108 completed five-minute candles spanning 2026-03-26 to 2026-09-25.
2. Session: 24-hour global trading. Bars exist outside US regular hours. Filtering for US regular trading hours (09:30 to 16:00 ET) yields 9,750 regular-session five-minute candles across 125 trading sessions.
3. Volume: Volume numbers range from roughly 500 to 5,000 per candle. This represents tick counts (price updates), not exchange-traded index volume.
4. Scale: Prices range from ~6,560 to ~7,810 over the sample period, tracking SPX levels.
5. Invariants: High is always greater than or equal to Open, Low, and Close. Low is always less than or equal to Open, High, and Close. No zero or negative prices occur.

### Trial 3: Yahoo Finance (^GSPC)

Source evaluated:
- Library: `yfinance` 1.8.0.
- Symbol: `^GSPC` (standard ticker for S&P 500 cash index).

Findings:
1. Row count: 4,679 five-minute candles spanning 2026-08-14 to 2026-11-06 (the rolling 60-day intraday limit).
2. Session: Strictly regular US trading hours (09:30 to 16:00 ET).
3. Volume: Reports aggregated component share volume, not traded index shares.
4. Freshness: Updates throughout market hours with a standard 15-minute exchange delay.

### Overlap analysis (GetData vs Yahoo Finance)

We matched candles across the 2,339 overlapping regular-session five-minute intervals between 2026-08-14 and 2026-09-25:
- Mean difference (GetData close minus Yahoo close): +1.03 index points.
- Standard deviation of difference: 1.47 index points.
- Median difference: +1.27 index points.
- 25th percentile: +0.16 index points; 75th percentile: +2.05 index points.
- Extreme spread: -4.05 to +6.07 index points (less than 0.08% of index level).

Interpretation:
The two series track the same underlying market movements with tiny differences caused by timestamp boundary rounding and continuous index interpolation.

## Canonical dataset strategy

To satisfy project constraints without buying paid archives or altering the target instrument:
1. GetData regular-session candles provide the multi-month historical training and walk-forward validation dataset (March 2026 to September 2026, 9,750 bars).
2. Yahoo Finance `^GSPC` provides the recent test window, out-of-sample verification, and live dashboard market feed (August 2026 to November 2026, 4,679 bars).
3. We store raw downloads immutably under `data/raw/` and produce a clean canonical Parquet table under `data/processed/spx_5m_canonical.parquet`.
