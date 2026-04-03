import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiBase } from "@/lib/api";
import { DollarSign, Target, TrendingUp, Calendar, RefreshCw } from "lucide-react";

interface MonthlyRow {
  bucket: string;
  totalPremium: number;
  realisedPnl: number;
  tradeCount: number;
  assignments: number;
}

function monthLabel(bucket: string) {
  const [year, month] = bucket.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

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

  const monthly: MonthlyRow[] = data?.monthly ?? [];
  const openTrades = data?.openTrades ?? [];
  const target = data?.monthlyIncomeTarget;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthData = monthly.find((m) => m.bucket === currentMonth);
  const ytdPremium = monthly.reduce((sum, m) => sum + (m.totalPremium ?? 0), 0);
  const ytdPnl = monthly.reduce((sum, m) => sum + (m.realisedPnl ?? 0), 0);
  const totalTrades = monthly.reduce((sum, m) => sum + (m.tradeCount ?? 0), 0);

  const currentPremium = currentMonthData?.totalPremium ?? 0;
  const progressPct = target ? Math.min((currentPremium / target) * 100, 100) : null;

  const maxPremium = Math.max(...monthly.map((m) => m.totalPremium ?? 0), 1);

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
              <div className="text-xs text-muted-foreground mt-1.5">
                {progressPct! >= 100 ? "Target reached!" : `${progressPct!.toFixed(0)}% of monthly target`}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly bar chart */}
        {monthly.length > 0 && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Monthly Premium Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {monthly.slice(0, 12).reverse().map((m) => {
                  const height = ((m.totalPremium ?? 0) / maxPremium) * 100;
                  const isCurrent = m.bucket === currentMonth;
                  return (
                    <div key={m.bucket} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end" style={{ height: "100px" }}>
                        <div
                          title={`$${(m.totalPremium ?? 0).toFixed(0)}`}
                          className={`w-full rounded-t transition-all ${isCurrent ? "bg-emerald-500" : "bg-slate-600 hover:bg-slate-500"}`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground" style={{ writingMode: "vertical-rl", fontSize: "9px" }}>
                        {monthLabel(m.bucket)}
                      </span>
                    </div>
                  );
                })}
              </div>
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
