import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TradeStoryPanel } from "@/components/options/TradeStoryPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, TrendingDown, TrendingUp, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, RotateCcw, X, Info, BarChart2, Shield,
  DollarSign, BookOpen, Activity,
} from "lucide-react";

// ─── Risk Dashboard Panel ─────────────────────────────────────────────────────

interface RiskDashboard {
  totalCollateral: number;
  totalPositions: number;
  nlv: number | null;
  marginPct: number | null;
  marginCapPct: number;
  marginStatus: "ok" | "elevated" | "breach" | "unknown";
  perTickerExposure: { ticker: string; collateral: number; pct: number }[];
  drawdownPct: number | null;
  currentMonthIncome: number;
  peakMonthIncome: number | null;
  estimatedOpenPnl: number;
}

function MarginDonut({ pct, cap, status }: { pct: number; cap: number; status: string }) {
  const clamped = Math.min(pct, cap);
  const overflowPct = Math.max(0, pct - cap);
  const stroke = status === "breach" ? "#ef4444" : status === "elevated" ? "#f59e0b" : "#10b981";
  const r = 26;
  const circ = 2 * Math.PI * r;
  const filledFrac = Math.min(clamped / 100, 1);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={stroke} strokeWidth="8"
        strokeDasharray={`${filledFrac * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      {overflowPct > 0 && (
        <circle cx="36" cy="36" r={r} fill="none"
          stroke="#ef4444" strokeWidth="4" strokeDasharray={`${Math.min(overflowPct / 100, 1) * circ} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 36 36)"
        />
      )}
      <text x="36" y="40" textAnchor="middle" fill={stroke} fontSize="12" fontWeight="700">
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

function RiskDashboardPanel() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<RiskDashboard>({
    queryKey: ["options-risk-dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/options/risk-dashboard", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="h-12 rounded-xl bg-slate-800/40 animate-pulse" />;
  if (!data) return null;

  const isHealthy = data.marginStatus === "ok" || data.marginStatus === "unknown";

  const statusColor = {
    ok:       "border-emerald-500/30 bg-emerald-500/5",
    elevated: "border-amber-500/30 bg-amber-500/5",
    breach:   "border-red-500/40 bg-red-500/10",
    unknown:  "border-slate-700 bg-slate-800/30",
  }[data.marginStatus];

  const statusText = {
    ok:       "Margin within limits",
    elevated: "Margin approaching limit",
    breach:   "Margin limit breached",
    unknown:  "Connect IBKR to see margin",
  }[data.marginStatus];

  const showCollapsed = isHealthy && !expanded;

  return (
    <div className={`rounded-xl border ${statusColor}`}>
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <Activity className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-white flex-1">Portfolio Risk Dashboard</span>
        {data.marginStatus === "breach" && (
          <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400 bg-red-500/10">MARGIN BREACH</Badge>
        )}
        {data.marginStatus === "elevated" && (
          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400 bg-amber-500/10">ELEVATED</Badge>
        )}
        {isHealthy && data.totalPositions > 0 && !expanded && (
          <>
            <span className="text-xs text-muted-foreground">
              {data.totalPositions} position{data.totalPositions !== 1 ? "s" : ""} ·{" "}
              {data.marginPct != null ? `${data.marginPct}% margin used` : "margin ok"} ·{" "}
              <span className="text-emerald-400">${data.currentMonthIncome.toLocaleString()} this month</span>
            </span>
          </>
        )}
        {isHealthy && data.totalPositions === 0 && !expanded && (
          <span className="text-xs text-muted-foreground">No open positions</span>
        )}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        }
      </button>

      {/* Full panel — shown when expanded or status is elevated/breach */}
      {!showCollapsed && (
      <div className="px-4 pb-4">

      <div className="flex items-start gap-4 flex-wrap">
        {/* Margin meter */}
        {data.marginPct != null ? (
          <div className="flex items-center gap-3">
            <MarginDonut pct={data.marginPct} cap={data.marginCapPct} status={data.marginStatus} />
            <div>
              <p className="text-xs font-medium text-white">{statusText}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {data.marginPct.toFixed(1)}% of {data.marginCapPct}% cap used
              </p>
              {data.nlv && (
                <p className="text-[11px] text-muted-foreground">
                  ${data.totalCollateral.toLocaleString()} of ${Math.round(data.nlv * data.marginCapPct / 100).toLocaleString()} available
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4 text-slate-500" />
            <span>Connect IBKR to see margin utilization</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Capital deployed</p>
            <p className="text-sm font-bold text-white">${data.totalCollateral.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{data.totalPositions} position{data.totalPositions !== 1 ? "s" : ""}</p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Estimated P&L (open)</p>
            <p className={`text-sm font-bold ${data.estimatedOpenPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {data.estimatedOpenPnl >= 0 ? "+" : ""}${data.estimatedOpenPnl.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">theta-decay model</p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">This month's income</p>
            <p className="text-sm font-bold text-emerald-400">${data.currentMonthIncome.toLocaleString()}</p>
            {data.peakMonthIncome && <p className="text-[10px] text-muted-foreground">Peak: ${data.peakMonthIncome.toLocaleString()}</p>}
          </div>

          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground">Monthly drawdown</p>
            {data.drawdownPct != null ? (
              <p className={`text-sm font-bold ${data.drawdownPct <= 10 ? "text-emerald-400" : data.drawdownPct <= 30 ? "text-amber-400" : "text-red-400"}`}>
                {data.drawdownPct > 0 ? `−${data.drawdownPct}%` : "On track"}
              </p>
            ) : (
              <p className="text-sm font-bold text-slate-400">–</p>
            )}
            <p className="text-[10px] text-muted-foreground">vs 3-month peak</p>
          </div>
        </div>
      </div>

      {/* Per-ticker exposure */}
      {data.perTickerExposure.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Capital concentration</p>
          <div className="flex flex-wrap gap-2">
            {data.perTickerExposure.slice(0, 6).map((t) => (
              <div key={t.ticker} className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white">{t.ticker}</span>
                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${t.pct > 20 ? "bg-red-500" : t.pct > 15 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(t.pct, 100)}%` }}
                  />
                </div>
                <span className={`text-[11px] font-mono ${t.pct > 20 ? "text-red-400" : "text-muted-foreground"}`}>{t.pct.toFixed(0)}%</span>
                {t.pct > 20 && <AlertTriangle className="w-3 h-3 text-red-400" />}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}

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
  realisedPnl?: number | null;
  notes?: string | null;
}

interface CoveredCallSuggestion {
  ticker: string;
  sharesOwned: number;
  contracts: number;
  avgCost: number;
  suggestedStrike: number;
  suggestedExpiry: string;
  dte: number;
  estPremiumPerContract: number;
  estTotalIncome: number;
  note: string;
}

function dte(expiry: string): number {
  return Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function urgencyPill(trade: Trade) {
  const d = dte(trade.expiry);
  const premium = trade.premiumCollected ?? 0;
  // Default profit target 50% = close when position value is 50% of what we collected
  const profitTarget = premium * 0.5;

  if (d === 0) return { label: "Expires today", color: "text-red-400 bg-red-500/15 border-red-500/40", urgent: true };
  if (d <= 7)  return { label: `${d} days left — act soon`, color: "text-red-400 bg-red-500/10 border-red-500/30", urgent: true };
  if (d <= 14) return { label: `${d} days — monitor`, color: "text-amber-400 bg-amber-500/10 border-amber-500/30", urgent: false };
  return { label: `${d} days`, color: "text-slate-400 bg-slate-500/10 border-slate-500/20", urgent: false };
}

export default function OptionsPositions() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rollModal, setRollModal] = useState<{ trade: Trade; data: Record<string, unknown> } | null>(null);
  const [closeModal, setCloseModal] = useState<{ trade: Trade; buyBackPrice: string } | null>(null);
  const [showStats, setShowStats] = useState(false);

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

  const [syncResult, setSyncResult] = useState<{ summary: string; autoClosed: number; added: number } | null>(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/options/positions/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    onSuccess: (data) => {
      setSyncResult(data);
      qc.invalidateQueries({ queryKey: ["options-trades"] });
      qc.invalidateQueries({ queryKey: ["options-performance"] });
    },
  });

  const { data: coveredCallsData } = useQuery({
    queryKey: ["covered-calls"],
    queryFn: async () => {
      const r = await fetch(`/api/options/covered-calls`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const { data: perfData } = useQuery({
    queryKey: ["options-performance"],
    queryFn: async () => {
      const r = await fetch(`/api/options/performance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const closeMutation = useMutation({
    mutationFn: async ({ id, limitPrice, status }: { id: number; limitPrice?: number; status?: string }) => {
      if (status) {
        // Manual mark
        const r = await fetch(`/api/options/trades/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
          body: JSON.stringify({ status }),
        });
        return r.json();
      }
      // IBKR close
      const r = await fetch(`/api/options/trades/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
        body: JSON.stringify({ limitPrice }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["options-trades"] });
      qc.invalidateQueries({ queryKey: ["options-performance"] });
      setCloseModal(null);
    },
  });

  const rollMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/options/trades/${id}/roll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    onSuccess: (data, id) => {
      const trade = trades.find((t) => t.id === id);
      if (trade) setRollModal({ trade, data });
    },
  });

  const trades: Trade[] = (data?.trades ?? []).filter((t: Trade) => t.status === "open");
  const closedTrades: Trade[] = (data?.trades ?? []).filter((t: Trade) => t.status !== "open");
  const perf = perfData?.summary;
  const coveredCalls: CoveredCallSuggestion[] = coveredCallsData?.positions ?? [];

  const totalAtRisk = trades.reduce((s, t) => s + (t.premiumCollected ?? 0), 0);
  const urgentCount = trades.filter((t) => dte(t.expiry) <= 7).length;
  const profitOpportunities = trades.filter((t) => {
    // 50% profit opportunity = option has decayed significantly
    return dte(t.expiry) > 0 && dte(t.expiry) <= 14;
  }).length;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Open Positions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {trades.length} open · ${totalAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })} in premium
              {urgentCount > 0 && <span className="text-red-400 ml-2">· {urgentCount} need attention now</span>}
              {profitOpportunities > 0 && <span className="text-emerald-400 ml-2">· {profitOpportunities} approaching profit target</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowStats((s) => !s)}>
              <BarChart2 className="w-4 h-4 mr-2" /> {showStats ? "Hide" : "Show"} track record
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing with IBKR..." : "Sync with IBKR"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Sync result */}
        {syncResult && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${
            (syncResult.autoClosed > 0 || syncResult.added > 0)
              ? "bg-blue-500/10 border-blue-500/30"
              : "bg-emerald-500/10 border-emerald-500/30"
          }`}>
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-white">{syncResult.summary}</p>
              {syncResult.autoClosed > 0 && (
                <p className="text-xs text-blue-300 mt-1">
                  {syncResult.autoClosed} position{syncResult.autoClosed > 1 ? "s" : ""} were in your records but not in IBKR — automatically marked as closed.
                </p>
              )}
              {syncResult.added > 0 && (
                <p className="text-xs text-blue-300 mt-0.5">
                  {syncResult.added} position{syncResult.added > 1 ? "s" : ""} found in IBKR that weren't in your records — added automatically.
                </p>
              )}
            </div>
            <button onClick={() => setSyncResult(null)} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Risk Dashboard */}
        <RiskDashboardPanel />

        {/* Philosophy banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300 space-y-1">
            <p className="font-medium text-blue-200">Income-first, no-loss philosophy</p>
            <p>
              <strong>Default rule: close at 50% profit.</strong> If you collected $200, buy back the option for $100 or less and lock in the profit.
              There's no need to wait until expiry — most of the value is captured at 50%.
            </p>
            <p>
              <strong>Max loss rule: close if the position doubles against you.</strong> If your $200 option is now worth $400, close it
              — you've risked $200 to potentially lose $400. Cut the loss, move on to the next trade.
            </p>
            <p>
              <strong>Roll when you're losing but the trade is sound.</strong> If a position is going against you with 7–14 days left but the company is still strong,
              roll it forward 30 days at the same strike to collect more premium and buy yourself time.
            </p>
          </div>
        </div>

        {/* Track record stats */}
        {showStats && perf && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Win rate",
                value: perf.winRate != null ? `${(perf.winRate * 100).toFixed(0)}%` : "–",
                sub: `${perf.wins} wins, ${perf.losses} losses`,
                color: perf.winRate != null && perf.winRate >= 0.7 ? "text-emerald-400" : "text-white",
              },
              {
                label: "Average win",
                value: perf.avgWin ? `$${perf.avgWin.toFixed(0)}` : "–",
                sub: "profit per closed trade",
                color: "text-emerald-400",
              },
              {
                label: "Average loss",
                value: perf.avgLoss ? `$${Math.abs(perf.avgLoss).toFixed(0)}` : "–",
                sub: "loss per losing trade",
                color: "text-red-400",
              },
              {
                label: "Total realised",
                value: perf.realisedPnl != null ? `$${perf.realisedPnl.toFixed(0)}` : "–",
                sub: "actual confirmed profit/loss",
                color: (perf.realisedPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
              },
            ].map(({ label, value, sub, color }) => (
              <Card key={label} className="bg-[#1a1f2e] border-slate-700/50">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Open positions", value: trades.length, color: "text-white" },
            { label: "Premium in the market", value: `$${totalAtRisk.toFixed(0)}`, color: "text-emerald-400", sub: "max you could collect if all expire" },
            { label: "Need attention", value: urgentCount, color: urgentCount > 0 ? "text-red-400" : "text-slate-500" },
          ].map(({ label, value, color, sub }) => (
            <Card key={label} className="bg-[#1a1f2e] border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
                {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Covered calls from your IBKR holdings */}
        {coveredCalls.length > 0 && (
          <Card className="bg-[#1a1f2e] border-blue-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Covered Call Opportunities — Your Existing Shares
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                You own enough shares of these companies to sell covered calls and earn extra income without buying anything new.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {coveredCalls.map((cc) => (
                <div key={cc.ticker} className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{cc.ticker}</span>
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/10">
                          Covered Call
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cc.note}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-emerald-400">${cc.estTotalIncome}</div>
                      <div className="text-xs text-muted-foreground">est. income</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Strike (sell at)", value: `$${cc.suggestedStrike}` },
                      { label: "Expiry", value: cc.suggestedExpiry },
                      { label: "Contracts", value: `${cc.contracts} (${cc.sharesOwned} shares)` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-800/50 rounded p-2">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="text-xs font-medium text-white mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    To place this trade: go to Signals page and filter for {cc.ticker} with "Sell Call" strategy, or place directly in IBKR.
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Not connected to IBKR note for covered calls */}
        {coveredCallsData && !coveredCallsData.connected && (
          <div className="flex items-start gap-3 p-3 bg-slate-800/60 border border-slate-700 rounded-lg">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {coveredCallsData.message}{" "}
              <a href="/settings/ibkr" className="text-blue-400 underline hover:no-underline">Connect IBKR →</a>
            </p>
          </div>
        )}

        {/* Open positions list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-24 rounded-lg bg-slate-800/40 animate-pulse" />)}
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-16">
            <TrendingDown className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg text-muted-foreground">No open positions</p>
            <p className="text-sm text-muted-foreground mt-1">Approve a signal on the Signals page to open your first position</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map((t) => {
              const d = dte(t.expiry);
              const pill = urgencyPill(t);
              const isExpanded = expandedId === t.id;
              const premium = t.premiumCollected ?? 0;
              const halfTarget = premium * 0.5;
              const maxLoss = premium * 2;
              const isRollCandidate = d <= 14 && d > 0;

              return (
                <Card key={t.id} className={`bg-[#1a1f2e] border transition-colors ${d <= 7 ? "border-red-500/40" : d <= 14 ? "border-amber-500/30" : "border-slate-700/50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="shrink-0">
                          <div className="text-base font-bold text-white">{t.ticker}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t.right === "PUT"
                              ? <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Cash-Secured Put</span>
                              : <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Covered Call</span>}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 flex-1 text-sm min-w-0">
                          <div>
                            <div className="text-xs text-muted-foreground">Strike</div>
                            <div className="text-white font-medium">${t.strike}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Expires</div>
                            <div className="text-white font-medium">{t.expiry}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Time left</div>
                            <div className={`font-medium ${d <= 7 ? "text-red-400" : d <= 14 ? "text-amber-400" : "text-white"}`}>
                              {d === 0 ? "Today!" : `${d} days`}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Income collected</div>
                            <div className="text-emerald-400 font-medium">${premium.toFixed(0)}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs border shrink-0 ${pill.color}`}>
                          {pill.label}
                        </Badge>
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                        className="text-muted-foreground hover:text-white transition-colors shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-4">

                        {/* Exit guidance */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                            <div className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
                              <CheckCircle className="w-3 h-3" /> Close at profit target
                            </div>
                            <div className="text-base font-bold text-emerald-400 mt-1">Buy back for ≤ ${halfTarget.toFixed(0)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              That locks in ${(premium - halfTarget).toFixed(0)} profit (50% of income collected)
                            </div>
                          </div>
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-xs text-red-300 font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3" /> Max loss — close if it costs
                            </div>
                            <div className="text-base font-bold text-red-400 mt-1">Buy back at ${maxLoss.toFixed(0)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Don't let the loss exceed 2× your income (${premium.toFixed(0)} collected)
                            </div>
                          </div>
                        </div>

                        {/* Roll suggestion */}
                        {isRollCandidate && (
                          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-amber-300">
                                Getting close to expiry — consider rolling forward
                              </p>
                              <p className="text-xs text-amber-400/80 mt-0.5">
                                Rolling means buying back this contract and selling a new one ~30 days out. You collect extra premium and buy yourself more time.
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0"
                              onClick={() => rollMutation.mutate(t.id)}
                              disabled={rollMutation.isPending}
                            >
                              <RotateCcw className="w-3 h-3 mr-1.5" />
                              {rollMutation.isPending ? "Generating..." : "Roll plan"}
                            </Button>
                          </div>
                        )}

                        {/* Opened info */}
                        <div className="text-xs text-muted-foreground">
                          Opened: {new Date(t.openedAt).toLocaleDateString("en-GB")}
                          {t.ibkrOrderId && <span className="ml-4 font-mono">IBKR: {t.ibkrOrderId}</span>}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            onClick={() => setCloseModal({ trade: t, buyBackPrice: halfTarget.toFixed(2) })}
                          >
                            <DollarSign className="w-3 h-3 mr-1.5" />
                            Close position
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-600"
                            onClick={() => closeMutation.mutate({ id: t.id, status: "expired" })}
                          >
                            <CheckCircle className="w-3 h-3 mr-1.5" />
                            Expired (full income)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-amber-500/30 text-amber-400"
                            onClick={() => closeMutation.mutate({ id: t.id, status: "assigned" })}
                          >
                            Assigned (shares)
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          "Expired" = option expired worthless, you keep all income. "Assigned" = you were obligated to buy/sell shares.
                          "Close position" = you bought back the option early.
                        </p>

                        {/* Trade Story */}
                        <TradeStoryPanel tradeId={t.id} ticker={t.ticker} status={t.status} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recent history */}
        {closedTrades.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Completed Trades
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    {["Company", "Type", "Strike", "Income collected", "Outcome", "P&L", "Closed"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.slice(0, 15).map((t) => (
                    <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-white font-medium">{t.ticker}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {t.right === "PUT" ? "Cash-Secured Put" : "Covered Call"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">${t.strike}</td>
                      <td className="py-2 px-3 text-emerald-400">${t.premiumCollected?.toFixed(0) ?? "–"}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={`text-xs ${
                          t.status === "expired"  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                          t.status === "assigned" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                          t.status === "closed"   ? "text-blue-400 border-blue-500/30 bg-blue-500/10" :
                          "text-slate-400 border-slate-500/30"
                        }`}>
                          {t.status === "expired" ? "Expired ✓" : t.status === "assigned" ? "Assigned" : t.status === "closed" ? "Closed early" : t.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        {t.realisedPnl != null ? (
                          <span className={t.realisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {t.realisedPnl >= 0 ? "+" : ""}${t.realisedPnl.toFixed(0)}
                          </span>
                        ) : <span className="text-muted-foreground">–</span>}
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

      {/* ─── Close Position Modal ─────────────────────────────────────────────── */}
      {closeModal && (
        <Dialog open onOpenChange={(o) => !o && setCloseModal(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Close position — {closeModal.trade.ticker}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Set the price you want to buy back the option for
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-300 leading-relaxed">
                You originally collected <strong className="text-emerald-400">${(closeModal.trade.premiumCollected ?? 0).toFixed(0)}</strong> from this trade.
                To close it, you buy back the option. The difference is your profit (or loss).
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="text-muted-foreground">50% target — close at</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    ${((closeModal.trade.premiumCollected ?? 0) * 0.5).toFixed(0)} buy-back
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    locks in ${((closeModal.trade.premiumCollected ?? 0) * 0.5).toFixed(0)} profit
                  </div>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="text-muted-foreground">Max loss at</div>
                  <div className="text-base font-bold text-red-400 mt-1">
                    ${((closeModal.trade.premiumCollected ?? 0) * 2).toFixed(0)} buy-back
                  </div>
                  <div className="text-muted-foreground mt-0.5">closes with 2× loss</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buy-back price (what you'll pay per contract × 100)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={closeModal.buyBackPrice}
                    onChange={(e) => setCloseModal((m) => m ? { ...m, buyBackPrice: e.target.value } : null)}
                    className="bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>
                {closeModal.buyBackPrice && (
                  <p className="text-xs text-muted-foreground">
                    Total cost to close: <strong className="text-white">${(parseFloat(closeModal.buyBackPrice) * 100).toFixed(0)}</strong>
                    {" · "}
                    P&L: <strong className={parseFloat(closeModal.buyBackPrice) * 100 <= (closeModal.trade.premiumCollected ?? 0) ? "text-emerald-400" : "text-red-400"}>
                      ${((closeModal.trade.premiumCollected ?? 0) - parseFloat(closeModal.buyBackPrice) * 100).toFixed(0)}
                    </strong>
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCloseModal(null)} className="border-slate-600">Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => closeMutation.mutate({ id: closeModal.trade.id, limitPrice: parseFloat(closeModal.buyBackPrice) })}
                disabled={closeMutation.isPending || !closeModal.buyBackPrice}
              >
                {closeMutation.isPending ? "Closing..." : "Close position"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Roll Modal ───────────────────────────────────────────────────────── */}
      {rollModal && (
        <Dialog open onOpenChange={(o) => !o && setRollModal(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Roll recommendation — {rollModal.trade.ticker}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Extend this trade to next month to collect more premium
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                  <div className="text-xs text-muted-foreground mb-2">Current trade (close this)</div>
                  {[
                    { label: "Strike", value: `$${rollModal.data.currentTrade ? (rollModal.data.currentTrade as any).strike : "–"}` },
                    { label: "Expires", value: (rollModal.data.currentTrade as any)?.expiry ?? "–" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                  <div className="text-xs text-amber-300 mb-2">New trade (open this)</div>
                  {[
                    { label: "Strike", value: `$${(rollModal.data.proposedRoll as any)?.strike ?? "–"}` },
                    { label: "New expiry", value: (rollModal.data.proposedRoll as any)?.newExpiry ?? "–" },
                    { label: "Days added", value: `+${(rollModal.data.proposedRoll as any)?.daysAdded ?? 30}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs py-0.5">
                      <span className="text-amber-400/70">{label}</span>
                      <span className="text-white font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {rollModal.data.rationale && (
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> AI recommendation
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">{rollModal.data.rationale as string}</p>
                </div>
              )}

              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs font-medium text-blue-300 mb-1">How to do this in IBKR</p>
                <p className="text-xs text-blue-400 leading-relaxed">{rollModal.data.instruction as string}</p>
              </div>

              <p className="text-xs text-muted-foreground">
                After you've completed the roll in IBKR, come back and mark this position as "Closed early" so your records stay accurate.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRollModal(null)} className="border-slate-600 flex-1">
                I'll handle it in IBKR
              </Button>
              <Button
                variant="outline"
                className="border-amber-500/30 text-amber-400 flex-1"
                onClick={() => {
                  closeMutation.mutate({ id: rollModal.trade.id, status: "closed" });
                  setRollModal(null);
                }}
              >
                Mark current as closed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
