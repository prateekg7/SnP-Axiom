import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

const THEME_COLORS = {
  dark: {
    bgPaper: '#000000',
    gridColor: '#222634',
    textColor: '#787b86',
    borderColor: '#262b38',
    candleUp: '#089981',
    candleDown: '#f23645',
    bbUpper: '#ea3943',
    bbMiddle: '#2962ff',
    bbLower: '#089981',
    ema9: '#06b6d4',
    ema21: '#f97316',
    ema50: '#a855f7',
    vwap: '#eab308',
    pathColor: '#a855f7',
    conformalColor: '#818cf8',
    volUp: '#08998126',
    volDown: '#f2364526',
  },
  light: {
    bgPaper: '#ffffff',
    gridColor: '#dbe0e8',
    textColor: '#64748b',
    borderColor: '#cbd2df',
    candleUp: '#089981',
    candleDown: '#f23645',
    bbUpper: '#ea3943',
    bbMiddle: '#2962ff',
    bbLower: '#089981',
    ema9: '#0891b2',
    ema21: '#ea580c',
    ema50: '#9333ea',
    vwap: '#ca8a04',
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

function computeEMA(candles, period) {
  if (!candles || candles.length < period) return [];
  const k = 2 / (period + 1);
  const out = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  out.push({ time: candles[period - 1].time, value: parseFloat(ema.toFixed(2)) });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: parseFloat(ema.toFixed(2)) });
  }
  return out;
}

function computeVWAP(candles) {
  if (!candles || candles.length === 0) return [];
  const out = [];
  let cumVol = 0;
  let cumPV = 0;
  let lastDay = null;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const dt = new Date(c.time * 1000);
    const day = dt.getUTCDate();

    // Reset cumulation on day transition
    if (lastDay !== null && day !== lastDay) {
      cumVol = 0;
      cumPV = 0;
    }
    lastDay = day;

    const vol = c.volume || 100000;
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumVol += vol;
    cumPV += typicalPrice * vol;

    const vwap = cumVol > 0 ? cumPV / cumVol : c.close;
    out.push({ time: c.time, value: parseFloat(vwap.toFixed(2)) });
  }
  return out;
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

function createForecastSeries(chart, type, colors, theme, basePrice = 7370) {
  if (type === 'bars') {
    return chart.addBarSeries({
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      openVisible: true,
      thinBars: false,
      title: '30m Proj Bars',
      priceLineVisible: false,
    });
  }
  if (type === 'area') {
    return chart.addAreaSeries({
      topColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.35)' : 'rgba(147, 51, 234, 0.22)',
      bottomColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.0)' : 'rgba(147, 51, 234, 0.01)',
      lineColor: colors.pathColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '30m Proj Area',
      priceLineVisible: false,
    });
  }
  if (type === 'baseline') {
    return chart.addBaselineSeries({
      baseValue: { type: 'price', price: basePrice },
      topLineColor: colors.candleUp,
      topFillColor1: theme === 'dark' ? 'rgba(8, 153, 129, 0.30)' : 'rgba(8, 153, 129, 0.18)',
      topFillColor2: 'rgba(8, 153, 129, 0.0)',
      bottomLineColor: colors.candleDown,
      bottomFillColor1: 'rgba(242, 54, 69, 0.0)',
      bottomFillColor2: theme === 'dark' ? 'rgba(242, 54, 69, 0.30)' : 'rgba(242, 54, 69, 0.18)',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '30m Proj Baseline',
      priceLineVisible: false,
    });
  }
  // Default: 'candles'
  return chart.addCandlestickSeries({
    upColor: theme === 'dark' ? 'rgba(8, 153, 129, 0.70)' : 'rgba(8, 153, 129, 0.65)',
    downColor: theme === 'dark' ? 'rgba(242, 54, 69, 0.70)' : 'rgba(242, 54, 69, 0.65)',
    borderVisible: true,
    borderUpColor: colors.candleUp,
    borderDownColor: colors.candleDown,
    wickUpColor: colors.candleUp,
    wickDownColor: colors.candleDown,
    title: '30m Proj Candles',
    priceLineVisible: false,
  });
}

function generateForecastCandles(forecast, lastCandle) {
  if (!forecast || !lastCandle) return { bars: [], points: [] };
  const lastTime = lastCandle.time;
  const refPrice = forecast.reference_price || lastCandle.close;

  let steps = [];
  if (forecast.path_30m && forecast.path_30m.length > 0) {
    steps = forecast.path_30m;
  } else if (forecast.expected_price_next_5m) {
    steps = [{ horizon_minutes: 5, expected_close: forecast.expected_price_next_5m }];
  }

  if (steps.length === 0) return { bars: [], points: [] };

  let prevClose = lastCandle.close;
  const bars = [];
  const points = [{ time: lastTime, value: lastCandle.close }];

  steps.forEach((pt) => {
    const stepTime = lastTime + pt.horizon_minutes * 60;
    const open = prevClose;
    const close = pt.expected_close;

    const bodyRange = Math.abs(close - open);
    const volWick = forecast.volatility_30m
      ? refPrice * (forecast.volatility_30m / Math.sqrt(6)) * 0.45
      : 0.40;
    const wickSpread = Math.max(bodyRange * 0.30, volWick, 0.35);

    let high = +(Math.max(open, close) + wickSpread).toFixed(2);
    let low = +(Math.min(open, close) - wickSpread).toFixed(2);

    if (forecast.predicted_high_30m) {
      high = Math.min(high, forecast.predicted_high_30m);
    }
    if (forecast.predicted_low_30m) {
      low = Math.max(low, forecast.predicted_low_30m);
    }
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);

    bars.push({
      time: stepTime,
      open,
      high,
      low,
      close,
    });

    points.push({
      time: stepTime,
      value: close,
    });

    prevClose = close;
  });

  return { bars, points };
}

export default function CandlestickChart({ candles, forecast, market, theme = 'dark' }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const forecastSeriesRef = useRef(null);
  const currentViewTypeRef = useRef('candles');
  const volumeSeriesRef = useRef(null);

  // Indicator series refs
  const bbUpperSeriesRef = useRef(null);
  const bbMiddleSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const vwapSeriesRef = useRef(null);

  const priceLinesRef = useRef([]);

  // States
  const [chartView, setChartView] = useState('candles'); // 'candles' | 'bars' | 'area' | 'baseline'
  const [forecastHorizon, setForecastHorizon] = useState('all'); // 'all' | '30m' | '5m' | 'off'
  const [indicators, setIndicators] = useState({
    bb: true,
    ema9: false,
    ema21: true,
    ema50: false,
    vwap: false,
  });
  const [activeTimeframe, setActiveTimeframe] = useState('1D');

  // Latest calculated indicator values for tags
  const [indicatorValues, setIndicatorValues] = useState({
    bbUpper: 7418.55,
    bbMiddle: 7385.20,
    bbLower: 7352.10,
    ema9: null,
    ema21: null,
    ema50: null,
    vwap: null,
  });

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
        fontFamily: "'Geist Mono', monospace",
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
      title: 'BB SMA',
      priceLineVisible: false,
    });
    const bbLowerSeries = chart.addLineSeries({
      color: colors.bbLower,
      lineWidth: 1,
      title: 'BB Lower',
      priceLineVisible: false,
    });

    // Traditional EMAs & VWAP Lines
    const ema9Series = chart.addLineSeries({
      color: colors.ema9,
      lineWidth: 1,
      title: 'EMA 9',
      priceLineVisible: false,
    });
    const ema21Series = chart.addLineSeries({
      color: colors.ema21,
      lineWidth: 1,
      title: 'EMA 21',
      priceLineVisible: false,
    });
    const ema50Series = chart.addLineSeries({
      color: colors.ema50,
      lineWidth: 1,
      title: 'EMA 50',
      priceLineVisible: false,
    });
    const vwapSeries = chart.addLineSeries({
      color: colors.vwap,
      lineWidth: 1,
      title: 'VWAP',
      priceLineVisible: false,
    });

    // Initial Main Price Series (Candles by default)
    const mainSeries = createMainSeries(chart, 'candles', colors, theme);
    // Initial 30m Forecast Series (matching view type)
    const forecastSeries = createForecastSeries(chart, 'candles', colors, theme);

    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;
    forecastSeriesRef.current = forecastSeries;
    currentViewTypeRef.current = 'candles';
    volumeSeriesRef.current = volumeSeries;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMiddleSeriesRef.current = bbMiddleSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
    ema9SeriesRef.current = ema9Series;
    ema21SeriesRef.current = ema21Series;
    ema50SeriesRef.current = ema50Series;
    vwapSeriesRef.current = vwapSeries;

    // Native ResizeObserver for reliable container-based responsiveness
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
        vertLines: { color: colors.gridColor, visible: true },
        horzLines: { color: colors.gridColor, visible: true },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
      timeScale: {
        borderColor: colors.borderColor,
      },
    });
  }, [theme, colors]);

  // Handle active timeframe range zoom
  const handleTimeframeChange = (tf) => {
    setActiveTimeframe(tf);
    if (!chartRef.current || !candles || candles.length === 0) return;
    const timeScale = chartRef.current.timeScale();
    const totalBars = candles.length;

    if (tf === '1D') {
      const barsCount = Math.min(totalBars, 78);
      timeScale.setVisibleLogicalRange({ from: totalBars - barsCount, to: totalBars + 6 });
    } else if (tf === '5D') {
      const barsCount = Math.min(totalBars, 390);
      timeScale.setVisibleLogicalRange({ from: totalBars - barsCount, to: totalBars + 12 });
    } else if (tf === '1M') {
      const barsCount = Math.min(totalBars, 1560);
      timeScale.setVisibleLogicalRange({ from: totalBars - barsCount, to: totalBars + 20 });
    } else {
      // 3M, 6M, YTD, 1Y, 5Y, All
      timeScale.fitContent();
    }
  };

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
      if (forecastSeriesRef.current) {
        try {
          chartRef.current.removeSeries(forecastSeriesRef.current);
        } catch (e) {}
      }

      mainSeriesRef.current = createMainSeries(chartRef.current, chartView, colors, theme, basePrice);
      forecastSeriesRef.current = createForecastSeries(chartRef.current, chartView, colors, theme, basePrice);
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

    // Calculate Traditional Indicators
    let lastBBUpper = 7418.55;
    let lastBBMid = 7385.20;
    let lastBBLow = 7352.10;
    let lastEMA9 = null;
    let lastEMA21 = null;
    let lastEMA50 = null;
    let lastVWAP = null;

    // 1. Bollinger Bands
    if (indicators.bb && formatted.length >= 20) {
      const { upper, middle, lower } = computeBollingerBands(formatted, 20, 2);
      bbUpperSeriesRef.current?.setData(upper);
      bbMiddleSeriesRef.current?.setData(middle);
      bbLowerSeriesRef.current?.setData(lower);

      if (upper.length > 0) {
        lastBBUpper = upper[upper.length - 1].value;
        lastBBMid = middle[middle.length - 1].value;
        lastBBLow = lower[lower.length - 1].value;
      }
    } else {
      bbUpperSeriesRef.current?.setData([]);
      bbMiddleSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
    }

    // 2. EMA 9
    if (indicators.ema9 && formatted.length >= 9) {
      const ema9Data = computeEMA(formatted, 9);
      ema9SeriesRef.current?.setData(ema9Data);
      if (ema9Data.length > 0) lastEMA9 = ema9Data[ema9Data.length - 1].value;
    } else {
      ema9SeriesRef.current?.setData([]);
    }

    // 3. EMA 21
    if (indicators.ema21 && formatted.length >= 21) {
      const ema21Data = computeEMA(formatted, 21);
      ema21SeriesRef.current?.setData(ema21Data);
      if (ema21Data.length > 0) lastEMA21 = ema21Data[ema21Data.length - 1].value;
    } else {
      ema21SeriesRef.current?.setData([]);
    }

    // 4. EMA 50
    if (indicators.ema50 && formatted.length >= 50) {
      const ema50Data = computeEMA(formatted, 50);
      ema50SeriesRef.current?.setData(ema50Data);
      if (ema50Data.length > 0) lastEMA50 = ema50Data[ema50Data.length - 1].value;
    } else {
      ema50SeriesRef.current?.setData([]);
    }

    // 5. VWAP
    if (indicators.vwap && formatted.length > 0) {
      const vwapData = computeVWAP(formatted);
      vwapSeriesRef.current?.setData(vwapData);
      if (vwapData.length > 0) lastVWAP = vwapData[vwapData.length - 1].value;
    } else {
      vwapSeriesRef.current?.setData([]);
    }

    setIndicatorValues({
      bbUpper: lastBBUpper,
      bbMiddle: lastBBMid,
      bbLower: lastBBLow,
      ema9: lastEMA9,
      ema21: lastEMA21,
      ema50: lastEMA50,
      vwap: lastVWAP,
    });

    // Reset indicator price line badges on main series
    priceLinesRef.current.forEach((pl) => {
      try {
        mainSeriesRef.current?.removePriceLine(pl);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Right-scale Bollinger Band indicator badges
    if (indicators.bb && mainSeriesRef.current) {
      const upLine = mainSeriesRef.current.createPriceLine({
        price: lastBBUpper,
        color: colors.bbUpper,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB Up',
      });
      const midLine = mainSeriesRef.current.createPriceLine({
        price: lastBBMid,
        color: colors.bbMiddle,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB SMA',
      });
      const lowLine = mainSeriesRef.current.createPriceLine({
        price: lastBBLow,
        color: colors.bbLower,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'BB Low',
      });
      priceLinesRef.current.push(upLine, midLine, lowLine);
    }

    // Right-scale EMA 21 badge
    if (indicators.ema21 && lastEMA21 && mainSeriesRef.current) {
      const emaLine = mainSeriesRef.current.createPriceLine({
        price: lastEMA21,
        color: colors.ema21,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'EMA 21',
      });
      priceLinesRef.current.push(emaLine);
    }

    // Right-scale VWAP badge
    if (indicators.vwap && lastVWAP && mainSeriesRef.current) {
      const vwapLine = mainSeriesRef.current.createPriceLine({
        price: lastVWAP,
        color: colors.vwap,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'VWAP',
      });
      priceLinesRef.current.push(vwapLine);
    }

    // Prediction Visualizations on Graph
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

      // 2. 30m Forward Projections (sequential 5m steps) matching selected view type
      if (forecastHorizon === '30m' || forecastHorizon === 'all') {
        const { bars, points } = generateForecastCandles(forecast, lastCandle);
        if (bars.length > 0) {
          if (chartView === 'candles' || chartView === 'bars') {
            forecastSeriesRef.current?.setData(bars);
          } else {
            forecastSeriesRef.current?.setData(points);
          }
        } else {
          forecastSeriesRef.current?.setData([]);
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
        forecastSeriesRef.current?.setData([]);
      }

      if (forecastHorizon === 'off') {
        forecastSeriesRef.current?.setData([]);
      }
    } else {
      forecastSeriesRef.current?.setData([]);
    }
  }, [candles, forecast, chartView, forecastHorizon, indicators, theme, colors]);

  const activeIndicatorCount = Object.values(indicators).filter(Boolean).length;
  const timeframes = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

  return (
    <div className="chart-wrapper-panel">
      {/* Top chart indicator tags and Shadcn Dropdown menus */}
      <div className="chart-header-row">
        <div className="chart-tag-cluster">
          {indicators.bb && (
            <div className="study-chip">
              <span className="study-title">BB 20 SMA</span>
              <span className="bb-metric-tag badge-bb-upper">{indicatorValues.bbUpper.toFixed(2)}</span>
              <span className="bb-metric-tag badge-bb-middle">{indicatorValues.bbMiddle.toFixed(2)}</span>
              <span className="bb-metric-tag badge-bb-lower">{indicatorValues.bbLower.toFixed(2)}</span>
            </div>
          )}

          {indicators.ema9 && indicatorValues.ema9 && (
            <div className="study-chip">
              <span className="study-title">EMA 9</span>
              <span className="bb-metric-tag badge-ema9">{indicatorValues.ema9.toFixed(2)}</span>
            </div>
          )}

          {indicators.ema21 && indicatorValues.ema21 && (
            <div className="study-chip">
              <span className="study-title">EMA 21</span>
              <span className="bb-metric-tag badge-ema21">{indicatorValues.ema21.toFixed(2)}</span>
            </div>
          )}

          {indicators.ema50 && indicatorValues.ema50 && (
            <div className="study-chip">
              <span className="study-title">EMA 50</span>
              <span className="bb-metric-tag badge-ema50">{indicatorValues.ema50.toFixed(2)}</span>
            </div>
          )}

          {indicators.vwap && indicatorValues.vwap && (
            <div className="study-chip">
              <span className="study-title">VWAP</span>
              <span className="bb-metric-tag badge-vwap">{indicatorValues.vwap.toFixed(2)}</span>
            </div>
          )}

          <div className="study-chip volume-chip">
            <span className="vol-title">Vol</span>
            <span className="vol-val">3.41B</span>
          </div>
        </div>

        {/* 3 Prominent Shadcn Dropdowns: View, Predictions, Indicators */}
        <div className="chart-controls-group">
          {/* Dropdown 1: View selection */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="shadcn-dropdown-trigger" title="Select Chart View">
                <span className="shadcn-trigger-label">View</span>
                <span className="shadcn-trigger-value">
                  {chartView === 'candles' && 'Candles'}
                  {chartView === 'bars' && 'OHLC Bars'}
                  {chartView === 'area' && 'Area Line'}
                  {chartView === 'baseline' && 'Baseline'}
                </span>
                <span className="shadcn-trigger-chevron">&#9662;</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Chart Price View</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setChartView('candles')}
                className={chartView === 'candles' ? 'active' : ''}
              >
                <span>Candles</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setChartView('bars')}
                className={chartView === 'bars' ? 'active' : ''}
              >
                <span>OHLC Bars</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setChartView('area')}
                className={chartView === 'area' ? 'active' : ''}
              >
                <span>Area Line</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setChartView('baseline')}
                className={chartView === 'baseline' ? 'active' : ''}
              >
                <span>Baseline</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dropdown 2: Predictions selection */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="shadcn-dropdown-trigger" title="Select Forecast Horizon">
                <span className="shadcn-trigger-label">Prediction</span>
                <span className="shadcn-trigger-value">
                  {forecastHorizon === 'all' && 'All (30m + 5m)'}
                  {forecastHorizon === '30m' && '30m Horizon'}
                  {forecastHorizon === '5m' && '5m Target'}
                  {forecastHorizon === 'off' && 'Off'}
                </span>
                <span className="shadcn-trigger-chevron">&#9662;</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Forecast Horizon</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setForecastHorizon('all')}
                className={forecastHorizon === 'all' ? 'active' : ''}
              >
                <span>All Projections (30m + 5m)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setForecastHorizon('30m')}
                className={forecastHorizon === '30m' ? 'active' : ''}
              >
                <span>30m Horizon (6 x 5m Steps) &amp; Envelope</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setForecastHorizon('5m')}
                className={forecastHorizon === '5m' ? 'active' : ''}
              >
                <span>5m Target Barrier Line</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setForecastHorizon('off')}
                className={forecastHorizon === 'off' ? 'active' : ''}
              >
                <span>Off (Hide Projections)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dropdown 3: Traditional Indicators selection */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="shadcn-dropdown-trigger" title="Toggle Traditional Indicators">
                <span className="shadcn-trigger-label">Indicators</span>
                <span className="shadcn-trigger-value">
                  {activeIndicatorCount > 0 ? `${activeIndicatorCount} Active` : 'None'}
                </span>
                <span className="shadcn-trigger-chevron">&#9662;</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Traditional Indicators</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={indicators.bb}
                onCheckedChange={(checked) =>
                  setIndicators((prev) => ({ ...prev, bb: Boolean(checked) }))
                }
              >
                Bollinger Bands (20, 2)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={indicators.ema9}
                onCheckedChange={(checked) =>
                  setIndicators((prev) => ({ ...prev, ema9: Boolean(checked) }))
                }
              >
                EMA 9 (Fast Trend)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={indicators.ema21}
                onCheckedChange={(checked) =>
                  setIndicators((prev) => ({ ...prev, ema21: Boolean(checked) }))
                }
              >
                EMA 21 (Medium Trend)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={indicators.ema50}
                onCheckedChange={(checked) =>
                  setIndicators((prev) => ({ ...prev, ema50: Boolean(checked) }))
                }
              >
                EMA 50 (Slow Baseline)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={indicators.vwap}
                onCheckedChange={(checked) =>
                  setIndicators((prev) => ({ ...prev, vwap: Boolean(checked) }))
                }
              >
                VWAP (Session Volume)
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setIndicators({
                    bb: false,
                    ema9: false,
                    ema21: false,
                    ema50: false,
                    vwap: false,
                  })
                }
              >
                <span>Clear All Indicators</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="chart-canvas-area" />

      {/* Bottom Toolbar with Working Larger Timeframe Buttons */}
      <div className="chart-bottom-bar">
        <div className="timeframe-selector">
          {timeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => handleTimeframeChange(tf)}
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
