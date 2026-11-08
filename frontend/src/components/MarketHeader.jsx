import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function MarketHeader({ market, theme, onToggleTheme }) {
  const latestPrice = market?.latest_price ?? 7376.86;
  const openPrice = market?.open ?? 7376.50;
  const highPrice = market?.high ?? 7376.95;
  const lowPrice = market?.low ?? 7376.50;
  const change = market?.change ?? 2.01;
  const pctChange = market?.pct_change ?? 0.03;
  const isPositive = change >= 0;

  // TradingView simulator quote box (asymmetric 3 pt spread)
  const bidPrice = (latestPrice - 1.50).toFixed(2);
  const askPrice = (latestPrice + 1.50).toFixed(2);

  return (
    <header className="market-top-bar">
      <div className="header-left">
        <div className="symbol-cluster">
          <div className="index-circle-badge" aria-hidden="true">
            <span>500</span>
          </div>
          <span className="symbol-title">S&amp;P 500 Index</span>
          <span className="badge-pill">5m</span>
          <span className="badge-pill symbol-pill">SPX</span>
        </div>

        {/* Bid / Ask Quote Block matching TradingView top bar */}
        <div className="quote-box">
          <div className="quote-badge quote-sell">
            <span className="quote-price">{bidPrice}</span>
            <span className="quote-action">SELL</span>
          </div>
          <span className="quote-spread">3.00</span>
          <div className="quote-badge quote-buy">
            <span className="quote-price">{askPrice}</span>
            <span className="quote-action">BUY</span>
          </div>
        </div>

        {/* OHLC Bar */}
        <div className="ohlc-strip">
          <span className="ohlc-item">
            <span className="ohlc-key">O</span>
            <span className="ohlc-val">{openPrice.toFixed(2)}</span>
          </span>
          <span className="ohlc-item">
            <span className="ohlc-key">H</span>
            <span className="ohlc-val">{highPrice.toFixed(2)}</span>
          </span>
          <span className="ohlc-item">
            <span className="ohlc-key">L</span>
            <span className="ohlc-val">{lowPrice.toFixed(2)}</span>
          </span>
          <span className="ohlc-item">
            <span className="ohlc-key">C</span>
            <span className={`ohlc-val ${isPositive ? 'val-up' : 'val-down'}`}>
              {latestPrice.toFixed(2)}
            </span>
          </span>
          <span className={`ohlc-change ${isPositive ? 'val-up' : 'val-down'}`}>
            {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{pctChange.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="header-right">
        <div className="feed-status-pill">
          <Activity size={13} className="feed-icon" />
          <span>{market?.source || 'LSE Live Feed'}</span>
        </div>

        <div className="session-status-pill">
          <ShieldCheck size={13} className="session-icon" />
          <span>{market?.freshness === 'live' ? 'cash session' : 'market closed'}</span>
        </div>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
