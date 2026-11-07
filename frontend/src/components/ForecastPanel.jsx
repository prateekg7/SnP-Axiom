import React from 'react';
import { Target } from 'lucide-react';

export default function ForecastPanel({ forecast }) {
  if (!forecast) {
    return (
      <div className="card">
        <div className="card-title">Forecast overview</div>
        <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Awaiting forecast data…</div>
      </div>
    );
  }

  const pUp = forecast.p_touch_up_next_5m || 0.5;
  const rawPUp = forecast.raw_p_touch_up || pUp;
  const refPrice = forecast.reference_price || 0;
  const exp5m = forecast.expected_price_next_5m || refPrice;
  const delta5m = exp5m - refPrice;

  const regimeColors = {
    trending_up: { color: 'var(--color-accent)', label: 'trending up' },
    trending_down: { color: 'var(--color-down)', label: 'trending down' },
    mean_reverting: { color: 'var(--color-blue)', label: 'mean reverting' },
  };
  const reg = regimeColors[forecast.market_regime] || { color: 'var(--color-ink-2)', label: forecast.market_regime || 'neutral' };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={16} color="var(--color-accent)" />
          <span>Multi-task AI forecast</span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {forecast.forecast_id}
        </span>
      </div>

      {/* Probability Gauge / Card */}
      <div className="metric-tile" style={{ background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-accent-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Next 5m touch-up probability</span>
          <span className="pill pill-green" style={{ fontSize: '0.7rem' }}>Platt calibrated</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
          <div style={{ fontSize: '1.85rem', fontWeight: 600, color: 'var(--color-accent)' }}>
            {(pUp * 100).toFixed(1)}%
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
            (raw: {(rawPUp * 100).toFixed(1)}%)
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--color-rule)', marginTop: '0.5rem', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, Math.max(0, pUp * 100))}%`, height: '100%', background: 'var(--color-accent)' }} />
        </div>
      </div>

      {/* 5m Expected Price & Regime */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.75rem' }}>
        <div className="metric-tile">
          <span className="metric-label">Expected 5m price</span>
          <div className="metric-value" style={{ color: delta5m >= 0 ? 'var(--color-accent)' : 'var(--color-down)' }}>
            {exp5m.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.7rem', color: delta5m >= 0 ? 'var(--color-accent)' : 'var(--color-down)', marginTop: '0.2rem' }}>
            {delta5m >= 0 ? '+' : ''}{delta5m.toFixed(2)} pts
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Market regime</span>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: reg.color, marginTop: '0.25rem' }}>
            {reg.label}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
            30m RV: {(forecast.volatility_30m * 1000).toFixed(3)}
          </span>
        </div>
      </div>

      {/* 30m Extrema */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.75rem' }}>
        <div className="metric-tile">
          <span className="metric-label" style={{ color: 'var(--color-accent)' }}>30m pred high</span>
          <div className="metric-value" style={{ color: 'var(--color-accent)' }}>
            {forecast.predicted_high_30m?.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            +{((forecast.predicted_high_30m - refPrice) || 0).toFixed(2)} pts
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label" style={{ color: 'var(--color-down)' }}>30m pred low</span>
          <div className="metric-value" style={{ color: 'var(--color-down)' }}>
            {forecast.predicted_low_30m?.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            {((forecast.predicted_low_30m - refPrice) || 0).toFixed(2)} pts
          </span>
        </div>
      </div>

      {/* 90% Conformal Interval */}
      {forecast.prediction_interval && (
        <div className="metric-tile" style={{ background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-band-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label" style={{ color: 'var(--color-band)' }}>90% conformal interval</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
              empirical: {(forecast.prediction_interval.empirical_coverage * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-ink)', marginTop: '0.25rem' }}>
            [{forecast.prediction_interval.lower?.toFixed(2)}, {forecast.prediction_interval.upper?.toFixed(2)}]
          </div>
        </div>
      )}

      {/* 30m Forecast Path Breakdown */}
      {forecast.path_30m && forecast.path_30m.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
            30-minute trajectory path
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '0.4rem' }}>
            {forecast.path_30m.map((pt) => {
              const d = pt.expected_close - refPrice;
              return (
                <div key={pt.horizon_minutes} style={{ background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-rule)', padding: '0.4rem 0.2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)' }}>+{pt.horizon_minutes}m</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, marginTop: '0.1rem' }}>
                    {pt.expected_close.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: d >= 0 ? 'var(--color-accent)' : 'var(--color-down)' }}>
                    {d >= 0 ? '+' : ''}{d.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
