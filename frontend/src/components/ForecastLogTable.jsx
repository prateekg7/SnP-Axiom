import React, { useMemo, useState } from "react";
import { BarSparkline, useSparklineHover } from "./charts/sparkline";

function formatTime(isoString) {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return "--:--";
  }
}

export default function ForecastLogTable({ history = [] }) {
  const [horizonView, setHorizonView] = useState("5m"); // '5m' | '30m'
  const records = useMemo(() => [...(history || [])].reverse().slice(0, 25), [history]);

  // Chronological last 25 forecasts for the @bklit/sparkline accuracy & excursion strip
  const sparkData = useMemo(() => {
    const chrono = (history || []).slice(-25);
    return chrono.map((item, idx) => {
      const ref = item.reference_price || 7500;
      const actualMove =
        item.actual_delta !== undefined
          ? Math.abs(item.actual_delta)
          : Math.abs((item.expected_price_next_5m || ref) - ref);
      return {
        idx,
        time: formatTime(item.as_of),
        moveMag: Number(Math.max(0.05, actualMove).toFixed(2)),
        actualDelta: item.actual_delta,
        predDelta: Number(((item.expected_price_next_5m || ref) - ref).toFixed(2)),
        outcome: item.outcome || item.status || "PENDING",
        regime: item.market_regime || "TREND",
      };
    });
  }, [history]);

  const hover = useSparklineHover();
  const activePoint = hover.datum ?? sparkData[sparkData.length - 1];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/75">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 pb-3 dark:border-zinc-800/80">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Recent Forecast Logs
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Rolling 25-bar live prediction and outcome ledger
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80">
          <button
            type="button"
            onClick={() => setHorizonView("5m")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              horizonView === "5m"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            5m Log
          </button>
          <button
            type="button"
            onClick={() => setHorizonView("30m")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              horizonView === "30m"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            30m Log
          </button>
        </div>
      </div>

      {/* @bklit/sparkline Realized Move & Hover Telemetry Strip */}
      {sparkData.length >= 2 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-3 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-950/50">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
            <span className="text-zinc-500 dark:text-zinc-400">
              5m Bar Impulse {activePoint ? `· ${activePoint.time} ET [${activePoint.regime}]` : ""}
            </span>
            {activePoint && (
              <span className="text-zinc-800 dark:text-zinc-200">
                Pred {activePoint.predDelta >= 0 ? "+" : ""}
                {activePoint.predDelta.toFixed(2)}
                {activePoint.actualDelta !== undefined
                  ? ` · Act ${activePoint.actualDelta >= 0 ? "+" : ""}${activePoint.actualDelta.toFixed(2)} (${activePoint.outcome})`
                  : " · PENDING"}
              </span>
            )}
          </div>
          <div className="h-7 w-full">
            <BarSparkline
              barGap={2}
              barRadius={2}
              color="var(--chart-2)"
              data={sparkData}
              dataKey="moveMag"
              height={28}
              {...hover.sparklineProps}
            />
          </div>
        </div>
      )}

      {/* Clean Data Table */}
      <div className="max-h-[260px] overflow-x-auto overflow-y-auto rounded-xl border border-zinc-200/70 dark:border-zinc-800/80">
        <table className="w-full border-collapse text-left font-mono text-[11px]">
          <thead className="sticky top-0 z-10 bg-zinc-100/95 text-[10px] uppercase tracking-wider text-zinc-500 backdrop-blur-xs dark:bg-zinc-900/95 dark:text-zinc-400">
            {horizonView === "5m" ? (
              <tr>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Time</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Ref</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">5m Pred</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Conf</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium">Action</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium">Outcome</th>
              </tr>
            ) : (
              <tr>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Time</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Ref</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">30m Dest</th>
                <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Bounds (L/H)</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium">Action</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium">Outcome</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/70">
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400"
                >
                  No forecast logs recorded yet.
                </td>
              </tr>
            ) : (
              records.map((item, idx) => {
                const ref = item.reference_price || 7500;
                const isPending = item.status === "PENDING";

                const delta5m = (item.expected_price_next_5m || ref) - ref;
                const isUp5m = delta5m >= 0;
                const pVal = item.p_touch_up_next_5m
                  ? (item.p_touch_up_next_5m * 100).toFixed(1)
                  : "--";

                const path = item.path_30m || [];
                const exp30m =
                  path.length > 0
                    ? path[path.length - 1].expected_close
                    : item.expected_price_next_5m || ref;
                const delta30m = exp30m - ref;
                const isUp30m = delta30m >= 0;
                const low30m = item.predicted_low_30m
                  ? item.predicted_low_30m.toFixed(1)
                  : "--";
                const high30m = item.predicted_high_30m
                  ? item.predicted_high_30m.toFixed(1)
                  : "--";

                const act = (item.action || "HOLD").toUpperCase();
                const out = (item.outcome || "RESOLVED").toUpperCase();
                const isHit = out === "TP" || out === "TN";
                const isMiss = out === "FP" || out === "FN";

                return (
                  <tr
                    key={item.forecast_id || idx}
                    className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                      isPending ? "bg-sky-500/5" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-700 tabular-nums dark:text-zinc-300">
                      {formatTime(item.as_of)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
                      {ref.toFixed(2)}
                    </td>

                    {horizonView === "5m" ? (
                      <>
                        <td
                          className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${
                            isUp5m
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          <span>
                            {isUp5m ? "+" : ""}
                            {delta5m.toFixed(2)}
                          </span>
                          {isPending ? (
                            <span className="ml-1 text-[10px] text-zinc-400">(eval)</span>
                          ) : item.actual_delta !== undefined ? (
                            <span className="ml-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                              ({item.actual_delta >= 0 ? "+" : ""}
                              {item.actual_delta.toFixed(2)})
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
                          {pVal}%
                        </td>
                      </>
                    ) : (
                      <>
                        <td
                          className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${
                            isUp30m
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isUp30m ? "+" : ""}
                          {delta30m.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                          <span className="text-rose-600 dark:text-rose-400">{low30m}</span>
                          <span className="text-zinc-400"> / </span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {high30m}
                          </span>
                        </td>
                      </>
                    )}

                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          act === "LONG"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                            : act === "SHORT"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                            : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {act}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-2 py-1.5 text-center">
                      {isPending ? (
                        <span className="inline-block rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300">
                          PENDING
                        </span>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            isHit
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                              : isMiss
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                              : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {out}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
