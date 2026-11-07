import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function CumulativeSparkline({ performance, trades }) {
  // Build a synthetic or realized curve from trades / performance
  const dataPoints = React.useMemo(() => {
    if (trades && trades.length > 0) {
      let cumulative = 0;
      const pts = trades.slice(0, 30).map((t) => {
        cumulative += t.net_pnl || 0;
        return cumulative;
      });
      return pts.length > 5 ? pts : [-120, -180, -90, -140, -280, -327.94];
    }
    return [-120, -180, -90, -140, -280, -327.94];
  }, [trades]);

  const minVal = Math.min(...dataPoints);
  const maxVal = Math.max(...dataPoints);
  const range = maxVal - minVal || 1;

  const width = 360;
  const height = 120;
  const paddingY = 16;

  const points = dataPoints.map((val, idx) => {
    const x = (idx / (dataPoints.length - 1)) * (width - 16) + 8;
    const y = height - paddingY - ((val - minVal) / range) * (height - paddingY * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - 8},${height} L 8,${height} Z`;

  const isNetPositive = (performance?.net_pnl_pts || 0) >= 0;

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="panel-header">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Total Balance</span>
          <ArrowUpRight size={16} color="var(--color-muted)" />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
          <div style={{ fontSize: 'var(--text-display)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {isNetPositive ? '+' : ''}{performance?.net_pnl_pts ? `${performance.net_pnl_pts.toFixed(2)} pts` : '-327.94 pts'}
          </div>
          <span className="pill pill-green" style={{ fontSize: 'var(--text-xs)' }}>
            +4.24%
          </span>
        </div>
      </div>

      {/* SVG Glow Line Sparkline */}
      <div style={{ marginTop: 'var(--space-sm)', position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ width: '100%', height: '110px', overflow: 'visible' }}>
          <defs>
            <linearGradient id="balanceGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-up)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--color-up)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaD} fill="url(#balanceGlow)" />

          {/* Glowing Line */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-up)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Time Axis Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: 'var(--space-2xs)' }}>
          <span>09:30</span>
          <span>11:00</span>
          <span>12:30</span>
          <span>14:00</span>
          <span>15:55</span>
        </div>
      </div>
    </div>
  );
}