import React from 'react';
import { Clock, TrendingUp, TrendingDown, Activity, Info } from 'lucide-react';

export default function MarketHeader({ market, isConnected }) {
  if (!market) {
    return (
      <header className="card" style={{ padding: 'var(--space-md) var(--space-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Activity className="spin-icon" size={20} color="var(--color-blue)" />
          <span>Connecting to SPX market data stream…</span>
        </div>
      </header>
    );
  }

  const isPositive = (market.change || 0) >= 0;
  const priceColor = isPositive ? 'var(--color-up)' : 'var(--color-down)';

  return (
    <header className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-2xs)' }}>
            <h1 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>
              S&P 500 Index
            </h1>
            <span className="pill pill-blue">SPX</span>
            <span className={`pill ${market.is_regular_session ? 'pill-green' : 'pill-amber'}`}>
              <Clock size={12} />
              <span>{market.is_regular_session ? 'regular session' : 'closed / after hours'}</span>
            </span>
            <span className="pill" style={{ background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-rule)', color: 'var(--color-ink-2)' }}>
              {market.freshness === 'delayed_15m' ? '15m delayed' : 'canonical series'}
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', margin: 0 }}>
            Underlying: cash index <span className="hairline">/</span> quote: {market.provider_symbol || '^GSPC'} <span className="hairline">/</span> provider: {market.source}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-display)', fontWeight: 500, lineHeight: 1.1, color: priceColor }}>
              {market.latest_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: priceColor, marginTop: 'var(--space-3xs)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2xs)' }}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{isPositive ? '+' : ''}{market.change?.toFixed(2)} ({isPositive ? '+' : ''}{market.pct_change?.toFixed(2)}%)</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-md)', borderLeft: 'var(--rule-hair) solid var(--color-rule)', paddingLeft: 'var(--space-md)' }}>
            <div style={{ fontSize: 'var(--text-xs)' }}>
              <div style={{ color: 'var(--color-muted)' }}>session open</div>
              <div style={{ fontWeight: 500 }}>{market.open?.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)' }}>
              <div style={{ color: 'var(--color-muted)' }}>day high</div>
              <div style={{ fontWeight: 500, color: 'var(--color-up)' }}>{market.high?.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 'var(--text-xs)' }}>
              <div style={{ color: 'var(--color-muted)' }}>day low</div>
              <div style={{ fontWeight: 500, color: 'var(--color-down)' }}>{market.low?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: 'var(--rule-hair) solid var(--color-rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-xs)', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' }}>
          <Info size={14} color="var(--color-hold)" />
          <span>S&P 500 cash index levels are non-tradable indicators. All signals and executions are paper-trading simulations.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span>timestamp (NY): {market.timestamp_ny || 'N/A'}</span>
          <span style={{ color: isConnected ? 'var(--color-up)' : 'var(--color-hold)' }}>
            [{isConnected ? 'live stream' : 'polling'}]
          </span>
        </div>
      </div>
    </header>
  );
}