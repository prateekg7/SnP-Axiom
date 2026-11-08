import React from 'react';
import ThemeToggle from './ThemeToggle';

export default function MarketHeader({ market, theme, onToggleTheme }) {
  const latestPrice = market?.latest_price ?? 7376.86;
  const openPrice = market?.open ?? 7376.50;
  const highPrice = market?.high ?? 7376.95;
  const lowPrice = market?.low ?? 7376.50;
  const change = market?.change ?? 2.01;
  const pctChange = market?.pct_change ?? 0.03;
  const isPositive = change >= 0;

  const bidPrice = (latestPrice - 1.50).toFixed(2);
  const askPrice = (latestPrice + 1.50).toFixed(2);

  return (
    <header className="market-top-bar">
      <div className="header-left">
        <div className="symbol-cluster">
          <span className="symbol-title">S&amp;P 500 Index</span>
          <span className="badge-pill">5m</span>
          <span className="badge-pill symbol-pill">SPX</span>
        </div>

        {/* Bid / Ask Quote Block */}
        <div className="quote-box">
          <div className="quote-badge quote-sell">
            <span className="quote-action">SELL</span>
            <span className="quote-price">{bidPrice}</span>
          </div>
          <span className="quote-spread">3.00</span>
          <div className="quote-badge quote-buy">
            <span className="quote-action">BUY</span>
            <span className="quote-price">{askPrice}</span>
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
          <span>{market?.source || 'LSE Live Feed'}</span>
        </div>

        <div className="session-status-pill">
          <span>{market?.freshness === 'live' ? 'cash session' : 'market closed'}</span>
        </div>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
