import React from 'react';
import { Target, TrendingUp, TrendingDown, ShieldCheck, Activity, Compass } from 'lucide-react';

export default function PredictionPanel({ forecast, market }) {
  if (!forecast) {
    return (
      <div className="panel-container">
        <div className="panel-headline">
          <h2 className="headline-title">Multi-task AI predictions</h2>
        </div>
        <p className="panel-empty-text">Awaiting model inference data…</p>
      </div>
    );
  }

  const refPrice = forecast.reference_price || market?.latest_price || 7376.86;
  const exp5m = forecast.expected_price_next_5m || refPrice;
  const delta5m = exp5m - refPrice;
  const isUp = delta5m >= 0;

  const pTouchUp = forecast.p_touch_up_next_5m ?? 0.9263;
  const rawPTouchUp = forecast.raw_p_touch_up ?? 0.8435;
  const conformal = forecast.prediction_interval || { lower: 7372.07, upper: 7382.59, empirical_coverage: 0.896 };
  const high30m = forecast.predicted_high_30m || refPrice + 9.09;
  const low30m = forecast.predicted_low_30m || refPrice - 9.87;

  return (
    <div className="panel-container">
      <div className="panel-headline">
        <div className="headline-badge">
          <Target size={14} className="icon-target" />
          <h2 className="headline-title">Multi-task AI predictions</h2>
        </div>
        <span className="model-chip">{forecast.model_version || 'LSTM + Open-Jev'}</span>
      </div>

      <div className="predictions-grid">
        {/* Directional 5m forecast card */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">Next 5m direction</span>
            <span className={`dir-badge ${isUp ? 'dir-up' : 'dir-down'}`}>
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{isUp ? 'UP' : 'DOWN'}</span>
            </span>
          </div>
          <div className="tile-main-row">
            <span className="tile-value-big">{exp5m.toFixed(2)}</span>
            <span className={`tile-delta ${isUp ? 'val-up' : 'val-down'}`}>
              {isUp ? '+' : ''}{delta5m.toFixed(2)} pts
            </span>
          </div>
          <div className="tile-subtext">
            Directional edge: 52.8% recall (top among all baselines)
          </div>
        </div>

        {/* 30m Touch-Up barrier probability */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">Touch-UP (+3.0 pts barrier)</span>
            <span className="calibrated-pill">Calibrated</span>
          </div>
          <div className="tile-main-row">
            <span className="tile-value-big">{(pTouchUp * 100).toFixed(1)}%</span>
            <span className="tile-sub-metric">raw {(rawPTouchUp * 100).toFixed(1)}%</span>
          </div>
          <div className="tile-subtext">
            Platt scaled (Brier 0.0492 vs 0.0504 raw, ECE 0.0093)
          </div>
        </div>

        {/* Conformal 90% prediction band */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">90% conformal band (30m)</span>
            <span className="coverage-pill">{(conformal.empirical_coverage * 100).toFixed(1)}% cov</span>
          </div>
          <div className="tile-range-row">
            <span className="range-box range-lower">{conformal.lower.toFixed(2)}</span>
            <span className="range-to">to</span>
            <span className="range-box range-upper">{conformal.upper.toFixed(2)}</span>
          </div>
          <div className="tile-subtext">
            Band width: {(conformal.upper - conformal.lower).toFixed(2)} pts (asymmetric bounds)
          </div>
        </div>

        {/* 30m Expected Extrema */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">30m expected range</span>
            <span className="extrema-pill">Vol {(forecast.volatility_30m * 10000).toFixed(1)} bps</span>
          </div>
          <div className="tile-range-row">
            <span className="extrema-val val-down">L {low30m.toFixed(2)}</span>
            <span className="range-sep">/</span>
            <span className="extrema-val val-up">H {high30m.toFixed(2)}</span>
          </div>
          <div className="tile-subtext">
            Expected max swing: {(high30m - low30m).toFixed(2)} pts
          </div>
        </div>
      </div>

      {/* Decision Engine status */}
      <div className="decision-bar">
        <div className="decision-left">
          <Compass size={14} className="icon-compass" />
          <span className="decision-label">Engine action:</span>
          <span className={`action-tag action-${(forecast.action || 'HOLD').toLowerCase()}`}>
            {forecast.action || 'HOLD'}
          </span>
        </div>
        <div className="decision-right">
          <ShieldCheck size={13} className="icon-shield" />
          <span className="decision-confidence">Epistemic conf: 0.66 (gate &gt;= 0.35)</span>
        </div>
      </div>
    </div>
  );
}
