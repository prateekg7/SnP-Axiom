import React, { useState } from 'react';

function formatTime(isoString) {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return '--:--';
  }
}

export default function ForecastLogTable({ history = [] }) {
  const [horizonView, setHorizonView] = useState('5m'); // '5m' | '30m'
  const records = history.slice(0, 15);

  return (
    <div className="panel-container log-panel-container">
      <div className="panel-headline">
        <h2 className="headline-title">Recent forecast logs</h2>
        <div className="horizon-toggle-group">
          <button
            type="button"
            onClick={() => setHorizonView('5m')}
            className={`horizon-tab-btn ${horizonView === '5m' ? 'active' : ''}`}
            title="5-minute prediction log"
          >
            5m log
          </button>
          <button
            type="button"
            onClick={() => setHorizonView('30m')}
            className={`horizon-tab-btn ${horizonView === '30m' ? 'active' : ''}`}
            title="30-minute prediction log"
          >
            30m log
          </button>
        </div>
      </div>

      <div className="table-scroll-wrapper">
        <table className="compact-log-table">
          <thead>
            {horizonView === '5m' ? (
              <tr>
                <th scope="col" className="col-left">time (et)</th>
                <th scope="col" className="col-right">ref price</th>
                <th scope="col" className="col-right">5m pred</th>
                <th scope="col" className="col-right">target prob</th>
                <th scope="col" className="col-center">action</th>
                <th scope="col" className="col-center">status</th>
              </tr>
            ) : (
              <tr>
                <th scope="col" className="col-left">time (et)</th>
                <th scope="col" className="col-right">ref price</th>
                <th scope="col" className="col-right">30m dest</th>
                <th scope="col" className="col-right">30m bounds (L/H)</th>
                <th scope="col" className="col-center">action</th>
                <th scope="col" className="col-center">status</th>
              </tr>
            )}
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  no forecast logs recorded yet
                </td>
              </tr>
            ) : (
              records.map((item, idx) => {
                const ref = item.reference_price || 7376.86;

                // 5m values
                const isUp5m = (item.expected_price_next_5m || ref) >= ref;
                const delta5m = (item.expected_price_next_5m || ref) - ref;
                const pVal = item.p_touch_up_next_5m ? (item.p_touch_up_next_5m * 100).toFixed(1) + '%' : '--';

                // 30m values
                const path = item.path_30m || [];
                const exp30m = path.length > 0 ? path[path.length - 1].expected_close : (item.expected_price_next_5m || ref);
                const delta30m = exp30m - ref;
                const isUp30m = delta30m >= 0;
                const low30m = item.predicted_low_30m ? item.predicted_low_30m.toFixed(1) : '--';
                const high30m = item.predicted_high_30m ? item.predicted_high_30m.toFixed(1) : '--';

                return (
                  <tr key={item.forecast_id || idx} className="log-row">
                    <td className="log-cell time-cell col-left">{formatTime(item.as_of)}</td>
                    <td className="log-cell price-cell col-right">{ref.toFixed(2)}</td>

                    {horizonView === '5m' ? (
                      <>
                        <td className={`log-cell pred-cell col-right ${isUp5m ? 'val-up' : 'val-down'}`}>
                          {isUp5m ? '+' : ''}{delta5m.toFixed(2)}
                        </td>
                        <td className="log-cell prob-cell col-right">{pVal}</td>
                      </>
                    ) : (
                      <>
                        <td className={`log-cell pred-cell col-right ${isUp30m ? 'val-up' : 'val-down'}`}>
                          {isUp30m ? '+' : ''}{delta30m.toFixed(2)}
                        </td>
                        <td className="log-cell extrema-cell col-right">
                          <span className="val-down">{low30m}</span>
                          <span className="range-sep"> / </span>
                          <span className="val-up">{high30m}</span>
                        </td>
                      </>
                    )}

                    <td className="log-cell action-cell col-center">
                      <span className={`log-action-tag action-${(item.action || 'HOLD').toLowerCase()}`}>
                        {item.action || 'HOLD'}
                      </span>
                    </td>
                    <td className="log-cell status-cell col-center">
                      <span className="log-status-resolved">{item.status || 'RESOLVED'}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
