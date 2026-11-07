import React, { useEffect, useRef } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import { Activity } from 'lucide-react';

export default function CandlestickChart({ candles, forecast }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const pathSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Read computed tokens for chart canvas
    const styles = getComputedStyle(document.documentElement);
    const bgPaper = styles.getPropertyValue('--color-paper-2').trim() || '#131b15';
    const inkMuted = styles.getPropertyValue('--color-muted').trim() || '#6e8574';
    const ruleColor = styles.getPropertyValue('--color-rule').trim() || '#223326';
    const accentGreen = styles.getPropertyValue('--color-accent').trim() || '#47e584';
    const downRed = styles.getPropertyValue('--color-down').trim() || '#e85c54';
    const pathBlue = styles.getPropertyValue('--color-blue').trim() || '#5ba3e0';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 440,
      layout: {
        background: { color: bgPaper },
        textColor: inkMuted,
        fontSize: 12,
        fontFamily: "'Martian Mono', monospace",
      },
      grid: {
        vertLines: { color: ruleColor, style: LineStyle.Dotted },
        horzLines: { color: ruleColor, style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: inkMuted, width: 1, style: LineStyle.Dashed },
        horzLine: { color: inkMuted, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: ruleColor,
        autoScale: true,
      },
      timeScale: {
        borderColor: ruleColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: accentGreen,
      downColor: downRed,
      borderVisible: false,
      wickUpColor: accentGreen,
      wickDownColor: downRed,
    });

    const pathSeries = chart.addLineSeries({
      color: pathBlue,
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

    const styles = getComputedStyle(document.documentElement);
    const accentGreen = styles.getPropertyValue('--color-accent').trim() || '#47e584';
    const downRed = styles.getPropertyValue('--color-down').trim() || '#e85c54';
    const bandPurple = styles.getPropertyValue('--color-band').trim() || '#b58ae0';

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
          color: accentGreen,
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
          color: downRed,
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
          color: bandPurple,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: '90% upper',
        });
        const lower = candleSeriesRef.current.createPriceLine({
          price: forecast.prediction_interval.lower,
          color: bandPurple,
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
