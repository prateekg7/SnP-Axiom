import React, { useMemo, useState } from "react";
import { ComposedChart } from "./charts/composed-chart";
import { Area } from "./charts/area";
import { BarChart } from "./charts/bar-chart";
import { Bar } from "./charts/bar";
import { BarXAxis } from "./charts/bar-x-axis";
import { Grid } from "./charts/grid";
import { XAxis } from "./charts/x-axis";
import { YAxis } from "./charts/y-axis";
import { ChartTooltip } from "./charts/tooltip";

export default function EquityDrawdownCard({ performance }) {
  const [viewMode, setViewMode] = useState("curve"); // 'curve' | 'trades'

  const rawCurve = performance?.equity_curve || [];
  const backtest = performance?.backtest_reference || {
    net_pnl_pts: 222.48,
    gross_pnl_pts: 325.08,
    win_rate_pct: 45.91,
    profit_factor: 1.184,
    max_drawdown_pts: 82.52,
    total_trades: 342,
    avg_win_pts: 9.12,
    avg_loss_pts: 6.54,
  };

  const completedTrades = performance?.completed_trades ?? 0;
  const winTrades = performance?.winning_trades ?? 0;
  const loseTrades = performance?.losing_trades ?? 0;
  const avgWin = performance?.avg_win_pts ?? 0;
  const avgLoss = performance?.avg_loss_pts ?? 0;
  const expectancy = performance?.expectancy_pts ?? 0;
  const payoffRatio = performance?.payoff_ratio ?? 0;
  const maxDD = performance?.max_drawdown_pts ?? 0;
  const abstentionRate = performance?.abstention_rate_pct ?? 100;

  // Ensure ComposedChart always gets >= 2 monotonic Date points and symmetric non-collapsed Y-bounds
  const { series, labels, yDomains } = useMemo(() => {
    const baseMs = Date.now() - 3600_000;
    const basePoints =
      rawCurve.length >= 2
        ? rawCurve
        : [
            {
              idx: 0,
              label: "Start",
              trade_pnl: 0,
              cum_pnl: 0,
              drawdown: 0,
              position: "FLAT",
            },
            {
              idx: 1,
              label: performance?.active_trade ? "Open MTM" : "Current",
              trade_pnl: performance?.unrealized_pnl_pts ?? 0,
              cum_pnl: performance?.net_pnl_pts ?? 0,
              drawdown: -Math.abs(performance?.max_drawdown_pts ?? 0),
              position: performance?.position_state ?? "FLAT",
            },
          ];

    const mapped = basePoints.map((pt, i) => ({
      date: new Date(baseMs + i * 300_000),
      label: pt.label || `T${i}`,
      cumPnl: Number((pt.cum_pnl ?? 0).toFixed(2)),
      drawdown: Number((pt.drawdown ?? 0).toFixed(2)),
      tradePnl: Number((pt.trade_pnl ?? 0).toFixed(2)),
      position: pt.position || "FLAT",
    }));

    const vals = mapped.flatMap((m) => [m.cumPnl, m.drawdown, 0]);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = maxVal - minVal;
    const lowBound = span < 2 ? -5 : Number((minVal - span * 0.15).toFixed(1));
    const highBound = span < 2 ? 5 : Number((maxVal + span * 0.15).toFixed(1));

    return {
      series: mapped,
      labels: mapped.map((m) => m.label),
      yDomains: { left: [lowBound, highBound] },
    };
  }, [performance, rawCurve]);

  const tradeBars = useMemo(() => {
    return rawCurve
      .filter((pt) => pt.idx > 0)
      .slice(-20)
      .map((pt) => ({
        label: pt.label || `#${pt.idx}`,
        pnl: Number((pt.trade_pnl ?? 0).toFixed(2)),
        position: pt.position || "FLAT",
      }));
  }, [rawCurve]);

  const netPositive = (performance?.net_pnl_pts ?? 0) >= 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Equity Curve &amp; Drawdown Profile
            </h2>
            <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              {completedTrades} closed · {abstentionRate.toFixed(1)}% HOLD gate
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Cumulative net SPX points, underwater drawdown, and trade expectancy analytics
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
          <button
            type="button"
            onClick={() => setViewMode("curve")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "curve"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Equity Area
          </button>
          <button
            type="button"
            onClick={() => setViewMode("trades")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "trades"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Per-Trade P&amp;L
          </button>
        </div>
      </div>

      {/* Main @bklit/area-chart or @bklit/bar-chart */}
      <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/50">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: netPositive ? "var(--color-up)" : "var(--color-down)",
                }}
              />
              {viewMode === "curve" ? "Cumulative Net P&L (pts)" : "Closed Trade Return (pts)"}
            </span>
            {viewMode === "curve" && (
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--color-down)" }}
                />
                Underwater Drawdown
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            Backtest Ref: +{backtest.net_pnl_pts.toFixed(1)} pts (PF {backtest.profit_factor.toFixed(2)}x)
          </span>
        </div>

        {viewMode === "curve" ? (
          <ComposedChart
            animationDuration={0}
            aspectRatio="12 / 5"
            data={series}
            margin={{ top: 18, right: 16, bottom: 34, left: 52 }}
            yDomains={yDomains}
          >
            <Grid highlightRowValues={[0]} horizontal numTicksRows={4} strokeDasharray="3,3" />
            <Area
              dataKey="cumPnl"
              fill={netPositive ? "var(--color-up)" : "var(--color-down)"}
              fillOpacity={0.32}
              showMarkers
              stroke={netPositive ? "var(--color-up)" : "var(--color-down)"}
              strokeWidth={2.5}
            />
            <Area
              dataKey="drawdown"
              fill="var(--color-down)"
              fillOpacity={0.18}
              stroke="var(--color-down)"
              strokeWidth={1.5}
            />
            <YAxis formatLargeNumbers={false} formatValue={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`} numTicks={4} />
            <XAxis labels={labels} numTicks={5} tickMode="data" />
            <ChartTooltip
              dateLabels={labels}
              rows={(pt) => [
                {
                  color: pt.cumPnl >= 0 ? "var(--color-up)" : "var(--color-down)",
                  label: "Cum Net P&L",
                  value: `${pt.cumPnl >= 0 ? "+" : ""}${pt.cumPnl.toFixed(2)} pts`,
                },
                {
                  color: "var(--color-down)",
                  label: "Drawdown",
                  value: `${pt.drawdown.toFixed(2)} pts`,
                },
                {
                  color: "var(--chart-2)",
                  label: `Step (${pt.position})`,
                  value: `${pt.tradePnl >= 0 ? "+" : ""}${pt.tradePnl.toFixed(2)} pts`,
                },
              ]}
            />
          </ComposedChart>
        ) : tradeBars.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
            No closed bracket orders in the current session yet.
          </div>
        ) : (
          <BarChart
            animationDuration={0}
            aspectRatio="12 / 5"
            data={tradeBars}
            margin={{ top: 18, right: 16, bottom: 34, left: 16 }}
            xDataKey="label"
          >
            <Grid horizontal numTicksRows={4} strokeDasharray="3,3" />
            <Bar
              dataKey="pnl"
              fill="var(--chart-2)"
              lineCap="round"
              showValue
              stroke="var(--chart-2)"
              valueLabelFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`}
            />
            <BarXAxis showAllLabels={tradeBars.length <= 10} tickerHalfWidth={50} />
            <ChartTooltip
              rows={(pt) => [
                {
                  color: pt.pnl >= 0 ? "var(--color-up)" : "var(--color-down)",
                  label: `${pt.position} Net P&L`,
                  value: `${pt.pnl >= 0 ? "+" : ""}${pt.pnl.toFixed(2)} pts`,
                },
              ]}
              showCrosshair={false}
            />
          </BarChart>
        )}
      </div>

      {/* Expectancy & Asymmetric Bracket Breakdown */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Live Expectancy</div>
          <div
            className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${
              expectancy >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {expectancy >= 0 ? "+" : ""}
            {expectancy.toFixed(2)} pts
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Per closed trade</div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Payoff Asymmetry</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            {payoffRatio.toFixed(2)} : 1
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            +{avgWin.toFixed(1)} win / {avgLoss.toFixed(1)} loss
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">W / L Tally</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
            <span className="text-emerald-600 dark:text-emerald-400">{winTrades}W</span>
            <span className="mx-1 text-zinc-400">/</span>
            <span className="text-rose-600 dark:text-rose-400">{loseTrades}L</span>
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Target DD limit: -{backtest.max_drawdown_pts.toFixed(1)}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 px-3.5 py-2.5 dark:bg-zinc-800/50">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Max Drawdown</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-rose-600 tabular-nums dark:text-rose-400">
            -{maxDD.toFixed(2)} pts
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Peak-to-trough depth</div>
        </div>
      </div>
    </section>
  );
}
