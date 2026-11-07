import React, { useState } from 'react';
import { History, X } from 'lucide-react';

export default function TradeLog({ forecastHistory, trades, onClose }) {
  const [activeTab, setActiveTab] = useState('predictions');

  const formatNYTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <History size={16} color="var(--color-blue)" />
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('predictions')}
              className={`pill-btn ${activeTab === 'predictions' ? 'active' : ''}`}
            >
              completed forecasts ({forecastHistory?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trades')}
              className={`pill-btn ${activeTab === 'trades' ? 'active' : ''}`}
            >
              paper trades ledger ({trades?.length || 0})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
            {activeTab === 'predictions' ? 'immutable records' : 'simulated fills'}
          </span>
          {onClose && (
            <button type="button" onClick={onClose} className="header-icon-btn" title="Back to dashboard">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ maxHeight: '420px', overflowY: 'auto', border: 'var(--rule-hair) solid var(--color-rule)', borderRadius: 'var(--radius-tile)' }}>
        {activeTab === 'predictions' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>timestamp (NY)</th>
                <th>ref price</th>
                <th>P(touch-up)</th>
                <th>5m expected</th>
                <th>30m high / low</th>
                <th>action</th>
                <th>regime</th>
                <th>status</th>
              </tr>
            </thead>
            <tbody>
              {(!forecastHistory || forecastHistory.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--color-muted)' }}>
                    No completed forecasts recorded yet.
                  </td>
                </tr>
              ) : (
                forecastHistory.slice().reverse().map((fc, i) => (
                  <tr key={fc.forecast_id || i}>
                    <td>{formatNYTime(fc.as_of)}</td>
                    <td>{fc.reference_price?.toFixed(2)}</td>
                    <td style={{ color: 'var(--color-accent-text)', fontWeight: 500 }}>
                      {((fc.p_touch_up_next_5m || 0) * 100).toFixed(1)}%
                    </td>
                    <td>{fc.expected_price_next_5m?.toFixed(2)}</td>
                    <td>
                      {fc.predicted_high_30m?.toFixed(1)} / {fc.predicted_low_30m?.toFixed(1)}
                    </td>
                    <td>
                      <span className={`pill ${fc.action === 'LONG' ? 'pill-green' : fc.action === 'SHORT' ? 'pill-red' : 'pill-amber'}`}>
                        {fc.action?.toLowerCase()}
                      </span>
                    </td>
                    <td>{fc.market_regime}</td>
                    <td>
                      <span className="pill" style={{ background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-rule)', color: 'var(--color-muted)' }}>
                        {fc.status?.toLowerCase() || 'resolved'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>trade id</th>
                <th>direction</th>
                <th>entry time (NY)</th>
                <th>entry price</th>
                <th>exit time (NY)</th>
                <th>exit price</th>
                <th>exit reason</th>
                <th>net P&L</th>
              </tr>
            </thead>
            <tbody>
              {(!trades || trades.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--color-muted)' }}>
                    No paper trades executed in this session.
                  </td>
                </tr>
              ) : (
                trades.slice().reverse().map((tr) => {
                  const netPositive = (tr.net_pnl || 0) >= 0;
                  return (
                    <tr key={tr.trade_id}>
                      <td>{tr.trade_id}</td>
                      <td>
                        <span className={`pill ${tr.direction === 'LONG' ? 'pill-green' : 'pill-red'}`}>
                          {tr.direction?.toLowerCase()}
                        </span>
                      </td>
                      <td>{formatNYTime(tr.entry_time)}</td>
                      <td>{tr.entry_price?.toFixed(2)}</td>
                      <td>{formatNYTime(tr.exit_time)}</td>
                      <td>{tr.exit_price?.toFixed(2)}</td>
                      <td>{tr.exit_reason?.toLowerCase()}</td>
                      <td style={{ fontWeight: 600, color: netPositive ? 'var(--color-up)' : 'var(--color-down)' }}>
                        {netPositive ? '+' : ''}{tr.net_pnl?.toFixed(2)} pts
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}