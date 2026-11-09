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

function createMainSeries(chart, type, colors, theme, basePrice = 7370) {
  if (type === 'bars') {
    return chart.addBarSeries({
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      openVisible: true,
      thinBars: false,
    });
  }
  if (type === 'area') {
    return chart.addAreaSeries({
      topColor: theme === 'dark' ? 'rgba(41, 98, 255, 0.35)' : 'rgba(41, 98, 255, 0.20)',
      bottomColor: theme === 'dark' ? 'rgba(41, 98, 255, 0.0)' : 'rgba(41, 98, 255, 0.01)',
      lineColor: '#2962ff',
      lineWidth: 2,
      priceLineVisible: false,
    });
  }
  if (type === 'baseline') {
    return chart.addBaselineSeries({
      baseValue: { type: 'price', price: basePrice },
      topLineColor: colors.candleUp,
      topFillColor1: theme === 'dark' ? 'rgba(8, 153, 129, 0.25)' : 'rgba(8, 153, 129, 0.15)',
      topFillColor2: 'rgba(8, 153, 129, 0.0)',
      bottomLineColor: colors.candleDown,
      bottomFillColor1: 'rgba(242, 54, 69, 0.0)',
      bottomFillColor2: theme === 'dark' ? 'rgba(242, 54, 69, 0.25)' : 'rgba(242, 54, 69, 0.15)',
      lineWidth: 2,
      priceLineVisible: false,
    });
  }
  return chart.addCandlestickSeries({
    upColor: colors.candleUp,
    downColor: colors.candleDown,
    borderVisible: false,
    wickUpColor: colors.candleUp,
    wickDownColor: colors.candleDown,
  });
}

export default function CandlestickChart({ candles, forecast, market, theme = 'dark' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const currentViewTypeRef = useRef('candles');
  const volumeSeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const pathSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  const [chartView, setChartView] = useState('candles'); // 'candles' | 'bars' | 'area' | 'baseline'
  const [forecastHorizon, setForecastHorizon] = useState('all'); // '30m' | '5m' | 'all' | 'off'
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

    // Initial Main Price Series (Candles by default)
    const mainSeries = createMainSeries(chart, 'candles', colors, theme);

    // Forecast Trajectory Path Line (for 30m horizon)
    const pathSeries = chart.addLineSeries({
      color: colors.pathColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '30m Trajectory',
      priceLineVisible: false,
    });

    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;
    currentViewTypeRef.current = 'candles';
    volumeSeriesRef.current = volumeSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
    pathSeriesRef.current = pathSeries;

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const entry = entries[0];
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && chartRef.current) {
          chartRef.current.applyOptions({
            width: Math.floor(newWidth),
            height: newHeight > 0 ? Math.floor(newHeight) : 480,
          });
        }
      });
      resizeObserver.observe(container);
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 480,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
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

  // Update chart series, view types, indicators, and predictions
  useEffect(() => {
    if (!chartRef.current || !candles || candles.length === 0) return;

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

    // Switch main series type if requested view does not match current series
    const basePrice = formatted.length > 0 ? formatted[0].close : 7370;
    if (currentViewTypeRef.current !== chartView) {
      // Clear previous price lines attached to the old series
      priceLinesRef.current.forEach((pl) => {
        try {
          mainSeriesRef.current?.removePriceLine(pl);
        } catch (e) {}
      });
      priceLinesRef.current = [];

      if (mainSeriesRef.current) {
        try {
          chartRef.current.removeSeries(mainSeriesRef.current);
        } catch (e) {}
      }

      mainSeriesRef.current = createMainSeries(chartRef.current, chartView, colors, theme, basePrice);
      currentViewTypeRef.current = chartView;
    }

    // Set price data for the active view type
    if (chartView === 'candles' || chartView === 'bars') {
      mainSeriesRef.current?.setData(formatted);
    } else {
      mainSeriesRef.current?.setData(formatted.map((c) => ({ time: c.time, value: c.close })));
    }

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

    // Reset price line references on the current main series
    priceLinesRef.current.forEach((pl) => {
      try {
        mainSeriesRef.current?.removePriceLine(pl);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Right-scale Bollinger Band indicator badges
    if (showBB && bbLatest.upper && mainSeriesRef.current) {
      const upLine = mainSeriesRef.current.createPriceLine({
        price: bbLatest.upper,
        color: colors.bbUpper,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB Upper',
      });
      const midLine = mainSeriesRef.current.createPriceLine({
        price: bbLatest.middle,
        color: colors.bbMiddle,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB SMA',
      });
      const lowLine = mainSeriesRef.current.createPriceLine({
        price: bbLatest.lower,
        color: colors.bbLower,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB Lower',
      });
      priceLinesRef.current.push(upLine, midLine, lowLine);
    }

    // Prediction Visualizations on Graph (30m trajectory, 5m target, conformal intervals)
    if (forecast && formatted.length > 0 && mainSeriesRef.current) {
      const lastCandle = formatted[formatted.length - 1];
      const lastTime = lastCandle.time;
      const refPrice = forecast.reference_price || lastCandle.close;

      // 1. Single-step 5m target price line
      if ((forecastHorizon === '5m' || forecastHorizon === 'all') && forecast.expected_price_next_5m) {
        const delta5m = forecast.expected_price_next_5m - refPrice;
        const isUp5m = delta5m >= 0;
        const line5m = mainSeriesRef.current.createPriceLine({
          price: forecast.expected_price_next_5m,
          color: isUp5m ? colors.candleUp : colors.candleDown,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `5m: ${forecast.expected_price_next_5m.toFixed(2)}`,
        });
        priceLinesRef.current.push(line5m);
      }

      // 2. 30m Trajectory curve & 30m Conformal bounds
      if ((forecastHorizon === '30m' || forecastHorizon === 'all')) {
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

        // Conformal 90% predictive interval bounds
        if (forecast.prediction_interval) {
          const bandUpper = mainSeriesRef.current.createPriceLine({
            price: forecast.prediction_interval.upper,
            color: colors.conformalColor,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: '30m Env Up',
          });
          const bandLower = mainSeriesRef.current.createPriceLine({
            price: forecast.prediction_interval.lower,
            color: colors.conformalColor,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: '30m Env Low',
          });
          priceLinesRef.current.push(bandUpper, bandLower);
        }

        // 30m Projected High / Low extrema bounds
        if (forecast.predicted_high_30m && forecast.predicted_low_30m) {
          const highExtrema = mainSeriesRef.current.createPriceLine({
            price: forecast.predicted_high_30m,
            color: colors.bbUpper,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: '30m High',
          });
          const lowExtrema = mainSeriesRef.current.createPriceLine({
            price: forecast.predicted_low_30m,
            color: colors.bbLower,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: '30m Low',
          });
          priceLinesRef.current.push(highExtrema, lowExtrema);
        }
      } else {
        pathSeriesRef.current?.setData([]);
      }

      if (forecastHorizon === 'off') {
        pathSeriesRef.current?.setData([]);
      }
    } else {
      pathSeriesRef.current?.setData([]);
    }
  }, [candles, forecast, chartView, forecastHorizon, showBB, theme, colors, bbLatest.upper]);

  const timeframes = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

  return (
    <div className="chart-wrapper-panel">
      {/* Top chart indicator and view controls bar */}
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
          {/* Chart View selector: 4 views (Candles, Bars, Area, Baseline) */}
          <div className="chart-subgroup">
            <span className="chart-group-label">View:</span>
            <button
              type="button"
              onClick={() => setChartView('candles')}
              className={`chart-tab-toggle ${chartView === 'candles' ? 'active' : ''}`}
              title="Candlestick chart view"
            >
              <span>Candles</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView('bars')}
              className={`chart-tab-toggle ${chartView === 'bars' ? 'active' : ''}`}
              title="OHLC Bars chart view"
            >
              <span>Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView('area')}
              className={`chart-tab-toggle ${chartView === 'area' ? 'active' : ''}`}
              title="Area line chart view"
            >
              <span>Area</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView('baseline')}
              className={`chart-tab-toggle ${chartView === 'baseline' ? 'active' : ''}`}
              title="Baseline relative chart view"
            >
              <span>Baseline</span>
            </button>
          </div>

          {/* Forecast Horizon selector */}
          <div className="chart-subgroup">
            <span className="chart-group-label">Pred:</span>
            <button
              type="button"
              onClick={() => setForecastHorizon('30m')}
              className={`chart-tab-toggle ${forecastHorizon === '30m' ? 'active' : ''}`}
              title="30-minute forward trajectory and envelope"
            >
              <span>30m path</span>
            </button>
            <button
              type="button"
              onClick={() => setForecastHorizon('5m')}
              className={`chart-tab-toggle ${forecastHorizon === '5m' ? 'active' : ''}`}
              title="5-minute directional target line"
            >
              <span>5m target</span>
            </button>
            <button
              type="button"
              onClick={() => setForecastHorizon('all')}
              className={`chart-tab-toggle ${forecastHorizon === 'all' ? 'active' : ''}`}
              title="Both 5m target and 30m path"
            >
              <span>All</span>
            </button>
            <button
              type="button"
              onClick={() => setForecastHorizon('off')}
              className={`chart-tab-toggle ${forecastHorizon === 'off' ? 'active' : ''}`}
              title="Hide all forecast lines"
            >
              <span>Off</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBB(!showBB)}
            className={`chart-tab-toggle ${showBB ? 'active' : ''}`}
            title="Toggle Bollinger Bands"
          >
            <span>BB 20</span>
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
