import React from 'react';
import { ShieldAlert, Clock, TrendingUp, TrendingDown, Activity, Info } from 'lucide-react';

export default function MarketHeader({ market, isConnected, lastUpdated }) {
  if (!market) {
    return (
      <header className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity className="animate-spin" size={20} color="var(--accent-blue)" />
          <span>Connecting to SPX market data stream...</span>
        </div>
      </header>
    );
  }

  const isPositive = (market.change || 0) >= 0;
  const priceColor = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <header className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              S&P 500 Index
            </h1>
            <span className="pill pill-blue mono" style={{ fontSize: '0.8rem' }}>SPX</span>
            <span className={`pill ${market.is_regular_session ? 'pill-green' : 'pill-amber'}`}>
              <Clock size={12} />
              {market.is_regular_session ? 'REGULAR SESSION' : 'CLOSED / AFTER HOURS'}
            </span>
            <span className="pill mono" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
              {market.freshness === 'delayed_15m' ? '15M DELAYED' : 'HISTORICAL CANONICAL'}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Underlying: Cash Index (Quote Symbol: {market.provider_symbol || '^GSPC'}) • Provider: {market.source}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.1, color: priceColor }}>
              {market.latest_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 600, color: priceColor, marginTop: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{isPositive ? '+' : ''}{market.change?.toFixed(2)} ({isPositive ? '+' : ''}{market.pct_change?.toFixed(2)}%)</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', borderLeft: '1px solid var(--border)', paddingLeft: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>Session Open</div>
              <div className="mono" style={{ fontWeight: 600 }}>{market.open?.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>Day High</div>
              <div className="mono" style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{market.high?.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--text-muted)', textTransform: 'uppercase' }}>Day Low</div>
              <div className="mono" style={{ fontWeight: 600, color: 'var(--accent-red)' }}>{market.low?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={14} color="var(--accent-amber)" />
          <span>Notice: S&P 500 cash index levels are non-tradable indicators. All signals and executions are paper-trading simulations.</span>
        </div>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Timestamp (NY): {market.timestamp_ny || 'N/A'}</span>
          <span style={{ color: isConnected ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
            ● {isConnected ? 'Live WebSocket' : 'Polling'}
          </span>
        </div>
      </div>
    </header>
  );
}
