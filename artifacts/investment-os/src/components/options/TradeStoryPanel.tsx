import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { BookOpen, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

// ─── API types (matching backend TradeStoryResult exactly) ───────────────────

interface StoryPoint {
  date: string;
  daysElapsed: number;
  markPnl: number | null;
  theoreticalPnl: number;
}

interface WhatIfPath {
  label: string;
  points: { day: number; pnl: number }[];
  finalPnl: number;
  description: string;
}

interface TradeStoryResult {
  tradeId: number;
  ticker: string;
  strike: number;
  expiry: string;
  right: string;
  premiumCollected: number;
  openedAt: string;
  closedAt: string | null;
  status: string;
  realisedPnl: number | null;
  initialDte: number;
  snapshots: StoryPoint[];
  whatIf: WhatIfPath[] | null;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function StoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1420] border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground">Day {label}</p>
      {payload.map((p: any) =>
        p.value != null && (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">${Number(p.value).toFixed(0)}</span>
          </p>
        ),
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  tradeId: number;
  ticker: string;
  status: string;
}

const WHAT_IF_COLORS = ["#10b981", "#60a5fa", "#f59e0b"];

export function TradeStoryPanel({ tradeId, ticker, status }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery<TradeStoryResult>({
    queryKey: ["trade-story", tradeId],
    queryFn: async () => {
      const r = await fetch(`/api/options/trades/${tradeId}/story`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Failed to load story");
      return r.json();
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  // --- Derived values from real API shape ---
  const snapshots = data?.snapshots ?? [];
  const hasActualData = snapshots.some((s) => s.markPnl != null);

  // Find latest actual P&L from snapshots
  const latestSnap = [...snapshots].reverse().find((s) => s.markPnl != null);
  const currentPnl = latestSnap?.markPnl ?? 0;
  const currentTheo = latestSnap?.theoreticalPnl ?? 0;
  const premiumCollected = data?.premiumCollected ?? 0;
  const profitTarget50 = premiumCollected * 0.5;
  const atTarget = currentPnl >= profitTarget50 && premiumCollected > 0;

  // Build main chart: daysElapsed as x-axis, two series
  const mainChartData = snapshots.map((pt) => ({
    day: pt.daysElapsed,
    "Theta decay (est)": pt.theoreticalPnl,
    "Actual P&L": pt.markPnl,
  }));

  // Build what-if chart for closed/assigned trades
  // Each WhatIfPath has its own { day, pnl } array — merge into common day axis
  const whatIf = data?.whatIf ?? null;
  const whatIfChartData: Record<string, number | undefined>[] = [];
  if (whatIf?.length) {
    const maxDay = Math.max(...whatIf.flatMap((w) => w.points.map((p) => p.day)));
    for (let d = 0; d <= maxDay; d++) {
      const row: Record<string, number | undefined> = { day: d };
      for (const path of whatIf) {
        const pt = path.points.find((p) => p.day === d);
        row[path.label] = pt?.pnl;
      }
      whatIfChartData.push(row);
    }
  }

  // Simple insight derived from data
  function buildInsight(): string {
    if (!data) return "";
    const { status: tradeStatus, premiumCollected: prem, realisedPnl, initialDte } = data;
    if (tradeStatus === "expired") return `This position expired worthless after ${initialDte} days — you kept the full $${prem.toFixed(0)} premium.`;
    if (tradeStatus === "assigned") return `You were assigned on ${ticker} after ${initialDte} days. The $${prem.toFixed(0)} premium offsets your cost basis.`;
    if (tradeStatus === "closed") {
      const pnl = realisedPnl ?? 0;
      if (pnl >= profitTarget50) return `Excellent — you closed at ${((pnl / prem) * 100).toFixed(0)}% of premium, locking in $${pnl.toFixed(0)}.`;
      if (pnl > 0) return `You closed early with $${pnl.toFixed(0)} profit (${((pnl / prem) * 100).toFixed(0)}% of premium).`;
      return `This trade closed with a $${Math.abs(pnl).toFixed(0)} loss.`;
    }
    // Open trade
    if (hasActualData && currentPnl >= profitTarget50) return `You've reached the 50% profit target! Consider closing to lock in $${currentPnl.toFixed(0)} now.`;
    if (hasActualData) return `${ticker} is tracking ${currentPnl >= currentTheo ? "ahead of" : "behind"} the theta decay model at $${currentPnl.toFixed(0)} P&L.`;
    return `Theta decay is working for you — check back once daily snapshots begin populating.`;
  }

  return (
    <div className="border-t border-slate-700/50 pt-3 mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors w-full"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="font-medium">Trade Story</span>
        <span className="text-muted-foreground">— how this position has evolved</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading trade history…
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">Could not load trade story.</p>
          )}

          {data && (
            <>
              {/* Insight */}
              <div className="p-2.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-xs text-violet-200 leading-relaxed">
                {buildInsight()}
              </div>

              {/* Open trade live metrics */}
              {status === "open" && (
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Premium: </span>
                    <span className="text-emerald-400 font-semibold">${premiumCollected.toFixed(0)}</span>
                  </div>
                  {hasActualData && (
                    <div>
                      <span className="text-muted-foreground">P&L to date: </span>
                      <span className={`font-semibold ${currentPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${currentPnl.toFixed(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Theta est: </span>
                    <span className="text-slate-300">${currentTheo.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">50% target: </span>
                    <span className={atTarget ? "text-emerald-400 font-semibold" : "text-slate-300"}>
                      ${profitTarget50.toFixed(0)}{atTarget && " ✓"}
                    </span>
                  </div>
                </div>
              )}

              {/* Closed trade outcome */}
              {status !== "open" && (
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Premium collected: </span>
                    <span className="text-emerald-400 font-semibold">${premiumCollected.toFixed(0)}</span>
                  </div>
                  {data.realisedPnl != null && (
                    <div>
                      <span className="text-muted-foreground">Realised P&L: </span>
                      <span className={`font-semibold ${data.realisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${data.realisedPnl.toFixed(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Duration: </span>
                    <span className="text-slate-300">{data.initialDte} days</span>
                  </div>
                </div>
              )}

              {/* Main P&L chart (open trades or any with snapshots) */}
              {mainChartData.length > 1 && (
                <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3">
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Blue = actual mark-to-market P&L · Grey dashed = theoretical theta decay · Emerald dashed = 50% target
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={mainChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        label={{ value: "Days since open", position: "insideBottomRight", offset: -4, fill: "#64748b", fontSize: 10 }}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        tickFormatter={(v) => `$${v}`}
                        width={42}
                      />
                      <Tooltip content={<StoryTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      {premiumCollected > 0 && (
                        <ReferenceLine
                          y={profitTarget50}
                          stroke="#10b981"
                          strokeDasharray="5 3"
                          strokeOpacity={0.5}
                          label={{ value: "50% target", position: "insideTopRight", fill: "#10b981", fontSize: 10 }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="Theta decay (est)"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="Actual P&L"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {!hasActualData && status === "open" && (
                <p className="text-xs text-muted-foreground py-1">
                  Actual P&L snapshots recorded each evening — check back tomorrow to see this chart populate.
                </p>
              )}

              {/* What-if overlay for closed/assigned trades */}
              {whatIf && whatIf.length > 0 && whatIfChartData.length > 1 && (
                <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3">
                  <p className="text-xs font-medium text-white mb-1">What if you had…</p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Three alternative exit strategies overlaid on the same trade
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={whatIfChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v}`} width={42} />
                      <Tooltip content={<StoryTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      {whatIf.map((path, i) => (
                        <Line
                          key={path.label}
                          type="monotone"
                          dataKey={path.label}
                          stroke={WHAT_IF_COLORS[i % WHAT_IF_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {whatIf.map((path, i) => (
                      <div key={path.label} className="flex items-start gap-2 text-xs">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: WHAT_IF_COLORS[i % WHAT_IF_COLORS.length] }}
                        />
                        <div>
                          <span className="font-medium text-white">{path.label}</span>
                          <span className="text-muted-foreground ml-1">— {path.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
