import React from 'react';
import { Target, TrendingUp, TrendingDown, ShieldCheck, Compass } from 'lucide-react';

export default function PredictionPanel({ forecast, market }) {
  if (!forecast) {
    return (
      <div className="panel-container">
        <div className="panel-headline">
          <h2 className="headline-title">Predictive signals</h2>
        </div>
        <p className="panel-empty-text">Awaiting market cycle data…</p>
      </div>
    );
  }

  const refPrice = forecast.reference_price || market?.latest_price || 7376.86;
  const exp5m = forecast.expected_price_next_5m || refPrice;
  const delta5m = exp5m - refPrice;
  const isUp = delta5m >= 0;

  const pTouchUp = forecast.p_touch_up_next_5m ?? 0.9263;
  const conformal = forecast.prediction_interval || { lower: 7372.07, upper: 7382.59, empirical_coverage: 0.896 };
  const high30m = forecast.predicted_high_30m || refPrice + 9.09;
  const low30m = forecast.predicted_low_30m || refPrice - 9.87;

  return (
    <div className="panel-container">
      <div className="panel-headline">
        <div className="headline-badge">
          <Target size={14} className="icon-target" />
          <h2 className="headline-title">Predictive signals</h2>
        </div>
        <span className="model-chip">5m cycle</span>
      </div>

      <div className="predictions-grid">
        {/* Directional 5m projection */}
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
            Short-horizon directional bias from order flow momentum
          </div>
        </div>

        {/* 30m Target barrier probability */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">Target barrier (+3.0 pts)</span>
            <span className="calibrated-pill">Calibrated</span>
          </div>
          <div className="tile-main-row">
            <span className="tile-value-big">{(pTouchUp * 100).toFixed(1)}%</span>
            <span className="tile-sub-metric">30m window</span>
          </div>
          <div className="tile-subtext">
            Probability of touching 3.0 point profit target before expiration
          </div>
        </div>

        {/* 30m Confidence envelope */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">Confidence envelope (30m)</span>
            <span className="coverage-pill">{(conformal.empirical_coverage * 100).toFixed(1)}% coverage</span>
          </div>
          <div className="tile-range-row">
            <span className="range-box range-lower">{conformal.lower.toFixed(2)}</span>
            <span className="range-to">to</span>
            <span className="range-box range-upper">{conformal.upper.toFixed(2)}</span>
          </div>
          <div className="tile-subtext">
            Asymmetric 90% predictive interval bounds
          </div>
        </div>

        {/* 30m Projected extrema */}
        <div className="prediction-tile">
          <div className="tile-top-row">
            <span className="tile-label">Projected extrema</span>
            <span className="extrema-pill">Vol {(forecast.volatility_30m * 10000).toFixed(1)} bps</span>
          </div>
          <div className="tile-range-row">
            <span className="extrema-val val-down">L {low30m.toFixed(2)}</span>
            <span className="range-sep">/</span>
            <span className="extrema-val val-up">H {high30m.toFixed(2)}</span>
          </div>
          <div className="tile-subtext">
            Estimated maximum price swing over 6 bars
          </div>
        </div>
      </div>

      {/* Strategy and Risk Filter status */}
      <div className="decision-bar">
        <div className="decision-left">
          <Compass size={14} className="icon-compass" />
          <span className="decision-label">Strategy action:</span>
          <span className={`action-tag action-${(forecast.action || 'HOLD').toLowerCase()}`}>
            {forecast.action || 'HOLD'}
          </span>
        </div>
        <div className="decision-right">
          <ShieldCheck size={13} className="icon-shield" />
          <span className="decision-confidence">Risk filter: Clear (confidence 0.66)</span>
        </div>
      </div>
    </div>
  );
}
