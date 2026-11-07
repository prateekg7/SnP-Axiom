import React, { useState } from 'react';
import { History } from 'lucide-react';

export default function TradeLog({ forecastHistory, trades }) {
  const [activeTab, setActiveTab] = useState('predictions');

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <History size={16} color="var(--color-blue)" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('predictions')}
              style={{
                background: activeTab === 'predictions' ? 'var(--color-paper-3)' : 'transparent',
                color: activeTab === 'predictions' ? 'var(--color-ink)' : 'var(--color-muted)',
                border: 'var(--rule-hair) solid var(--color-rule)',
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              completed forecasts ({forecastHistory?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              style={{
                background: activeTab === 'trades' ? 'var(--color-paper-3)' : 'transparent',
                color: activeTab === 'trades' ? 'var(--color-ink)' : 'var(--color-muted)',
                border: 'var(--rule-hair) solid var(--color-rule)',
                padding: '0.25rem 0.6rem',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              paper trades ledger ({trades?.length || 0})
            </button>
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {activeTab === 'predictions' ? 'immutable records' : 'simulated fills'}
        </span>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto', border: 'var(--rule-hair) solid var(--color-rule)' }}>
        {activeTab === 'predictions' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>timestamp (UTC)</th>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-muted)' }}>
                    No completed forecasts recorded yet.
                  </td>
                </tr>
              ) : (
                forecastHistory.slice().reverse().map((fc, i) => (
                  <tr key={fc.forecast_id || i}>
                    <td style={{ fontSize: '0.75rem' }}>
                      {fc.as_of ? new Date(fc.as_of).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td>{fc.reference_price?.toFixed(2)}</td>
                    <td style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                      {((fc.p_touch_up_next_5m || 0) * 100).toFixed(1)}%
                    </td>
                    <td>{fc.expected_price_next_5m?.toFixed(2)}</td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {fc.predicted_high_30m?.toFixed(1)} / {fc.predicted_low_30m?.toFixed(1)}
                    </td>
                    <td>
                      <span className={`pill ${fc.action === 'LONG' ? 'pill-green' : fc.action === 'SHORT' ? 'pill-red' : 'pill-amber'}`} style={{ fontSize: '0.65rem' }}>
                        {fc.action?.toLowerCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{fc.market_regime}</td>
                    <td>
                      <span className="pill" style={{ fontSize: '0.65rem', background: 'var(--color-paper)', border: 'var(--rule-hair) solid var(--color-rule)', color: 'var(--color-muted)' }}>
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
                <th>entry time</th>
                <th>entry price</th>
                <th>exit time</th>
                <th>exit price</th>
                <th>exit reason</th>
                <th>net P&L</th>
              </tr>
            </thead>
            <tbody>
              {(!trades || trades.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-muted)' }}>
                    No paper trades executed in this session.
                  </td>
                </tr>
              ) : (
                trades.slice().reverse().map((tr) => {
                  const netPositive = (tr.net_pnl || 0) >= 0;
                  return (
                    <tr key={tr.trade_id}>
                      <td style={{ fontSize: '0.75rem' }}>{tr.trade_id}</td>
                      <td>
                        <span className={`pill ${tr.direction === 'LONG' ? 'pill-green' : 'pill-red'}`} style={{ fontSize: '0.65rem' }}>
                          {tr.direction?.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {tr.entry_time ? new Date(tr.entry_time).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td>{tr.entry_price?.toFixed(2)}</td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {tr.exit_time ? new Date(tr.exit_time).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td>{tr.exit_price?.toFixed(2)}</td>
                      <td style={{ fontSize: '0.75rem' }}>{tr.exit_reason?.toLowerCase()}</td>
                      <td style={{ fontWeight: 600, color: netPositive ? 'var(--color-accent)' : 'var(--color-down)' }}>
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
