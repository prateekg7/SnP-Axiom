import React, { useMemo, useState } from "react";
import AppleActivityCard from "./kokonutui/apple-activity-card";
import { Gauge } from "./charts/gauge";
import { AreaSparkline } from "./charts/sparkline";

export default function MarketStatsPanel({
  performance,
  stats,
  forecast,
  history = [],
}) {
  const [strategyTab, setStrategyTab] = useState("live"); // 'live' | 'backtest'

  const isLive = strategyTab === "live";

  // Live session paper trading metrics
  const liveNetPnl = performance?.net_pnl_pts ?? 0.0;
  const liveGrossPnl = performance?.gross_pnl_pts ?? 0.0;
  const liveRealizedPnl = performance?.realized_pnl_pts ?? 0.0;
  const liveUnrealizedPnl = performance?.unrealized_pnl_pts ?? 0.0;
  const liveWinRate = performance?.win_rate_pct ?? 0.0;
  const liveProfitFactor = performance?.profit_factor ?? 0.0;
  const liveMaxDrawdown = performance?.max_drawdown_pts ?? 0.0;
  const liveTotalTrades = performance?.total_trades ?? 0;
  const liveCompletedTrades = performance?.completed_trades ?? 0;
  const liveExpectancy = performance?.expectancy_pts ?? 0.0;
  const livePosition = performance?.position_state ?? "FLAT";
  const liveActiveTrade = performance?.active_trade ?? null;
  const liveAbstention = performance?.abstention_rate_pct ?? 100.0;

  const backtestRef = performance?.backtest_reference || {
    net_pnl_pts: 222.48,
    gross_pnl_pts: 325.08,
    win_rate_pct: 45.91,
    profit_factor: 1.184,
    max_drawdown_pts: 82.52,
    total_trades: 342,
    avg_win_pts: 9.12,
    avg_loss_pts: 6.54,
  };

  const activeNetPnl = isLive ? liveNetPnl : backtestRef.net_pnl_pts;
  const activeWinRate = isLive ? liveWinRate : backtestRef.win_rate_pct;
  const activePF = isLive ? liveProfitFactor : backtestRef.profit_factor;
  const activeDD = isLive ? liveMaxDrawdown : backtestRef.max_drawdown_pts;
  const isNetPositive = activeNetPnl >= 0;

  // Dynamic model & quant telemetry (wired directly to backend calculations)
  const telemetry = forecast?.telemetry || {};
  const quant = forecast?.quant || {};

  const regimeLabel = forecast?.market_regime || "TREND";
  const adxVal = telemetry.adx ?? null;
  const volRatio = telemetry.vol_ratio ?? null;

  const tpPoints = forecast?.tp_points ?? 3.0;
  const slPoints = forecast?.sl_points ?? 1.5;

  const bsTouchTp30m =
    quant.bs_touch_tp_30m_pct ??
    (forecast?.p_touch_up_next_5m ? forecast.p_touch_up_next_5m * 100 : 0);
  const bsTouch3pt5m = quant.bs_touch_3pt_5m_pct ?? null;

  const mcVar95Pct = quant.var_95_pct ?? 0;
  const mcVar95Pts = quant.var_95_pts ?? 0;
  const mcCvar95Pts = quant.cvar_95_pts ?? 0;

  const realizedVolBps =
    quant.realized_vol_30m_bps ??
    ((forecast?.volatility_30m || 0.00075) * 10000);

  const conformalCoverage = forecast?.prediction_interval?.empirical_coverage
    ? Number((forecast.prediction_interval.empirical_coverage * 100).toFixed(1))
    : Number(
        (
          (stats?.forecast_metrics?.conformal_empirical_coverage ?? 0.8697) *
          100
        ).toFixed(1)
      );

  const brierScore = stats?.forecast_metrics?.calibrated_brier ?? 0.0517;
  const eceScore = stats?.forecast_metrics?.calibrated_ece ?? 0.0004;

  // Sparkline series for 30m realized volatility over recent bars
  const rvSparkData = useMemo(() => {
    const slice = (history || []).slice(-24);
    if (slice.length < 2) {
      return [
        { i: 0, rv: Number(realizedVolBps || 12) },
        { i: 1, rv: Number(realizedVolBps || 12) },
      ];
    }
    return slice.map((item, idx) => ({
      i: idx,
      rv: Number(((item.volatility_30m || 0.0007) * 10000).toFixed(1)),
    }));
  }, [history, realizedVolBps]);

  // Kokonut Apple Activity Rings mapped cleanly to live trading & calibration goals
  const activityRings = useMemo(() => {
    const winTarget = 55;
    const covTarget = 90;
    const pfScaled = Math.round(activePF * 100);
    const pfTarget = 200; // 2.00x target (scaled x100 for clean integer ring animation)

    return [
      {
        label: "WIN RATE EDGE",
        color: "#10B981",
        colorEnd: "#34D399",
        size: 162,
        current: Math.round(activeWinRate),
        target: winTarget,
        unit: "%",
      },
      {
        label: "CONFORMAL COV",
        color: "#3B82F6",
        colorEnd: "#60A5FA",
        size: 126,
        current: Math.round(conformalCoverage),
        target: covTarget,
        unit: "%",
      },
      {
        label: "PF TARGET (X100)",
        color: "#F59E0B",
        colorEnd: "#FBBF24",
        size: 90,
        current: pfScaled,
        target: pfTarget,
        unit: "%",
      },
    ];
  }, [activePF, activeWinRate, conformalCoverage]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Paper Strategy &amp; Quant Risk
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Real-time bracket P&amp;L, Apple-style health rings, and analytical risk telemetry
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
          <button
            type="button"
            onClick={() => setStrategyTab("live")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              isLive
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Live Paper ({liveTotalTrades})
          </button>
          <button
            type="button"
            onClick={() => setStrategyTab("backtest")}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              !isLive
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Backtest Reference
          </button>
        </div>
      </div>

      {/* Hero Row: P&L + Metrics Left | @kokonutui/apple-activity-card Right */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-zinc-200/70 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/50 xl:col-span-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {isLive
                  ? "Paper Trading Net P&L (Live Session)"
                  : "Paper Trading Net P&L (Backtest Baseline)"}
              </span>
              {isLive ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                    livePosition === "LONG"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : livePosition === "SHORT"
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                      : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {livePosition === "FLAT"
                    ? "FLAT · SCANNING"
                    : `${livePosition} @ ${liveActiveTrade?.entry_price?.toFixed(2)} (${
                        liveActiveTrade?.floating_pts >= 0 ? "+" : ""
                      }${liveActiveTrade?.floating_pts?.toFixed(2)} pts)`}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                  +{backtestRef.gross_pnl_pts.toFixed(1)} gross pts
                </span>
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-2.5">
              <span
                className={`font-mono text-3xl font-bold tracking-tight tabular-nums ${
                  isNetPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isNetPositive ? "+" : ""}
                {activeNetPnl.toFixed(2)} pts
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {isLive
                  ? `${liveCompletedTrades} closed · +${tpPoints.toFixed(1)} TP / -${slPoints.toFixed(1)} SL`
                  : `${backtestRef.total_trades} closed bracket orders (2:1 ATR/pts)`}
              </span>
            </div>

            {isLive && (
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  Realized:{" "}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    {liveRealizedPnl >= 0 ? "+" : ""}
                    {liveRealizedPnl.toFixed(2)}
                  </strong>
                </span>
                <span>
                  Gross:{" "}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    {liveGrossPnl >= 0 ? "+" : ""}
                    {liveGrossPnl.toFixed(2)}
                  </strong>
                </span>
                <span>
                  Float:{" "}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    {liveUnrealizedPnl >= 0 ? "+" : ""}
                    {liveUnrealizedPnl.toFixed(2)}
                  </strong>
                </span>
              </div>
            )}

            <div className="mt-3 rounded-lg border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>Bracket Execution Rules</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">2:1 R:R</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div>
                  <div className="text-[10px] text-zinc-500">Target / Stop</div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    +{tpPoints.toFixed(1)} / -{slPoints.toFixed(1)} pts
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Max Hold</div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    6 bars (30m)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Cost Model</div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    0.30 pts RT
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">HOLD Gate</div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {liveAbstention.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-900">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Win Rate</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {activeWinRate.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-900">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Profit Factor</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {activePF.toFixed(2)}x
              </div>
            </div>
            <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-900">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Max DD</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                -{activeDD.toFixed(2)} pts
              </div>
            </div>
            <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-900">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {isLive ? "Expectancy" : "Selectivity"}
              </div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {isLive
                  ? `${liveExpectancy >= 0 ? "+" : ""}${liveExpectancy.toFixed(2)} pts`
                  : `${liveAbstention.toFixed(1)}%`}
              </div>
            </div>
          </div>
        </div>

        {/* @kokonutui/apple-activity-card */}
        <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-950/50 xl:col-span-6">
          <AppleActivityCard
            activities={activityRings}
            className="max-w-full rounded-xl bg-transparent p-4 shadow-none"
            title="Strategy Health Targets"
            titleAs="h3"
          />
        </div>
      </div>

      {/* Bottom 4 Quant Analytics Tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Market Regime + Volatility Sparkline */}
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Market Regime &amp; Volatility
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                regimeLabel === "TREND"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
              }`}
            >
              {regimeLabel}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {regimeLabel === "TREND" ? "Directional Flow" : "Mean Reverting"}
            </span>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              RV {Number(realizedVolBps).toFixed(1)} bps
            </span>
          </div>
          <div className="h-8 w-full">
            <AreaSparkline
              color="var(--chart-2)"
              data={rvSparkData}
              dataKey="rv"
              fillOpacity={0.25}
              height={32}
            />
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {adxVal !== null
              ? `ADX ${adxVal.toFixed(1)} · VolRatio ${volRatio?.toFixed(2)}x · Selectivity ${liveAbstention.toFixed(1)}% HOLD`
              : "Dual-regime switching between trend momentum and VWAP/RSI reversion"}
          </div>
        </div>

        {/* Live Analytical Black-Scholes Barrier Touch Probability */}
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Black-Scholes Barrier Odds
            </span>
            <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              analytic GBM
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
              {Number(bsTouchTp30m).toFixed(1)}%{" "}
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                (+{tpPoints.toFixed(1)} pt TP / 30m)
              </span>
            </span>
            {bsTouch3pt5m !== null && (
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                +3pt/5m: {bsTouch3pt5m.toFixed(1)}%
              </span>
            )}
          </div>
          <Gauge
            activeGradient={["#10B981", "#3B82F6"]}
            linearHeight={14}
            orientation="linear"
            totalNotches={24}
            useGradient
            value={Math.min(100, Math.max(0, Number(bsTouchTp30m)))}
          />
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            First-exit reflection probability using live 30m RV ({Number(realizedVolBps).toFixed(1)} bps)
          </div>
        </div>

        {/* Live Monte Carlo 95% Value at Risk & CVaR */}
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Monte Carlo Value at Risk (95%)
            </span>
            <span className="rounded-full bg-rose-500/12 px-2 py-0.5 font-mono text-[11px] text-rose-600 dark:text-rose-300">
              2,000 paths
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold text-rose-600 tabular-nums dark:text-rose-400">
              -{Math.abs(Number(mcVar95Pct)).toFixed(2)}%
            </span>
            <span className="font-mono text-xs text-zinc-600 tabular-nums dark:text-zinc-300">
              {Number(mcVar95Pts).toFixed(2)} pts VaR · CVaR {Number(mcCvar95Pts).toFixed(2)} pts
            </span>
          </div>
          <Gauge
            activeGradient={["#F59E0B", "#EF4444"]}
            linearHeight={14}
            orientation="linear"
            totalNotches={24}
            useGradient
            value={Math.min(100, Math.max(8, Math.abs(Number(mcVar95Pts)) * 4))}
          />
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            5th-percentile 6-bar adverse tail loss (and Expected Shortfall beyond VaR)
          </div>
        </div>

        {/* Conformal Coverage & Probability Calibration */}
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Conformal Coverage &amp; Calibration
            </span>
            <span className="rounded-full bg-blue-500/12 px-2 py-0.5 font-mono text-[11px] text-blue-600 dark:text-blue-300">
              nom 90%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-lg font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
              {conformalCoverage.toFixed(1)}%
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
              Brier {brierScore.toFixed(4)} · ECE {eceScore.toFixed(4)}
            </span>
          </div>
          <Gauge
            activeGradient={["#3B82F6", "#8B5CF6"]}
            linearHeight={14}
            orientation="linear"
            totalNotches={24}
            useGradient
            value={Math.min(100, Math.max(0, conformalCoverage))}
          />
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Finite-sample distribution-free interval validity and Platt probability calibration
          </div>
        </div>
      </div>
    </section>
  );
}
