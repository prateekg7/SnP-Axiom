import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import { Activity } from 'lucide-react';

// Lightweight Charts 2D canvas parser requires hex color strings
const CHART_THEME = {
  bgPaper: '#0e131f',
  inkMuted: '#7988a3',
  ruleColor: '#1d273b',
  candleUp: '#2dd4bf',
  candleDown: '#fb7185',
  pathAzure: '#38bdf8',
  highUp: '#34d399',
  lowDown: '#f87171',
  bandLavender: '#c084fc',
};

export default function CandlestickChart({ candles, forecast }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const pathSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  const [showPath, setShowPath] = useState(true);
  const [showExtrema, setShowExtrema] = useState(true);
  const [showBands, setShowBands] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const containerWidth = chartContainerRef.current.clientWidth || 800;

    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: 440,
      layout: {
        background: { color: CHART_THEME.bgPaper },
        textColor: CHART_THEME.inkMuted,
        fontSize: 12,
        fontFamily: "'Mona Sans', ui-sans-serif, sans-serif",
      },
      grid: {
        vertLines: { color: CHART_THEME.ruleColor, style: LineStyle.Dotted },
        horzLines: { color: CHART_THEME.ruleColor, style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: CHART_THEME.inkMuted, width: 1, style: LineStyle.Dashed },
        horzLine: { color: CHART_THEME.inkMuted, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: CHART_THEME.ruleColor,
        autoScale: true,
      },
      timeScale: {
        borderColor: CHART_THEME.ruleColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 14,
        barSpacing: 9,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_THEME.candleUp,
      downColor: CHART_THEME.candleDown,
      borderVisible: false,
      wickUpColor: CHART_THEME.candleUp,
      wickDownColor: CHART_THEME.candleDown,
    });

    const pathSeries = chart.addLineSeries({
      color: CHART_THEME.pathAzure,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '30m trajectory',
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    pathSeriesRef.current = pathSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update candle data and forecast overlay
  useEffect(() => {
    if (!candleSeriesRef.current || !candles || candles.length === 0) return;

    const formatted = [];
    const seen = new Set();
    for (const c of candles) {
      if (!seen.has(c.time)) {
        seen.add(c.time);
        formatted.push({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
      }
    }
    formatted.sort((a, b) => a.time - b.time);
    candleSeriesRef.current.setData(formatted);

    // Clear old price lines
    priceLinesRef.current.forEach((pl) => {
      try {
        candleSeriesRef.current.removePriceLine(pl);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Add forecast trajectory path
    if (forecast && formatted.length > 0) {
      const lastCandle = formatted[formatted.length - 1];
      const lastTime = lastCandle.time;

      if (showPath && forecast.path_30m && forecast.path_30m.length > 0) {
        const pathData = [{ time: lastTime, value: lastCandle.close }];
        forecast.path_30m.forEach((pt) => {
          pathData.push({
            time: lastTime + pt.horizon_minutes * 60,
            value: pt.expected_close,
          });
        });
        pathSeriesRef.current?.setData(pathData);
      } else {
        pathSeriesRef.current?.setData([]);
      }

      if (showExtrema && forecast.predicted_high_30m) {
        const highLine = candleSeriesRef.current.createPriceLine({
          price: forecast.predicted_high_30m,
          color: CHART_THEME.highUp,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '30m high',
        });
        priceLinesRef.current.push(highLine);
      }

      if (showExtrema && forecast.predicted_low_30m) {
        const lowLine = candleSeriesRef.current.createPriceLine({
          price: forecast.predicted_low_30m,
          color: CHART_THEME.lowDown,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '30m low',
        });
        priceLinesRef.current.push(lowLine);
      }

      if (showBands && forecast.prediction_interval) {
        const upper = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.upper,
          color: CHART_THEME.bandLavender,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '90% upper',
        });
        const lower = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.lower,
          color: CHART_THEME.bandLavender,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '90% lower',
        });
        priceLinesRef.current.push(upper, lower);
      }
    }
  }, [candles, forecast, showPath, showExtrema, showBands]);

  return (
    <div className="card">
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <Activity size={16} color="var(--color-blue)" />
          <span>S&P 500 five-minute candles and projected path</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' }}>
          <button
            type="button"
            onClick={() => setShowPath(!showPath)}
            className={`pill-btn ${showPath ? 'active' : ''}`}
          >
            30m path
          </button>
          <button
            type="button"
            onClick={() => setShowExtrema(!showExtrema)}
            className={`pill-btn ${showExtrema ? 'active' : ''}`}
          >
            extrema
          </button>
          <button
            type="button"
            onClick={() => setShowBands(!showBands)}
            className={`pill-btn ${showBands ? 'active' : ''}`}
          >
            90% interval
          </button>
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: '440px', overflow: 'hidden' }} />
    </div>
  );
}