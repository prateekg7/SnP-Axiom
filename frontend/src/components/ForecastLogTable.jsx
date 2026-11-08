import React from 'react';
import { History, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
        <div className="headline-badge">
          <History size={14} className="icon-history" />
          <h2 className="headline-title">Recent forecast logs</h2>
        </div>
        <span className="count-chip">{history.length} records</span>
      </div>

      <div className="table-scroll-wrapper">
        <table className="compact-log-table">
          <thead>
            <tr>
              <th scope="col">time (et)</th>
              <th scope="col">ref price</th>
              <th scope="col">5m pred</th>
              <th scope="col">touch prob</th>
              <th scope="col">action</th>
              <th scope="col">status</th>
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
                    <td className="log-cell time-cell">{formatTime(item.as_of)}</td>
                    <td className="log-cell price-cell">{item.reference_price?.toFixed(2) || '--'}</td>
                    <td className="log-cell pred-cell">
                      <span className={`pred-delta ${isUp ? 'val-up' : 'val-down'}`}>
                        {isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        <span>{isUp ? '+' : ''}{delta.toFixed(2)}</span>
                      </span>
                    </td>
                    <td className="log-cell prob-cell">{pVal}</td>
                    <td className="log-cell action-cell">
                      <span className={`log-action-tag action-${(item.action || 'HOLD').toLowerCase()}`}>
                        {item.action || 'HOLD'}
                      </span>
                    </td>
                    <td className="log-cell status-cell">
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
