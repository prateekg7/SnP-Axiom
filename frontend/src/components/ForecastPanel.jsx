import React from 'react';
import { Target, Compass, BarChart2, Zap, ArrowUp, ArrowDown } from 'lucide-react';

export default function ForecastPanel({ forecast }) {
  if (!forecast) {
    return (
      <div className="card">
        <div className="card-title">Forecast Overview</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Awaiting forecast data...</div>
      </div>
    );
  }

  const pUp = forecast.p_touch_up_next_5m || 0.5;
  const rawPUp = forecast.raw_p_touch_up || pUp;
  const refPrice = forecast.reference_price || 0;
  const exp5m = forecast.expected_price_next_5m || refPrice;
  const delta5m = exp5m - refPrice;

  const regimeColors = {
    trending_up: { color: 'var(--accent-green)', label: 'TRENDING UP' },
    trending_down: { color: 'var(--accent-red)', label: 'TRENDING DOWN' },
    mean_reverting: { color: 'var(--accent-blue)', label: 'MEAN REVERTING' },
  };
  const reg = regimeColors[forecast.market_regime] || { color: 'var(--text-secondary)', label: forecast.market_regime || 'NEUTRAL' };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={16} color="var(--accent-green)" />
          <span>Multi-Task AI Forecast</span>
        </div>
        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {forecast.forecast_id}
        </span>
      </div>

      {/* Probability Gauge / Card */}
      <div className="metric-tile" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label" style={{ color: 'var(--text-secondary)' }}>Next 5m Touch-UP Probability</span>
          <span className="pill pill-green mono" style={{ fontSize: '0.7rem' }}>Platt Calibrated</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-green)' }}>
            {(pUp * 100).toFixed(1)}%
          </div>
          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            (raw: {(rawPUp * 100).toFixed(1)}%)
          </span>
        </div>
        {/* Progress Bar */}
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginTop: '0.5rem', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, Math.max(0, pUp * 100))}%`, height: '100%', background: 'var(--accent-green)', borderRadius: 3 }} />
        </div>
      </div>

      {/* 5m Expected Price & Regime */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="metric-tile">
          <span className="metric-label">Expected 5m Price</span>
          <div className="metric-value mono" style={{ color: delta5m >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {exp5m.toFixed(2)}
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: delta5m >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '0.2rem' }}>
            {delta5m >= 0 ? '+' : ''}{delta5m.toFixed(2)} pts
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label">Market Regime</span>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: reg.color, marginTop: '0.25rem' }}>
            {reg.label}
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            30m RV: {(forecast.volatility_30m * 1000).toFixed(3)}
          </span>
        </div>
      </div>

      {/* 30m Extrema */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="metric-tile">
          <span className="metric-label" style={{ color: 'var(--accent-green)' }}>30m Pred High</span>
          <div className="metric-value mono" style={{ color: 'var(--accent-green)' }}>
            {forecast.predicted_high_30m?.toFixed(2)}
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            +{((forecast.predicted_high_30m - refPrice) || 0).toFixed(2)} pts
          </span>
        </div>

        <div className="metric-tile">
          <span className="metric-label" style={{ color: 'var(--accent-red)' }}>30m Pred Low</span>
          <div className="metric-value mono" style={{ color: 'var(--accent-red)' }}>
            {forecast.predicted_low_30m?.toFixed(2)}
          </div>
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {((forecast.predicted_low_30m - refPrice) || 0).toFixed(2)} pts
          </span>
        </div>
      </div>

      {/* 90% Conformal Interval */}
      {forecast.prediction_interval && (
        <div className="metric-tile" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label" style={{ color: '#c084fc' }}>90% Conformal Interval</span>
            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Empirical: {(forecast.prediction_interval.empirical_coverage * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e9d5ff', marginTop: '0.25rem' }}>
            [{forecast.prediction_interval.lower?.toFixed(2)}, {forecast.prediction_interval.upper?.toFixed(2)}]
          </div>
        </div>
      )}

      {/* 30m Forecast Path Breakdown */}
      {forecast.path_30m && forecast.path_30m.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            30-Minute Trajectory Path
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.4rem' }}>
            {forecast.path_30m.map((pt) => {
              const d = pt.expected_close - refPrice;
              return (
                <div key={pt.horizon_minutes} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.4rem 0.2rem', textAlign: 'center' }}>
                  <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{pt.horizon_minutes}m</div>
                  <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '0.1rem' }}>
                    {pt.expected_close.toFixed(1)}
                  </div>
                  <div className="mono" style={{ fontSize: '0.65rem', color: d >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
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
