import React, { useMemo, useState } from "react";
import { ComposedChart } from "./charts/composed-chart";
import { Band } from "./charts/band";
import { Line } from "./charts/line";
import { Grid } from "./charts/grid";
import { XAxis } from "./charts/x-axis";
import { YAxis } from "./charts/y-axis";
import { ChartTooltip } from "./charts/tooltip";
import { BarChart } from "./charts/bar-chart";
import { Bar } from "./charts/bar";
import { BarXAxis } from "./charts/bar-x-axis";

export default function QuantRiskConeCard({ forecast }) {
  const [tab, setTab] = useState("cone"); // 'cone' | 'barriers' | 'histogram'

  const refPrice = forecast?.reference_price ?? 7500;
  const quant = forecast?.quant || {};
  const path30m = forecast?.path_30m || [];
  const tpPts = forecast?.tp_points ?? 3.0;
  const slPts = forecast?.sl_points ?? 1.5;

  // Build 2,000-path GBM quantile fan + Adaptive v2 path
  const { coneData, coneLabels, yBounds } = useMemo(() => {
    const baseMs = forecast?.as_of ? new Date(forecast.as_of).getTime() : Date.now();
    const mcMed = quant.mc_median_path || [];
    const mcUp = quant.mc_upper_90 || [];
    const mcLow = quant.mc_lower_90 || [];

    const rows = [
      {
        date: new Date(baseMs),
        label: "Now",
        median: Number(refPrice.toFixed(2)),
        model: Number(refPrice.toFixed(2)),
        upper: Number(refPrice.toFixed(2)),
        lower: Number(refPrice.toFixed(2)),
        tpLevel: Number((refPrice + tpPts).toFixed(2)),
        slLevel: Number((refPrice - slPts).toFixed(2)),
      },
      ...[0, 1, 2, 3, 4, 5].map((i) => {
        const min = (i + 1) * 5;
        const modelStep = path30m[i]?.expected_close ?? refPrice;
        return {
          date: new Date(baseMs + min * 60_000),
          label: `+${min}m`,
          median: Number((mcMed[i] ?? modelStep).toFixed(2)),
          model: Number(modelStep.toFixed(2)),
          upper: Number((mcUp[i] ?? modelStep + tpPts * 0.8).toFixed(2)),
          lower: Number((mcLow[i] ?? modelStep - slPts * 1.4).toFixed(2)),
          tpLevel: Number((refPrice + tpPts).toFixed(2)),
          slLevel: Number((refPrice - slPts).toFixed(2)),
        };
      }),
    ];

    const allVals = rows.flatMap((r) => [r.lower, r.upper, r.tpLevel, r.slLevel, r.model]);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const pad = Math.max(1.5, (maxV - minV) * 0.08);

    return {
      coneData: rows,
      coneLabels: rows.map((r) => r.label),
      yBounds: [Number((minV - pad).toFixed(2)), Number((maxV + pad).toFixed(2))],
    };
  }, [forecast?.as_of, path30m, quant.mc_lower_90, quant.mc_median_path, quant.mc_upper_90, refPrice, slPts, tpPts]);

  const yDomains = useMemo(() => ({ left: yBounds }), [yBounds]);

  const termData = useMemo(() => {
    const raw = quant.barrier_term_structure || [
      { horizon: "5m", p_tp_pct: 5, p_sl_pct: 30, p_scalp_3pt_pct: 65 },
      { horizon: "10m", p_tp_pct: 17, p_sl_pct: 45, p_scalp_3pt_pct: 77 },
      { horizon: "15m", p_tp_pct: 28, p_sl_pct: 54, p_scalp_3pt_pct: 82 },
      { horizon: "30m", p_tp_pct: 45, p_sl_pct: 65, p_scalp_3pt_pct: 89 },
    ];
    return raw.map((r) => ({
      horizon: r.horizon,
      tpOdds: Number(r.p_tp_pct ?? 0),
      slOdds: Number(r.p_sl_pct ?? 0),
    }));
  }, [quant.barrier_term_structure]);

  const histogramData = useMemo(() => {
    const raw = quant.terminal_histogram || [
      { bucket: "<-10", pct: 8 },
      { bucket: "-10..-5", pct: 16 },
      { bucket: "-5..0", pct: 25 },
      { bucket: "0..+5", pct: 26 },
      { bucket: "+5..+10", pct: 17 },
      { bucket: ">+10", pct: 8 },
    ];
    return raw.map((b) => ({
      bucket: b.bucket,
      pct: Number(b.pct ?? 0),
      isNegative: b.isNegative,
    }));
  }, [quant.terminal_histogram]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Monte Carlo Risk Cone &amp; Barrier Odds
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            2,000-path GBM confidence corridor, tail risk (VaR/CVaR), and first-passage odds
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
          {[
            { id: "cone", label: "30m Cone" },
            { id: "barriers", label: "TP vs SL Odds" },
            { id: "histogram", label: "30m Tail Dist" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === item.id
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/50">
        {tab === "cone" && (
          <>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
                  {forecast?.model_version?.includes("random_forest")
                    ? "Random Forest ML Path"
                    : forecast?.model_version === "spx_option_a_native_ml"
                    ? "Option A ML Path"
                    : "Adaptive v2 Path"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" />
                  MC 10th-90th Band
                </span>
              </div>
              <span className="font-mono text-zinc-500 dark:text-zinc-400">
                Active Bracket +{tpPts.toFixed(1)} / -{slPts.toFixed(1)} pts
              </span>
            </div>

            <ComposedChart
              animationDuration={0}
              aspectRatio="12 / 5"
              data={coneData}
              margin={{ top: 14, right: 16, bottom: 30, left: 46 }}
              yDomains={yDomains}
            >
              <Grid horizontal numTicksRows={4} strokeDasharray="3,3" />
              <Band
                fill="var(--chart-2)"
                fillOpacity={0.16}
                lowerKey="lower"
                stroke="var(--chart-2)"
                strokeOpacity={0.4}
                upperKey="upper"
              />
              <Line
                dataKey="tpLevel"
                stroke="var(--color-up)"
                strokeDasharray="4,4"
                strokeOpacity={0.65}
                strokeWidth={1.2}
              />
              <Line
                dataKey="slLevel"
                stroke="var(--color-down)"
                strokeDasharray="4,4"
                strokeOpacity={0.65}
                strokeWidth={1.2}
              />
              <Line dataKey="median" stroke="var(--chart-3)" strokeWidth={1.6} />
              <Line
                dataKey="model"
                showMarkers
                stroke="var(--chart-1)"
                strokeWidth={2.5}
              />
              <YAxis formatLargeNumbers={false} formatValue={(v) => v.toFixed(0)} numTicks={4} />
              <XAxis labels={coneLabels} numTicks={7} tickMode="data" />
              <ChartTooltip
                dateLabels={coneLabels}
                rows={(pt) => [
                  { color: "var(--chart-1)", label: "Model Path", value: Number(pt.model).toFixed(2) },
                  { color: "var(--chart-3)", label: "MC Median", value: Number(pt.median).toFixed(2) },
                  {
                    color: "var(--chart-2)",
                    label: "MC p10-p90",
                    value: `${Number(pt.lower).toFixed(1)} - ${Number(pt.upper).toFixed(1)}`,
                  },
                ]}
              />
            </ComposedChart>
          </>
        )}

        {tab === "barriers" && (
          <BarChart
            animationDuration={0}
            aspectRatio="12 / 5"
            data={termData}
            margin={{ top: 18, right: 16, bottom: 32, left: 16 }}
            xDataKey="horizon"
          >
            <Grid horizontal numTicksRows={4} strokeDasharray="3,3" />
            <Bar
              dataKey="tpOdds"
              fill="var(--color-up)"
              lineCap="round"
              showValue
              stroke="var(--color-up)"
              valueLabelFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <Bar
              dataKey="slOdds"
              fill="var(--color-down)"
              lineCap="round"
              showValue
              stroke="var(--color-down)"
              valueLabelFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <BarXAxis showAllLabels tickerHalfWidth={45} />
            <ChartTooltip
              rows={(pt) => [
                {
                  color: "var(--color-up)",
                  label: `+${tpPts.toFixed(1)} pt TP Touch`,
                  value: `${pt.tpOdds.toFixed(1)}%`,
                },
                {
                  color: "var(--color-down)",
                  label: `-${slPts.toFixed(1)} pt SL Touch`,
                  value: `${pt.slOdds.toFixed(1)}%`,
                },
              ]}
              showCrosshair={false}
            />
          </BarChart>
        )}

        {tab === "histogram" && (
          <BarChart
            animationDuration={0}
            aspectRatio="12 / 5"
            data={histogramData}
            margin={{ top: 18, right: 16, bottom: 32, left: 16 }}
            xDataKey="bucket"
          >
            <Grid horizontal numTicksRows={4} strokeDasharray="3,3" />
            <Bar
              dataKey="pct"
              fill="var(--chart-2)"
              lineCap="round"
              showValue
              stroke="var(--chart-2)"
              valueLabelFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <BarXAxis showAllLabels tickerHalfWidth={55} />
            <ChartTooltip
              rows={(pt) => [
                {
                  color: pt.isNegative ? "var(--color-down)" : "var(--color-up)",
                  label: `30m Move ${pt.bucket} pts`,
                  value: `${pt.pct.toFixed(1)}% prob`,
                },
              ]}
              showCrosshair={false}
            />
          </BarChart>
        )}
      </div>

      {/* Tail Risk KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">95% VaR (30m)</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-rose-600 tabular-nums dark:text-rose-400">
            {Number(quant.var_95_pts ?? 0).toFixed(2)} pts
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            -{Math.abs(Number(quant.var_95_pct ?? 0)).toFixed(2)}% index move
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">95% CVaR Tail</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-rose-600 tabular-nums dark:text-rose-400">
            {Number(quant.cvar_95_pts ?? 0).toFixed(2)} pts
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Expected shortfall</div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">MC Expected Range</div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {quant.mc_expected_min_low ? quant.mc_expected_min_low.toFixed(1) : "--"} /{" "}
            {quant.mc_expected_max_high ? quant.mc_expected_max_high.toFixed(1) : "--"}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Mean path min/max</div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Bracket Reward/Risk</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            {(tpPts / Math.max(0.1, slPts)).toFixed(2)} : 1
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            +{tpPts.toFixed(1)} TP / -{slPts.toFixed(1)} SL pts
          </div>
        </div>
      </div>
    </section>
  );
}

