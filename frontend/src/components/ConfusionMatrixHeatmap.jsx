import React, { useState } from 'react';

const MATRICES = {
  'Directional Model': {
    name: 'Directional Model',
    tag: 'Active Model',
    TP: 651,
    FN: 582,
    FP: 641,
    TN: 610,
    accuracy: 50.76,
    precision: 50.39,
    recall: 52.80,
    f1: 0.516,
    total: 2484,
    note: 'Directional classification across 2,484 out-of-sample 5-minute bars',
  },
  'RSI Benchmark': {
    name: 'RSI Benchmark',
    tag: 'Momentum Filter',
    TP: 634,
    FN: 599,
    FP: 640,
    TN: 611,
    accuracy: 50.12,
    precision: 49.76,
    recall: 51.42,
    f1: 0.506,
    total: 2484,
    note: 'Fixed RSI threshold mean-reversion benchmark',
  },
  'Trend Benchmark': {
    name: 'Trend Benchmark',
    tag: 'Moving Average',
    TP: 599,
    FN: 634,
    FP: 600,
    TN: 651,
    accuracy: 50.32,
    precision: 49.96,
    recall: 48.58,
    f1: 0.493,
    total: 2484,
    note: 'Fast and slow exponential moving average trend crossover',
  },
  'Momentum Benchmark': {
    name: 'Momentum Benchmark',
    tag: '3-bar Return',
    TP: 615,
    FN: 618,
    FP: 636,
    TN: 615,
    accuracy: 49.52,
    precision: 49.16,
    recall: 49.88,
    f1: 0.495,
    total: 2484,
    note: 'Short-horizon price momentum return indicator',
  },
  'MACD Benchmark': {
    name: 'MACD Benchmark',
    tag: 'Signal Line',
    TP: 551,
    FN: 682,
    FP: 585,
    TN: 666,
    accuracy: 48.99,
    precision: 48.50,
    recall: 44.69,
    f1: 0.465,
    total: 2484,
    note: 'Standard MACD histogram signal crossover',
  },
  'Unconditional Baseline': {
    name: 'Unconditional Baseline',
    tag: 'Base Rate',
    TP: 1233,
    FN: 0,
    FP: 1251,
    TN: 0,
    accuracy: 49.64,
    precision: 49.64,
    recall: 100.0,
    f1: 0.663,
    total: 2484,
    note: 'Unconditional upward market drift (49.64% baseline frequency)',
  },
};

const TOUCH_MATRIX = {
  name: 'Target Barrier (+3.0 pts)',
  tag: '30m Window',
  TP: 124,
  FN: 10,
  FP: 198,
  TN: 2152,
  accuracy: 91.63,
  precision: 38.51,
  recall: 92.54,
  f1: 0.544,
  total: 2484,
  note: 'Sensitivity catching +3.0 point upside runs within 6 bars',
};

export default function ConfusionMatrixHeatmap({ stats }) {
  const [activeModel, setActiveModel] = useState('Directional Model');
  const [matrixType, setMatrixType] = useState('direction');

  const current = matrixType === 'direction' ? (MATRICES[activeModel] || MATRICES['Directional Model']) : TOUCH_MATRIX;
  const total = current.total;

  const tpPct = ((current.TP / total) * 100).toFixed(1);
  const fnPct = ((current.FN / total) * 100).toFixed(1);
  const fpPct = ((current.FP / total) * 100).toFixed(1);
  const tnPct = ((current.TN / total) * 100).toFixed(1);

  return (
    <div className="panel-container heatmap-container">
      <div className="panel-headline">
        <h2 className="headline-title">Directional accuracy matrix</h2>

        <div className="matrix-type-toggle">
          <button
            type="button"
            onClick={() => setMatrixType('direction')}
            className={`matrix-toggle-btn ${matrixType === 'direction' ? 'active' : ''}`}
          >
            5m direction
          </button>
          <button
            type="button"
            onClick={() => setMatrixType('touch')}
            className={`matrix-toggle-btn ${matrixType === 'touch' ? 'active' : ''}`}
          >
            target barrier
          </button>
        </div>
      </div>

      {/* Model Benchmark Selector */}
      {matrixType === 'direction' && (
        <div className="model-selector-row">
          <span className="selector-label">Benchmark:</span>
          <div className="model-pills-wrap">
            {Object.keys(MATRICES).map((mName) => (
              <button
                key={mName}
                type="button"
                onClick={() => setActiveModel(mName)}
                className={`model-tab-btn ${activeModel === mName ? 'active' : ''}`}
              >
                {mName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flat Visual Heatmap 2x2 Grid */}
      <div className="heatmap-visual-box">
        <div className="heatmap-table-wrap">
          <div className="matrix-col-headers">
            <div className="axis-corner-label">actual \ predicted</div>
            <div className="axis-col-label">pred UP</div>
            <div className="axis-col-label">pred DOWN</div>
          </div>

          <div className="matrix-data-row">
            <div className="axis-row-label">act UP</div>
            <div className="heatmap-cell cell-tp">
              <span className="cell-type-tag">True Up</span>
              <span className="cell-count-big">{current.TP}</span>
              <span className="cell-pct-sub">{tpPct}% of test set</span>
            </div>
            <div className="heatmap-cell cell-fn">
              <span className="cell-type-tag">False Down</span>
              <span className="cell-count-big">{current.FN}</span>
              <span className="cell-pct-sub">{fnPct}% of test set</span>
            </div>
          </div>

          <div className="matrix-data-row">
            <div className="axis-row-label">act DOWN</div>
            <div className="heatmap-cell cell-fp">
              <span className="cell-type-tag">False Up</span>
              <span className="cell-count-big">{current.FP}</span>
              <span className="cell-pct-sub">{fpPct}% of test set</span>
            </div>
            <div className="heatmap-cell cell-tn">
              <span className="cell-type-tag">True Down</span>
              <span className="cell-count-big">{current.TN}</span>
              <span className="cell-pct-sub">{tnPct}% of test set</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="matrix-metrics-grid">
        <div className="metric-flat-cell">
          <span className="metric-card-label">accuracy</span>
          <span className="metric-card-val val-highlight">{current.accuracy.toFixed(2)}%</span>
          <span className="metric-card-sub">base: 49.64%</span>
        </div>

        <div className="metric-flat-cell">
          <span className="metric-card-label">precision</span>
          <span className="metric-card-val">{current.precision.toFixed(2)}%</span>
          <span className="metric-card-sub">precision rate</span>
        </div>

        <div className="metric-flat-cell">
          <span className="metric-card-label">recall</span>
          <span className="metric-card-val val-up">{current.recall.toFixed(1)}%</span>
          <span className="metric-card-sub">sensitivity</span>
        </div>

        <div className="metric-flat-cell">
          <span className="metric-card-label">f1 score</span>
          <span className="metric-card-val">{current.f1.toFixed(3)}</span>
          <span className="metric-card-sub">harmonic mean</span>
        </div>
      </div>

      <div className="matrix-footer-note">
        <span className="text-tag">{current.tag}</span>
        <span className="footer-desc">{current.note}</span>
      </div>
    </div>
  );
}
