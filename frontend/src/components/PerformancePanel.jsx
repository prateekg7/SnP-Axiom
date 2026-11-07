import React from 'react';
import { Award, DollarSign, TrendingDown, Percent, BarChart3, AlertCircle } from 'lucide-react';

export default function PerformancePanel({ performance }) {
  if (!performance) {
    return (
      <div className="card">
        <div className="card-title">Strategy Performance</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading paper trading ledger...</div>
      </div>
    );
  }

  const isNetPositive = (performance.net_pnl_pts || 0) >= 0;
  const pnlColor = isNetPositive ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={16} color="var(--accent-amber)" />
          <span>Paper Trading Performance</span>
        </div>
        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {performance.total_trades} Simulated Trades
        </span>
      </div>

      {/* Main Net P&L Card */}
      <div className="metric-tile" style={{ background: isNetPositive ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)', borderColor: isNetPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label" style={{ color: 'var(--text-secondary)' }}>Net Cumulative P&L</span>
          <span className="pill mono" style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.25)', color: 'var(--text-secondary)' }}>
            After Costs & Slippage
          </span>
        </div>
        <div className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: pnlColor, marginTop: '0.25rem' }}>
          {isNetPositive ? '+' : ''}{performance.net_pnl_pts?.toFixed(2)} pts
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Gross P&L: {performance.gross_pnl_pts >= 0 ? '+' : ''}{performance.gross_pnl_pts?.toFixed(2)} pts</span>
          <span>Point Multiplier: 1.0 ($1/pt)</span>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        <div className="metric-tile">
          <span className="metric-label">Win Rate</span>
          <div className="metric-value mono" style={{ color: performance.win_rate_pct >= 50 ? 'var(--accent-green)' : 'var(--text-primary)' }}>
            {performance.win_rate_pct?.toFixed(1)}%
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {performance.winning_trades} wins / {performance.losing_trades} losses
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Profit Factor</span>
          <div className="metric-value mono">
            {performance.profit_factor?.toFixed(2)}
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Gross gains / losses
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Max Drawdown</span>
          <div className="metric-value mono" style={{ color: 'var(--accent-red)' }}>
            -{performance.max_drawdown_pts?.toFixed(2)} pts
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Peak-to-trough
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Abstention Rate</span>
          <div className="metric-value mono">
            {performance.abstention_rate_pct?.toFixed(1)}%
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Hold periods
          </span>
        </div>
      </div>

      {/* Avg Win/Loss */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.75rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Average Win: <strong className="mono" style={{ color: 'var(--accent-green)' }}>+{performance.avg_win_pts?.toFixed(2)} pts</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>Average Loss: <strong className="mono" style={{ color: 'var(--accent-red)' }}>{performance.avg_loss_pts?.toFixed(2)} pts</strong></span>
      </div>

      {/* Synthetic Note */}
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          SPX is a non-tradable cash index. P&L represents a synthetic forward ledger with 0.10 pt slippage + 0.05 pt cost per round trip.
        </span>
      </div>
    </div>
  );
}
