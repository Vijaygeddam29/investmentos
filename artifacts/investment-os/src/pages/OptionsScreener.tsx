import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingDown, TrendingUp, RefreshCw, SlidersHorizontal, CheckCircle,
  AlertTriangle, Info, Star, Shield, DollarSign, BarChart2, ChevronDown,
  ChevronUp, Zap, BookOpen, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScreenerSignal {
  id: number;
  ticker: string;
  companyName: string;
  sector: string | null;
  marketCap: number | null;
  strategy: string;
  regime: string;
  strike: number;
  expiry: string;
  dte: number;
  premium: number;
  premiumYieldPct: number;
  probabilityProfit: number | null;
  ivPercentile: number | null;
  iv: number | null;
  fortressScore: number;
  aiRationale: string | null;
  capitalRequired: number;
  annualizedROC: number;
  confidenceScore: number;
  tier: "holdings" | "safe" | "high_confidence";
  maxProfit: number;
  maxLoss: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIERS = [
  { key: "all",             label: "All Signals",     icon: BarChart2, desc: "" },
  { key: "holdings",        label: "My Holdings",     icon: Star,      desc: "Covered calls on shares you already own — no extra capital needed" },
  { key: "safe",            label: "Safe & Solid",    icon: Shield,    desc: "Established, high-quality companies with fortress scores ≥ 65%" },
  { key: "high_confidence", label: "High Confidence", icon: Zap,       desc: "Highest composite confidence — best premium quality + stock quality" },
] as const;

const STRATEGIES = [
  { key: "all",       label: "All Strategies" },
  { key: "SELL_PUT",  label: "Sell Put" },
  { key: "SELL_CALL", label: "Sell Call" },
  { key: "WHEEL",     label: "Income Wheel" },
];

const SORT_OPTIONS = [
  { key: "roc",        label: "Best Return on Capital" },
  { key: "confidence", label: "Most Confident" },
  { key: "ivp",        label: "Highest IV Premium" },
  { key: "capital",    label: "Lowest Capital Required" },
];

function strategyBadge(strategy: string, tier: string) {
  if (tier === "holdings") return { label: "Covered Call", style: "text-blue-400 bg-blue-500/10 border-blue-500/30", Icon: TrendingUp };
  if (strategy === "SELL_PUT")  return { label: "Sell Put",     style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", Icon: TrendingDown };
  if (strategy === "SELL_CALL") return { label: "Sell Call",   style: "text-blue-400 bg-blue-500/10 border-blue-500/30", Icon: TrendingUp };
  return { label: "Income Wheel", style: "text-violet-400 bg-violet-500/10 border-violet-500/30", Icon: RefreshCw };
}

function tierBadge(tier: string) {
  if (tier === "holdings")        return { label: "★ My Holdings",     style: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  if (tier === "safe")            return { label: "✓ Safe Pick",        style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  return                                 { label: "↑ High Confidence", style: "text-violet-400 bg-violet-500/10 border-violet-500/30" };
}

function rocColor(roc: number) {
  if (roc >= 30) return "text-emerald-400";
  if (roc >= 15) return "text-amber-400";
  return "text-slate-300";
}

function formatCap(n: number) {
  if (n === 0) return <span className="text-emerald-400 font-medium text-xs">Free*</span>;
  if (n >= 100_000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function formatMarketCap(n: number | null) {
  if (!n) return null;
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000)     return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)         return `$${(n / 1_000_000).toFixed(0)}M`;
  return null;
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : "bg-slate-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-300 tabular-nums w-8 text-right">{score}%</span>
    </div>
  );
}

function IVBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">–</span>;
  const style = pct >= 60 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-slate-400";
  const label = pct >= 60 ? "Rich" : pct >= 40 ? "Fair" : "Cheap";
  return <span className={`text-xs font-medium ${style}`}>{Math.round(pct)}% <span className="text-muted-foreground font-normal">({label})</span></span>;
}

// ─── Rationale Modal ──────────────────────────────────────────────────────────

function RationaleModal({ signal, onClose }: { signal: ScreenerSignal | null; onClose: () => void }) {
  if (!signal) return null;
  const strat = strategyBadge(signal.strategy, signal.tier);
  const tier  = tierBadge(signal.tier);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <strat.Icon className="w-4 h-4" />
            {signal.ticker} — {strat.label}
            <Badge className={`text-[11px] border ml-1 ${tier.style}`}>{tier.label}</Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {signal.companyName} · {signal.strike} {signal.strategy === "SELL_PUT" ? "put" : "call"} expiring {signal.expiry} ({signal.dte} DTE)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Key metrics grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Premium collected",   value: `$${signal.premium.toFixed(2)}/share` },
              { label: "Annualised return",   value: `${signal.annualizedROC}%`, highlight: true },
              { label: "Capital required",    value: signal.capitalRequired === 0 ? "None (own shares)" : `$${signal.capitalRequired.toLocaleString()}` },
              { label: "Max profit",          value: `$${signal.maxProfit.toLocaleString()}` },
              { label: "Max loss",            value: signal.maxLoss ? `$${signal.maxLoss.toLocaleString()}` : "Upside capped" },
              { label: "Prob. of profit",     value: signal.probabilityProfit ? `${Math.round(signal.probabilityProfit * 100)}%` : "–" },
            ].map((m) => (
              <div key={m.label} className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className={`text-sm font-semibold ${(m as any).highlight ? "text-emerald-400" : "text-white"}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* AI Rationale */}
          {signal.aiRationale ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-violet-400" /> AI analysis
              </p>
              <div className="bg-slate-800/30 rounded-lg p-3">
                <p className="text-xs text-slate-300 leading-relaxed">{signal.aiRationale}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No AI analysis available for this signal yet.</p>
          )}

          {/* Holdings note */}
          {signal.tier === "holdings" && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Star className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                You already own shares of {signal.ticker}. Selling this covered call collects the premium with no additional capital. If the stock rises above ${signal.strike}, your shares are called away at a profit.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OptionsScreener() {
  const qc = useQueryClient();

  // Filter state
  const [activeTier, setActiveTier]         = useState<string>("all");
  const [activeStrategy, setActiveStrategy] = useState<string>("all");
  const [sortBy, setSortBy]                 = useState<string>("roc");
  const [minROC, setMinROC]                 = useState(0);
  const [maxCapital, setMaxCapital]         = useState(100_000);
  const [minConf, setMinConf]               = useState(0);
  const [minIVP, setMinIVP]                 = useState(0);
  const [sectorFilter, setSectorFilter]     = useState("all");
  const [showFilters, setShowFilters]       = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<ScreenerSignal | null>(null);
  const [queuedId, setQueuedId]             = useState<number | null>(null);

  const params = new URLSearchParams({
    strategy:   activeStrategy,
    tier:       activeTier,
    minROC:     String(minROC),
    maxCapital: maxCapital >= 100_000 ? "999999" : String(maxCapital),
    minConf:    String(minConf),
    minIVP:     String(minIVP),
    sector:     sectorFilter,
    sortBy,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["options-screener", params.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/options/screener?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json() as Promise<{ signals: ScreenerSignal[]; total: number; sectors: string[] }>;
    },
    staleTime: 2 * 60 * 1000,
  });

  const signals   = data?.signals ?? [];
  const allSectors = data?.sectors ?? [];

  const addToQueueMutation = useMutation({
    mutationFn: async (signalId: number) => {
      const r = await fetch("/api/options/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ios_jwt")}`,
        },
        body: JSON.stringify({ signalId }),
      });
      return r.json();
    },
    onSuccess: (_, signalId) => {
      setQueuedId(signalId);
      qc.invalidateQueries({ queryKey: ["options-queue"] });
    },
  });

  // Tier counts from current unfiltered data (approximate from signal list)
  const tierCounts = useMemo(() => {
    const all = signals;
    return {
      all:             all.length,
      holdings:        all.filter((s) => s.tier === "holdings").length,
      safe:            all.filter((s) => s.tier === "safe").length,
      high_confidence: all.filter((s) => s.tier === "high_confidence").length,
    };
  }, [signals]);

  return (
    <Layout>
      <div className="space-y-5 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Options Screener</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Loading signals…" : `${signals.length} opportunities · ranked by ${SORT_OPTIONS.find(s => s.key === sortBy)?.label}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters((f) => !f)}
              className={showFilters ? "border-violet-500/50 text-violet-300" : ""}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {showFilters ? "Hide filters" : "Filters"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Tier tabs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TIERS.map((t) => {
            const Icon = t.icon;
            const count = tierCounts[t.key as keyof typeof tierCounts] ?? 0;
            const active = activeTier === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTier(t.key)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-700 bg-[#1a1f2e] hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-violet-400" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-semibold ${active ? "text-white" : "text-slate-300"}`}>{t.label}</span>
                  {count > 0 && t.key !== "all" && (
                    <span className={`ml-auto text-xs font-mono px-1.5 py-0.5 rounded ${active ? "bg-violet-500/20 text-violet-300" : "bg-slate-700/50 text-muted-foreground"}`}>{count}</span>
                  )}
                  {t.key === "all" && (
                    <span className={`ml-auto text-xs font-mono px-1.5 py-0.5 rounded ${active ? "bg-violet-500/20 text-violet-300" : "bg-slate-700/50 text-muted-foreground"}`}>{signals.length}</span>
                  )}
                </div>
                {t.desc && <p className="text-[11px] text-muted-foreground leading-tight">{t.desc}</p>}
              </button>
            );
          })}
        </div>

        {/* ── Filter panel ── */}
        {showFilters && (
          <Card className="bg-[#1a1f2e] border-slate-700/50">
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                {/* Strategy */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-300 font-medium">Strategy</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {STRATEGIES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setActiveStrategy(s.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          activeStrategy === s.key
                            ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                            : "bg-slate-800/50 border-slate-700 text-muted-foreground hover:border-slate-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort by */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-300 font-medium">Sort by</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SORT_OPTIONS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSortBy(s.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          sortBy === s.key
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                            : "bg-slate-800/50 border-slate-700 text-muted-foreground hover:border-slate-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sector */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-300 font-medium">Sector</Label>
                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
                  >
                    <option value="all">All sectors</option>
                    {allSectors.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Min ROC */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300 font-medium">Min. return on capital</Label>
                    <span className="text-xs text-emerald-400 font-mono">{minROC}%/yr</span>
                  </div>
                  <Slider value={[minROC]} onValueChange={([v]) => setMinROC(v)} min={0} max={60} step={5} />
                  <p className="text-[11px] text-muted-foreground">Only show trades returning at least {minROC}% annualised on the capital blocked</p>
                </div>

                {/* Max capital */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300 font-medium">Max capital per trade</Label>
                    <span className="text-xs text-blue-400 font-mono">{maxCapital >= 100_000 ? "Any" : `$${maxCapital.toLocaleString()}`}</span>
                  </div>
                  <Slider value={[maxCapital]} onValueChange={([v]) => setMaxCapital(v)} min={1_000} max={100_000} step={1_000} />
                  <p className="text-[11px] text-muted-foreground">
                    {maxCapital >= 100_000 ? "No capital limit applied" : `Show only trades requiring ≤ $${maxCapital.toLocaleString()} collateral`}
                  </p>
                </div>

                {/* Min confidence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300 font-medium">Min. confidence score</Label>
                    <span className="text-xs text-violet-400 font-mono">{minConf}%</span>
                  </div>
                  <Slider value={[minConf]} onValueChange={([v]) => setMinConf(v)} min={0} max={90} step={5} />
                  <p className="text-[11px] text-muted-foreground">Composite of stock quality, IV quality, and probability of profit</p>
                </div>

                {/* Min IV percentile */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300 font-medium">Min. premium quality (IV%)</Label>
                    <span className="text-xs text-amber-400 font-mono">{minIVP}th percentile</span>
                  </div>
                  <Slider value={[minIVP]} onValueChange={([v]) => setMinIVP(v)} min={0} max={80} step={5} />
                  <p className="text-[11px] text-muted-foreground">Higher = options are priced more richly than usual. 50+ means premiums are elevated.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Stats summary ── */}
        {signals.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Best annual return",
                value: `${signals[0]?.annualizedROC ?? 0}%`,
                sub: signals[0]?.ticker ?? "–",
                color: "text-emerald-400",
              },
              {
                label: "Avg confidence",
                value: `${Math.round(signals.reduce((s, x) => s + x.confidenceScore, 0) / signals.length)}%`,
                sub: "across all results",
                color: "text-violet-400",
              },
              {
                label: "Lowest capital needed",
                value: signals.filter(s => s.capitalRequired > 0).length > 0
                  ? `$${Math.min(...signals.filter(s => s.capitalRequired > 0).map(s => s.capitalRequired)).toLocaleString()}`
                  : "From $0",
                sub: "cash-secured put or covered call",
                color: "text-blue-400",
              },
              {
                label: "Free income trades",
                value: signals.filter(s => s.capitalRequired === 0).length,
                sub: "covered calls (own shares)",
                color: "text-amber-400",
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#1a1f2e] border border-slate-700/50 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Results ── */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-[#1a1f2e] border border-slate-700/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-white font-medium">No signals match your filters</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Try loosening the filters, or generate new signals from the Options Signals page.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => {
              setMinROC(0); setMaxCapital(100_000); setMinConf(0); setMinIVP(0);
              setActiveStrategy("all"); setActiveTier("all"); setSectorFilter("all");
            }}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[1.8fr_1.2fr_0.8fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Company</span>
              <span>Strategy / Tier</span>
              <span>Strike / DTE</span>
              <span>Premium</span>
              <span className="text-emerald-400">Annual ROC</span>
              <span>Capital needed</span>
              <span>Confidence</span>
              <span></span>
            </div>

            {signals.map((signal) => {
              const strat = strategyBadge(signal.strategy, signal.tier);
              const tier  = tierBadge(signal.tier);
              const addedToQueue = queuedId === signal.id;

              return (
                <div
                  key={signal.id}
                  className="bg-[#1a1f2e] border border-slate-700/40 rounded-xl hover:border-slate-600/60 transition-all"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[1.8fr_1.2fr_0.8fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3">
                    {/* Company */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{signal.ticker}</span>
                        {signal.regime === "BEAR" && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{signal.companyName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {signal.sector && (
                          <span className="text-[10px] text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">{signal.sector}</span>
                        )}
                        {formatMarketCap(signal.marketCap) && (
                          <span className="text-[10px] text-slate-500">{formatMarketCap(signal.marketCap)}</span>
                        )}
                      </div>
                    </div>

                    {/* Strategy + tier */}
                    <div className="space-y-1">
                      <Badge className={`text-[11px] border ${strat.style}`}>
                        <strat.Icon className="w-3 h-3 mr-1 inline" />
                        {strat.label}
                      </Badge>
                      <Badge className={`text-[11px] border block w-fit ${tier.style}`}>{tier.label}</Badge>
                    </div>

                    {/* Strike / DTE */}
                    <div>
                      <p className="text-sm font-semibold text-white">${signal.strike}</p>
                      <p className="text-[11px] text-muted-foreground">{signal.dte} DTE · {signal.expiry.slice(5)}</p>
                    </div>

                    {/* Premium */}
                    <div>
                      <p className="text-sm font-semibold text-white">${signal.premium.toFixed(2)}<span className="text-[11px] text-muted-foreground">/sh</span></p>
                      <p className="text-[11px] text-muted-foreground">${signal.maxProfit} max profit</p>
                      <IVBadge pct={signal.ivPercentile} />
                    </div>

                    {/* Annual ROC — hero metric */}
                    <div>
                      <p className={`text-lg font-bold tabular-nums ${rocColor(signal.annualizedROC)}`}>
                        {signal.annualizedROC}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">annualised</p>
                      {signal.probabilityProfit && (
                        <p className="text-[11px] text-slate-400">{Math.round(signal.probabilityProfit * 100)}% win rate</p>
                      )}
                    </div>

                    {/* Capital */}
                    <div>
                      <p className="text-sm font-semibold text-white">{formatCap(signal.capitalRequired)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {signal.capitalRequired === 0 ? "already own shares" : "per contract (×100 shares)"}
                      </p>
                    </div>

                    {/* Confidence */}
                    <div className="min-w-[100px]">
                      <ConfidenceBar score={signal.confidenceScore} />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Fortress: {Math.round(signal.fortressScore * 100)}%
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                        onClick={() => setSelectedSignal(signal)}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        className={`h-7 text-xs ${addedToQueue ? "bg-emerald-600 hover:bg-emerald-700" : "bg-violet-600 hover:bg-violet-700"}`}
                        onClick={() => !addedToQueue && addToQueueMutation.mutate(signal.id)}
                        disabled={addedToQueue || addToQueueMutation.isPending}
                      >
                        {addedToQueue ? <><CheckCircle className="w-3 h-3 mr-1" /> Added</> : "Review"}
                      </Button>
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{signal.ticker}</span>
                          <Badge className={`text-[10px] border ${tier.style}`}>{tier.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{signal.companyName}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${rocColor(signal.annualizedROC)}`}>{signal.annualizedROC}%</p>
                        <p className="text-[10px] text-muted-foreground">annual ROC</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-800/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Strike</p>
                        <p className="text-sm font-semibold text-white">${signal.strike}</p>
                      </div>
                      <div className="bg-slate-800/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Premium</p>
                        <p className="text-sm font-semibold text-white">${signal.premium.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-800/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Capital</p>
                        <p className="text-sm font-semibold text-white">{formatCap(signal.capitalRequired)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ConfidenceBar score={signal.confidenceScore} />
                      <Button
                        size="sm"
                        className={`ml-auto h-7 text-xs ${addedToQueue ? "bg-emerald-600" : "bg-violet-600 hover:bg-violet-700"}`}
                        onClick={() => setSelectedSignal(signal)}
                      >
                        <Info className="w-3 h-3 mr-1" /> Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Holdings footnote */}
        {signals.some((s) => s.capitalRequired === 0) && (
          <p className="text-[11px] text-muted-foreground text-center pb-2">
            * "Free" covered calls require no additional capital because you already own the shares. Premium is pure income.
          </p>
        )}
      </div>

      {/* Rationale modal */}
      {selectedSignal && (
        <RationaleModal signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
      )}
    </Layout>
  );
}
