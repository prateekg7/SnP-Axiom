# Data Acquisition and Provider Trial Log

## Target instrument

S&P 500 cash index (SPX), matching the user-facing S&P 500 quote (`INDEXSP:.INX` in the supplied screenshot).

Do not silently substitute:
- SPY ETF;
- ES futures;
- a broker CFD / `US500` / `SPX500` derivative;
- an index proxy with a different session or price methodology.

A proxy can be separately tested as an input feature, but it is not the target-price history.

## Provider trial order

Try providers one at a time. For each provider, save:
- provider name and account plan;
- exact symbol and instrument description;
- API endpoint or download URL;
- earliest/latest timestamps;
- interval and session coverage;
- timezone;
- OHLC semantics;
- volume semantics;
- data delay/update frequency;
- missing/duplicate bars;
- overlap comparison against the chosen reference;
- licence/redistribution terms;
- decision: accept / reject / research-only.

### Trial 1 — London Strategic Edge (LSE) — first choice to validate

Links:
- https://londonstrategicedge.com/pricing
- https://londonstrategicedge.com/free-market-data-api/
- API reference: https://londonstrategicedge.com/docs/api
- WebSocket reference: https://londonstrategicedge.com/docs/websocket

Why try first:
- Advertises REST historical OHLCV and WebSocket live prices.
- Advertises 1m, 5m, 15m, 1h, 4h and daily bars.
- Advertises an index instrument catalogue.
- User reports a free tier with 60 API calls/minute.

Candidate symbol from earlier research: `SPX.IDX` in the indices market. Treat this as unverified until the API returns instrument metadata and sample candles.

Must verify:
1. Is this the S&P 500 cash index matching the intended display, or a derived/alternative index series?
2. Does the exact symbol have 5-minute history?
3. What is the earliest 5-minute candle?
4. Is the five-minute history available on the free plan?
5. Does its WebSocket stream support this exact symbol on the free plan?
6. What is actual update cadence and delay?
7. Does the advertised 60 calls/minute apply to this endpoint/account?
8. What are export and data retention limits?
9. Can data be displayed in a publicly hosted academic demo?

Do not infer five-minute historical depth from a claim about daily history or total archive size.

### Trial 2 — GetData Finance GitHub sample — free evaluation only

Links:
- https://github.com/getdata-finance/spx500-5m-ohlcv-index-historical-data
- https://raw.githubusercontent.com/getdata-finance/spx500-5m-ohlcv-index-historical-data/main/SPX500_5m.csv
- https://getdata.finance/datasets/spx500

What is advertised:
- 5-minute OHLCV sample on GitHub.
- Full commercial archive advertised from 2009 onward.
- Global/extended sessions, not US regular session only.
- `volume` is described as tick volume / price updates, not exchange-traded SPX volume.
- GitHub sample is much shorter than the full archive.

Use:
- download the free sample;
- inspect session hours and price scale;
- compare overlapping US regular-session prices against LSE/Yahoo/reference values;
- do not treat sample's tick volume as actual SPX volume;
- full archive is not assumed free.

### Trial 3 — Yahoo Finance / yfinance (`^GSPC`) — free short-history comparison

Links:
- https://finance.yahoo.com/quote/%5EGSPC/
- https://github.com/ranaroussi/yfinance

Use:
- quick prototype;
- recent intraday comparison;
- independent price sanity check.

Limitations:
- five-minute intraday history is rolling/limited (commonly up to about 60 days; verify current behaviour);
- no contractual real-time feed;
- unofficial yfinance wrapper, subject to Yahoo access/terms;
- volume for an index should not be treated as traded index volume.

Not suitable as the only multi-year training source.

### Trial 4 — FirstRate Data — strong direct-SPX historical fallback, paid

Link:
- https://firstratedata.com/i/index/SPX

Advertises:
- SPX dataset;
- 1-minute, 5-minute, 30-minute, hourly and daily bars;
- history beginning 2008-01-02;
- daily updates;
- sample download;
- full dataset/bundle is paid; one month of updates is included, thereafter an annual update subscription is listed.

This is the strongest direct-SPX historical reference candidate found, but it does not satisfy a strict free-only requirement beyond the sample. Keep as a contingency if budget rules change.

### Trial 5 — FinzData — paid full intraday SPX history

Link:
- https://finzdata.com/index-data
- https://finzdata.com/pricing

Advertises:
- SPX and 122 other indices;
- 1-minute history from 2008;
- 5-minute bars derived from 1-minute history;
- free API key includes the last 12 months of daily index bars;
- full one-index history advertised at a one-time $29 price.

This is a useful low-cost fallback, but full 5-minute history is not free.

### Trial 6 — Other public/reference sources

- Cboe delayed SPX quote page: https://www.cboe.com/delayed_quotes/spx/  
  Useful for reference checking; do not assume a free historical five-minute API exists.
- S&P Dow Jones Indices: https://www.spglobal.com/spdji/  
  Use for index identity, methodology and licensing context; not assumed to be a free intraday API.
- Alpha Vantage: https://www.alphavantage.co/documentation/  
  Check current index endpoints and plan entitlements. Do not assume its free intraday equity endpoint supplies SPX cash-index bars.
- Twelve Data: https://twelvedata.com/  
  Check exact index symbol and plan entitlement; do not assume index WebSocket is free.

## Provider acceptance rule

The selected source must pass:
1. Correct instrument identity.
2. Sufficient 5-minute history for meaningful training and walk-forward evaluation.
3. Known timezone and regular-session coverage.
4. Reliable candle completion semantics.
5. Consistent OHLC fields.
6. Known volume semantics.
7. Live or latest-price access with honest freshness metadata.
8. Acceptable data licence for intended demo.

If no free provider passes all requirements, record the limitation and choose the best honest compromise. Do not fabricate data or quietly use a proxy as SPX.

## Trial log template

| Provider | Symbol | Earliest 5m | Latest 5m | Session | Live support | Free? | Identity validated? | Decision |
|---|---|---|---|---|---|---|---|---|
| LSE | SPX.IDX? | TBD | TBD | TBD | TBD | TBD | No | Pending |
| GetData sample | SPX500 | TBD | TBD | Global/extended advertised | No assumption | Sample free | No | Pending |
| Yahoo | ^GSPC | TBD | TBD | Verify | Delayed/unofficial | Yes | Compare | Pending |
| FirstRate | SPX | 2008 advertised | Current page date | Verify | Historical provider | No | Strong candidate | Paid fallback |
| FinzData | SPX | 2008 advertised | Current | US Eastern | API entitlement | Daily free only | Strong candidate | Paid fallback |

## Critical data rules

- Preserve raw downloads.
- Store normalized timestamps in UTC and retain source timezone metadata.
- Use `America/New_York` exchange sessions for session calculations.
- No random shuffling.
- Never train on labels that have not matured by the training cutoff.
- No cross-provider stitching without overlap analysis.
- No look-ahead when aligning external features.
- No direct SPX volume assumption.
