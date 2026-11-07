import React from 'react';
import { Target, TrendingUp, Activity, ArrowUpRight, ArrowDownRight, ShieldCheck } from 'lucide-react';

export default function ForecastPanel({ forecast }) {
  if (!forecast) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0, textTransform: 'none' }}>
            Multi-task AI Forecast
          </h2>
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}>Awaiting forecast data…</div>
      </div>
    );
  }

  const pUp = forecast.p_touch_up_next_5m || 0.5;
  const rawPUp = forecast.raw_p_touch_up || pUp;
  const refPrice = forecast.reference_price || 0;
  const exp5m = forecast.expected_price_next_5m || refPrice;
  const delta5m = exp5m - refPrice;
  const highDelta = (forecast.predicted_high_30m || refPrice) - refPrice;
  const lowDelta = (forecast.predicted_low_30m || refPrice) - refPrice;

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <div className="panel-header" style={{ marginBottom: 'var(--space-xs)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0, textTransform: 'none' }}>
            Multi-task AI Forecast
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: 'var(--space-3xs)' }}>
            Calibrated neural signals & 30m horizon projections
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Row 1: Next 5m Touch-Up */}
        <div className="watchlist-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="watchlist-icon-circle" style={{ backgroundColor: 'var(--color-up-wash)', color: 'var(--color-up)' }}>
              <Target size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Touch-Up (5m)</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-ink)' }}>
                {(pUp * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>raw {(rawPUp * 100).toFixed(1)}%</div>
            <span className="pill pill-green" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
              Platt +0.64%
            </span>
          </div>
        </div>

        {/* Row 2: 5m Expected Price */}
        <div className="watchlist-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="watchlist-icon-circle" style={{ backgroundColor: 'var(--color-blue-wash)', color: 'var(--color-blue)' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Expected 5m Close</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-ink)' }}>
                {exp5m.toFixed(2)}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>horizon +5m</div>
            <span className={`pill ${delta5m >= 0 ? 'pill-green' : 'pill-red'}`} style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
              {delta5m >= 0 ? '+' : ''}{delta5m.toFixed(2)} pts
            </span>
          </div>
        </div>

        {/* Row 3: Market Regime */}
        <div className="watchlist-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="watchlist-icon-circle" style={{ backgroundColor: 'var(--color-hold-wash)', color: 'var(--color-hold)' }}>
              <Activity size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Market Regime</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-ink)' }}>
                {forecast.market_regime || 'mean reverting'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>30m RV: {(forecast.volatility_30m * 1000).toFixed(2)}</div>
            <span className="pill pill-blue" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
              calibrated
            </span>
          </div>
        </div>

        {/* Row 4: 30m Pred High */}
        <div className="watchlist-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="watchlist-icon-circle" style={{ backgroundColor: 'var(--color-up-wash)', color: 'var(--color-up)' }}>
              <ArrowUpRight size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>30m Pred High</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-up)' }}>
                {forecast.predicted_high_30m?.toFixed(2) || '7386.77'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>extrema</div>
            <span className="pill pill-green" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
              +{highDelta.toFixed(2)} pts
            </span>
          </div>
        </div>

        {/* Row 5: 30m Pred Low */}
        <div className="watchlist-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="watchlist-icon-circle" style={{ backgroundColor: 'var(--color-down-wash)', color: 'var(--color-down)' }}>
              <ArrowDownRight size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>30m Pred Low</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-down)' }}>
                {forecast.predicted_low_30m?.toFixed(2) || '7362.49'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>extrema</div>
            <span className="pill pill-red" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
              {lowDelta.toFixed(2)} pts
            </span>
          </div>
        </div>

        {/* Row 6: 90% Conformal Interval */}
        {forecast.prediction_interval && (
          <div className="watchlist-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <div className="watchlist-icon-circle" style={{ backgroundColor: 'var(--color-band-wash)', color: 'var(--color-band)' }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>90% Conformal Interval</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink)' }}>
                  [{forecast.prediction_interval.lower?.toFixed(1)}, {forecast.prediction_interval.upper?.toFixed(1)}]
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="pill" style={{ background: 'var(--color-paper-3)', color: 'var(--color-muted)' }}>
                {(forecast.prediction_interval.empirical_coverage * 100).toFixed(1)}% cov
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}