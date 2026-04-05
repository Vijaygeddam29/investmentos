import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Target, TrendingUp, Calendar, Info } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Cell,
} from "recharts";

interface MonthlyRow {
  bucket: string;
  totalPremium: number;
  realisedPnl: number;
  tradeCount: number;
  assignments: number;
}

interface ForecastResult {
  currentMonthActual: number;
  forecastRemainder: number;
  forecastTotal: number;
  openPositionsCount: number;
  detail: { ticker: string; remainingTheta: number }[];
}

function monthLabel(bucket: string) {
  const [year, month] = bucket.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

// Compute 3-month rolling average (trailing)
function addMovingAverage(rows: MonthlyRow[], windowSize = 3): (MonthlyRow & { ma3?: number })[] {
  return rows.map((row, i) => {
    if (i < windowSize - 1) return row;
    const slice = rows.slice(i - windowSize + 1, i + 1);
    const avg = slice.reduce((s, r) => s + (r.totalPremium ?? 0), 0) / windowSize;
    return { ...row, ma3: Math.round(avg) };
  });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1420] border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1 min-w-[140px]">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((p: any) => (
        p.value != null && (
          <p key={p.name} style={{ color: p.color ?? p.fill }}>
            {p.name}:{" "}
            <span className="font-semibold">
              ${typeof p.value === "number" ? p.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : p.value}
            </span>
          </p>
        )
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OptionsIncome() {
  const { data, isLoading } = useQuery({
    queryKey: ["options-income"],
    queryFn: async () => {
      const r = await fetch(`/api/options/income`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: forecastData } = useQuery<ForecastResult>({
    queryKey: ["options-income-forecast"],
    queryFn: async () => {
      const r = await fetch(`/api/options/income/forecast`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 15 * 60 * 1000,
  });

  const monthly: MonthlyRow[] = data?.monthly ?? [];
  const target = data?.monthlyIncomeTarget;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthData = monthly.find((m) => m.bucket === currentMonth);
  const ytdPremium = monthly.reduce((sum, m) => sum + (m.totalPremium ?? 0), 0);
  const ytdPnl = monthly.reduce((sum, m) => sum + (m.realisedPnl ?? 0), 0);
  const totalTrades = monthly.reduce((sum, m) => sum + (m.tradeCount ?? 0), 0);
  const currentPremium = currentMonthData?.totalPremium ?? 0;
  const progressPct = target ? Math.min((currentPremium / target) * 100, 100) : null;

  // Build chart data: last 12 months ascending, with MA and forecast
  const last12 = [...monthly].slice(-12);
  const withMa = addMovingAverage(last12, 3);

  // Inject a "forecast" bar for current month remainder
  const chartData = withMa.map((row) => {
    const isCurrent = row.bucket === currentMonth;
    const forecast = isCurrent && forecastData ? forecastData.forecastRemainder : undefined;
    return {
      month: monthLabel(row.bucket),
      "Premium collected": row.totalPremium ?? 0,
      "Forecast remainder": forecast ?? 0,
      "3-month avg": row.ma3,
      isCurrent,
    };
  });

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Income Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Premium collected, realised P&L, and assignment history</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "This month", value: `$${currentPremium.toFixed(0)}`, color: "text-emerald-400", icon: DollarSign },
            { label: "YTD premium", value: `$${ytdPremium.toFixed(0)}`, color: "text-emerald-400", icon: TrendingUp },
            { label: "YTD realised P&L", value: `$${(ytdPnl ?? 0).toFixed(0)}`, color: ytdPnl >= 0 ? "text-emerald-400" : "text-red-400", icon: TrendingUp },
            { label: "Total trades", value: totalTrades, color: "text-white", icon: Calendar },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label} className="bg-[#1a1f2e] border-slate-700/50">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className={`text-xl font-bold mt-0.5 ${color}`}>{value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Monthly target progress */}
        {target != null && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-medium text-white">Monthly Income Target</span>
                </div>
                <span className="text-sm font-bold text-emerald-400">${currentPremium.toFixed(0)} / ${target.toLocaleString()}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressPct! >= 100 ? "bg-emerald-500" : progressPct! >= 60 ? "bg-blue-500" : "bg-violet-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {progressPct! >= 100 ? "Target reached!" : `${progressPct!.toFixed(0)}% of monthly target`}
                </span>
                {forecastData && forecastData.forecastTotal > currentPremium && (
                  <span className="text-xs text-blue-400">
                    Forecast by month-end: <strong>${forecastData.forecastTotal.toFixed(0)}</strong>
                    {" "}({forecastData.openPositionsCount} open positions)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Momentum chart (Recharts) */}
        {monthly.length > 0 && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm text-white">Monthly Income Momentum</CardTitle>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 opacity-70" />
                    Actual
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-400 opacity-50" />
                    Forecast
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-5 h-px bg-amber-400" style={{ display: "inline-block" }} />
                    <span className="text-amber-400">3-month avg</span>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />

                  {/* Monthly target reference line */}
                  {target && (
                    <ReferenceLine
                      y={target}
                      stroke="#8b5cf6"
                      strokeDasharray="5 3"
                      strokeOpacity={0.6}
                      label={{ value: "Target", position: "insideTopRight", fill: "#8b5cf6", fontSize: 10 }}
                    />
                  )}

                  {/* Actual premium bars */}
                  <Bar dataKey="Premium collected" stackId="income" maxBarSize={40} radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={entry.isCurrent ? "#10b981" : "#334155"}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>

                  {/* Forecast remainder (stacked) */}
                  <Bar dataKey="Forecast remainder" stackId="income" maxBarSize={40} fill="#60a5fa" opacity={0.45} radius={[3, 3, 0, 0]} />

                  {/* 3-month MA line */}
                  <Line
                    type="monotone"
                    dataKey="3-month avg"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                Green bar = current month actual · Blue = forecast from open positions' remaining theta · Amber line = 3-month rolling average
              </p>
            </CardContent>
          </Card>
        )}

        {/* Forecast detail panel */}
        {forecastData && forecastData.openPositionsCount > 0 && (
          <Card className="bg-[#1a1f2e] border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                This month's income forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Already collected</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">${forecastData.currentMonthActual.toFixed(0)}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Remaining theta</div>
                  <div className="text-lg font-bold text-blue-400 mt-0.5">+${forecastData.forecastRemainder.toFixed(0)}</div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Month-end total</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">${forecastData.forecastTotal.toFixed(0)}</div>
                </div>
              </div>

              {forecastData.detail.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Remaining theta by position:</p>
                  {forecastData.detail.map((d) => (
                    <div key={d.ticker} className="flex items-center justify-between text-xs px-2 py-1.5 bg-slate-800/40 rounded">
                      <span className="text-white font-medium">{d.ticker}</span>
                      <span className="text-blue-400">+${d.remainingTheta.toFixed(0)} est.</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                Theta decay estimated using square-root-of-time model · Actual results depend on early closes and assignment events
              </p>
            </CardContent>
          </Card>
        )}

        {/* Monthly table */}
        {monthly.length > 0 && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {["Month", "Premium collected", "Realised P&L", "Trades", "Assignments"].map((h) => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.bucket} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 text-white font-medium">
                          {monthLabel(m.bucket)}
                          {m.bucket === currentMonth && <Badge variant="outline" className="ml-2 text-xs border-blue-500/30 text-blue-400 bg-blue-500/10">Current</Badge>}
                        </td>
                        <td className="py-2.5 px-4 text-emerald-400 font-semibold">${(m.totalPremium ?? 0).toFixed(0)}</td>
                        <td className={`py-2.5 px-4 font-semibold ${(m.realisedPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(m.realisedPnl ?? 0) >= 0 ? "+" : ""}${(m.realisedPnl ?? 0).toFixed(0)}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">{m.tradeCount}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{m.assignments ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {monthly.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg text-muted-foreground">No income data yet</p>
            <p className="text-sm text-muted-foreground mt-1">Start selling options to track your premium income here</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
