import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiBase } from "@/lib/api";
import { RefreshCw, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Trade {
  id: number;
  ticker: string;
  right: string;
  strike: number;
  expiry: string;
  quantity: number;
  premiumCollected: number | null;
  openedAt: string;
  status: string;
  ibkrOrderId: string | null;
}

function dte(expiry: string): number {
  return Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function statusBadge(trade: Trade) {
  const d = dte(trade.expiry);
  if (d <= 7) return { label: "Act", color: "text-red-400 bg-red-500/10 border-red-500/30" };
  if (d <= 14) return { label: "Watch", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  return { label: "Safe", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
}

export default function OptionsPositions() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["options-trades"],
    queryFn: async () => {
      const r = await fetch(`/api/options/trades`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: ibkrData } = useQuery({
    queryKey: ["ibkr-positions"],
    queryFn: async () => {
      const r = await fetch(`/api/ibkr/positions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const closeMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/options/trades/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ios_jwt")}`,
        },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options-trades"] }),
  });

  const trades: Trade[] = (data?.trades ?? []).filter((t: Trade) => t.status === "open");
  const closedTrades: Trade[] = (data?.trades ?? []).filter((t: Trade) => t.status !== "open");

  const totalCollected = trades.reduce((sum, t) => sum + (t.premiumCollected ?? 0), 0);
  const urgentCount = trades.filter((t) => dte(t.expiry) <= 7).length;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Open Positions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {trades.length} open · ${totalCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })} premium at risk
              {urgentCount > 0 && <span className="text-red-400 ml-2">· {urgentCount} need attention</span>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Open positions", value: trades.length, color: "text-white" },
            { label: "Premium collected", value: `$${totalCollected.toFixed(0)}`, color: "text-emerald-400" },
            { label: "Need attention", value: urgentCount, color: urgentCount > 0 ? "text-red-400" : "text-white" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="bg-[#1a1f2e] border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* IBKR live positions */}
        {ibkrData?.connected && ibkrData.positions?.length > 0 && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                Live IBKR Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">{ibkrData.positions.length} positions synced from IBKR</div>
            </CardContent>
          </Card>
        )}

        {/* Open trades table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-20 rounded-lg bg-slate-800/40 animate-pulse" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-16">
            <TrendingDown className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg text-muted-foreground">No open positions</p>
            <p className="text-sm text-muted-foreground mt-1">Approve a signal to open your first position</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map((t) => {
              const d = dte(t.expiry);
              const sb = statusBadge(t);
              const isExpanded = expandedId === t.id;
              return (
                <Card key={t.id} className={`bg-[#1a1f2e] border transition-colors ${d <= 7 ? "border-red-500/40" : d <= 14 ? "border-amber-500/30" : "border-slate-700/50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="text-base font-bold text-white">{t.ticker}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t.right === "PUT" ? (
                              <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Short Put</span>
                            ) : (
                              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Short Call</span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-6 flex-1 text-sm">
                          <div><div className="text-xs text-muted-foreground">Strike</div><div className="text-white font-medium">${t.strike}</div></div>
                          <div><div className="text-xs text-muted-foreground">Expiry</div><div className="text-white font-medium">{t.expiry}</div></div>
                          <div><div className="text-xs text-muted-foreground">DTE</div><div className={`font-medium ${d <= 7 ? "text-red-400" : d <= 14 ? "text-amber-400" : "text-white"}`}>{d}d</div></div>
                          <div><div className="text-xs text-muted-foreground">Premium</div><div className="text-emerald-400 font-medium">${t.premiumCollected?.toFixed(0) ?? "–"}</div></div>
                        </div>
                        <Badge variant="outline" className={`text-xs border shrink-0 ${sb.color}`}>{sb.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="text-muted-foreground hover:text-white transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
                        {d <= 7 && (
                          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300">
                              {d === 0 ? "Expiring today" : `${d} days to expiry`} — consider closing or rolling this position.
                            </p>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Opened: {new Date(t.openedAt).toLocaleDateString("en-GB")}
                          {t.ibkrOrderId && <span className="ml-4">IBKR Order: {t.ibkrOrderId}</span>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-600"
                            onClick={() => closeMutation.mutate({ id: t.id, status: "closed" })}
                          >
                            <CheckCircle className="w-3 h-3 mr-1.5" /> Mark Closed (bought back)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-600"
                            onClick={() => closeMutation.mutate({ id: t.id, status: "expired" })}
                          >
                            Mark Expired (full profit)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            onClick={() => closeMutation.mutate({ id: t.id, status: "assigned" })}
                          >
                            Mark Assigned
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recently closed */}
        {closedTrades.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["Ticker", "Type", "Strike", "Expiry", "Premium", "Status", "Closed"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.slice(0, 10).map((t) => (
                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-white font-medium">{t.ticker}</td>
                      <td className="py-2 px-3 text-muted-foreground">{t.right}</td>
                      <td className="py-2 px-3 text-muted-foreground">${t.strike}</td>
                      <td className="py-2 px-3 text-muted-foreground">{t.expiry}</td>
                      <td className="py-2 px-3 text-emerald-400">${t.premiumCollected?.toFixed(0) ?? "–"}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={`text-xs ${
                          t.status === "expired" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                          t.status === "assigned" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                          "text-slate-400 border-slate-500/30"
                        }`}>{t.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {t.openedAt ? new Date(t.openedAt).toLocaleDateString("en-GB") : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
