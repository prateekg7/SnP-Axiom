import React, { useState, useEffect, useRef } from 'react';
import MarketHeader from './components/MarketHeader';
import CandlestickChart from './components/CandlestickChart';
import PredictionPanel from './components/PredictionPanel';
import ForecastLogTable from './components/ForecastLogTable';
import ConfusionMatrixCard from './components/ConfusionMatrixCard';
import MarketStatsPanel from './components/MarketStatsPanel';
import EquityDrawdownCard from './components/EquityDrawdownCard';
import MarketObservationsCard from './components/MarketObservationsCard';
import QuantRiskConeCard from './components/QuantRiskConeCard';
import StrategyEdgeCard from './components/StrategyEdgeCard';

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

  const lastHashesRef = useRef({
    market: '',
    candles: '',
    forecast: '',
    history: '',
    stats: '',
    performance: '',
  });

  const updateIfChanged = (key, value, setter) => {
    const hash = JSON.stringify(value);
    if (lastHashesRef.current[key] !== hash) {
      lastHashesRef.current[key] = hash;
      setter(value);
    }
  };

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
        fetch('/api/market/candles?limit=1500').then((r) => r.json()).catch(() => []),
        fetch('/api/forecast/latest').then((r) => r.json()).catch(() => null),
        fetch('/api/forecast/history?limit=50').then((r) => r.json()).catch(() => []),
        fetch('/api/evaluation/stats').then((r) => r.json()).catch(() => null),
        fetch('/api/performance').then((r) => r.json()).catch(() => null),
      ]);

      if (mRes && !mRes.error) updateIfChanged('market', mRes, setMarket);
      if (Array.isArray(cRes)) updateIfChanged('candles', cRes, setCandles);
      if (fRes && !fRes.error) updateIfChanged('forecast', fRes, setForecast);
      if (Array.isArray(fhRes)) updateIfChanged('history', fhRes, setForecastHistory);
      if (evalRes && !evalRes.error) updateIfChanged('stats', evalRes, setEvaluationStats);
      if (perfRes && !perfRes.error) updateIfChanged('performance', perfRes, setPerformance);
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
            if (data.type === 'tick') {
              if (data.market) updateIfChanged('market', data.market, setMarket);
              if (data.forecast) updateIfChanged('forecast', data.forecast, setForecast);
              if (data.performance) updateIfChanged('performance', data.performance, setPerformance);
              if (data.stats) updateIfChanged('stats', data.stats, setEvaluationStats);
              if (Array.isArray(data.history)) updateIfChanged('history', data.history, setForecastHistory);
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
        forecast={forecast}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Dashboard Bento Grid */}
      <main className="terminal-workspace">
        {/* Bento Zone 1: Live Price Action Hero (8 cols) + Predictive Signal Dial & Cone (4 cols) */}
        <section className="bento-zone bento-hero-zone">
          <div className="bento-card-slot bento-hero-chart">
            <CandlestickChart
              candles={candles}
              forecast={forecast}
              market={market}
              theme={theme}
            />
          </div>

          <div className="bento-card-slot bento-hero-signal">
            <PredictionPanel
              forecast={forecast}
              market={market}
            />
          </div>
        </section>

        {/* Bento Zone 2: Wide Performance & Confusion Track (7 cols, 2 cards) + Telemetry Rail (5 cols, 3 cards) */}
        <section className="bento-zone bento-core-zone">
          <div className="bento-col-stack bento-core-wide">
            <div className="bento-card-slot">
              <MarketStatsPanel
                performance={performance}
                stats={evaluationStats}
                forecast={forecast}
                history={forecastHistory}
              />
            </div>

            <div className="bento-card-grow">
              <ConfusionMatrixCard
                stats={evaluationStats}
              />
            </div>
          </div>

          <div className="bento-col-stack bento-core-rail">
            <div className="bento-card-slot">
              <ForecastLogTable
                history={forecastHistory}
              />
            </div>

            <div className="bento-card-slot">
              <MarketObservationsCard
                forecast={forecast}
                history={forecastHistory}
                market={market}
              />
            </div>

            <div className="bento-card-grow">
              <EquityDrawdownCard
                performance={performance}
              />
            </div>
          </div>
        </section>

        {/* Bento Zone 3: Quantitative Forward Tail Risk (6 cols) + Held-Out Strategy Edge (6 cols) */}
        <section className="bento-zone bento-lower-zone">
          <div className="bento-card-slot bento-half bento-card-grow">
            <QuantRiskConeCard
              forecast={forecast}
            />
          </div>

          <div className="bento-card-slot bento-half bento-card-grow">
            <StrategyEdgeCard
              stats={evaluationStats}
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
