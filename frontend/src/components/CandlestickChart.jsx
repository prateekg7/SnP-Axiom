import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';

const THEME_COLORS = {
  dark: {
    bgPaper: '#000000',
    gridColor: '#0a0a0a',
    textColor: '#555555',
    borderColor: '#181818',
    candleUp: '#089981',
    candleDown: '#f23645',
    bbUpper: '#ea3943',
    bbMiddle: '#2962ff',
    bbLower: '#089981',
    pathColor: '#a855f7',
    conformalColor: '#818cf8',
    volUp: '#08998126',
    volDown: '#f2364526',
  },
  light: {
    bgPaper: '#f7f4ed',
    gridColor: '#ede8dd',
    textColor: '#666055',
    borderColor: '#ded6c5',
    candleUp: '#089981',
    candleDown: '#f23645',
    bbUpper: '#ea3943',
    bbMiddle: '#2962ff',
    bbLower: '#089981',
    pathColor: '#9333ea',
    conformalColor: '#6366f1',
    volUp: '#08998120',
    volDown: '#f2364520',
  },
};

function computeBollingerBands(candles, period = 20, multiplier = 2) {
  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let k = 0; k < period; k++) {
      sum += candles[i - k].close;
    }
    const sma = sum / period;
    let sumSqDiff = 0;
    for (let k = 0; k < period; k++) {
      const diff = candles[i - k].close - sma;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / period);
    const upVal = sma + multiplier * stdDev;
    const lowVal = sma - multiplier * stdDev;
    const time = candles[i].time;

    middle.push({ time, value: parseFloat(sma.toFixed(2)) });
    upper.push({ time, value: parseFloat(upVal.toFixed(2)) });
    lower.push({ time, value: parseFloat(lowVal.toFixed(2)) });
  }

  return { upper, middle, lower };
}

export default function CandlestickChart({ candles, forecast, market, theme = 'dark' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const pathSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  const [showPredictions, setShowPredictions] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('5m');
  const [bbLatest, setBbLatest] = useState({ upper: 7418.55, middle: 7385.20, lower: 7352.10 });

  const colors = THEME_COLORS[theme] || THEME_COLORS.dark;

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: 480,
      layout: {
        background: { color: colors.bgPaper },
        textColor: colors.textColor,
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', monospace",
      },
      grid: {
        vertLines: { color: colors.gridColor, style: LineStyle.Dotted },
        horzLines: { color: colors.gridColor, style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: colors.textColor, width: 1, style: LineStyle.Dashed },
        horzLine: { color: colors.textColor, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
        autoScale: true,
        scaleMargins: {
          top: 0.12,
          bottom: 0.18,
        },
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 16,
        barSpacing: 9,
      },
    });

    // Volume overlay at top
    const volumeSeries = chart.addHistogramSeries({
      color: colors.textColor,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volumeTop',
    });
    chart.priceScale('volumeTop').applyOptions({
      scaleMargins: {
        top: 0.02,
        bottom: 0.82,
      },
    });

    // Bollinger Band Lines
    const bbUpperSeries = chart.addLineSeries({
      color: colors.bbUpper,
      lineWidth: 1,
      title: 'BB Upper',
      priceLineVisible: false,
    });
    const bbMiddleSeries = chart.addLineSeries({
      color: colors.bbMiddle,
      lineWidth: 1,
      title: 'BB 20 SMA',
      priceLineVisible: false,
    });
    const bbLowerSeries = chart.addLineSeries({
      color: colors.bbLower,
      lineWidth: 1,
      title: 'BB Lower',
      priceLineVisible: false,
    });

    // Main Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      borderVisible: false,
      wickUpColor: colors.candleUp,
      wickDownColor: colors.candleDown,
    });

    // Forecast Trajectory Path
    const pathSeries = chart.addLineSeries({
      color: colors.pathColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '30m Trajectory',
      priceLineVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
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

  // Update theme colors when mode toggles
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: {
        background: { color: colors.bgPaper },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
      timeScale: {
        borderColor: colors.borderColor,
      },
    });
  }, [theme, colors]);

  // Update candles, BB, volume, and predicting lines
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
          volume: c.volume || 1500000,
        });
      }
    }
    formatted.sort((a, b) => a.time - b.time);
    candleSeriesRef.current.setData(formatted);

    // Volume bars at top
    if (volumeSeriesRef.current) {
      const volData = formatted.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? colors.volUp : colors.volDown,
      }));
      volumeSeriesRef.current.setData(volData);
    }

    // Bollinger Bands
    if (showBB && formatted.length >= 20) {
      const { upper, middle, lower } = computeBollingerBands(formatted, 20, 2);
      bbUpperSeriesRef.current?.setData(upper);
      bbMiddleSeriesRef.current?.setData(middle);
      bbLowerSeriesRef.current?.setData(lower);

      if (upper.length > 0) {
        const lastUpper = upper[upper.length - 1].value;
        const lastMiddle = middle[middle.length - 1].value;
        const lastLower = lower[lower.length - 1].value;
        setBbLatest({ upper: lastUpper, middle: lastMiddle, lower: lastLower });
      }
    } else {
      bbUpperSeriesRef.current?.setData([]);
      bbMiddleSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
    }

    // Clear previous price line badges
    priceLinesRef.current.forEach((pl) => {
      try {
        candleSeriesRef.current?.removePriceLine(pl);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Right-scale indicator badges matching TradingView screenshot
    if (showBB && bbLatest.upper) {
      const upLine = candleSeriesRef.current.createPriceLine({
        price: bbLatest.upper,
        color: colors.bbUpper,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB Upper',
      });
      const midLine = candleSeriesRef.current.createPriceLine({
        price: bbLatest.middle,
        color: colors.bbMiddle,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB SMA',
      });
      const lowLine = candleSeriesRef.current.createPriceLine({
        price: bbLatest.lower,
        color: colors.bbLower,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB Lower',
      });
      priceLinesRef.current.push(upLine, midLine, lowLine);
    }

    // Predicting lines on graph
    if (showPredictions && forecast && formatted.length > 0) {
      const lastCandle = formatted[formatted.length - 1];
      const lastTime = lastCandle.time;

      if (forecast.path_30m && forecast.path_30m.length > 0) {
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

      // Conformal 90% prediction bounds as clean lines on the chart without axis clutter
      if (forecast.prediction_interval) {
        const bandUpper = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.upper,
          color: colors.conformalColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '90% Upper',
        });
        const bandLower = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.lower,
          color: colors.conformalColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '90% Lower',
        });
        priceLinesRef.current.push(bandUpper, bandLower);
      }
    } else {
      pathSeriesRef.current?.setData([]);
    }
  }, [candles, forecast, showPredictions, showBB, theme, colors, bbLatest.upper]);

  const timeframes = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

  return (
    <div className="chart-wrapper-panel">
      {/* Top chart indicator info bar */}
      <div className="chart-header-row">
        <div className="chart-tag-cluster">
          <div className="study-chip">
            <span className="study-title">BB 20 SMA close 2</span>
            <span className="bb-metric-tag badge-bb-upper">{bbLatest.upper.toFixed(2)}</span>
            <span className="bb-metric-tag badge-bb-middle">{bbLatest.middle.toFixed(2)}</span>
            <span className="bb-metric-tag badge-bb-lower">{bbLatest.lower.toFixed(2)}</span>
          </div>

          <div className="study-chip volume-chip">
            <span className="vol-title">Vol</span>
            <span className="vol-val">3.41B</span>
          </div>
        </div>

        <div className="chart-controls-group">
          <button
            type="button"
            onClick={() => setShowPredictions(!showPredictions)}
            className={`chart-tab-toggle ${showPredictions ? 'active' : ''}`}
            title="Toggle Forecast Trajectory and Bands"
          >
            <span>Forecast path</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBB(!showBB)}
            className={`chart-tab-toggle ${showBB ? 'active' : ''}`}
            title="Toggle Bollinger Bands"
          >
            <span>Bollinger Bands</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="chart-canvas-area" />

      {/* Bottom Toolbar matching TradingView */}
      <div className="chart-bottom-bar">
        <div className="timeframe-selector">
          {timeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setActiveTimeframe(tf)}
              className={`tf-button ${activeTimeframe === tf ? 'active' : ''}`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="tv-branding">
          <span className="tv-logo-mark">TradingView</span>
          <span className="tv-clock">21:47:48 UTC</span>
        </div>
      </div>
    </div>
  );
}
