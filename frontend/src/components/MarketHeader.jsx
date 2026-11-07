import React from 'react';
import { Clock, TrendingUp, TrendingDown, Activity, Info } from 'lucide-react';

export default function MarketHeader({ market, isConnected }) {
  if (!market) {
    return (
      <header className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity className="spin-icon" size={20} color="var(--color-blue)" />
          <span>Connecting to SPX market data stream…</span>
        </div>
      </header>
    );
  }

  const isPositive = (market.change || 0) >= 0;
  const priceColor = isPositive ? 'var(--color-accent)' : 'var(--color-down)';

  return (
    <header className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>
              S&P 500 Index
            </h1>
            <span className="pill pill-blue" style={{ fontSize: '0.8rem' }}>SPX</span>
            <span className={`pill ${market.is_regular_session ? 'pill-green' : 'pill-amber'}`}>
              <Clock size={12} />
              <span>{market.is_regular_session ? 'regular session' : 'closed / after hours'}</span>
            </span>
            <span className="pill" style={{ background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-rule)', color: 'var(--color-ink-2)' }}>
              {market.freshness === 'delayed_15m' ? '15m delayed' : 'canonical series'}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted)', margin: 0 }}>
            Underlying: cash index <span className="hairline">/</span> quote: {market.provider_symbol || '^GSPC'} <span className="hairline">/</span> provider: {market.source}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 500, lineHeight: 1.1, color: priceColor }}>
              {market.latest_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: priceColor, marginTop: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
              {isPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              <span>{isPositive ? '+' : ''}{market.change?.toFixed(2)} ({isPositive ? '+' : ''}{market.pct_change?.toFixed(2)}%)</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderLeft: 'var(--rule-hair) solid var(--color-rule)', paddingLeft: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--color-muted)' }}>session open</div>
              <div style={{ fontWeight: 500 }}>{market.open?.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--color-muted)' }}>day high</div>
              <div style={{ fontWeight: 500, color: 'var(--color-accent)' }}>{market.high?.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--color-muted)' }}>day low</div>
              <div style={{ fontWeight: 500, color: 'var(--color-down)' }}>{market.low?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: 'var(--rule-hair) solid var(--color-rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={14} color="var(--color-hold)" />
          <span>S&P 500 cash index levels are non-tradable indicators. All signals and executions are paper-trading simulations.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>timestamp (NY): {market.timestamp_ny || 'N/A'}</span>
          <span style={{ color: isConnected ? 'var(--color-accent)' : 'var(--color-hold)' }}>
            [{isConnected ? 'live stream' : 'polling'}]
          </span>
        </div>
      </div>
    </header>
  );
}
