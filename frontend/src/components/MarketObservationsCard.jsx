import React, { useMemo } from "react";
import { ComposedChart } from "./charts/composed-chart";
import { Area } from "./charts/area";
import { ProfitLossLine } from "./charts/profit-loss-line";
import { Grid } from "./charts/grid";
import { XAxis } from "./charts/x-axis";
import { YAxis } from "./charts/y-axis";
import { ChartTooltip } from "./charts/tooltip";

function formatEtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export default function MarketObservationsCard({ forecast, history = [], market }) {
  const telemetry = forecast?.telemetry || {};
  const spot = forecast?.reference_price || market?.latest_price || 7500;

  const { chartData, labels, rvCeiling } = useMemo(() => {
    const raw = (history || []).slice(-32);
    const items =
      raw.length >= 2
        ? raw
        : (() => {
            const latestItem = forecast || {
              as_of: new Date().toISOString(),
              raw_score: 0,
              volatility_30m: 0.0007,
              market_regime: "RANGE",
            };
            const endMs = latestItem.as_of
              ? new Date(latestItem.as_of).getTime()
              : Date.now();
            return [
              {
                ...latestItem,
                as_of: new Date(endMs - 300_000).toISOString(),
              },
              {
                ...latestItem,
                as_of: new Date(endMs).toISOString(),
              },
            ];
          })();

    const mapped = items.map((item, idx) => ({
      date: item.as_of ? new Date(item.as_of) : new Date(idx * 300_000),
      label: formatEtTime(item.as_of) || `B${idx}`,
      score: Number((item.raw_score ?? 0).toFixed(2)),
      rvBps: Number(((item.volatility_30m || 0.0007) * 10000).toFixed(1)),
      regime: item.market_regime || "RANGE",
    }));

    const maxRv = Math.max(12, ...mapped.map((m) => m.rvBps));
    return {
      chartData: mapped,
      labels: mapped.map((m) => m.label),
      rvCeiling: Math.ceil(maxRv * 1.45),
    };
  }, [forecast, history]);

  const yDomains = useMemo(
    () => ({
      left: [-6, 6],
      right: [0, rvCeiling],
    }),
    [rvCeiling]
  );

  // Institutional level calculations for trader observations
  const vwap = telemetry.vwap;
  const vwapDistPts = telemetry.vwap_dist_pts;
  const vwapDistAtr = telemetry.vwap_dist_atr;
  const orReady = telemetry.or_ready;
  const orHigh = telemetry.or_high;
  const orLow = telemetry.or_low;
  const pdh = telemetry.pdh;
  const pdl = telemetry.pdl;
  const adx = telemetry.adx;
  const plusDi = telemetry.plus_di;
  const minusDi = telemetry.minus_di;
  const volRatio = telemetry.vol_ratio;
  const atrPts = telemetry.atr_pts;
  const rsi14 = telemetry.rsi_14;
  const ema9 = telemetry.ema9;
  const ema21 = telemetry.ema21;
  const ema50 = telemetry.ema50;

  const emaStack =
    ema9 && ema21 && ema50
      ? ema9 > ema21 && ema21 > ema50
        ? "Bullish Alignment (9 > 21 > 50)"
        : ema9 < ema21 && ema21 < ema50
        ? "Bearish Alignment (9 < 21 < 50)"
        : "Mixed Transition Stack"
      : "Awaiting EMA convergence";

  const vwapState =
    vwapDistAtr === undefined
      ? "Calibrating"
      : Math.abs(vwapDistAtr) >= 1.35
      ? vwapDistAtr > 0
        ? "Overextended Above VWAP (Fade Risk)"
        : "Overextended Below VWAP (Snapback Risk)"
      : vwapDistAtr >= 0
      ? "Constructive Above Session VWAP"
      : "Heavy Below Session VWAP";

  const orState = !orReady
    ? "Forming 09:30-10:00 ET Opening Range"
    : spot > orHigh
    ? `Breakout Above OR High (+${(spot - orHigh).toFixed(2)} pts)`
    : spot < orLow
    ? `Breakdown Below OR Low (-${(orLow - spot).toFixed(2)} pts)`
    : `Inside OR (${(orHigh - spot).toFixed(1)} to H / ${(spot - orLow).toFixed(1)} to L)`;

  const pdState =
    pdh && pdl
      ? spot > pdh
        ? `Above Prior Day High (+${(spot - pdh).toFixed(2)} pts)`
        : spot < pdl
        ? `Below Prior Day Low (-${(pdl - spot).toFixed(2)} pts)`
        : `PDH ${(pdh - spot).toFixed(1)} pts above · PDL ${(spot - pdl).toFixed(1)} pts below`
      : "Computing prior session extremes";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Market Observations &amp; Regime Timeline
            </h2>
            <span className="rounded-full bg-sky-500/12 px-2.5 py-0.5 font-mono text-[11px] font-medium text-sky-700 dark:text-sky-300">
              {forecast?.market_regime || "TREND"} Regime
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Conviction score flow (-6 to +6), volatility backdrop, and institutional anchors
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            +Score / -Score
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" />
            Vol (bps)
          </span>
        </div>
      </div>

      {/* Dual-Axis @bklit ComposedChart: ProfitLossLine for raw_score + Area for volatility */}
      <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/50">
        <ComposedChart
          animationDuration={0}
          aspectRatio="12 / 5"
          data={chartData}
          margin={{ top: 18, right: 38, bottom: 32, left: 34 }}
          yDomains={yDomains}
        >
          <Grid highlightRowValues={[0]} horizontal numTicksRows={4} strokeDasharray="3,3" />
          <Area
            dataKey="rvBps"
            fill="var(--chart-2)"
            fillOpacity={0.16}
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            yAxisId="right"
          />
          <ProfitLossLine dataKey="score" strokeWidth={2.5} />
          <YAxis formatLargeNumbers={false} formatValue={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`} numTicks={4} yAxisId="left" />
          <YAxis formatLargeNumbers={false} formatValue={(v) => `${v.toFixed(0)}b`} numTicks={3} orientation="right" yAxisId="right" />
          <XAxis labels={labels} numTicks={5} tickMode="data" />
          <ChartTooltip
            dateLabels={labels}
            rows={(pt) => [
              {
                color: pt.score >= 0 ? "var(--color-up)" : "var(--color-down)",
                label: `Score (${pt.regime})`,
                value: `${pt.score >= 0 ? "+" : ""}${pt.score.toFixed(2)}`,
              },
              {
                color: "var(--chart-2)",
                label: "Bar ATR Vol",
                value: `${pt.rvBps.toFixed(1)} bps`,
              },
            ]}
          />
        </ComposedChart>
      </div>

      {/* Actionable Microstructure Observations Deck */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>Session VWAP Positioning</span>
            {vwap !== undefined && (
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                VWAP {vwap.toFixed(2)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                (vwapDistPts ?? 0) >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {vwapDistPts !== undefined
                ? `${vwapDistPts >= 0 ? "+" : ""}${vwapDistPts.toFixed(2)} pts (${
                    vwapDistAtr >= 0 ? "+" : ""
                  }${vwapDistAtr.toFixed(2)} ATR)`
                : "--"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{vwapState}</p>
        </div>

        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>Trend &amp; DMI Strength</span>
            {atrPts !== undefined && (
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                ATR {atrPts.toFixed(2)} pts
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            <span>ADX {adx !== undefined ? adx.toFixed(1) : "--"}</span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              +DI {plusDi?.toFixed(1) ?? "--"} / -DI {minusDi?.toFixed(1) ?? "--"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{emaStack}</p>
        </div>

        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>Opening Range &amp; Prior Levels</span>
            {pdh !== undefined && (
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                OR {orLow?.toFixed(0)}-{orHigh?.toFixed(0)}
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {orState}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{pdState}</p>
        </div>

        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>Volatility Gate &amp; Momentum</span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                telemetry.vol_ok !== false
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
              }`}
            >
              {telemetry.vol_ok !== false ? "Vol Gate Open" : "Vol Compressed/Spiked"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            <span>VolRatio {volRatio !== undefined ? `${volRatio.toFixed(2)}x` : "--"}</span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              RSI(14) {rsi14 !== undefined ? rsi14.toFixed(1) : "--"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {volRatio !== undefined && volRatio < 0.75
              ? "Volatility compressing; smaller mean-reverting swings"
              : volRatio !== undefined && volRatio > 1.25
              ? "Expanding bar range; wider ATR brackets active"
              : "Normal intraday ATR expansion ratio for 2:1 setups"}
          </p>
        </div>
      </div>
    </section>
  );
}
