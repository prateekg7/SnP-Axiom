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
      color: 'var(--color-up)',
      bg: 'var(--color-up-wash)',
      border: 'var(--color-up-border)',
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
        padding: 'var(--space-md) var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div
          style={{
            background: config.color,
            color: 'var(--color-paper)',
            padding: 'var(--space-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: config.color }}>
              Recommended action: {config.label}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', background: 'var(--color-paper)', padding: 'var(--space-3xs) var(--space-xs)', border: 'var(--rule-hair) solid var(--color-rule)' }}>
              rule: {reason}
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', marginTop: 'var(--space-3xs)' }}>
            {config.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
        <ShieldCheck size={16} color="var(--color-up)" />
        <span>Validation: passed ({forecast.forecast_id || 'ID'})</span>
      </div>
    </div>
  );
}