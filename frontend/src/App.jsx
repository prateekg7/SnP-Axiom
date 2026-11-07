import React, { useState, useEffect } from 'react';
import MarketHeader from './components/MarketHeader';
import DecisionBanner from './components/DecisionBanner';
import CandlestickChart from './components/CandlestickChart';
import ForecastPanel from './components/ForecastPanel';
import PerformancePanel from './components/PerformancePanel';
import TradeLog from './components/TradeLog';

export default function App() {
  const [market, setMarket] = useState(null);
  const [candles, setCandles] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [forecastHistory, setForecastHistory] = useState([]);
  const [trades, setTrades] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

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
    <div className="app-container">
      <MarketHeader market={market} isConnected={isConnected} />
      
      <DecisionBanner forecast={forecast} />

      <div className="dashboard-grid">
        <CandlestickChart candles={candles} forecast={forecast} />
        <ForecastPanel forecast={forecast} />
      </div>

      <div className="bottom-grid">
        <TradeLog forecastHistory={forecastHistory} trades={trades} />
        <PerformancePanel performance={performance} />
      </div>

      <footer style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
        <p>
          SPX AI Trading Indicator v1.0 <span className="hairline">/</span> Multi-Task LSTM and LightGBM Benchmark <span className="hairline">/</span> Conformal Prediction Calibration
        </p>
        <p style={{ marginTop: '0.25rem' }}>
          Hypothetical decision system for research and evaluation only. Not financial advice. No broker integration.
        </p>
      </footer>
    </div>
  );
}
