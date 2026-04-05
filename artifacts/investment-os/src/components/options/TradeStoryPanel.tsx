import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { BookOpen, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryPoint {
  day: number;
  date: string;
  actualPnl: number | null;
  theoreticalPnl: number;
  underlyingPrice?: number | null;
}

interface StoryResult {
  tradeId: number;
  ticker: string;
  strategy: string;
  status: string;
  openedAt: string;
  expiry: string;
  initialDte: number;
  premium: number;
  premiumPerContract: number;
  currentDte: number;
  daysSinceOpen: number;
  actualPnlToDate: number;
  theoreticalPnlToDate: number;
  profitTargetPct: number;
  profitTargetAmount: number;
  curve: StoryPoint[];
  insight: string;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function StoryTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1420] border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground">Day {label}</p>
      {payload.map((p: any) => (
        p.value != null && (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">${Number(p.value).toFixed(0)}</span>
          </p>
        )
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  tradeId: number;
  ticker: string;
  status: string;
}

export function TradeStoryPanel({ tradeId, ticker, status }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery<StoryResult>({
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

  // Build chart data from story curve — scatter for actual points, line for theta decay
  const chartData = (data?.curve ?? []).map((pt) => ({
    day: pt.day,
    "Theta decay (est)": Math.round(pt.theoreticalPnl * 100) / 100,
    "Actual P&L": pt.actualPnl != null ? Math.round(pt.actualPnl * 100) / 100 : null,
  }));

  const profitTarget = data?.profitTargetAmount ?? 0;
  const currentPnl = data?.actualPnlToDate ?? 0;
  const atTarget = profitTarget > 0 && currentPnl >= profitTarget;

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
              {/* Insight strip */}
              {data.insight && (
                <div className="p-2.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-xs text-violet-200 leading-relaxed">
                  {data.insight}
                </div>
              )}

              {/* P&L status for open trades */}
              {status === "open" && (
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">P&L to date: </span>
                    <span className={`font-semibold ${currentPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${currentPnl.toFixed(0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Theta estimate: </span>
                    <span className="text-slate-300">${(data.theoreticalPnlToDate ?? 0).toFixed(0)}</span>
                  </div>
                  {profitTarget > 0 && (
                    <div>
                      <span className="text-muted-foreground">Target (50%): </span>
                      <span className={atTarget ? "text-emerald-400 font-semibold" : "text-slate-300"}>
                        ${profitTarget.toFixed(0)}
                        {atTarget && " ✓ Reached!"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Chart */}
              {chartData.length > 1 && (
                <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 p-3">
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Blue = actual mark-to-market P&L snapshots · Dashed = expected theta decay · Dashed line = 50% profit target
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
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

                      {/* 50% profit target reference */}
                      {profitTarget > 0 && (
                        <ReferenceLine
                          y={profitTarget}
                          stroke="#10b981"
                          strokeDasharray="6 3"
                          strokeOpacity={0.5}
                          label={{ value: "Target", position: "insideTopRight", fill: "#10b981", fontSize: 10 }}
                        />
                      )}

                      {/* Theta decay model — dashed */}
                      <Line
                        type="monotone"
                        dataKey="Theta decay (est)"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        dot={false}
                        connectNulls
                      />

                      {/* Actual P&L dots */}
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

              {chartData.length <= 1 && (
                <p className="text-xs text-muted-foreground py-2">
                  Not enough daily snapshot data yet — the system records snapshots each evening. Check back tomorrow.
                </p>
              )}

              {/* Closed trade what-if */}
              {status !== "open" && data.premiumPerContract > 0 && (
                <div className="p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-white">How did this trade end?</p>
                  <p>
                    You collected <span className="text-emerald-400 font-semibold">${data.premiumPerContract.toFixed(0)}</span> in premium.
                    {" "}
                    {data.status === "expired"
                      ? "The option expired worthless — you kept 100% of the income."
                      : data.status === "assigned"
                        ? "You were assigned shares. Premiums collected offset your cost basis."
                        : "You closed the position early."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
