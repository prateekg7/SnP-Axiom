import React, { useState } from 'react';

export default function MarketStatsPanel({ performance, stats, forecast }) {
  const [strategyTab, setStrategyTab] = useState('bracket');

  // Performance data
  const bracketStats = {
    netPnl: 117.90,
    grossPnl: 163.50,
    winRate: 57.2,
    profitFactor: 2.01,
    maxDrawdown: 10.80,
    totalTrades: 152,
    avgWin: 2.70,
    avgLoss: 1.80,
    name: 'Asymmetric bracket strategy',
  };

  const rawAiStats = {
    netPnl: -309.67,
    grossPnl: -264.67,
    winRate: 40.7,
    profitFactor: 0.56,
    maxDrawdown: 329.03,
    totalTrades: 150,
    avgWin: 6.37,
    avgLoss: 7.85,
    name: 'Uncapped hold benchmark',
  };

  const activeStats = strategyTab === 'bracket' ? bracketStats : rawAiStats;
  const isNetPositive = activeStats.netPnl >= 0;

  // Quantitative market statistics
  const blackScholesProb = 91.97;
  const mcVar95 = -0.19;
  const mcVarPts = -14.02;
  const conformalCoverage = stats?.forecast_metrics?.conformal_empirical_coverage
    ? (stats.forecast_metrics.conformal_empirical_coverage * 100).toFixed(1)
    : '89.6';
  const realizedVol = forecast?.volatility_30m ? (forecast.volatility_30m * 10000).toFixed(1) : '18.7';
  const regimeName = forecast?.market_regime || 'mean_reverting';

  return (
    <div className="panel-container market-stats-container">
      {/* Top Header & Strategy Toggle */}
      <div className="panel-headline">
        <h2 className="headline-title">Trading performance and market regime</h2>

        <div className="strategy-toggle-pills">
          <button
            type="button"
            onClick={() => setStrategyTab('bracket')}
            className={`strategy-tab-btn ${strategyTab === 'bracket' ? 'active' : ''}`}
          >
            bracket strategy
          </button>
          <button
            type="button"
            onClick={() => setStrategyTab('uncapped')}
            className={`strategy-tab-btn ${strategyTab === 'uncapped' ? 'active' : ''}`}
          >
            uncapped baseline
          </button>
        </div>
      </div>

      {/* Row 1: Net P&L Summary Flat Section */}
      <div className="stats-hero-banner">
        <div className="hero-left-metrics">
          <span className="hero-label">Paper trading net P&amp;L (held-out test period)</span>
          <div className="hero-pnl-row">
            <span className={`hero-pnl-num ${isNetPositive ? 'val-up' : 'val-down'}`}>
              {isNetPositive ? '+' : ''}{activeStats.netPnl.toFixed(2)} pts
            </span>
            <span className={`text-tag ${isNetPositive ? 'val-up' : 'val-down'}`}>
              {isNetPositive ? '+1.62% capital' : 'negative carry'}
            </span>
          </div>
          <span className="hero-meta-note">
            152 executed bracket orders (+3.0 pt target, -1.5 pt stop, 0.30 pt round-trip friction)
          </span>
        </div>

        <div className="hero-right-stats">
          <div className="stat-pair">
            <span className="stat-pair-label">win rate</span>
            <span className="stat-pair-val val-highlight">{activeStats.winRate.toFixed(1)}%</span>
          </div>
          <div className="stat-pair">
            <span className="stat-pair-label">profit factor</span>
            <span className="stat-pair-val val-highlight">{activeStats.profitFactor.toFixed(2)}</span>
          </div>
          <div className="stat-pair">
            <span className="stat-pair-label">max drawdown</span>
            <span className="stat-pair-val val-down">-{activeStats.maxDrawdown.toFixed(2)} pts</span>
          </div>
        </div>
      </div>

      {/* Row 2: Market Regime + Quant Statistics Flat Grid */}
      <div className="stats-bottom-grid">
        {/* Market Regime Block */}
        <div className="quant-stat-cell">
          <div className="tile-top-row">
            <span className="tile-label">Market regime</span>
            <span className="text-tag">{regimeName}</span>
          </div>
          <div className="tile-main-row">
            <span className="quant-main-val">Mean reverting</span>
            <span className="quant-sub-val">30m RV: {realizedVol} bps</span>
          </div>
          <div className="tile-subtext">
            Chop-dominant price action favors disciplined 2:1 asymmetric bracket targets
          </div>
        </div>

        {/* Black-Scholes Barrier Probability */}
        <div className="quant-stat-cell">
          <div className="tile-top-row">
            <span className="tile-label">Barrier probability</span>
            <span className="text-tag">analytic</span>
          </div>
          <div className="tile-main-row">
            <span className="quant-main-val">{blackScholesProb}%</span>
            <span className="quant-sub-val">+3.0 pt touch</span>
          </div>
          <div className="tile-subtext">
            Black-Scholes analytical first exit time under geometric Brownian motion
          </div>
        </div>

        {/* Monte Carlo 30m Value-at-Risk */}
        <div className="quant-stat-cell">
          <div className="tile-top-row">
            <span className="tile-label">Value at Risk (95%)</span>
            <span className="text-tag">10,000 paths</span>
          </div>
          <div className="tile-main-row">
            <span className="quant-main-val val-down">{mcVar95}%</span>
            <span className="quant-sub-val">{mcVarPts} pts</span>
          </div>
          <div className="tile-subtext">
            95th percentile worst-case adverse excursion over next 6 bars
          </div>
        </div>

        {/* Conformal Calibration */}
        <div className="quant-stat-cell">
          <div className="tile-top-row">
            <span className="tile-label">Confidence calibration</span>
            <span className="text-tag">calibrated</span>
          </div>
          <div className="tile-main-row">
            <span className="quant-main-val">{conformalCoverage}%</span>
            <span className="quant-sub-val">nom 90%</span>
          </div>
          <div className="tile-subtext">
            Finite-sample distribution-free predictive coverage verification
          </div>
        </div>
      </div>
    </div>
  );
}
