import React from 'react';
import { ChevronDown, ArrowDownLeft, ArrowRightLeft, ShieldCheck } from 'lucide-react';

export default function DecisionBanner({ forecast, onOpenLedger }) {
  const action = (forecast?.action || 'HOLD').toUpperCase();
  const reason = forecast?.decision_reason || 'JEV_UNCONFIGURED_SAFE_HOLD';

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="panel-header">
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Total Value</span>
          <button type="button" className="pill-btn" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3xs)' }}>
            <span>USD</span>
            <ChevronDown size={13} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
          <div style={{ fontSize: 'var(--text-display)', fontWeight: 600, color: 'var(--color-ink)' }}>
            {action === 'LONG' ? 'LONG' : action === 'SHORT' ? 'SHORT' : 'HOLD'}
          </div>
          <span className="pill pill-amber" style={{ fontSize: 'var(--text-xs)' }}>
            safe hold
          </span>
        </div>

        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: 'var(--space-2xs)' }}>
          rule: {reason}
        </div>
      </div>

      {/* Signal Rows matching mockup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)', marginTop: 'var(--space-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--color-muted)' }}>Risk Guard</span>
          <span style={{ color: 'var(--color-ink)' }}>Strict Entry Flat</span>
          <span className="pill pill-amber" style={{ fontSize: 'var(--text-xs)' }}>Active</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--color-muted)' }}>Validation</span>
          <span style={{ color: 'var(--color-ink)' }}>{forecast?.forecast_id || 'Canonical'}</span>
          <span className="pill pill-green" style={{ fontSize: 'var(--text-xs)' }}>Passed</span>
        </div>
      </div>

      {/* Action Buttons matching mockup */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <button
          type="button"
          className="pill-btn"
          style={{
            flex: 1,
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-xs)',
            padding: 'var(--space-sm)',
            fontWeight: 600,
          }}
        >
          <ArrowDownLeft size={16} />
          <span>Risk Guard</span>
        </button>

        <button
          type="button"
          onClick={onOpenLedger}
          className="pill-btn"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-xs)',
            padding: 'var(--space-sm)',
          }}
        >
          <ArrowRightLeft size={16} />
          <span>Trades</span>
        </button>
      </div>
    </div>
  );
}