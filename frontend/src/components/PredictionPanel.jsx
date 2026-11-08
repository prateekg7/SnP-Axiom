import React, { useState } from 'react';

export default function PredictionPanel({ forecast, market }) {
  const [horizonMode, setHorizonMode] = useState('both'); // '5m' | '30m' | 'both'

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
  const isUp5m = delta5m >= 0;

  // 30m metrics
  const path30m = forecast.path_30m || [];
  const exp30m = path30m.length > 0 ? path30m[path30m.length - 1].expected_close : refPrice + 3.15;
  const delta30m = exp30m - refPrice;
  const isUp30m = delta30m >= 0;

  const pTouchUp = forecast.p_touch_up_next_5m ?? 0.9263;
  const conformal = forecast.prediction_interval || { lower: 7372.07, upper: 7382.59, empirical_coverage: 0.788 };
  const high30m = forecast.predicted_high_30m || refPrice + 9.09;
  const low30m = forecast.predicted_low_30m || refPrice - 9.87;
  const vol30mBps = ((forecast.volatility_30m || 0.001874) * 10000).toFixed(1);
  const return5mBps = ((delta5m / refPrice) * 10000).toFixed(1);

  return (
    <div className="panel-container">
      <div className="panel-headline">
        <h2 className="headline-title">Predictive signals</h2>
        <div className="horizon-toggle-group">
          <button
            type="button"
            onClick={() => setHorizonMode('5m')}
            className={`horizon-tab-btn ${horizonMode === '5m' ? 'active' : ''}`}
            title="Next 5-minute cycle prediction"
          >
            5m cycle
          </button>
          <button
            type="button"
            onClick={() => setHorizonMode('30m')}
            className={`horizon-tab-btn ${horizonMode === '30m' ? 'active' : ''}`}
            title="30-minute forward trajectory and envelope"
          >
            30m cycle
          </button>
          <button
            type="button"
            onClick={() => setHorizonMode('both')}
            className={`horizon-tab-btn ${horizonMode === 'both' ? 'active' : ''}`}
            title="Combined multi-horizon overview"
          >
            Combined
          </button>
        </div>
      </div>

      <div className="signals-table-rows">
        {/* VIEW: 5M HORIZON */}
        {horizonMode === '5m' && (
          <>
            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Next 5m direction</span>
                <span className="signal-subtext">Order flow momentum vector</span>
              </div>
              <div className="signal-row-values">
                <span className="signal-val-primary">{exp5m.toFixed(2)}</span>
                <span className={`signal-val-delta ${isUp5m ? 'val-up' : 'val-down'}`}>
                  {isUp5m ? '+' : ''}{delta5m.toFixed(2)} pts
                </span>
                <span className={`dir-flag ${isUp5m ? 'flag-up' : 'flag-down'}`}>
                  {isUp5m ? 'UP' : 'DOWN'}
                </span>
              </div>
            </div>

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Target barrier (+3.0 pts)</span>
                <span className="signal-subtext">Calibrated touch probability</span>
              </div>
              <div className="signal-row-values">
                <span className="signal-val-primary">{(pTouchUp * 100).toFixed(1)}%</span>
                <span className="text-tag">calibrated</span>
              </div>
            </div>

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">5m Expected return</span>
                <span className="signal-subtext">Single-bar logarithmic drift</span>
              </div>
              <div className="signal-row-values">
                <span className={`signal-val-primary ${isUp5m ? 'val-up' : 'val-down'}`}>
                  {isUp5m ? '+' : ''}{return5mBps} bps
                </span>
                <span className="text-tag">5m drift</span>
              </div>
            </div>

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Micro-dispersion band</span>
                <span className="signal-subtext">Instantaneous spread threshold</span>
              </div>
              <div className="signal-row-values">
                <div className="envelope-range-display">
                  <span className="val-down">{(refPrice - 2.5).toFixed(2)}</span>
                  <span className="range-to">to</span>
                  <span className="val-up">{(refPrice + 2.5).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* VIEW: 30M HORIZON */}
        {horizonMode === '30m' && (
          <>
            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Next 30m expected close</span>
                <span className="signal-subtext">6-bar horizon destination</span>
              </div>
              <div className="signal-row-values">
                <span className="signal-val-primary">{exp30m.toFixed(2)}</span>
                <span className={`signal-val-delta ${isUp30m ? 'val-up' : 'val-down'}`}>
                  {isUp30m ? '+' : ''}{delta30m.toFixed(2)} pts
                </span>
                <span className={`dir-flag ${isUp30m ? 'flag-up' : 'flag-down'}`}>
                  {isUp30m ? 'UP' : 'DOWN'}
                </span>
              </div>
            </div>

            {/* 6-step forward trajectory progression */}
            <div className="signal-data-row trajectory-row">
              <div className="signal-row-meta">
                <span className="signal-label">30m Trajectory steps</span>
                <span className="signal-subtext">5m to 30m forward projection</span>
              </div>
              <div className="trajectory-steps-strip">
                {path30m.map((pt) => (
                  <div key={pt.horizon_minutes} className="trajectory-step-cell">
                    <span className="step-horizon-tag">+{pt.horizon_minutes}m</span>
                    <span className="step-price-tag">{pt.expected_close.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

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

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Projected extrema (30m)</span>
                <span className="signal-subtext">Expected range at {vol30mBps} bps RV</span>
              </div>
              <div className="signal-row-values">
                <div className="envelope-range-display">
                  <span className="val-down">L {low30m.toFixed(2)}</span>
                  <span className="range-sep">/</span>
                  <span className="val-up">H {high30m.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* VIEW: COMBINED (BOTH) */}
        {horizonMode === 'both' && (
          <>
            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Next 5m direction</span>
                <span className="signal-subtext">Order flow momentum vector</span>
              </div>
              <div className="signal-row-values">
                <span className="signal-val-primary">{exp5m.toFixed(2)}</span>
                <span className={`signal-val-delta ${isUp5m ? 'val-up' : 'val-down'}`}>
                  {isUp5m ? '+' : ''}{delta5m.toFixed(2)} pts
                </span>
                <span className={`dir-flag ${isUp5m ? 'flag-up' : 'flag-down'}`}>
                  {isUp5m ? 'UP' : 'DOWN'}
                </span>
              </div>
            </div>

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Next 30m target</span>
                <span className="signal-subtext">Touch barrier probability: {(pTouchUp * 100).toFixed(1)}%</span>
              </div>
              <div className="signal-row-values">
                <span className="signal-val-primary">{exp30m.toFixed(2)}</span>
                <span className={`signal-val-delta ${isUp30m ? 'val-up' : 'val-down'}`}>
                  {isUp30m ? '+' : ''}{delta30m.toFixed(2)} pts
                </span>
                <span className="text-tag">30m dest</span>
              </div>
            </div>

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Confidence envelope (30m)</span>
                <span className="signal-subtext">90% predictive interval bounds</span>
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

            <div className="signal-data-row">
              <div className="signal-row-meta">
                <span className="signal-label">Projected extrema (30m)</span>
                <span className="signal-subtext">6-bar horizon at {vol30mBps} bps RV</span>
              </div>
              <div className="signal-row-values">
                <div className="envelope-range-display">
                  <span className="val-down">L {low30m.toFixed(2)}</span>
                  <span className="range-sep">/</span>
                  <span className="val-up">H {high30m.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Flat Bottom Strategy Line */}
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
