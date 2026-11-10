# Test 1: SPX Coupled Bracket Strategy evaluation

This report evaluates Test 1 using the SPX Coupled AI and Bracket Strategy (`spx_coupled_bracket_strategy.pine`), comparing its multi-year TradingView backtest with a live demonstration session conducted on the S&P 500 cash index (SPX).

## Strategy overview and model structure

The strategy targets the S&P 500 cash index (SPX) on 5-minute bars during regular trading hours (09:30 to 16:00 ET). It pairs an AI-derived directional drift model with an analytical barrier touch model and technical oscillator bounds.

```
                          5-Minute SPX Market Data
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
   AI Directional Drift                               Technical Boundary
   - Log returns (1, 3, 6, 24)                        - RSI(14) ceiling / floor
   - Intrabar price drift                             - Bollinger %B (20, 2.0)
   - EMA 21 distance                                  - EMA 9 / 21 / 50 alignment
   - Normalized MACD histogram                                 │
           │                                                   │
           ▼                                                   │
   Barrier Touch Model                                         │
   - Black-Scholes first passage                               │
   - P(touch >= +3.0 pts | 30m window)                         │
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     ▼
                          Entry Rule Verification
                    Long: drift > threshold AND touch >= 0.90
                          AND RSI < 58 AND %B < 0.85
                    Short: drift < -threshold
                          AND RSI > 42 AND %B > 0.15
                                     │
                                     ▼
                        Asymmetric Bracket Execution
                        - Take-Profit: +3.0 index pts
                        - Stop-Loss:   -1.5 index pts
                        - Time Exit:   6 bars (30 min)
                        - Flatten:     15:55 ET close
```

Positions enter on the bar close when all criteria agree. Bracket orders govern exit logic:

1. Target barrier: Fixed +3.0 points take-profit limit.
2. Stop barrier: Fixed -1.5 points stop-loss stop.
3. Time exit: If neither target fills within 6 bars (30 minutes), the position closes at market.
4. Session exit: All positions flatten at or after 15:55 ET to eliminate overnight gap exposure.

## Features and quantitative techniques

The model evaluates seven core inputs on each 5-minute candle:

| Feature | Calculation | Purpose |
| :--- | :--- | :--- |
| `log_ret_1` | `ln(close / close[1])` | Immediate 5-minute momentum |
| `log_ret_3` | `ln(close / close[3])` | Short-term 15-minute trend direction |
| `log_ret_24` | `ln(close / close[24])` | Half-day baseline trend slope |
| `ema_dist_norm` | `(close - EMA21) / close` | Mean deviation from the short-term equilibrium |
| `macd_diff_norm` | `MACD_hist / close` | Normalized momentum divergence |
| `realized_vol_30m` | `stdev(log_ret_1, 6) * sqrt(6)` | Rolling 30-minute realized volatility |
| `cal_p_touch` | Black-Scholes analytical first passage | Probability of touching the +3.0 pt barrier within 30 minutes |

### Analytical touch probability

The barrier probability calculation models the index path as geometric Brownian motion with drift parameter `r_1_drift` and volatility `realized_vol_30m`. It computes first-passage probability to barrier `H = price + 3.0` using the standard closed-form reflection principle:

$$P(\tau \le T) = \Phi(d_1) + \left(\frac{H}{S_0}\right)^{2\mu' / \sigma^2} \Phi(d_2)$$

where:
- $\mu' = \mu - \frac{1}{2}\sigma^2$
- $d_1 = \frac{-\ln(H / S_0) + \mu' T}{\sigma \sqrt{T}}$
- $d_2 = \frac{-\ln(H / S_0) - \mu' T}{\sigma \sqrt{T}}$

Long entries require $P(\tau \le T) \ge 0.90$.

### Mean-reversion envelope guards

To avoid buying tops or shorting bottoms during choppy consolidation, the strategy applies two technical guards:
- Long entries require RSI(14) below 58.0 and Bollinger %B below 0.85.
- Short entries require RSI(14) above 42.0 and Bollinger %B above 0.15.

## TradingView backtest performance

The strategy ran across 5-minute SPX cash index bars from January 3, 2023 to November 9, 2026 on TradingView.

![TradingView Strategy Tester](backtest.png)

### Summary metrics

| Metric | TradingView Backtest Value |
| :--- | :--- |
| Test span | January 3, 2023 to November 9, 2026 (almost 4 years) |
| Starting capital | $100,000.00 |
| Net P&L | -$261.68 (-0.26%) |
| Gross profit | $7,529.32 (+7.53%) |
| Gross loss | $7,786.93 (-7.79%) |
| Profit factor | 0.967 |
| Total closed trades | 1,083 |
| Profitable trades (win rate) | 50.14% (543 wins / 540 losses) |
| Max drawdown | $692.34 (0.69%) |
| Expectancy | -0.24 pts per trade |
| Outliers P&L | -439.23 pts |
| Buy and hold index return | +$91,176.50 |

The 50.14% win rate sits above the 33.3% theoretical break-even rate required by a 2:1 profit-to-loss bracket. Net P&L finished slightly negative (-$261.68) because 6-bar time exits frequently closed positions at fractional losses before the take-profit target was reached, along with commission friction ($0.15 per order across 2,166 order events).

## Live demonstration session and confusion matrix

The live demonstration ran against streaming 5-minute SPX candles on November 9, 2026, evaluating model predictions and simulated paper trades in real time.

![Live Dashboard Demonstration](live_test_dashboard.png)

### Directional accuracy matrix

The confusion matrix tracks 5-minute directional predictions against actual candle closes across 39 evaluated bars:

| Actual \ Predicted | Predicted UP | Predicted DOWN | Total |
| :--- | :--- | :--- | :--- |
| **Actual UP** | 16 (True UP) | 3 (False DOWN) | 19 |
| **Actual DOWN** | 20 (False UP) | 0 (True DOWN) | 20 |
| **Total** | 36 | 3 | 39 |

#### Derived performance rates

- Directional accuracy: 41.0% (16 / 39)
- Precision (UP): 44.4% (16 / 36)
- Recall (UP): 84.2% (16 / 19)
- F1 score: 0.582
- Predicted DOWN frequency: 7.7% (3 / 39)

### Live paper trading performance

The execution engine simulated 8 bracket orders during the session:

| Metric | Live Session Value |
| :--- | :--- |
| Realized net P&L | -12.84 pts |
| Floating P&L | 0.00 pts (flat at session close) |
| Closed bracket trades | 8 |
| Profitable trades (win rate) | 25.0% (2 wins / 6 losses) |
| Profit factor | 0.63 |
| Max session drawdown | -15.74 pts |
| Prevailing market regime | Mean-reverting (30m realized volatility: 9.0 bps) |
| 95% Value at Risk (10,000 paths) | -14.02 pts (-0.19%) |
| Conformal coverage calibration | 87.0% (against 90% nominal target) |

## Performance analysis: backtest vs live session

Comparing the backtest and live results reveals three operational characteristics:

### 1. Regime sensitivity

The 4-year backtest covered broad trending periods, multi-week rallies, and volatility expansions. In those conditions, directional momentum persisted long enough for 50.14% of trades to reach the +3.0 point profit target.

The live demonstration took place in a quiet afternoon session with realized volatility of only 9.0 basis points. SPX fluctuated within a tight range near 7,550. Under mean-reverting chop, directional drift signals decayed quickly, resulting in 6 stop-outs and a 25.0% session win rate.

### 2. Upward drift bias

In the live session, 36 out of 39 forecasts predicted UP. While this produced a strong recall of 84.2% on actual up bars, it created 20 false positives when candles closed red. The linear drift calculation placed high weight on positive medium-term moving average slopes, underestimating short-term range reversals.

### 3. Time-based exits in low volatility

The 6-bar (30-minute) maximum holding duration protects capital during trending reversals. However, in low-volatility regimes, price movement is often too small to touch either the +3.0 pt or -1.5 pt barrier within 30 minutes. Positions were closed prematurely near the stop level rather than reaching targets.

## Conclusions for Test 2

1. Add volatility regime gating: Disable trend-following entries when 30-minute realized volatility drops below 12 basis points.
2. Incorporate explicit range-fading logic: When the regime classifier indicates chop, invert entry rules to sell near upper Bollinger bands and buy near lower bands.
3. Test dynamic bracket sizing: Scale take-profit and stop-loss barriers with ATR rather than fixed index points, allowing targets to contract during low-volatility sessions.
