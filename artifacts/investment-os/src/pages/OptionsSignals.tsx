import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiBase } from "@/lib/api";
import {
  TrendingDown, TrendingUp, RefreshCw, Zap, CheckCircle, XCircle, AlertTriangle, Info, BarChart2
} from "lucide-react";

const strategyConfig: Record<string, { label: string; color: string; icon: typeof TrendingDown; bg: string }> = {
  SELL_PUT:  { label: "Sell Put",  color: "text-emerald-400", icon: TrendingDown, bg: "bg-emerald-500/10 border-emerald-500/30" },
  SELL_CALL: { label: "Sell Call", color: "text-blue-400",    icon: TrendingUp,   bg: "bg-blue-500/10 border-blue-500/30" },
  WHEEL:     { label: "Wheel",     color: "text-violet-400",  icon: RefreshCw,    bg: "bg-violet-500/10 border-violet-500/30" },
};

const regimeColors: Record<string, string> = {
  BULL:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  BEAR:     "text-red-400 bg-red-500/10 border-red-500/30",
  SIDEWAYS: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  RECOVERY: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  UNKNOWN:  "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

function IvPercentileBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">–</span>;
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}th</span>
    </div>
  );
}

interface Signal {
  signal: {
    id: number;
    ticker: string;
    strategy: string;
    regime: string;
    strike: number;
    expiry: string;
    dte: number;
    premium: number;
    premiumYieldPct: number;
    probabilityProfit: number | null;
    ivPercentile: number | null;
    fortressScore: number | null;
    rocketScore: number | null;
    aiRationale: string | null;
    macroContext: string | null;
  };
  company: { name: string | null; sector: string | null };
}

export default function OptionsSignals() {
  const qc = useQueryClient();
  const [confirmSignal, setConfirmSignal] = useState<Signal | null>(null);
  const [orderResult, setOrderResult] = useState<{ status: string; message?: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["options-signals"],
    queryFn: async () => {
      const r = await fetch(`/api/options/signals`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: premarketData } = useQuery({
    queryKey: ["premarket-today"],
    queryFn: async () => {
      const r = await fetch(`/api/intelligence/premarket/today`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/options/signals/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/options/signals/${id}/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options-signals"] }),
  });

  const approveMutation = useMutation({
    mutationFn: async (signalId: number) => {
      const r = await fetch(`/api/options/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ios_jwt")}`,
        },
        body: JSON.stringify({ signalId }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      setConfirmSignal(null);
      setOrderResult(data);
      qc.invalidateQueries({ queryKey: ["options-signals"] });
      qc.invalidateQueries({ queryKey: ["options-queue"] });
    },
  });

  const briefing = premarketData?.briefing;
  const signals: Signal[] = data?.signals ?? [];

  const riskColor: Record<string, string> = {
    low: "text-emerald-400", moderate: "text-blue-400", elevated: "text-amber-400", high: "text-red-400",
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Options Signals</h1>
            <p className="text-sm text-muted-foreground mt-1">Regime-aware wheel candidates ranked by premium yield</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Zap className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? "Generating..." : "Generate Signals"}
            </Button>
          </div>
        </div>

        {generateMutation.data && (
          <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm text-blue-300">{generateMutation.data.message}</span>
          </div>
        )}

        {/* Today's macro context banner */}
        {briefing && (
          <div className={`p-4 rounded-lg border ${
            briefing.riskLevel === "high" ? "bg-red-500/10 border-red-500/30" :
            briefing.riskLevel === "elevated" ? "bg-amber-500/10 border-amber-500/30" :
            "bg-slate-800/50 border-slate-700"
          }`}>
            <div className="flex items-start gap-3">
              <BarChart2 className={`w-4 h-4 mt-0.5 shrink-0 ${riskColor[briefing.riskLevel] ?? "text-slate-400"}`} />
              <div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${riskColor[briefing.riskLevel]}`}>
                  {briefing.riskLevel} risk today
                  {briefing.positionSizeMultiplier < 0.95 && ` · Size at ${Math.round(briefing.positionSizeMultiplier * 100)}%`}
                </span>
                <p className="text-sm text-muted-foreground mt-0.5">{briefing.macroMood}</p>
                {briefing.optionsImplications && (
                  <p className="text-sm text-slate-300 mt-1">{briefing.optionsImplications}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Signal cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-56 rounded-lg bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg text-muted-foreground">No signals yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Generate Signals" to scan the universe for wheel candidates</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {signals.map(({ signal: s, company: c }) => {
              const strat = strategyConfig[s.strategy] ?? strategyConfig.SELL_PUT;
              const StratIcon = strat.icon;
              return (
                <Card key={s.id} className="bg-[#1a1f2e] border-slate-700/50 hover:border-slate-600 transition-colors">
                  <CardContent className="p-5 space-y-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-bold text-white">{s.ticker}</span>
                          <Badge variant="outline" className={`text-xs border ${strat.bg} ${strat.color}`}>
                            <StratIcon className="w-3 h-3 mr-1" />
                            {strat.label}
                          </Badge>
                          <Badge variant="outline" className={`text-xs border ${regimeColors[s.regime] ?? regimeColors.UNKNOWN}`}>
                            {s.regime}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{c?.name ?? s.ticker} · {c?.sector ?? "–"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-bold text-emerald-400">{s.premiumYieldPct.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">yield</div>
                      </div>
                    </div>

                    {/* Trade details */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: "Strike", value: `$${s.strike}` },
                        { label: "Expiry", value: s.expiry },
                        { label: "DTE", value: `${s.dte}d` },
                        { label: "Premium", value: `$${s.premium}/c` },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* IV + quality */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">IV Percentile</span>
                        <span className="text-muted-foreground">
                          PoP: {s.probabilityProfit != null ? `${s.probabilityProfit}%` : "–"}
                        </span>
                      </div>
                      <IvPercentileBar pct={s.ivPercentile} />
                      <div className="flex gap-3 text-xs text-muted-foreground pt-0.5">
                        <span>Fortress: <span className="text-white font-medium">{s.fortressScore != null ? (s.fortressScore * 100).toFixed(0) : "–"}</span></span>
                        <span>Rocket: <span className="text-white font-medium">{s.rocketScore != null ? (s.rocketScore * 100).toFixed(0) : "–"}</span></span>
                      </div>
                    </div>

                    {/* AI rationale */}
                    {s.aiRationale && (
                      <p className="text-xs text-slate-400 italic leading-relaxed border-l-2 border-slate-600 pl-3">
                        {s.aiRationale}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setConfirmSignal({ signal: s, company: c })}
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-muted-foreground hover:text-white"
                        onClick={() => dismissMutation.mutate(s.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1.5" /> Skip
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmSignal && (
        <Dialog open onOpenChange={(o) => !o && setConfirmSignal(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Confirm Trade</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Review the trade details before placing the order
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {(() => {
                const s = confirmSignal.signal;
                const c = confirmSignal.company;
                const strat = strategyConfig[s.strategy] ?? strategyConfig.SELL_PUT;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-white">{s.ticker}</span>
                      <Badge variant="outline" className={`text-xs border ${strat.bg} ${strat.color}`}>{strat.label}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Strike", value: `$${s.strike}` },
                        { label: "Expiry", value: s.expiry },
                        { label: "DTE", value: `${s.dte} days` },
                        { label: "Premium (1 contract)", value: `$${(s.premium * 100).toFixed(0)}` },
                        { label: "Yield", value: `${s.premiumYieldPct.toFixed(1)}% / ${s.dte}d` },
                        { label: "Order type", value: "Limit at mid-price" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-800/60 rounded-lg p-2.5">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300">
                        Collateral required: ~${(s.strike * 100).toLocaleString()} per contract.
                        Order will be placed as a limit at mid-price via your connected IBKR account.
                      </p>
                    </div>
                    {s.aiRationale && (
                      <p className="text-xs text-slate-400 italic border-l-2 border-slate-600 pl-3">{s.aiRationale}</p>
                    )}
                  </>
                );
              })()}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmSignal(null)} className="border-slate-600">Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => approveMutation.mutate(confirmSignal.signal.id)}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? "Placing order..." : "Confirm & Place Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Order result modal */}
      {orderResult && (
        <Dialog open onOpenChange={(o) => !o && setOrderResult(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white">
                {orderResult.status === "approved" ? "Order Placed" : "Trade Queued"}
              </DialogTitle>
            </DialogHeader>
            <div className={`p-4 rounded-lg ${orderResult.riskChecksPassed === false ? "bg-amber-500/10 border border-amber-500/30" : "bg-emerald-500/10 border border-emerald-500/30"}`}>
              <p className="text-sm text-white">{orderResult.message ?? "Trade approved and added to your review queue."}</p>
              {(orderResult as any).riskNotes?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {((orderResult as any).riskNotes as string[]).map((n, i) => (
                    <li key={i} className="text-xs text-amber-300">• {n}</li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setOrderResult(null)} className="w-full">Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
