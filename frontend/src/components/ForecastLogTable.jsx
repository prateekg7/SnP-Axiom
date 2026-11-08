import React from 'react';

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
  const records = history.slice(0, 15);

  return (
    <div className="panel-container log-panel-container">
      <div className="panel-headline">
        <h2 className="headline-title">Recent forecast logs</h2>
        <span className="text-tag">{history.length} records</span>
      </div>

      <div className="table-scroll-wrapper">
        <table className="compact-log-table">
          <thead>
            <tr>
              <th scope="col" className="col-left">time (et)</th>
              <th scope="col" className="col-right">ref price</th>
              <th scope="col" className="col-right">5m pred</th>
              <th scope="col" className="col-right">target prob</th>
              <th scope="col" className="col-center">action</th>
              <th scope="col" className="col-center">status</th>
            </tr>
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
                const isUp = (item.expected_price_next_5m || item.reference_price) >= item.reference_price;
                const delta = (item.expected_price_next_5m || item.reference_price) - item.reference_price;
                const pVal = item.p_touch_up_next_5m ? (item.p_touch_up_next_5m * 100).toFixed(1) + '%' : '--';

                return (
                  <tr key={item.forecast_id || idx} className="log-row">
                    <td className="log-cell time-cell col-left">{formatTime(item.as_of)}</td>
                    <td className="log-cell price-cell col-right">{item.reference_price?.toFixed(2) || '--'}</td>
                    <td className={`log-cell pred-cell col-right ${isUp ? 'val-up' : 'val-down'}`}>
                      {isUp ? '+' : ''}{delta.toFixed(2)}
                    </td>
                    <td className="log-cell prob-cell col-right">{pVal}</td>
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
