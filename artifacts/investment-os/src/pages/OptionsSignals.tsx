import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingDown, TrendingUp, RefreshCw, Zap, CheckCircle, XCircle,
  AlertTriangle, Info, BarChart2, Search, SlidersHorizontal,
  Shield, BookOpen, HelpCircle, X, GitCompare, Award, Layers,
  ArrowRightLeft, Lock,
} from "lucide-react";
import { ScenarioCompareModal } from "@/components/options/ScenarioCompareModal";
import { SpreadAlternativeModal } from "@/components/options/SpreadAlternativeModal";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine, YAxis,
} from "recharts";

// ─── Strategy helpers ─────────────────────────────────────────────────────────

function strategyLabel(strategy: string, regime: string): { badge: string; color: string; bg: string; icon: typeof TrendingDown; plain: string } {
  if (strategy === "SELL_CALL" || (regime === "BEAR" && strategy === "SELL_PUT")) {
    return {
      badge: "Sell Call",
      plain: "Covered Call",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
      icon: TrendingUp,
    };
  }
  if (strategy === "WHEEL") {
    return {
      badge: "Wheel",
      plain: "Income Wheel",
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/30",
      icon: RefreshCw,
    };
  }
  return {
    badge: "Sell Put",
    plain: "Cash-Secured Put",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: TrendingDown,
  };
}

function regimePill(regime: string): { style: string; label: string; isBearWarning: boolean } {
  const map: Record<string, { style: string; label: string; isBearWarning: boolean }> = {
    BULL:     { style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "Rising market", isBearWarning: false },
    BEAR:     { style: "text-red-400 bg-red-500/10 border-red-500/30",             label: "Falling market", isBearWarning: true },
    SIDEWAYS: { style: "text-amber-400 bg-amber-500/10 border-amber-500/30",       label: "Sideways market", isBearWarning: false },
    RECOVERY: { style: "text-sky-400 bg-sky-500/10 border-sky-500/30",             label: "Recovering market", isBearWarning: false },
    UNKNOWN:  { style: "text-slate-400 bg-slate-500/10 border-slate-500/30",       label: "Unclear trend", isBearWarning: false },
  };
  return map[regime] ?? map.UNKNOWN;
}

// Premium quality bar — renamed from "IV Percentile" to plain English
function PremiumQualityBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">–</span>;
  const color = pct >= 60 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-slate-500";
  const label = pct >= 60 ? "High premiums available now" : pct >= 40 ? "Average premiums" : "Low premiums — not ideal timing";
  return (
    <div className="space-y-1">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Earnings Warning ─────────────────────────────────────────────────────────

interface EarningsProximityInfo {
  nextEarningsDate: string | null;
  daysToEarnings: number | null;
  earningsWithin7Days: boolean;
  earningsWithin14Days: boolean;
}

function EarningsWarningBadge({ ticker, dte }: { ticker: string; dte: number }) {
  const { data } = useQuery<EarningsProximityInfo>({
    queryKey: ["options-earnings", ticker],
    queryFn: async () => {
      const r = await fetch(`/api/options/chain/${ticker}/earnings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  if (!data?.earningsWithin14Days) return null;
  const days = data.daysToEarnings ?? 0;
  const within7 = data.earningsWithin7Days;
  const overlapsDte = days < dte;

  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
      within7
        ? "bg-red-500/10 border-red-500/30 text-red-300"
        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
    }`}>
      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${within7 ? "text-red-400" : "text-amber-400"}`} />
      <div className="space-y-0.5">
        <p className="font-medium">
          Earnings {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
          {data.nextEarningsDate ? ` (${data.nextEarningsDate})` : ""}
        </p>
        <p className="text-[11px] opacity-90 leading-snug">
          {within7
            ? "IV is likely inflated — you collect more premium but the stock can gap sharply after the report."
            : "Earnings fall within your option's expiry window. Consider waiting until after the announcement for more stable pricing."
          }
          {overlapsDte && (
            <span className="font-medium"> Your contract expires after earnings — plan accordingly.</span>
          )}
        </p>
      </div>
    </div>
  );
}

// Mini spark chart for the signal card
function SparkChart({ ticker }: { ticker: string }) {
  const { data } = useQuery({
    queryKey: ["price-history", ticker],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${ticker}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      const d = await r.json();
      return (d.company?.priceHistory ?? []).slice(-90) as Array<{ date: string; close: number }>;
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!data || data.length < 5) {
    return <div className="h-12 bg-slate-800/30 rounded animate-pulse" />;
  }

  const prices = data.map((p) => p.close);
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? "#10b981" : "#ef4444";

  return (
    <div className="h-12">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", fontSize: "11px", padding: "4px 8px" }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, ""]}
            labelFormatter={(l) => l}
          />
          <Line type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Full chart in modal (1d, 1m, 3m, 6m, 1y, 2y)
function FullChart({ ticker, currentPrice }: { ticker: string; currentPrice: number | null }) {
  const [range, setRange] = useState<"1m" | "3m" | "6m" | "1y" | "2y">("3m");
  const dayMap: Record<string, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365, "2y": 730 };

  const { data } = useQuery({
    queryKey: ["price-history", ticker],
    queryFn: async () => {
      const r = await fetch(`/api/companies/${ticker}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      const d = await r.json();
      return (d.company?.priceHistory ?? []) as Array<{ date: string; close: number }>;
    },
    staleTime: 10 * 60 * 1000,
  });

  const sliced = (data ?? []).slice(-(dayMap[range]));
  const prices = sliced.map((p) => p.close);
  const isUp = prices.length > 1 && prices[prices.length - 1] >= prices[0];
  const color = isUp ? "#10b981" : "#ef4444";

  const pctChange = prices.length > 1
    ? ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-white font-semibold">{ticker}</span>
          {currentPrice && <span className="text-sm text-muted-foreground ml-2">${currentPrice.toFixed(2)}</span>}
          {pctChange && (
            <span className={`text-xs ml-2 font-medium ${parseFloat(pctChange) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {parseFloat(pctChange) >= 0 ? "+" : ""}{pctChange}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(["1m", "3m", "6m", "1y", "2y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${range === r ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-white"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sliced}>
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", fontSize: "11px", padding: "4px 8px" }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
            />
            <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
  company: { name: string | null; sector: string | null; currentPrice?: number | null };
}

const PROFIT_TARGETS = [
  { label: "Conservative — close at 25% profit", pct: 0.25 },
  { label: "Balanced — close at 50% profit (recommended)", pct: 0.5 },
  { label: "Aggressive — hold to 75% profit", pct: 0.75 },
  { label: "Full income — hold to expiry", pct: 1.0 },
];

// ─── Regime explanation ───────────────────────────────────────────────────────

function RegimeExplainer({ regime }: { regime: string }) {
  const content: Record<string, { title: string; why: string; best: string; avoid?: string }> = {
    BULL: {
      title: "Rising market — good time to sell puts",
      why: "When stocks are rising, selling a put below the current price is low-risk: the stock is unlikely to fall to your strike, and you collect the cash.",
      best: "Sell puts on quality stocks you'd be happy to own anyway if assigned.",
    },
    BEAR: {
      title: "Falling market — use covered calls, not naked puts",
      why: "When stocks are falling, selling a put is risky because the stock may fall below your strike and you'll be forced to buy shares at a loss. Instead, if you already own shares, sell a call above the current price to collect income as the stock drifts sideways or down.",
      best: "Sell covered calls on shares you already own. Avoid selling puts until the market stabilises.",
      avoid: "Selling puts in a falling market means you could be forced to buy shares at $100 each when they're now worth $70.",
    },
    SIDEWAYS: {
      title: "Sideways market — ideal conditions for selling options",
      why: "When a stock isn't going anywhere, options lose value fast. You sell the option, collect the cash, and the option expires worthless. Both puts and calls work well here.",
      best: "Sell puts just below support, or sell calls just above resistance.",
    },
    RECOVERY: {
      title: "Recovering market — cautious puts on quality stocks",
      why: "Markets are starting to bounce back, but not fully confirmed yet. Selling puts on strong, cash-generative companies gives you income and the chance to buy quality at a discount if the recovery stalls.",
      best: "Focus on Fortress-quality companies with strong cash flows. Keep position sizes small.",
    },
  };

  const c = content[regime] ?? content.SIDEWAYS;
  const isBear = regime === "BEAR";

  return (
    <div className={`p-4 rounded-lg border space-y-2 ${isBear ? "bg-red-500/5 border-red-500/30" : "bg-slate-800/50 border-slate-700"}`}>
      <div className="flex items-start gap-2">
        <BookOpen className={`w-4 h-4 shrink-0 mt-0.5 ${isBear ? "text-red-400" : "text-blue-400"}`} />
        <div className="space-y-1.5">
          <p className={`text-sm font-semibold ${isBear ? "text-red-300" : "text-white"}`}>{c.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{c.why}</p>
          {c.avoid && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">{c.avoid}</p>
            </div>
          )}
          <p className="text-xs text-slate-300">✓ {c.best}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Track Record Badge ───────────────────────────────────────────────────────

function TrackRecordBadge({ ticker, strategy }: { ticker: string; strategy: string }) {
  const { data } = useQuery({
    queryKey: ["track-record", ticker, strategy],
    queryFn: async () => {
      const r = await fetch(
        `/api/options/signals/track-record/${ticker}?strategy=${encodeURIComponent(strategy)}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` } },
      );
      return r.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour — doesn't change often
  });

  if (!data || (data.wins === 0 && data.losses === 0 && data.assignments === 0)) return null;
  const total = data.wins + data.losses;
  const winPct = total > 0 ? Math.round((data.wins / total) * 100) : null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Award className="w-3 h-3 text-amber-400 shrink-0" />
      <span className="text-white font-medium">{data.wins}W / {data.losses}L</span>
      {data.assignments > 0 && <span>· {data.assignments} assigned</span>}
      {winPct != null && <span className={`font-medium ${winPct >= 70 ? "text-emerald-400" : winPct >= 50 ? "text-amber-400" : "text-red-400"}`}>({winPct}%)</span>}
      <span>on this system</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OptionsSignals() {
  const qc = useQueryClient();
  const [confirmSignal, setConfirmSignal] = useState<Signal | null>(null);
  const [profitTargetPct, setProfitTargetPct] = useState(0.5);
  const [orderResult, setOrderResult] = useState<Record<string, unknown> | null>(null);
  const [tickerFilter, setTickerFilter] = useState("");
  const [maxSharePrice, setMaxSharePrice] = useState<number>(500);
  const [showFilters, setShowFilters] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [chartSignal, setChartSignal] = useState<Signal | null>(null);
  const [scenarioSignal, setScenarioSignal] = useState<Signal | null>(null);
  const [spreadSignal, setSpreadSignal] = useState<Signal | null>(null);

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

  const { data: ibkrStatus } = useQuery({
    queryKey: ["ibkr-status"],
    queryFn: async () => {
      const r = await fetch(`/api/ibkr/status`, {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options-signals"] }),
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
    mutationFn: async ({ signalId, profitTargetPct }: { signalId: number; profitTargetPct: number }) => {
      const r = await fetch(`/api/options/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ios_jwt")}`,
        },
        body: JSON.stringify({ signalId, profitTargetPct }),
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
  const allSignals: Signal[] = data?.signals ?? [];
  const globalRegime: string = data?.regime ?? allSignals[0]?.signal?.regime ?? "NEUTRAL";

  const riskColor: Record<string, string> = {
    low: "text-emerald-400", moderate: "text-blue-400", elevated: "text-amber-400", high: "text-red-400",
  };

  // Filter logic
  const filteredSignals = useMemo(() => {
    return allSignals.filter((item) => {
      const s = item.signal;
      if (tickerFilter && !s.ticker.toUpperCase().includes(tickerFilter.toUpperCase())) return false;
      // Share price filter: collateral for sell put = strike × 100
      if (s.strategy === "SELL_PUT" || s.strategy === "WHEEL") {
        if (s.strike > maxSharePrice) return false;
      }
      return true;
    });
  }, [allSignals, tickerFilter, maxSharePrice]);

  const isIbkrConnected = ibkrStatus?.connected ?? false;

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Options Income Signals</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sell options to collect regular income — reviewed by you before any order is placed
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowExplainer((e) => !e)}
            >
              <HelpCircle className="w-4 h-4 mr-2" /> How it works
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFilters((f) => !f)}>
              <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              <Zap className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? "Scanning stocks..." : "Scan for opportunities"}
            </Button>
          </div>
        </div>

        {/* IBKR connection notice */}
        {!isIbkrConnected && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-300">IBKR account not connected</p>
              <p className="text-xs text-amber-400 mt-0.5">
                You can review and approve signals now, but to place real orders you'll need to connect your Interactive Brokers account.{" "}
                <a href="/settings/ibkr" className="underline hover:no-underline">Go to Settings →</a>
              </p>
            </div>
          </div>
        )}

        {/* How it works explainer */}
        {showExplainer && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">How options income works</h2>
              <button onClick={() => setShowExplainer(false)} className="text-muted-foreground hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="space-y-1.5">
                <div className="text-emerald-400 font-semibold">1 · Sell Put (Cash-Secured Put)</div>
                <p>You agree to buy 100 shares at a lower price (the "strike"). In return, you receive cash upfront (the "premium"). If the shares never fall to that price, you keep the cash and the deal is done. If they do fall to that price, you end up buying shares you'd be happy to own anyway.</p>
                <p className="text-amber-300">Works best when the market is rising or sideways.</p>
              </div>
              <div className="space-y-1.5">
                <div className="text-blue-400 font-semibold">2 · Sell Call (Covered Call)</div>
                <p>You already own shares. You sell someone else the option to buy them from you at a higher price (the "strike"). You receive cash upfront. If shares don't rise to that price, you keep the cash and your shares. If they do, you sell your shares at a profit you've already agreed to.</p>
                <p className="text-amber-300">Works best when you own shares and the market is flat or falling.</p>
              </div>
              <div className="space-y-1.5">
                <div className="text-violet-400 font-semibold">3 · The Wheel</div>
                <p>You run both strategies in sequence: sell a put until assigned shares, then sell calls on those shares until they're called away, then start again. It's a way to generate income from the same stock repeatedly.</p>
                <p className="text-amber-300">Works best on quality stocks you're happy to hold long-term.</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-semibold text-white">Filter signals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Search by company ticker</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. AAPL, MSFT..."
                    value={tickerFilter}
                    onChange={(e) => setTickerFilter(e.target.value.toUpperCase())}
                    className="pl-9 bg-slate-900/50 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Max share price (affects how much cash you need to set aside)</Label>
                  <span className="text-xs text-white font-medium">${maxSharePrice}</span>
                </div>
                <Slider
                  value={[maxSharePrice]}
                  onValueChange={([v]) => setMaxSharePrice(v)}
                  min={50} max={1000} step={25}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  To sell 1 put contract at this price you'd need to set aside ~${(maxSharePrice * 100).toLocaleString()} in cash as collateral
                </p>
              </div>
            </div>
            {filteredSignals.length !== allSignals.length && (
              <p className="text-xs text-blue-400">
                Showing {filteredSignals.length} of {allSignals.length} signals after filters
              </p>
            )}
          </div>
        )}

        {/* Today's market mood */}
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
                  Market mood today: {briefing.riskLevel === "low" ? "calm" : briefing.riskLevel === "moderate" ? "normal" : briefing.riskLevel === "elevated" ? "cautious" : "risk-off"}
                  {briefing.positionSizeMultiplier < 0.95 && ` · Trade smaller today (${Math.round(briefing.positionSizeMultiplier * 100)}% of normal size)`}
                </span>
                <p className="text-sm text-muted-foreground mt-0.5">{briefing.macroMood}</p>
                {briefing.optionsImplications && (
                  <p className="text-sm text-slate-300 mt-1">{briefing.optionsImplications}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Regime explainer */}
        {globalRegime && globalRegime !== "NEUTRAL" && (
          <RegimeExplainer regime={globalRegime} />
        )}

        {/* Generate result message */}
        {generateMutation.data && (
          <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm text-blue-300">{generateMutation.data.message}</span>
          </div>
        )}

        {/* Signal cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-64 rounded-lg bg-slate-800/40 animate-pulse" />)}
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg text-muted-foreground">{allSignals.length > 0 ? "No signals match your filters" : "No signals yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {allSignals.length > 0
                ? "Try broadening your filters above"
                : 'Click "Scan for opportunities" to find the best income trades available today'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSignals.map(({ signal: s, company: c }) => {
              const strat = strategyLabel(s.strategy, s.regime);
              const regime = regimePill(s.regime);
              const StratIcon = strat.icon;
              const cashNeeded = s.strike * 100;
              const incomePerContract = s.premium * 100;
              const annualised = s.dte > 0 ? (s.premiumYieldPct / s.dte * 365).toFixed(0) : "–";
              const targetCloseIncome = incomePerContract * profitTargetPct;
              const currentPrice = c?.currentPrice ?? null;

              return (
                <Card key={s.id} className={`bg-[#1a1f2e] border transition-colors hover:border-slate-600 ${regime.isBearWarning && s.strategy === "SELL_PUT" ? "border-red-500/40" : "border-slate-700/50"}`}>
                  <CardContent className="p-5 space-y-4">
                    {/* Bear warning on sell puts */}
                    {regime.isBearWarning && s.strategy === "SELL_PUT" && (
                      <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Falling market: be extra cautious selling puts. Consider skipping this one.
                      </div>
                    )}

                    {/* Earnings proximity warning */}
                    <EarningsWarningBadge ticker={s.ticker} dte={s.dte} />

                    {/* Top row: ticker + income */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-bold text-white">{s.ticker}</span>
                          <Badge variant="outline" className={`text-xs border ${strat.bg} ${strat.color}`}>
                            <StratIcon className="w-3 h-3 mr-1" />
                            {strat.plain}
                          </Badge>
                          <Badge variant="outline" className={`text-xs border ${regime.style}`}>
                            {regime.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c?.name ?? s.ticker}
                          {c?.sector ? ` · ${c.sector}` : ""}
                          {currentPrice ? ` · Currently $${currentPrice.toFixed(2)}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-bold text-emerald-400">${incomePerContract.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">income / contract</div>
                        <div className="text-xs text-emerald-400/70 mt-0.5">~{annualised}% / year</div>
                      </div>
                    </div>

                    {/* Spark chart */}
                    <SparkChart ticker={s.ticker} />

                    {/* Key details in plain English */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-slate-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-muted-foreground">You agree to buy at</div>
                        <div className="text-sm font-bold text-white mt-0.5">${s.strike}</div>
                        {currentPrice && <div className="text-xs text-muted-foreground">{((1 - s.strike / currentPrice) * 100).toFixed(0)}% below today's price</div>}
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-muted-foreground">Cash to set aside</div>
                        <div className="text-sm font-bold text-white mt-0.5">${cashNeeded.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">for 1 contract (100 shares)</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-muted-foreground">Expires</div>
                        <div className="text-sm font-bold text-white mt-0.5">{s.expiry}</div>
                        <div className="text-xs text-muted-foreground">{s.dte} days from today</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2.5">
                        <div className="text-xs text-muted-foreground">Chance of keeping all income</div>
                        <div className={`text-sm font-bold mt-0.5 ${(s.probabilityProfit ?? 0) >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                          {s.probabilityProfit != null ? `${s.probabilityProfit}%` : "–"}
                        </div>
                      </div>
                    </div>

                    {/* Premium quality */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">How good are premiums right now?</p>
                      <PremiumQualityBar pct={s.ivPercentile} />
                    </div>

                    {/* Quality scores */}
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-muted-foreground">Company quality:</span>
                      <span className="text-xs text-white font-medium">
                        {s.fortressScore != null ? `${(s.fortressScore * 100).toFixed(0)}/100` : "–"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {s.fortressScore != null && s.fortressScore >= 0.7
                          ? "Strong — well-run, cash-generative business"
                          : s.fortressScore != null && s.fortressScore >= 0.55
                          ? "Decent — passes our quality screen"
                          : ""}
                      </span>
                    </div>

                    {/* AI rationale */}
                    {s.aiRationale && (
                      <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-slate-600 pl-3">
                        {s.aiRationale}
                      </p>
                    )}

                    {/* Track record */}
                    <TrackRecordBadge ticker={s.ticker} strategy={s.strategy} />

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setConfirmSignal({ signal: s, company: c }); setProfitTargetPct(0.5); }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" /> Review & Place Order
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="border border-violet-700/60 text-violet-400 hover:text-violet-300 hover:border-violet-500"
                        onClick={() => setScenarioSignal({ signal: s, company: c })}
                        title="Compare 3 DTE/premium scenarios"
                      >
                        <GitCompare className="w-4 h-4 mr-1.5" /> Compare
                      </Button>
                      {(s.strategy === "SELL_PUT" || s.strategy === "WHEEL") && s.capitalRequired > 2000 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="border border-slate-600 text-slate-400 hover:text-violet-300 hover:border-violet-500/50"
                          onClick={() => setSpreadSignal({ signal: s, company: c })}
                          title="View spread alternative — caps your max loss at $500"
                        >
                          <Layers className="w-4 h-4 mr-1" /> Spread
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="border border-slate-700 text-muted-foreground hover:text-white"
                        onClick={() => setChartSignal({ signal: s, company: c })}
                        title="View price chart"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="border border-slate-700 text-muted-foreground hover:text-white"
                        onClick={() => dismissMutation.mutate(s.id)}
                        title="Skip this signal"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Full chart modal ───────────────────────────────────────────────── */}
      {chartSignal && (
        <Dialog open onOpenChange={(o) => !o && setChartSignal(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">
                {chartSignal.signal.ticker} — Price Chart
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {chartSignal.company?.name} · {chartSignal.company?.sector}
              </DialogDescription>
            </DialogHeader>
            <FullChart
              ticker={chartSignal.signal.ticker}
              currentPrice={chartSignal.company?.currentPrice ?? null}
            />
            <div className="flex items-start gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                The proposed strike price of <strong className="text-white">${chartSignal.signal.strike}</strong> is
                where you'd be agreeing to buy shares. Look for this level on the chart to judge how safe it looks.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChartSignal(null)} className="border-slate-600">Close</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => { setChartSignal(null); setConfirmSignal(chartSignal); setProfitTargetPct(0.5); }}
              >
                Review & Place Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Confirm modal ──────────────────────────────────────────────────── */}
      {confirmSignal && (
        <Dialog open onOpenChange={(o) => !o && setConfirmSignal(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Review your order — {confirmSignal.signal.ticker}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Check the details and choose your exit plan before placing
              </DialogDescription>
            </DialogHeader>

            {(() => {
              const s = confirmSignal.signal;
              const c = confirmSignal.company;
              const strat = strategyLabel(s.strategy, s.regime);
              const cashNeeded = s.strike * 100;
              const incomePerContract = s.premium * 100;
              const profitClose = incomePerContract * profitTargetPct;
              const stopLoss = incomePerContract * 2;

              return (
                <div className="space-y-4 py-1">
                  {/* What you're doing */}
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-sm text-slate-300 leading-relaxed">
                    {s.strategy === "SELL_PUT" ? (
                      <>You are selling 1 put contract on <strong className="text-white">{s.ticker}</strong>. This means you agree to buy 100 shares at <strong className="text-white">${s.strike}</strong> each (total ${cashNeeded.toLocaleString()}) if the share price falls below that level before <strong className="text-white">{s.expiry}</strong>. In return, you receive <strong className="text-emerald-400">${incomePerContract.toFixed(0)}</strong> in cash now.</>
                    ) : s.strategy === "SELL_CALL" ? (
                      <>You are selling 1 call contract on <strong className="text-white">{s.ticker}</strong>. This means you agree to sell 100 shares at <strong className="text-white">${s.strike}</strong> each if the price rises above that before <strong className="text-white">{s.expiry}</strong>. In return, you receive <strong className="text-emerald-400">${incomePerContract.toFixed(0)}</strong> in cash now.</>
                    ) : (
                      <>Wheel strategy on <strong className="text-white">{s.ticker}</strong>. You collect <strong className="text-emerald-400">${incomePerContract.toFixed(0)}</strong> income from this contract expiring <strong className="text-white">{s.expiry}</strong>.</>
                    )}
                  </div>

                  {/* Key numbers */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground">You receive today</div>
                      <div className="text-xl font-bold text-emerald-400 mt-0.5">${incomePerContract.toFixed(0)}</div>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                      <div className="text-xs text-muted-foreground">Cash to set aside</div>
                      <div className="text-xl font-bold text-white mt-0.5">${cashNeeded.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Exit plan */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white">When do you want to take your profit?</Label>
                    <div className="space-y-2">
                      {PROFIT_TARGETS.map((pt) => {
                        const ptIncome = incomePerContract * pt.pct;
                        return (
                          <button
                            key={pt.pct}
                            onClick={() => setProfitTargetPct(pt.pct)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                              profitTargetPct === pt.pct
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                            }`}
                          >
                            <span className="text-xs text-muted-foreground">{pt.label}</span>
                            <span className={`text-sm font-bold shrink-0 ml-2 ${profitTargetPct === pt.pct ? "text-emerald-400" : "text-white"}`}>
                              +${ptIncome.toFixed(0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When your profit reaches ${profitClose.toFixed(0)}, the system will alert you to close.
                      If the position moves against you by ${stopLoss.toFixed(0)} (2× income), we recommend closing to cut losses.
                    </p>
                  </div>

                  {/* Protective hedge reminder */}
                  <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-blue-300">Want to limit your maximum loss?</p>
                      <p className="text-xs text-blue-400 mt-0.5">
                        You can buy a put at a lower strike (e.g. ${(s.strike * 0.9).toFixed(0)}) as protection. This costs extra but caps your downside. Manage this directly in IBKR after placing the order.
                      </p>
                    </div>
                  </div>

                  {/* Collateral warning */}
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      Your broker (IBKR) will hold ${cashNeeded.toLocaleString()} as collateral while this trade is open.
                      {isIbkrConnected
                        ? " Order will be placed as a limit at mid-price."
                        : " IBKR is not connected — your order will be saved to your queue and placed when you connect."}
                    </p>
                  </div>
                </div>
              );
            })()}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmSignal(null)} className="border-slate-600">Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => approveMutation.mutate({ signalId: confirmSignal.signal.id, profitTargetPct })}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? "Placing order..." : isIbkrConnected ? "Confirm & Place Order" : "Save to Queue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Order result modal ─────────────────────────────────────────────── */}
      {orderResult && (
        <Dialog open onOpenChange={(o) => !o && setOrderResult(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white">
                {orderResult.blocked
                  ? "Trade blocked by risk gate"
                  : orderResult.status === "approved"
                  ? "✓ Order placed successfully"
                  : "Saved to your queue"}
              </DialogTitle>
            </DialogHeader>
            {orderResult.blocked ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">
                      {orderResult.breachType === "margin_cap" ? "Margin cap exceeded"
                        : orderResult.breachType === "per_trade_cap" ? "Per-trade capital limit exceeded"
                        : orderResult.breachType === "drawdown_circuit_breaker" ? "Drawdown circuit breaker active"
                        : "Concentration limit exceeded"}
                    </p>
                    <p className="text-xs text-red-400 mt-1">{orderResult.reason as string}</p>
                  </div>
                </div>
                {orderResult.suggestion && (
                  <div className="flex items-start gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                    <Layers className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-violet-300">{orderResult.suggestion as string}</p>
                  </div>
                )}
                {(orderResult.headroom as number) > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Margin headroom remaining: <span className="text-white font-mono">${(orderResult.headroom as number).toLocaleString()}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className={`p-4 rounded-lg ${(orderResult.riskChecksPassed as boolean) === false ? "bg-amber-500/10 border border-amber-500/30" : "bg-emerald-500/10 border border-emerald-500/30"}`}>
                <p className="text-sm text-white">{(orderResult.message as string) ?? "Your trade has been approved."}</p>
                {Array.isArray(orderResult.riskNotes) && (orderResult.riskNotes as string[]).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {(orderResult.riskNotes as string[]).map((n, i) => (
                      <li key={i} className="text-xs text-amber-300">• {n}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setOrderResult(null)} className="w-full">
                {orderResult.blocked ? "Understood" : "Done"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* ─── Scenario Compare Modal ─────────────────────────────────────── */}
      {scenarioSignal && (
        <ScenarioCompareModal
          open
          onClose={() => setScenarioSignal(null)}
          ticker={scenarioSignal.signal.ticker}
          strategy={scenarioSignal.signal.strategy}
        />
      )}
      {/* ─── Spread Alternative Modal ────────────────────────────────────── */}
      {spreadSignal && (
        <SpreadAlternativeModal
          signalId={spreadSignal.signal.id}
          ticker={spreadSignal.signal.ticker}
          onClose={() => setSpreadSignal(null)}
        />
      )}
    </Layout>
  );
}
