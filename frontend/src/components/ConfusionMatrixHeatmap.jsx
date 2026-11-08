import React, { useState } from 'react';
import { Grid, BarChart2, CheckCircle2, AlertCircle } from 'lucide-react';

const MATRICES = {
  'AI Forecaster': {
    name: 'AI Forecaster',
    tag: 'LSTM Multi-task',
    TP: 651,
    FN: 582,
    FP: 641,
    TN: 610,
    accuracy: 50.76,
    precision: 50.39,
    recall: 52.80,
    f1: 0.516,
    total: 2484,
    note: 'Highest directional accuracy & recall across all baselines',
  },
  'RSI Baseline': {
    name: 'RSI Baseline',
    tag: 'RSI < 0.50',
    TP: 634,
    FN: 599,
    FP: 640,
    TN: 611,
    accuracy: 50.12,
    precision: 49.76,
    recall: 51.42,
    f1: 0.506,
    total: 2484,
    note: 'Secondary mean-reversion filter benchmark',
  },
  'MA Trend': {
    name: 'MA Trend',
    tag: 'Fast/Slow EMA',
    TP: 599,
    FN: 634,
    FP: 600,
    TN: 651,
    accuracy: 50.32,
    precision: 49.96,
    recall: 48.58,
    f1: 0.493,
    total: 2484,
    note: 'Trend-following moving average crossover',
  },
  'Momentum Baseline': {
    name: 'Momentum Baseline',
    tag: '3-bar return',
    TP: 615,
    FN: 618,
    FP: 636,
    TN: 615,
    accuracy: 49.52,
    precision: 49.16,
    recall: 49.88,
    f1: 0.495,
    total: 2484,
    note: 'Suffers severe whipsaw in intraday SPX chop',
  },
  'MACD Baseline': {
    name: 'MACD Baseline',
    tag: 'Histogram',
    TP: 551,
    FN: 682,
    FP: 585,
    TN: 666,
    accuracy: 48.99,
    precision: 48.50,
    recall: 44.69,
    f1: 0.465,
    total: 2484,
    note: 'Lags significantly on 5-minute cash index bars',
  },
  'Always-UP Baseline': {
    name: 'Always-UP Baseline',
    tag: 'Permabull',
    TP: 1233,
    FN: 0,
    FP: 1251,
    TN: 0,
    accuracy: 49.64,
    precision: 49.64,
    recall: 100.0,
    f1: 0.663,
    total: 2484,
    note: 'Theoretical base rate benchmark (49.64% UP bars)',
  },
};

const TOUCH_MATRIX = {
  name: 'Touch-UP (+3.0 pts Barrier)',
  tag: '30m Horizon',
  TP: 124,
  FN: 10,
  FP: 198,
  TN: 2152,
  accuracy: 91.63,
  precision: 38.51,
  recall: 92.54,
  f1: 0.544,
  total: 2484,
  note: '92.5% sensitivity catching intraday +3.0 pt rallies',
};

export default function ConfusionMatrixHeatmap({ stats }) {
  const [activeModel, setActiveModel] = useState('AI Forecaster');
  const [matrixType, setMatrixType] = useState('direction');

  const current = matrixType === 'direction' ? (MATRICES[activeModel] || MATRICES['AI Forecaster']) : TOUCH_MATRIX;
  const total = current.total;

  const tpPct = ((current.TP / total) * 100).toFixed(1);
  const fnPct = ((current.FN / total) * 100).toFixed(1);
  const fpPct = ((current.FP / total) * 100).toFixed(1);
  const tnPct = ((current.TN / total) * 100).toFixed(1);

  return (
    <div className="panel-container heatmap-container">
      <div className="panel-headline">
        <div className="headline-badge">
          <Grid size={14} className="icon-grid" />
          <h2 className="headline-title">Confusion matrix heatmap</h2>
        </div>

        <div className="matrix-type-toggle">
          <button
            type="button"
            onClick={() => setMatrixType('direction')}
            className={`matrix-toggle-btn ${matrixType === 'direction' ? 'active' : ''}`}
          >
            5m direction (up/down)
          </button>
          <button
            type="button"
            onClick={() => setMatrixType('touch')}
            className={`matrix-toggle-btn ${matrixType === 'touch' ? 'active' : ''}`}
          >
            touch-up (+3.0 pts)
          </button>
        </div>
      </div>

      {/* Model Benchmark Selector */}
      {matrixType === 'direction' && (
        <div className="model-selector-row">
          <span className="selector-label">Model:</span>
          <div className="model-pills-wrap">
            {Object.keys(MATRICES).map((mName) => (
              <button
                key={mName}
                type="button"
                onClick={() => setActiveModel(mName)}
                className={`model-pill-btn ${activeModel === mName ? 'active' : ''}`}
              >
                {mName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual Heatmap 2x2 Grid */}
      <div className="heatmap-visual-box">
        <div className="heatmap-table-wrap">
          {/* Top Column Labels */}
          <div className="matrix-col-headers">
            <div className="axis-corner-label">actual \ pred</div>
            <div className="axis-col-label">pred UP</div>
            <div className="axis-col-label">pred DOWN</div>
          </div>

          {/* Row 1: Actual UP */}
          <div className="matrix-data-row">
            <div className="axis-row-label">act UP</div>
            {/* TP Cell */}
            <div className="heatmap-cell cell-tp">
              <div className="cell-type-tag">TP (true up)</div>
              <div className="cell-count-big">{current.TP}</div>
              <div className="cell-pct-sub">{tpPct}% of test set</div>
            </div>
            {/* FN Cell */}
            <div className="heatmap-cell cell-fn">
              <div className="cell-type-tag">FN (missed up)</div>
              <div className="cell-count-big">{current.FN}</div>
              <div className="cell-pct-sub">{fnPct}% of test set</div>
            </div>
          </div>

          {/* Row 2: Actual DOWN */}
          <div className="matrix-data-row">
            <div className="axis-row-label">act DOWN</div>
            {/* FP Cell */}
            <div className="heatmap-cell cell-fp">
              <div className="cell-type-tag">FP (false up)</div>
              <div className="cell-count-big">{current.FP}</div>
              <div className="cell-pct-sub">{fpPct}% of test set</div>
            </div>
            {/* TN Cell */}
            <div className="heatmap-cell cell-tn">
              <div className="cell-type-tag">TN (true down)</div>
              <div className="cell-count-big">{current.TN}</div>
              <div className="cell-pct-sub">{tnPct}% of test set</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="matrix-metrics-grid">
        <div className="metric-pill-card">
          <span className="metric-card-label">accuracy</span>
          <span className="metric-card-val val-highlight">{current.accuracy.toFixed(2)}%</span>
          <span className="metric-card-sub">base: 49.64%</span>
        </div>

        <div className="metric-pill-card">
          <span className="metric-card-label">precision</span>
          <span className="metric-card-val">{current.precision.toFixed(2)}%</span>
          <span className="metric-card-sub">ppv score</span>
        </div>

        <div className="metric-pill-card">
          <span className="metric-card-label">recall</span>
          <span className="metric-card-val val-up">{current.recall.toFixed(1)}%</span>
          <span className="metric-card-sub">sensitivity</span>
        </div>

        <div className="metric-pill-card">
          <span className="metric-card-label">f1 score</span>
          <span className="metric-card-val">{current.f1.toFixed(3)}</span>
          <span className="metric-card-sub">harmonic mean</span>
        </div>
      </div>

      <div className="matrix-footer-note">
        <span className="footer-tag">{current.tag}</span>
        <span className="footer-desc">{current.note} (2,484 held-out test bars)</span>
      </div>
    </div>
  );
}
