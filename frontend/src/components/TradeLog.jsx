import React, { useState } from 'react';
import { History, ListFilter, ArrowUpRight, ArrowDownRight, Pause } from 'lucide-react';

export default function TradeLog({ forecastHistory, trades }) {
  const [activeTab, setActiveTab] = useState('predictions'); // 'predictions' or 'trades'

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <History size={16} color="var(--accent-blue)" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('predictions')}
              style={{
                background: activeTab === 'predictions' ? 'var(--border-light)' : 'transparent',
                color: activeTab === 'predictions' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              Completed-Candle Forecasts ({forecastHistory?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              style={{
                background: activeTab === 'trades' ? 'var(--border-light)' : 'transparent',
                color: activeTab === 'trades' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              Paper Trades Ledger ({trades?.length || 0})
            </button>
          </div>
        </div>

        <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'none' }}>
          {activeTab === 'predictions' ? 'Append-only immutable record' : 'Simulated execution fills'}
        </span>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
        {activeTab === 'predictions' ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Ref Price</th>
                <th>P(Touch-UP)</th>
                <th>5m Expected</th>
                <th>30m High/Low</th>
                <th>Action</th>
                <th>Regime</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!forecastHistory || forecastHistory.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    No completed forecasts recorded yet.
                  </td>
                </tr>
              ) : (
                forecastHistory.slice().reverse().map((fc, i) => (
                  <tr key={fc.forecast_id || i}>
                    <td className="mono" style={{ fontSize: '0.75rem' }}>
                      {fc.as_of ? new Date(fc.as_of).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="mono">{fc.reference_price?.toFixed(2)}</td>
                    <td className="mono" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                      {((fc.p_touch_up_next_5m || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="mono">{fc.expected_price_next_5m?.toFixed(2)}</td>
                    <td className="mono" style={{ fontSize: '0.75rem' }}>
                      H: {fc.predicted_high_30m?.toFixed(1)} / L: {fc.predicted_low_30m?.toFixed(1)}
                    </td>
                    <td>
                      <span className={`pill ${fc.action === 'LONG' ? 'pill-green' : fc.action === 'SHORT' ? 'pill-red' : 'pill-amber'}`} style={{ fontSize: '0.65rem' }}>
                        {fc.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{fc.market_regime}</td>
                    <td>
                      <span className="pill mono" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                        {fc.status || 'RESOLVED'}
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
                <th>Trade ID</th>
                <th>Dir</th>
                <th>Entry Time</th>
                <th>Entry Price</th>
                <th>Exit Time</th>
                <th>Exit Price</th>
                <th>Exit Reason</th>
                <th>Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {(!trades || trades.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    No paper trades executed in this session.
                  </td>
                </tr>
              ) : (
                trades.slice().reverse().map((tr) => {
                  const netPositive = (tr.net_pnl || 0) >= 0;
                  return (
                    <tr key={tr.trade_id}>
                      <td className="mono" style={{ fontSize: '0.75rem' }}>{tr.trade_id}</td>
                      <td>
                        <span className={`pill ${tr.direction === 'LONG' ? 'pill-green' : 'pill-red'}`} style={{ fontSize: '0.65rem' }}>
                          {tr.direction}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem' }}>
                        {tr.entry_time ? new Date(tr.entry_time).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="mono">{tr.entry_price?.toFixed(2)}</td>
                      <td className="mono" style={{ fontSize: '0.75rem' }}>
                        {tr.exit_time ? new Date(tr.exit_time).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="mono">{tr.exit_price?.toFixed(2)}</td>
                      <td style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{tr.exit_reason}</td>
                      <td className="mono" style={{ fontWeight: 700, color: netPositive ? 'var(--accent-green)' : 'var(--accent-red)' }}>
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

