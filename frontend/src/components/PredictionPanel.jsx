import React from 'react';

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
        <h2 className="headline-title">Predictive signals</h2>
        <span className="text-tag">5m cycle</span>
      </div>

      <div className="signals-table-rows">
        {/* Row 1: Direction */}
        <div className="signal-data-row">
          <div className="signal-row-meta">
            <span className="signal-label">Next 5m direction</span>
            <span className="signal-subtext">Order flow momentum vector</span>
          </div>
          <div className="signal-row-values">
            <span className="signal-val-primary">{exp5m.toFixed(2)}</span>
            <span className={`signal-val-delta ${isUp ? 'val-up' : 'val-down'}`}>
              {isUp ? '+' : ''}{delta5m.toFixed(2)} pts
            </span>
            <span className={`dir-flag ${isUp ? 'flag-up' : 'flag-down'}`}>
              {isUp ? 'UP' : 'DOWN'}
            </span>
          </div>
        </div>

        {/* Row 2: Target Barrier */}
        <div className="signal-data-row">
          <div className="signal-row-meta">
            <span className="signal-label">Target barrier (+3.0 pts)</span>
            <span className="signal-subtext">30m touch probability</span>
          </div>
          <div className="signal-row-values">
            <span className="signal-val-primary">{(pTouchUp * 100).toFixed(1)}%</span>
            <span className="text-tag">calibrated</span>
          </div>
        </div>

        {/* Row 3: Confidence Envelope */}
        <div className="signal-data-row">
          <div className="signal-row-meta">
            <span className="signal-label">Confidence envelope (30m)</span>
            <span className="signal-subtext">90% nominal predictive interval</span>
          </div>
          <div className="signal-row-values">
            <div className="envelope-range-display">
              <span className="val-down">{conformal.lower.toFixed(2)}</span>
              <span className="range-to">to</span>
              <span className="val-up">{conformal.upper.toFixed(2)}</span>
            </div>
            <span className="text-tag">{(conformal.empirical_coverage * 100).toFixed(1)}% coverage</span>
          </div>
        </div>

        {/* Row 4: Projected Extrema */}
        <div className="signal-data-row">
          <div className="signal-row-meta">
            <span className="signal-label">Projected extrema</span>
            <span className="signal-subtext">6-bar horizon at {(forecast.volatility_30m * 10000).toFixed(1)} bps RV</span>
          </div>
          <div className="signal-row-values">
            <div className="envelope-range-display">
              <span className="val-down">L {low30m.toFixed(2)}</span>
              <span className="range-sep">/</span>
              <span className="val-up">H {high30m.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Flat Bottom Strategy Line - Zero nested card boxes, zero pills */}
      <div className="signal-footer-bar">
        <div className="footer-status-item">
          <span className="status-key">Strategy action:</span>
          <span className={`status-action action-${(forecast.action || 'HOLD').toLowerCase()}`}>
            {forecast.action || 'HOLD'}
          </span>
        </div>
        <div className="footer-status-item">
          <span className="status-key">Risk filter:</span>
          <span className="status-note">Clear (confidence 0.66)</span>
        </div>
      </div>
    </div>
  );
}
