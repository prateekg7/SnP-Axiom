import React from 'react';
import { Award, AlertCircle } from 'lucide-react';

export default function PerformancePanel({ performance }) {
  if (!performance) {
    return (
      <div className="card">
        <div className="card-title">Strategy performance</div>
        <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Loading paper trading ledger…</div>
      </div>
    );
  }

  const isNetPositive = (performance.net_pnl_pts || 0) >= 0;
  const pnlColor = isNetPositive ? 'var(--color-accent)' : 'var(--color-down)';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={16} color="var(--color-hold)" />
          <span>Paper trading performance</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {performance.total_trades} simulated trades
        </span>
      </div>

      {/* Main Net P&L Card */}
      <div className="metric-tile" style={{ background: isNetPositive ? 'var(--color-accent-wash)' : 'var(--color-down-wash)', border: `var(--rule-hair) solid ${isNetPositive ? 'var(--color-accent-border)' : 'var(--color-down-border)'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label" style={{ color: 'var(--color-ink-2)' }}>Net cumulative P&L</span>
          <span className="pill" style={{ fontSize: '0.7rem', background: 'var(--color-paper)', color: 'var(--color-muted)', border: 'var(--rule-hair) solid var(--color-rule)' }}>
            after costs and slippage
          </span>
        </div>
        <div style={{ fontSize: '1.85rem', fontWeight: 600, color: pnlColor, marginTop: '0.25rem' }}>
          {isNetPositive ? '+' : ''}{performance.net_pnl_pts?.toFixed(2)} pts
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          <span>gross: {performance.gross_pnl_pts >= 0 ? '+' : ''}{performance.gross_pnl_pts?.toFixed(2)} pts</span>
          <span>multiplier: 1.0 ($1/pt)</span>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
        <div className="metric-tile">
          <span className="metric-label">Win rate</span>
          <div className="metric-value" style={{ color: performance.win_rate_pct >= 50 ? 'var(--color-accent)' : 'var(--color-ink)' }}>
            {performance.win_rate_pct?.toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
            {performance.winning_trades} wins / {performance.losing_trades} losses
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Profit factor</span>
          <div className="metric-value">
            {performance.profit_factor?.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
            gross gains / losses
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Max drawdown</span>
          <div className="metric-value" style={{ color: 'var(--color-down)' }}>
            -{performance.max_drawdown_pts?.toFixed(2)} pts
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
            peak-to-trough
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Abstention rate</span>
          <div className="metric-value">
            {performance.abstention_rate_pct?.toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
            hold periods
          </span>
        </div>
      </div>

      {/* Avg Win/Loss */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-rule)', fontSize: '0.75rem' }}>
        <span style={{ color: 'var(--color-muted)' }}>average win: <strong style={{ color: 'var(--color-accent)', fontWeight: 500 }}>+{performance.avg_win_pts?.toFixed(2)} pts</strong></span>
        <span style={{ color: 'var(--color-muted)' }}>average loss: <strong style={{ color: 'var(--color-down)', fontWeight: 500 }}>{performance.avg_loss_pts?.toFixed(2)} pts</strong></span>
      </div>

      {/* Synthetic Note */}
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          SPX is a non-tradable cash index. P&L represents a synthetic forward ledger with 0.10 pt slippage + 0.05 pt cost per round trip.
        </span>
      </div>
    </div>
  );
}
