import React, { useMemo, useState } from "react";
import { BarChart } from "./charts/bar-chart";
import { Bar } from "./charts/bar";
import { BarXAxis } from "./charts/bar-x-axis";
import { Grid } from "./charts/grid";
import { ChartTooltip } from "./charts/tooltip";
import { RadarChart } from "./charts/radar-chart";
import { RadarGrid } from "./charts/radar-grid";
import { RadarAxis } from "./charts/radar-axis";
import { RadarLabels } from "./charts/radar-labels";
import { RadarArea } from "./charts/radar-area";

const MATRICES = {
  "Directional Model": {
    name: "Directional Model",
    tag: "Out-of-Sample Model",
    TP: 651,
    FN: 582,
    FP: 641,
    TN: 610,
    accuracy: 50.76,
    precision: 50.39,
    recall: 52.8,
    f1: 0.516,
    total: 2484,
    note: "Directional classification across 2,484 out-of-sample 5-minute bars",
  },
  "RSI Benchmark": {
    name: "RSI Benchmark",
    tag: "Momentum Filter",
    TP: 634,
    FN: 599,
    FP: 640,
    TN: 611,
    accuracy: 50.12,
    precision: 49.76,
    recall: 51.42,
    f1: 0.506,
    total: 2484,
    note: "Fixed RSI threshold mean-reversion benchmark",
  },
  "Trend Benchmark": {
    name: "Trend Benchmark",
    tag: "Moving Average",
    TP: 599,
    FN: 634,
    FP: 600,
    TN: 651,
    accuracy: 50.32,
    precision: 49.96,
    recall: 48.58,
    f1: 0.493,
    total: 2484,
    note: "Fast and slow exponential moving average trend crossover",
  },
  "Momentum Benchmark": {
    name: "Momentum Benchmark",
    tag: "3-bar Return",
    TP: 615,
    FN: 618,
    FP: 636,
    TN: 615,
    accuracy: 49.52,
    precision: 49.16,
    recall: 49.88,
    f1: 0.495,
    total: 2484,
    note: "Short-horizon price momentum return indicator",
  },
  "MACD Benchmark": {
    name: "MACD Benchmark",
    tag: "Signal Line",
    TP: 551,
    FN: 682,
    FP: 585,
    TN: 666,
    accuracy: 48.99,
    precision: 48.5,
    recall: 44.69,
    f1: 0.465,
    total: 2484,
    note: "Standard MACD histogram signal crossover",
  },
  "Unconditional Baseline": {
    name: "Unconditional Baseline",
    tag: "Base Rate",
    TP: 1233,
    FN: 0,
    FP: 1251,
    TN: 0,
    accuracy: 49.64,
    precision: 49.64,
    recall: 100.0,
    f1: 0.663,
    total: 2484,
    note: "Unconditional upward market drift (49.64% baseline frequency)",
  },
};

const TOUCH_MATRIX = {
  name: "Target Barrier (+3.0 pts)",
  tag: "30m Window",
  TP: 124,
  FN: 10,
  FP: 198,
  TN: 2152,
  accuracy: 91.63,
  precision: 38.51,
  recall: 92.54,
  f1: 0.544,
  total: 2484,
  note: "Sensitivity catching +3.0 point upside runs within 6 bars",
};

const RADAR_METRICS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall UP" },
  { key: "specificity", label: "Spec DOWN" },
  { key: "f1", label: "F1 Score" },
];

export default function ConfusionMatrixCard({ stats }) {
  const [activeModel, setActiveModel] = useState("Live Session");
  const [matrixType, setMatrixType] = useState("direction");

  const liveMatrix = stats?.live_directional_matrix || {
    name: "Live Session",
    tag: "Dynamic Session",
    TP: 0,
    FN: 0,
    FP: 0,
    TN: 0,
    accuracy: 0.0,
    precision: 0.0,
    recall: 0.0,
    f1: 0.0,
    total: 0,
    note: "0 completed bars evaluated in live session (+1 every 5 min)",
  };

  const dynamicMatrices = useMemo(
    () => ({
      "Live Session": liveMatrix,
      "Directional Model (Test Set)": MATRICES["Directional Model"],
      "RSI Benchmark": MATRICES["RSI Benchmark"],
      "Trend Benchmark": MATRICES["Trend Benchmark"],
      "Momentum Benchmark": MATRICES["Momentum Benchmark"],
      "MACD Benchmark": MATRICES["MACD Benchmark"],
      "Unconditional Baseline": MATRICES["Unconditional Baseline"],
    }),
    [liveMatrix]
  );

  const current =
    matrixType === "direction"
      ? dynamicMatrices[activeModel] || liveMatrix
      : TOUCH_MATRIX;

  const total = current.total || 0;
  const isLive = activeModel === "Live Session" && matrixType === "direction";

  const specificity =
    current.TN + current.FP > 0
      ? (current.TN / (current.TN + current.FP)) * 100
      : 0;

  const tpPct = total > 0 ? ((current.TP / total) * 100).toFixed(1) : "0.0";
  const fnPct = total > 0 ? ((current.FN / total) * 100).toFixed(1) : "0.0";
  const fpPct = total > 0 ? ((current.FP / total) * 100).toFixed(1) : "0.0";
  const tnPct = total > 0 ? ((current.TN / total) * 100).toFixed(1) : "0.0";
  const pctSub = isLive ? "% session" : "% test set";

  // 2x2 Actual vs Predicted BarChart decomposition
  const barMatrixData = useMemo(
    () => [
      {
        bucket: "TP · Hit UP",
        actualClass: "Actual UP",
        predClass: "Predicted UP",
        count: current.TP,
        sharePct: total > 0 ? Number(((current.TP / total) * 100).toFixed(1)) : 0,
        correct: current.TP,
        miss: 0,
      },
      {
        bucket: "FN · Miss UP",
        actualClass: "Actual UP",
        predClass: "Predicted DOWN",
        count: current.FN,
        sharePct: total > 0 ? Number(((current.FN / total) * 100).toFixed(1)) : 0,
        correct: 0,
        miss: current.FN,
      },
      {
        bucket: "FP · False UP",
        actualClass: "Actual DOWN",
        predClass: "Predicted UP",
        count: current.FP,
        sharePct: total > 0 ? Number(((current.FP / total) * 100).toFixed(1)) : 0,
        correct: 0,
        miss: current.FP,
      },
      {
        bucket: "TN · Hit DN",
        actualClass: "Actual DOWN",
        predClass: "Predicted DOWN",
        count: current.TN,
        sharePct: total > 0 ? Number(((current.TN / total) * 100).toFixed(1)) : 0,
        correct: current.TN,
        miss: 0,
      },
    ],
    [current, total]
  );

  // 5-axis skill polygon comparing selected model against 50% coin-flip baseline
  const radarData = useMemo(
    () => [
      {
        label: current.name || activeModel,
        color: "var(--chart-1)",
        values: {
          accuracy: Number((current.accuracy || 0).toFixed(1)),
          precision: Number((current.precision || 0).toFixed(1)),
          recall: Number((current.recall || 0).toFixed(1)),
          specificity: Number(specificity.toFixed(1)),
          f1: Number(((current.f1 || 0) * 100).toFixed(1)),
        },
      },
      {
        label: "50% Uninformed Walk",
        color: "var(--chart-2)",
        values: {
          accuracy: 50,
          precision: 50,
          recall: 50,
          specificity: 50,
          f1: 50,
        },
      },
    ],
    [activeModel, current, specificity]
  );

  // Detect any strong class-prediction skew to help trader interpret live bias
  const totalPredUp = (current.TP || 0) + (current.FP || 0);
  const totalPredDown = (current.TN || 0) + (current.FN || 0);
  const biasLabel =
    total === 0
      ? "Awaiting resolved bars"
      : totalPredUp / total > 0.72
      ? `Bull-skewed (${((totalPredUp / total) * 100).toFixed(0)}% UP calls)`
      : totalPredDown / total > 0.72
      ? `Bear-skewed (${((totalPredDown / total) * 100).toFixed(0)}% DOWN calls)`
      : `Balanced (${((totalPredUp / total) * 100).toFixed(0)}% UP / ${((totalPredDown / total) * 100).toFixed(0)}% DOWN)`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Directional Confusion Matrix
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {current.tag}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Actual vs. Predicted 2x2 breakdown and directional skill symmetry
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
          <button
            type="button"
            onClick={() => setMatrixType("direction")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              matrixType === "direction"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            5m Direction
          </button>
          <button
            type="button"
            onClick={() => setMatrixType("touch")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              matrixType === "touch"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Target Barrier (+3.0 pts)
          </button>
        </div>
      </div>

      {/* Model Benchmark Pills */}
      {matrixType === "direction" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.keys(dynamicMatrices).map((mName) => {
            const isSelected = activeModel === mName;
            const isLivePill = mName === "Live Session";
            return (
              <button
                key={mName}
                type="button"
                onClick={() => setActiveModel(mName)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {isLivePill && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
                {isLivePill ? "Live Session" : mName}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Chart Duo: Left = @bklit/bar-chart 2x2 Decomposition | Right = @bklit/radar-chart Skill Profile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/50 lg:col-span-7">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              2x2 Contingency Distribution (Counts)
            </span>
            <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {biasLabel}
            </span>
          </div>

          <div className="w-full">
            <BarChart
              animationDuration={0}
              aspectRatio="16 / 9"
              data={barMatrixData}
              margin={{ top: 18, right: 14, bottom: 34, left: 14 }}
              stacked
              xDataKey="bucket"
            >
              <Grid horizontal numTicksRows={4} strokeDasharray="3,3" />
              <Bar
                animate={false}
                dataKey="correct"
                fill="var(--color-up)"
                lineCap="round"
                showValue
                stroke="var(--color-up)"
                valueLabelFormatter={(v) => (v > 0 ? String(v) : "")}
              />
              <Bar
                animate={false}
                dataKey="miss"
                fill="var(--color-down)"
                lineCap="round"
                showValue
                stroke="var(--color-down)"
                valueLabelFormatter={(v) => (v > 0 ? String(v) : "")}
              />
              <BarXAxis showAllLabels tickerHalfWidth={42} />
              <ChartTooltip
                rows={(pt) => [
                  {
                    color: pt.correct > 0 ? "var(--color-up)" : "var(--color-down)",
                    label: `${pt.actualClass} · ${pt.predClass}`,
                    value: `${pt.count} bars (${pt.sharePct}%)`,
                  },
                ]}
                showCrosshair={false}
              />
            </BarChart>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/50 lg:col-span-5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Class Balance Radar
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
                Selected
              </span>
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" />
                50% Base
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <RadarChart
              data={radarData}
              levels={4}
              margin={46}
              metrics={RADAR_METRICS}
              size={228}
            >
              <RadarGrid showLabels={false} strokeOpacity={0.45} />
              <RadarAxis />
              <RadarLabels fontSize={10} offset={18} />
              <RadarArea index={1} showGlow={false} showPoints={false} />
              <RadarArea index={0} showGlow showPoints />
            </RadarChart>
          </div>
        </div>
      </div>

      {/* Exact 2x2 Quadrant Cells Readout */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <span>True Up (TP)</span>
            <span className="font-mono">Act UP</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
              {current.TP}
            </span>
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
              {tpPct}{pctSub}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 p-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-rose-700 dark:text-rose-300">
            <span>False Down (FN)</span>
            <span className="font-mono">Act UP</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
              {current.FN}
            </span>
            <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
              {fnPct}{pctSub}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <span>False Up (FP)</span>
            <span className="font-mono">Act DOWN</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
              {current.FP}
            </span>
            <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
              {fpPct}{pctSub}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 p-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-sky-700 dark:text-sky-300">
            <span>True Down (TN)</span>
            <span className="font-mono">Act DOWN</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-xl font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
              {current.TN}
            </span>
            <span className="font-mono text-xs text-sky-600 dark:text-sky-400">
              {tnPct}{pctSub}
            </span>
          </div>
        </div>
      </div>

      {/* Classification KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Accuracy</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {total > 0 ? `${(current.accuracy || 0).toFixed(2)}%` : "0.00%"}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {isLive ? `${total} bars` : "Base 49.64%"}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Precision</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {total > 0 ? `${(current.precision || 0).toFixed(2)}%` : "0.00%"}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">UP hit precision</div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Recall / Spec</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            {total > 0 ? `${(current.recall || 0).toFixed(1)}%` : "0.0%"}{" "}
            <span className="text-xs text-zinc-400">/ {specificity.toFixed(1)}%</span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">UP vs DOWN rate</div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">F1 Score</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {total > 0 ? (current.f1 || 0).toFixed(3) : "0.000"}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Harmonic mean</div>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isLive
          ? `${total} completed 5m bars evaluated in live session (+1 every 5 min).`
          : current.note}
      </p>
    </section>
  );
}
