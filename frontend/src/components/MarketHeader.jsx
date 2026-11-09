import React from 'react';
import ThemeToggle from './ThemeToggle';

export default function MarketHeader({ theme, onToggleTheme }) {
  return (
    <header className="market-top-bar">
      <div className="header-left">
        <div className="symbol-cluster">
          <span className="symbol-title">S&amp;P 500 Index</span>
        </div>
      </div>

      <div className="header-right">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
