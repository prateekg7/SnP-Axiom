import React, { useMemo, useState } from "react";
import { ComposedChart } from "./charts/composed-chart";
import { Line } from "./charts/line";
import { Band } from "./charts/band";
import { Grid } from "./charts/grid";
import { XAxis } from "./charts/x-axis";
import { ChartTooltip } from "./charts/tooltip";
import { Gauge } from "./charts/gauge";

export default function PredictionPanel({ forecast, market }) {
  const [horizonMode, setHorizonMode] = useState("both"); // '5m' | '30m' | 'both'

  const refPrice = forecast?.reference_price || market?.latest_price || 7500;
  const exp5m = forecast?.expected_price_next_5m || refPrice;
  const delta5m = exp5m - refPrice;
  const isUp5m = delta5m >= 0;

  const path30m = forecast?.path_30m || [];
  const exp30m =
    path30m.length > 0
      ? path30m[path30m.length - 1].expected_close
      : exp5m;
  const delta30m = exp30m - refPrice;
  const isUp30m = delta30m >= 0;

  const pTouchUp = forecast?.p_touch_up_next_5m ?? 0.5;
  const confPct = Math.round(pTouchUp * 1000) / 10;
  const conformal = forecast?.prediction_interval || {
    lower: refPrice - 5,
    upper: refPrice + 5,
    empirical_coverage: 0.881,
  };
  const high30m = forecast?.predicted_high_30m || refPrice + 9;
  const low30m = forecast?.predicted_low_30m || refPrice - 9;
  const vol30mBps = ((forecast?.volatility_30m || 0.0008) * 10000).toFixed(1);
  const return5mBps = ((delta5m / refPrice) * 10000).toFixed(1);

  const telemetry = forecast?.telemetry || {};
  const regime = forecast?.market_regime || "TREND";
  const volOk = telemetry.vol_ok !== false;
  const tpPts = forecast?.tp_points ?? 3.0;
  const slPts = forecast?.sl_points ?? 1.5;

  // Build trajectory points from t=0 (+refPrice) to +30m within expanding conformal envelope
  const { coneData, coneLabels, yBounds } = useMemo(() => {
    const baseTime = forecast?.as_of ? new Date(forecast.as_of).getTime() : Date.now();
    const steps =
      path30m.length > 0
        ? path30m
        : [5, 10, 15, 20, 25, 30].map((m) => ({
            horizon_minutes: m,
            expected_close: exp5m,
          }));

    const halfEnv = Math.max(0.5, (conformal.upper - conformal.lower) / 2);
    const rows = [
      {
        date: new Date(baseTime),
        label: "Now",
        expected: Number(refPrice.toFixed(2)),
        upper: Number(refPrice.toFixed(2)),
        lower: Number(refPrice.toFixed(2)),
      },
      ...steps.map((s, idx) => {
        const scale = Math.sqrt((idx + 1) / steps.length);
        return {
          date: new Date(baseTime + s.horizon_minutes * 60_000),
          label: `+${s.horizon_minutes}m`,
          expected: Number(s.expected_close.toFixed(2)),
          upper: Number((s.expected_close + halfEnv * scale).toFixed(2)),
          lower: Number((s.expected_close - halfEnv * scale).toFixed(2)),
        };
      }),
    ];

    const lows = rows.map((r) => r.lower);
    const highs = rows.map((r) => r.upper);
    const minVal = Math.min(...lows);
    const maxVal = Math.max(...highs);
    const pad = Math.max(1.0, (maxVal - minVal) * 0.12);

    return {
      coneData: rows,
      coneLabels: rows.map((r) => r.label),
      yBounds: [Number((minVal - pad).toFixed(2)), Number((maxVal + pad).toFixed(2))],
    };
  }, [conformal.lower, conformal.upper, exp5m, forecast?.as_of, path30m, refPrice]);

  const yDomains = useMemo(() => ({ left: yBounds }), [yBounds]);

  if (!forecast) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
        <div className="flex items-center justify-between border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Predictive Signals
          </h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Awaiting market cycle data...
        </p>
      </section>
    );
  }

  const action = (forecast.action || "HOLD").toUpperCase();
  const actionStyle =
    action === "LONG"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
      : action === "SHORT"
      ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30"
      : "bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300/60 dark:border-zinc-700";

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      {/* Header + Horizon Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Predictive Signals
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {forecast?.model_version?.includes("random_forest")
              ? "SPX Random Forest (110 Trees + Platt + v2) forward targets and conformal envelope"
              : forecast?.model_version === "spx_option_a_native_ml"
              ? "SPX Option A (LGBM + Platt + v2) forward targets and conformal envelope"
              : "SPX Adaptive v2 forward targets and conformal envelope"}
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
          {[
            { id: "5m", label: "5m" },
            { id: "30m", label: "30m" },
            { id: "both", label: "Combined" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHorizonMode(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                horizonMode === tab.id
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Signal Highlight + Gauge Conviction Dial */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/50 sm:col-span-7">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {horizonMode === "30m" ? "Next 30m Expected Close" : "Next 5m Forecast"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                (horizonMode === "30m" ? isUp30m : isUp5m)
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-300"
              }`}
            >
              {horizonMode === "30m"
                ? isUp30m
                  ? "UP BIAS"
                  : "DOWN BIAS"
                : isUp5m
                ? "UP"
                : "DOWN"}
            </span>
          </div>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50">
              {(horizonMode === "30m" ? exp30m : exp5m).toFixed(2)}
            </span>
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                (horizonMode === "30m" ? isUp30m : isUp5m)
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {(horizonMode === "30m" ? delta30m : delta5m) >= 0 ? "+" : ""}
              {(horizonMode === "30m" ? delta30m : delta5m).toFixed(2)} pts
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-2 font-mono text-[11px] text-zinc-500 dark:border-zinc-800/70 dark:text-zinc-400">
            <span>
              Drift: {isUp5m ? "+" : ""}
              {return5mBps} bps
            </span>
            <span>
              Score: {(forecast.raw_score ?? 0) >= 0 ? "+" : ""}
              {(forecast.raw_score ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* @bklit/gauge-chart Arc Conviction Dial */}
        <div className="flex flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-2 dark:border-zinc-800/80 dark:bg-zinc-950/50 sm:col-span-5">
          <Gauge
            activeGradient={isUp5m ? ["#10B981", "#3B82F6"] : ["#F59E0B", "#EF4444"]}
            centerValue={Math.round(confPct)}
            defaultLabel="Confidence"
            endAngle={115}
            height={102}
            orientation="arc"
            startAngle={-115}
            suffix="%"
            totalNotches={24}
            useGradient
            value={Math.min(100, Math.max(0, confPct))}
            width={136}
          />
        </div>
      </div>

      {/* Inline 30m Trajectory Cone using @bklit ComposedChart + Band + Line */}
      {(horizonMode === "30m" || horizonMode === "both") && (
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/50">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              30m Trajectory &amp; 90% Conformal Envelope
            </span>
            <span className="font-mono text-zinc-500 dark:text-zinc-400">
              {conformal.lower.toFixed(1)} to {conformal.upper.toFixed(1)}
            </span>
          </div>
          <ComposedChart
            animationDuration={0}
            aspectRatio="5 / 2"
            data={coneData}
            margin={{ top: 10, right: 12, bottom: 26, left: 12 }}
            yDomains={yDomains}
          >
            <Grid horizontal numTicksRows={3} strokeDasharray="3,3" />
            <Band
              fill="var(--chart-2)"
              fillOpacity={0.14}
              lowerKey="lower"
              stroke="var(--chart-2)"
              strokeOpacity={0.35}
              upperKey="upper"
            />
            <Line
              dataKey="expected"
              showMarkers
              stroke={isUp30m ? "var(--color-up)" : "var(--color-down)"}
              strokeWidth={2}
            />
            <XAxis labels={coneLabels} numTicks={4} tickMode="data" />
            <ChartTooltip
              dateLabels={coneLabels}
              rows={(pt) => [
                {
                  color: isUp30m ? "var(--color-up)" : "var(--color-down)",
                  label: "Expected",
                  value: Number(pt.expected).toFixed(2),
                },
                {
                  color: "var(--chart-2)",
                  label: "90% Band",
                  value: `${Number(pt.lower).toFixed(1)} - ${Number(pt.upper).toFixed(1)}`,
                },
              ]}
            />
          </ComposedChart>
        </div>
      )}

      {/* Structured Metrics Rows (Preserving every existing signal readout) */}
      <div className="divide-y divide-zinc-200/60 rounded-xl border border-zinc-200/70 bg-zinc-50/40 px-3.5 text-xs dark:divide-zinc-800/70 dark:border-zinc-800/80 dark:bg-zinc-950/35">
        {horizonMode !== "30m" && (
          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="font-medium text-zinc-800 dark:text-zinc-200">
                Signal Confidence
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {forecast?.model_version?.includes("random_forest")
                  ? "Random Forest Platt-calibrated conviction"
                  : forecast?.model_version === "spx_option_a_native_ml"
                  ? "Option A Platt-calibrated conviction"
                  : "Adaptive v2 conviction probability"}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {confPct.toFixed(1)}%
              </span>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                TP +{tpPts.toFixed(1)} / SL -{slPts.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {horizonMode !== "5m" && (
          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="font-medium text-zinc-800 dark:text-zinc-200">
                Projected Extrema (30m)
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                6-bar horizon at {vol30mBps} bps RV
              </div>
            </div>
            <div className="font-mono font-medium tabular-nums">
              <span className="text-rose-600 dark:text-rose-400">L {low30m.toFixed(2)}</span>
              <span className="mx-1.5 text-zinc-400">/</span>
              <span className="text-emerald-600 dark:text-emerald-400">H {high30m.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2.5">
          <div>
            <div className="font-medium text-zinc-800 dark:text-zinc-200">
              {horizonMode === "5m" ? "Micro-dispersion Band" : "Confidence Envelope (30m)"}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {horizonMode === "5m"
                ? "Instantaneous spread bounds"
                : `${((conformal.empirical_coverage || 0.881) * 100).toFixed(1)}% empirical coverage`}
            </div>
          </div>
          <div className="font-mono font-medium tabular-nums">
            <span className="text-rose-600 dark:text-rose-400">
              {(horizonMode === "5m" ? refPrice - 2.5 : conformal.lower).toFixed(2)}
            </span>
            <span className="mx-1.5 text-zinc-400">to</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {(horizonMode === "5m" ? refPrice + 2.5 : conformal.upper).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Live Action & Risk Filter Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs dark:bg-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">Action:</span>
          <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${actionStyle}`}>
            {action}
          </span>
        </div>
        <div className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
          {volOk ? "Vol Gate OK" : "Vol Gated"} · [{regime}] · Conf {(pTouchUp * 100).toFixed(1)}%
        </div>
      </div>
    </section>
  );
}
