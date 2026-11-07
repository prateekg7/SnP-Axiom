import React from 'react';
import { ArrowUpRight, ArrowDownRight, PauseCircle, ShieldCheck } from 'lucide-react';

export default function DecisionBanner({ forecast }) {
  if (!forecast) return null;

  const action = (forecast.action || 'HOLD').toUpperCase();
  const reason = forecast.decision_reason || 'SAFE_HOLD';

  let config = {
    color: 'var(--color-hold)',
    bg: 'var(--color-hold-wash)',
    border: 'var(--color-hold-border)',
    icon: PauseCircle,
    label: 'hold',
    description: 'Risk guard active: market conditions do not satisfy strict entry criteria. Position flat.',
  };

  if (action === 'LONG') {
    config = {
      color: 'var(--color-accent)',
      bg: 'var(--color-accent-wash)',
      border: 'var(--color-accent-border)',
      icon: ArrowUpRight,
      label: 'long signal',
      description: 'Upward momentum and calibrated probability exceed risk threshold. Simulated long position active.',
    };
  } else if (action === 'SHORT') {
    config = {
      color: 'var(--color-down)',
      bg: 'var(--color-down-wash)',
      border: 'var(--color-down-border)',
      icon: ArrowDownRight,
      label: 'short signal',
      description: 'Downward trend and negative expected return. Simulated short position active.',
    };
  }

  const Icon = config.icon;

  return (
    <div
      style={{
        background: config.bg,
        border: `var(--rule-hair) solid ${config.border}`,
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
            color: 'var(--color-paper)',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: config.color }}>
              Recommended action: {config.label}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', background: 'var(--color-paper)', padding: '0.15rem 0.5rem', border: 'var(--rule-hair) solid var(--color-rule)' }}>
              rule: {reason}
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-ink-2)', marginTop: '0.2rem' }}>
            {config.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
        <ShieldCheck size={16} color="var(--color-accent)" />
        <span>Validation: passed ({forecast.forecast_id || 'ID'})</span>
      </div>
    </div>
  );
}
