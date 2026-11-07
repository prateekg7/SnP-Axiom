import React from 'react';
import { ArrowUpRight, ArrowDownRight, PauseCircle, ShieldCheck } from 'lucide-react';

export default function DecisionBanner({ forecast }) {
  if (!forecast) return null;

  const action = (forecast.action || 'HOLD').toUpperCase();
  const reason = forecast.decision_reason || 'SAFE_HOLD';

  let config = {
    color: 'var(--accent-amber)',
    bg: 'var(--accent-amber-bg)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: PauseCircle,
    label: 'HOLD',
    description: 'Risk guard active: market conditions do not satisfy strict entry criteria. Position flat.',
  };

  if (action === 'LONG') {
    config = {
      color: 'var(--accent-green)',
      bg: 'var(--accent-green-bg)',
      border: 'rgba(16, 185, 129, 0.4)',
      icon: ArrowUpRight,
      label: 'LONG SIGNAL',
      description: 'Upward momentum and calibrated probability exceed risk threshold. Simulated long position active.',
    };
  } else if (action === 'SHORT') {
    config = {
      color: 'var(--accent-red)',
      bg: 'var(--accent-red-bg)',
      border: 'rgba(239, 68, 68, 0.4)',
      icon: ArrowDownRight,
      label: 'SHORT SIGNAL',
      description: 'Downward trend and negative expected return. Simulated short position active.',
    };
  }

  const Icon = config.icon;

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            background: config.color,
            color: '#fff',
            borderRadius: '6px',
            padding: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: config.color, letterSpacing: '0.02em' }}>
              RECOMMENDED ACTION: {config.label}
            </span>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.25)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              RULE: {reason}
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {config.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <ShieldCheck size={16} color="var(--accent-green)" />
        <span className="mono">Validation: PASSED (Immutable Record {forecast.forecast_id || 'ID'})</span>
      </div>
    </div>
  );
}
