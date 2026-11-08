import React, { useState, useEffect } from 'react';
import MarketHeader from './components/MarketHeader';
import CandlestickChart from './components/CandlestickChart';
import PredictionPanel from './components/PredictionPanel';
import ForecastLogTable from './components/ForecastLogTable';
import ConfusionMatrixHeatmap from './components/ConfusionMatrixHeatmap';
import MarketStatsPanel from './components/MarketStatsPanel';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [market, setMarket] = useState(null);
  const [candles, setCandles] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [evaluationStats, setEvaluationStats] = useState(null);
  const [performance, setPerformance] = useState(null);

  // Sync theme with document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchAllData = async () => {
    try {
      const [mRes, cRes, fRes, fhRes, evalRes, perfRes] = await Promise.all([
        fetch('/api/market/latest').then((r) => r.json()).catch(() => ({})),
        fetch('/api/market/candles?limit=120').then((r) => r.json()).catch(() => []),
        fetch('/api/forecast/latest').then((r) => r.json()).catch(() => null),
        fetch('/api/forecast/history?limit=50').then((r) => r.json()).catch(() => []),
        fetch('/api/evaluation/stats').then((r) => r.json()).catch(() => null),
        fetch('/api/performance').then((r) => r.json()).catch(() => null),
      ]);

      if (mRes && !mRes.error) setMarket(mRes);
      if (Array.isArray(cRes)) setCandles(cRes);
      if (fRes && !fRes.error) setForecast(fRes);
      if (Array.isArray(fhRes)) setForecastHistory(fhRes);
      if (evalRes && !evalRes.error) setEvaluationStats(evalRes);
      if (perfRes && !perfRes.error) setPerformance(perfRes);
    } catch (err) {
      console.error('Error fetching market and model data:', err);
    }
  };

  useEffect(() => {
    fetchAllData();

    let ws = null;
    let pollTimer = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/market`;
      try {
        ws = new WebSocket(wsUrl);
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
      } catch (e) {
        // Fallback to polling
      }
    };

    connectWebSocket();
    pollTimer = setInterval(fetchAllData, 10000);

    return () => {
      if (ws) ws.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  return (
    <div className="terminal-root">
      {/* Top Header Bar */}
      <MarketHeader
        market={market}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Terminal Workspace Layout */}
      <main className="terminal-workspace">
        {/* Upper Split: Candlestick Chart (Left) + Predictions & Log Table (Right) */}
        <section className="terminal-upper-row">
          <div className="upper-chart-col">
            <CandlestickChart
              candles={candles}
              forecast={forecast}
              market={market}
              theme={theme}
            />
          </div>

          <div className="upper-sidebar-col">
            <PredictionPanel
              forecast={forecast}
              market={market}
            />
            <ForecastLogTable
              history={forecastHistory}
            />
          </div>
        </section>

        {/* Lower Split: Confusion Matrix Heatmap (Left) + P&L, Regime & Quant Stats (Right) */}
        <section className="terminal-lower-row">
          <div className="lower-half-col">
            <ConfusionMatrixHeatmap
              stats={evaluationStats}
            />
          </div>

          <div className="lower-half-col">
            <MarketStatsPanel
              performance={performance}
              stats={evaluationStats}
              forecast={forecast}
            />
          </div>
        </section>
      </main>

      {/* Quiet compliance and disclosure footer */}
      <footer className="terminal-footer">
        <div className="footer-left">
          <span>Hypothetical quantitative simulation. Target instrument: S&amp;P 500 Cash Index (SPX).</span>
        </div>
        <div className="footer-right">
          <span>Quantitative forecast models and bracket order simulation</span>
        </div>
      </footer>
    </div>
  );
}
