import React, { useState, useEffect } from 'react';
import { Home, LineChart, Activity, BookOpen, BarChart3, Bell, Plus, Settings, ShieldCheck } from 'lucide-react';
import MarketHeader from './components/MarketHeader';
import DecisionBanner from './components/DecisionBanner';
import CandlestickChart from './components/CandlestickChart';
import ForecastPanel from './components/ForecastPanel';
import PerformancePanel from './components/PerformancePanel';
import CumulativeSparkline from './components/CumulativeSparkline';
import TradeLog from './components/TradeLog';

export default function App() {
  const [market, setMarket] = useState(null);
  const [candles, setCandles] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [trades, setTrades] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const fetchAllData = async () => {
    try {
      const [mRes, cRes, fRes, fhRes, tRes, pRes] = await Promise.all([
        fetch('/api/market/latest').then((r) => r.json()),
        fetch('/api/market/candles?limit=120').then((r) => r.json()),
        fetch('/api/forecast/latest').then((r) => r.json()),
        fetch('/api/forecast/history?limit=50').then((r) => r.json()),
        fetch('/api/trades?limit=50').then((r) => r.json()),
        fetch('/api/performance').then((r) => r.json()),
      ]);

      if (!mRes.error) setMarket(mRes);
      if (Array.isArray(cRes)) setCandles(cRes);
      if (!fRes.error) setForecast(fRes);
      if (Array.isArray(fhRes)) setForecastHistory(fhRes);
      if (Array.isArray(tRes)) setTrades(tRes);
      if (!pRes.error) setPerformance(pRes);
    } catch (err) {
      console.error('Error fetching initial API data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();

    let ws = null;
    let pollInterval = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/market`;
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'tick' && data.market) {
              setMarket(data.market);
            }
          } catch (e) {
            console.error('WS parse error', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (err) {
        setIsConnected(false);
      }
    };

    connectWebSocket();
    pollInterval = setInterval(fetchAllData, 10000);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  return (
    <div className="dashboard-viewport">
      <div className="dashboard-window">
        {/* Left Sidebar Navigation */}
        <aside className="sidebar-strip">
          <div className="sidebar-nav-group">
            <div className="sidebar-btn-brand" title="SPX Axiom">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="4" y="4" width="7" height="7" rx="2" />
                <rect x="13" y="13" width="7" height="7" rx="2" />
              </svg>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`sidebar-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              title="Dashboard"
            >
              <Home size={19} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="sidebar-btn"
              title="Chart & Market"
            >
              <LineChart size={19} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="sidebar-btn"
              title="AI Forecasting"
            >
              <Activity size={19} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`sidebar-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              title="Trade Ledger"
            >
              <BookOpen size={19} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="sidebar-btn"
              title="Performance"
            >
              <BarChart3 size={19} />
            </button>

            <button
              type="button"
              className="sidebar-btn"
              title="Alerts"
            >
              <Bell size={19} />
            </button>

            <button
              type="button"
              className="sidebar-btn"
              title="New Order"
              style={{ marginTop: 'var(--space-2xs)' }}
            >
              <Plus size={19} />
            </button>
          </div>

          <div className="sidebar-nav-group">
            <button type="button" className="sidebar-btn" title="Settings">
              <Settings size={18} />
            </button>
            <button type="button" className="sidebar-btn" title="Model Status">
              <ShieldCheck size={18} />
            </button>
          </div>
        </aside>

        {/* Main Workstation Stage */}
        <main className="main-stage">
          <MarketHeader
            market={market}
            isConnected={isConnected}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <div className="workspace-content">
            {activeTab === 'dashboard' ? (
              <>
                {/* Top Row: Performance Chart (68%) + Watchlist (32%) */}
                <div className="top-chart-grid">
                  <CandlestickChart
                    candles={candles}
                    forecast={forecast}
                    market={market}
                  />
                  <ForecastPanel forecast={forecast} />
                </div>

                {/* Bottom Row: 3 Panels */}
                <div className="bottom-metrics-grid">
                  <PerformancePanel performance={performance} />
                  <DecisionBanner
                    forecast={forecast}
                    onOpenLedger={() => setActiveTab('ledger')}
                  />
                  <CumulativeSparkline
                    performance={performance}
                    trades={trades}
                  />
                </div>
              </>
            ) : (
              <TradeLog
                forecastHistory={forecastHistory}
                trades={trades}
                onClose={() => setActiveTab('dashboard')}
              />
            )}

            <footer style={{ marginTop: 'var(--space-sm)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
              <p>
                SPX AI Trading Indicator v1.0 <span className="hairline">/</span> Multi-Task LSTM and LightGBM Benchmark <span className="hairline">/</span> Conformal Prediction Calibration
              </p>
              <p style={{ marginTop: 'var(--space-3xs)' }}>
                Hypothetical decision system for research and evaluation only. Not financial advice. No broker integration.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}