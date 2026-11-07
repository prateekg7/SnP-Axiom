import React, { useEffect, useRef } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import { Activity, Layers } from 'lucide-react';

export default function CandlestickChart({ candles, forecast }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const pathSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 440,
      layout: {
        background: { color: '#161e2e' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: '#232e42', style: LineStyle.Dotted },
        horzLines: { color: '#232e42', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: '#475569', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#475569', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#232e42',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#232e42',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const pathSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: '30m Forecast Path',
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

    // Ensure sorted and unique timestamps
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

      // 30m Forecast Path points
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

      // Add Predicted High (green dashed line)
      if (forecast.predicted_high_30m) {
        const highLine = candleSeriesRef.current.createPriceLine({
          price: forecast.predicted_high_30m,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '30m Pred High',
        });
        priceLinesRef.current.push(highLine);
      }

      // Add Predicted Low (red dashed line)
      if (forecast.predicted_low_30m) {
        const lowLine = candleSeriesRef.current.createPriceLine({
          price: forecast.predicted_low_30m,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '30m Pred Low',
        });
        priceLinesRef.current.push(lowLine);
      }

      // Add Conformal Interval bounds (purple dotted lines)
      if (forecast.prediction_interval) {
        const upper = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.upper,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '90% Upper Band',
        });
        const lower = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.lower,
          color: '#a855f7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '90% Lower Band',
        });
        priceLinesRef.current.push(upper, lower);
      }
    }
  }, [candles, forecast]);

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={16} color="var(--accent-blue)" />
          <span>S&P 500 5-Minute Candlestick Chart & 30-Minute Projected Path</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', textTransform: 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#3b82f6' }}>
            <span style={{ width: 8, height: 2, background: '#3b82f6', display: 'inline-block' }}></span> 30m Path
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981' }}>
            <span style={{ width: 8, height: 2, background: '#10b981', display: 'inline-block' }}></span> Pred High
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444' }}>
            <span style={{ width: 8, height: 2, background: '#ef4444', display: 'inline-block' }}></span> Pred Low
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#a855f7' }}>
            <span style={{ width: 8, height: 2, background: '#a855f7', display: 'inline-block' }}></span> 90% Conformal Interval
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: '440px', borderRadius: '4px', overflow: 'hidden' }} />
    </div>
  );
}

