import React, { useEffect, useRef } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import { Activity } from 'lucide-react';

// Lightweight Charts 2D canvas parser requires hex or rgb color strings
const CHART_THEME = {
  bgPaper: '#141c16',
  inkMuted: '#688270',
  ruleColor: '#233327',
  accentGreen: '#3ee07f',
  downRed: '#e65750',
  pathBlue: '#5ba3e0',
  bandPurple: '#ba8de5',
};

export default function CandlestickChart({ candles, forecast }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const pathSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

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
        fontFamily: "'Martian Mono', monospace",
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
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_THEME.accentGreen,
      downColor: CHART_THEME.downRed,
      borderVisible: false,
      wickUpColor: CHART_THEME.accentGreen,
      wickDownColor: CHART_THEME.downRed,
    });

    const pathSeries = chart.addLineSeries({
      color: CHART_THEME.pathBlue,
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

  // Update candle data
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

    // Add forecast lines if available
    if (forecast && formatted.length > 0) {
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
      }

      if (forecast.predicted_high_30m) {
        const highLine = candleSeriesRef.current.createPriceLine({
          price: forecast.predicted_high_30m,
          color: CHART_THEME.accentGreen,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'pred high',
        });
        priceLinesRef.current.push(highLine);
      }

      if (forecast.predicted_low_30m) {
        const lowLine = candleSeriesRef.current.createPriceLine({
          price: forecast.predicted_low_30m,
          color: CHART_THEME.downRed,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'pred low',
        });
        priceLinesRef.current.push(lowLine);
      }

      if (forecast.prediction_interval) {
        const upper = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.upper,
          color: CHART_THEME.bandPurple,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '90% upper',
        });
        const lower = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.lower,
          color: CHART_THEME.bandPurple,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '90% lower',
        });
        priceLinesRef.current.push(upper, lower);
      }
    }
  }, [candles, forecast]);

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={16} color="var(--color-blue)" />
          <span>S&P 500 five-minute candles and projected path</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-blue)' }}>
            <span style={{ width: 8, height: 2, background: 'var(--color-blue)', display: 'inline-block' }}></span> 30m path
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-accent)' }}>
            <span style={{ width: 8, height: 2, background: 'var(--color-accent)', display: 'inline-block' }}></span> pred high
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-down)' }}>
            <span style={{ width: 8, height: 2, background: 'var(--color-down)', display: 'inline-block' }}></span> pred low
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-band)' }}>
            <span style={{ width: 8, height: 2, background: 'var(--color-band)', display: 'inline-block' }}></span> 90% band
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: '440px', overflow: 'hidden' }} />
    </div>
  );
}
