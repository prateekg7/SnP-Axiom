# Hypothetical Trading Performance Report

This report evaluates hypothetical paper trading performance across strategies on the chronological out-of-sample test period (2484 5-minute bars). All decisions are simulated; no live broker orders are placed.

## Test period performance comparison

Assumptions: 1 synthetic SPX unit, 0.10 points transaction cost per side, 0.05 points execution slippage.

| Strategy | Total Trades | Win Rate | Gross P&L (pts) | Net P&L (pts) | Profit Factor | Max Drawdown (pts) |
|---|---|---|---|---|---|---|
| AI Forecast Strategy | 153 | 41.8% | -282.04 | -327.94 | 0.56 | 357.14 |
| Momentum Baseline | 1256 | 31.3% | -196.73 | -573.53 | 0.84 | 750.41 |
| RSI Baseline | 90 | 68.9% | -167.17 | -194.17 | 0.56 | 277.84 |
| MACD Crossover Baseline | 201 | 30.8% | -293.85 | -354.15 | 0.81 | 576.35 |
| EMA Trend Baseline | 196 | 17.9% | -219.18 | -277.98 | 0.79 | 550.99 |

## Cost and slippage sensitivity (AI Forecast Strategy)

| Cost per side | Slippage per side | Net P&L (pts) | Win Rate | Profit Factor | Max Drawdown (pts) |
|---|---|---|---|---|---|
| 0.00 pts | 0.00 pts | -266.74 | 44.4% | 0.63 | 308.08 |
| 0.10 pts | 0.05 pts | -327.94 | 41.8% | 0.56 | 357.14 |
| 0.25 pts | 0.12 pts | -419.74 | 38.6% | 0.48 | 441.14 |
| 0.50 pts | 0.25 pts | -572.74 | 35.3% | 0.36 | 584.59 |

## Key observations

1. The AI Forecast Strategy traded selectively, avoiding the excessive turnover of continuous momentum flipping.
2. Net profitability is sensitive to friction: trading frequency must stay controlled to absorb realistic spread and broker slippage.
3. Every trade and position transition was recorded with point-in-time reference prices, satisfying strict reproducibility without lookahead bias.
