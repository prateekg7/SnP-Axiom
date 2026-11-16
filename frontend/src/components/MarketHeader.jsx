import React from "react";
import ThemeToggle from "./ThemeToggle";

export default function MarketHeader({ market, forecast, theme, onToggleTheme }) {
  const latest = market?.latest_price;
  const change = market?.change ?? 0;
  const pctChange = market?.pct_change ?? 0;
  const isUp = change >= 0;
  const regime = forecast?.market_regime || "TREND";
  const adx = forecast?.telemetry?.adx;
  const isRegular = market?.is_regular_session;

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/85 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85 sm:px-6">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 items-center rounded-lg bg-zinc-900 px-2.5 font-mono text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              SPX
            </span>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-base">
                S&amp;P 500 Quantitative Analytics
              </h1>
            </div>
          </div>

          {typeof latest === "number" && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-1 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                {latest.toFixed(2)}
              </span>
              <span
                className={`tabular-nums font-medium ${
                  isUp
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isUp ? "+" : ""}
                {change.toFixed(2)} ({isUp ? "+" : ""}
                {pctChange.toFixed(2)}%)
              </span>
            </div>
          )}

          <div className="hidden items-center gap-2 md:flex">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                regime === "TREND"
                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              }`}
            >
              {forecast?.model_version?.includes("random_forest")
                ? "Random Forest ML"
                : forecast?.model_version === "spx_option_a_native_ml"
                ? "Option A ML"
                : "Adaptive v2"} · {regime}
              {adx !== undefined ? ` (ADX ${adx.toFixed(1)})` : ""}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isRegular ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
              {isRegular ? "RTH Live" : market?.freshness || "Session Synced"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
