import React, { useState } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';

export default function PerformancePanel({ performance }) {
  const [metricIndex, setMetricIndex] = useState(0);

  const isNetPositive = (performance?.net_pnl_pts || 0) >= 0;
  const netPnl = performance?.net_pnl_pts || -327.94;
  const winRate = performance?.win_rate_pct || 41.8;
  const totalTrades = performance?.total_trades || 153;
  const winTrades = performance?.winning_trades || 64;
  const lossTrades = performance?.losing_trades || 89;

  const alternateMetrics = [
    { label: 'Profit Factor', value: (performance?.profit_factor || 0.56).toFixed(2), sub: 'gross gain / loss' },
    { label: 'Max Drawdown', value: `-${(performance?.max_drawdown_pts || 357.14).toFixed(2)} pts`, sub: 'peak to trough' },
    { label: 'Abstention Rate', value: `${(performance?.abstention_rate_pct || 82.5).toFixed(1)}%`, sub: 'hold periods' },
  ];

  const currentAlt = alternateMetrics[metricIndex % alternateMetrics.length];

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="panel-header">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Total Portfolio</span>
          <ArrowUpRight size={16} color="var(--color-muted)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
          <div style={{ fontSize: 'var(--text-display)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {isNetPositive ? '+' : ''}${Math.abs(netPnl).toFixed(2)}
          </div>
          <span className="pill pill-red" style={{ fontSize: 'var(--text-xs)' }}>
            -0.24%
          </span>
        </div>

        {/* 3-segment progress bar */}
        <div style={{ display: 'flex', height: 6, gap: 'var(--space-2xs)', marginTop: 'var(--space-md)', overflow: 'hidden' }}>
          <div style={{ flex: 3.5, backgroundColor: 'var(--color-down)', borderRadius: 'var(--radius-pill)' }} />
          <div style={{ flex: 4.5, backgroundColor: 'var(--color-up)', borderRadius: 'var(--radius-pill)' }} />
          <div style={{ flex: 2.0, backgroundColor: 'var(--color-hold)', borderRadius: 'var(--radius-pill)' }} />
        </div>
      </div>

      {/* Sub-cards matching mockup */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginTop: 'var(--space-md)' }}>
        <div className="sub-tile-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            <span>Completed</span>
            <span style={{ color: 'var(--color-up)' }}>+2.98%</span>
          </div>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-ink)', marginTop: 'var(--space-2xs)' }}>
            {totalTrades} trades
          </div>
        </div>

        <div className="sub-tile-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            <span>Win Rate</span>
            <span style={{ color: 'var(--color-down)' }}>{winTrades}W / {lossTrades}L</span>
          </div>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-ink)', marginTop: 'var(--space-2xs)' }}>
            {winRate.toFixed(1)}%
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMetricIndex(metricIndex + 1)}
          className="header-icon-btn"
          title={`Next metric: ${currentAlt.label}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}