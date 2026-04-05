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
  ChevronUp, Zap, BookOpen, X, Search, Grid3X3, Calendar,
  AlertCircle, ArrowRight, GitCompare,
} from "lucide-react";
import { ScenarioCompareModal } from "@/components/options/ScenarioCompareModal";

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

interface ExpiryInfo {
  date: string;
  dte: number;
  label: string;
  premiumQuality: "high" | "moderate" | "low" | null;
}

interface ChainContract {
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mid: number | null;
  iv: number | null;
  delta: number | null;
  theta: number | null;
  openInterest: number | null;
  volume: number | null;
  inTheMoney: boolean;
  annualizedROC: number | null;
  probabilityProfit: number | null;
  capitalRequired: number;
  premiumQuality: "high" | "moderate" | "low" | null;
}

interface EarningsInfo {
  nextEarningsDate: string | null;
  daysToEarnings: number | null;
  earningsWithin7Days: boolean;
  earningsWithin14Days: boolean;
}

interface OptionsChainResult {
  ticker: string;
  companyName: string | null;
  currentPrice: number | null;
  expiry: string;
  dte: number;
  calls: ChainContract[];
  puts: ChainContract[];
  ivRank: number | null;
  ivPercentile: number | null;
  iv: number | null;
  earnings: EarningsInfo;
  cachedAt: string;
  dataSource: "ibkr_live" | "yahoo_finance";
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

// ─── Earnings Warning Banner ──────────────────────────────────────────────────

function EarningsWarning({ earnings, ticker, dte }: { earnings: EarningsInfo | null; ticker: string; dte?: number }) {
  if (!earnings?.earningsWithin14Days) return null;
  const within7 = earnings.earningsWithin7Days;
  const days = earnings.daysToEarnings ?? 0;
  const overlapsDte = dte != null && days < dte;

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${
      within7
        ? "bg-red-500/10 border-red-500/30 text-red-300"
        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
    }`}>
      <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${within7 ? "text-red-400" : "text-amber-400"}`} />
      <div className="space-y-1">
        <p className="font-medium">
          {ticker} earnings {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
          {" "}({earnings.nextEarningsDate})
        </p>
        <p className="text-[11px] leading-relaxed opacity-90">
          {within7
            ? "IV is likely elevated due to the upcoming earnings event, inflating the premium you can collect. This is a double-edged sword: you earn more upfront, but the stock can move sharply after the announcement — in either direction."
            : "Earnings are coming up within your trade's DTE window. IV tends to rise before earnings then collapse after (IV crush)."
          }
          {overlapsDte && (
            <span className="block mt-1 font-medium">
              Recommendation: If you sell this option, it will expire {within7 ? "before" : "after"} earnings. Consider waiting until after the announcement when IV stabilises, or use a spread to cap your downside risk.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Rationale Modal ──────────────────────────────────────────────────────────

function RationaleModal({ signal, onClose }: { signal: ScreenerSignal | null; onClose: () => void }) {
  if (!signal) return null;
  const strat = strategyBadge(signal.strategy, signal.tier);
  const tier  = tierBadge(signal.tier);

  const { data: earnings } = useQuery<EarningsInfo>({
    queryKey: ["options-earnings", signal.ticker],
    queryFn: async () => {
      const r = await fetch(`/api/options/chain/${signal.ticker}/earnings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
  });

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
            {signal.companyName} · ${signal.strike} {signal.strategy === "SELL_PUT" ? "put" : "call"} expiring {signal.expiry} ({signal.dte} DTE)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <EarningsWarning earnings={earnings ?? null} ticker={signal.ticker} dte={signal.dte} />

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

// ─── Chain Contract Cell ──────────────────────────────────────────────────────

interface ContractDetailPanel {
  contract: ChainContract;
  side: "call" | "put";
  ticker: string;
  currentPrice: number;
  expiry: string;
  dte: number;
  onAddToQueue: () => void;
  onClose: () => void;
}

type MetricRow = {
  label: string;
  value: string;
  highlight?: boolean;
  style?: string;
};

function ContractDetailPanel({ contract, side, ticker, currentPrice, expiry, dte, onAddToQueue, onClose }: ContractDetailPanel) {
  const isOtm = side === "put" ? contract.strike < currentPrice : contract.strike > currentPrice;
  const pctFromMoney = Math.abs((contract.strike - currentPrice) / currentPrice * 100);
  const thetaPerContract = contract.theta != null ? (contract.theta * 100).toFixed(2) : null;

  // A/B/C quality grade derived from premiumQuality
  //   A = high (IV ≥ 40%, strong premium relative to capital)
  //   B = moderate (IV 25–39%)
  //   C = low or unavailable
  const qualityGrade =
    contract.premiumQuality === "high"     ? { grade: "A", style: "text-emerald-400" } :
    contract.premiumQuality === "moderate" ? { grade: "B", style: "text-amber-400"   } :
    contract.premiumQuality === "low"      ? { grade: "C", style: "text-slate-400"   } :
                                             { grade: "–", style: "text-muted-foreground" };

  const metrics: MetricRow[] = [
    {
      label: "Quality grade",
      value: qualityGrade.grade,
      style: qualityGrade.style,
    },
    { label: "Bid",             value: contract.bid != null ? `$${contract.bid.toFixed(2)}` : "–" },
    { label: "Ask",             value: contract.ask != null ? `$${contract.ask.toFixed(2)}` : "–" },
    { label: "Mid (premium)",   value: contract.mid != null ? `$${contract.mid.toFixed(2)}/sh` : "–", highlight: true },
    { label: "Open interest",   value: contract.openInterest != null ? contract.openInterest.toLocaleString() : "–" },
    { label: "Volume",          value: contract.volume != null ? contract.volume.toLocaleString() : "–" },
    { label: "IV",              value: contract.iv != null ? `${contract.iv}%` : "–" },
    { label: "Delta",           value: contract.delta != null ? contract.delta.toFixed(2) : "–" },
    {
      label: "Theta (daily decay)",
      value: thetaPerContract != null ? `$${thetaPerContract}/contract` : "–",
      style: "text-amber-400",
    },
    {
      label: isOtm ? "OTM by" : "ITM by",
      value: `${pctFromMoney.toFixed(1)}%`,
      style: isOtm ? "text-emerald-400" : "text-red-400",
    },
  ];

  return (
    <div className="absolute z-50 top-0 right-0 w-80 bg-[#0f1420] border border-slate-600 rounded-xl shadow-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-white">
            {ticker} ${contract.strike} {side === "put" ? "Put" : "Call"}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">Expiry: {expiry} ({dte} DTE)</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-slate-800/50 rounded-lg p-2 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
            <p className={`text-xs font-semibold ${m.highlight ? "text-emerald-400" : m.style ?? "text-white"}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {contract.annualizedROC != null && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300 font-medium">Annual return on capital</span>
            <span className="text-base font-bold text-emerald-400">{contract.annualizedROC}%</span>
          </div>
          {contract.probabilityProfit != null && (
            <p className="text-[11px] text-muted-foreground">{contract.probabilityProfit}% probability of profit</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Capital: ${contract.capitalRequired.toLocaleString()} · Max income: ${contract.mid != null ? (contract.mid * 100).toFixed(0) : "–"}
          </p>
        </div>
      )}

      <Button
        size="sm"
        className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs"
        onClick={onAddToQueue}
      >
        <ArrowRight className="w-3 h-3 mr-1.5" />
        Add to review queue
      </Button>
    </div>
  );
}

// ─── Chain View ───────────────────────────────────────────────────────────────

interface QueueResult {
  success: boolean;
  queueId: number;
  riskChecksPassed: boolean;
  riskNotes: string[];
  message: string;
}

function ChainView() {
  const qc = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [inputTicker, setInputTicker] = useState("");
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [selectedCell, setSelectedCell] = useState<{ strike: number; side: "call" | "put" } | null>(null);
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioSide, setScenarioSide] = useState<"put" | "call">("put");

  const { data: expiries, isLoading: expiriesLoading } = useQuery<{ expiries: ExpiryInfo[] }>({
    queryKey: ["options-expiries", ticker],
    queryFn: async () => {
      const r = await fetch(`/api/options/chain/${ticker}/expiries`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      return r.json();
    },
    enabled: !!ticker,
    staleTime: 15 * 60 * 1000,
  });

  const expiryList = expiries?.expiries ?? [];
  const activeExpiry = selectedExpiry || expiryList[0]?.date || "";

  const { data: chain, isLoading: chainLoading, error: chainError } = useQuery<OptionsChainResult>({
    queryKey: ["options-chain", ticker, activeExpiry],
    queryFn: async () => {
      const url = activeExpiry
        ? `/api/options/chain/${ticker}?expiry=${activeExpiry}`
        : `/api/options/chain/${ticker}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ios_jwt")}` },
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Chain unavailable");
      return r.json();
    },
    enabled: !!ticker && !!activeExpiry,
    staleTime: 15 * 60 * 1000,
  });

  const handleSearch = () => {
    const t = inputTicker.trim().toUpperCase();
    if (t) { setTicker(t); setSelectedExpiry(""); setSelectedCell(null); }
  };

  const addToQueueMutation = useMutation({
    mutationFn: async ({ contract, side }: { contract: ChainContract; side: "call" | "put" }) => {
      if (!chain) throw new Error("No chain loaded");
      const r = await fetch("/api/options/queue/from-chain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ios_jwt")}`,
        },
        body: JSON.stringify({
          ticker:       chain.ticker,
          side,
          strike:       contract.strike,
          expiry:       chain.expiry,
          dte:          chain.dte,
          mid:          contract.mid,
          currentPrice: chain.currentPrice,
          iv:           contract.iv,
          delta:        contract.delta,
          theta:        contract.theta,
          openInterest: contract.openInterest,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to queue trade");
      return data as QueueResult;
    },
    onSuccess: (result) => {
      setQueueResult(result);
      setSelectedCell(null);
      qc.invalidateQueries({ queryKey: ["options-queue"] });
    },
  });

  const allStrikes = useMemo(() => {
    if (!chain) return [];
    const putStrikes  = new Set(chain.puts.map((c)  => c.strike));
    const callStrikes = new Set(chain.calls.map((c) => c.strike));
    const all = new Set([...putStrikes, ...callStrikes]);
    return [...all].sort((a, b) => b - a);
  }, [chain]);

  const putByStrike  = useMemo(() => Object.fromEntries((chain?.puts  ?? []).map((c) => [c.strike, c])), [chain]);
  const callByStrike = useMemo(() => Object.fromEntries((chain?.calls ?? []).map((c) => [c.strike, c])), [chain]);

  const contractForCell = selectedCell
    ? (selectedCell.side === "put" ? putByStrike[selectedCell.strike] : callByStrike[selectedCell.strike])
    : null;

  function premiumQualityDot(q: "high" | "moderate" | "low" | null) {
    if (q === "high")     return "bg-emerald-400";
    if (q === "moderate") return "bg-amber-400";
    if (q === "low")      return "bg-slate-500";
    return "bg-transparent";
  }

  function cellClass(contract: ChainContract | undefined, itm: boolean) {
    if (!contract) return "text-muted-foreground/30";
    if (itm) return "bg-slate-700/40 text-slate-400";
    return "hover:bg-slate-700/50 cursor-pointer text-slate-200";
  }

  const ivRankLabel = chain?.ivRank != null
    ? (chain.ivRank >= 70 ? "High — rich premiums" : chain.ivRank >= 40 ? "Moderate" : "Low — thin premiums")
    : null;

  return (
    <div className="space-y-4">
      {/* Ticker search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={inputTicker}
            onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter ticker (e.g. AAPL, TSM, PLTR)..."
            className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={!inputTicker.trim()}>
          Load chain
        </Button>
        {ticker && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="border-violet-700/60 text-violet-400 hover:text-violet-300 hover:border-violet-500 text-xs"
              onClick={() => { setScenarioSide("put"); setScenarioOpen(true); }}
              title="Compare 3 put scenarios"
            >
              <GitCompare className="w-3.5 h-3.5 mr-1" /> Puts
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-700/60 text-blue-400 hover:text-blue-300 hover:border-blue-500 text-xs"
              onClick={() => { setScenarioSide("call"); setScenarioOpen(true); }}
              title="Compare 3 call scenarios"
            >
              <GitCompare className="w-3.5 h-3.5 mr-1" /> Calls
            </Button>
          </div>
        )}
        <div className="flex gap-1 flex-1 flex-wrap items-center">
          {["PLTR", "TSM", "AAPL", "NVDA", "MSFT"].map((t) => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInputTicker(t); setSelectedExpiry(""); setSelectedCell(null); }}
              className="px-2 py-1 text-xs rounded bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!ticker && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Grid3X3 className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-white font-medium">Search for a ticker to view its options chain</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Enter a stock ticker above to see all available strikes and expiry dates — calls on the left, puts on the right, just like a trading terminal.
          </p>
        </div>
      )}

      {ticker && (
        <>
          {/* Expiry selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Expiry:</span>
            {expiriesLoading && (
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-20 h-7 bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            )}
            {expiryList.map((exp) => {
              const active = (activeExpiry === exp.date) || (!selectedExpiry && exp === expiryList[0]);
              const qColor = exp.premiumQuality === "high" ? "text-emerald-400" : exp.premiumQuality === "moderate" ? "text-amber-400" : "text-slate-400";
              return (
                <button
                  key={exp.date}
                  onClick={() => setSelectedExpiry(exp.date)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    active
                      ? "bg-violet-500/20 border-violet-500/50 text-violet-300 font-medium"
                      : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <span className="font-semibold">{exp.label}</span>
                  <span className="ml-1 opacity-70">{exp.dte}d</span>
                  {exp.premiumQuality && (
                    <span className={`ml-1.5 ${qColor}`}>·</span>
                  )}
                </button>
              );
            })}
            {expiryList.length === 0 && !expiriesLoading && ticker && (
              <span className="text-xs text-muted-foreground">Loading expiry dates…</span>
            )}
          </div>

          {/* IV rank + earnings summary bar */}
          {chain && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                <span className="text-muted-foreground">Current price:</span>
                <span className="font-semibold text-white">${chain.currentPrice?.toFixed(2) ?? "–"}</span>
              </div>

              {chain.ivRank != null && (
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                  <span className="text-muted-foreground">IV Rank (52w):</span>
                  <span className={`font-semibold ${chain.ivRank >= 70 ? "text-emerald-400" : chain.ivRank >= 40 ? "text-amber-400" : "text-slate-300"}`}>
                    {chain.ivRank}%
                  </span>
                  {ivRankLabel && <span className="text-muted-foreground">— {ivRankLabel}</span>}
                </div>
              )}

              {chain.ivPercentile != null && (
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                  <span className="text-muted-foreground">IV Percentile (90d):</span>
                  <span className={`font-semibold ${chain.ivPercentile >= 60 ? "text-emerald-400" : chain.ivPercentile >= 35 ? "text-amber-400" : "text-slate-300"}`}>
                    {Math.round(chain.ivPercentile)}th
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                <span className="text-muted-foreground">DTE:</span>
                <span className="font-semibold text-white">{chain.dte} days</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                <div className="w-2 h-2 rounded-full bg-emerald-400" /> High premium
                <div className="w-2 h-2 rounded-full bg-amber-400 ml-2" /> Fair
                <div className="w-2 h-2 rounded-full bg-slate-500 ml-2" /> Low
              </div>
            </div>
          )}

          {chain?.earnings && (
            <EarningsWarning earnings={chain.earnings} ticker={ticker} dte={chain.dte} />
          )}

          {/* Chain grid */}
          {chainLoading && (
            <div className="space-y-1">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse" />
              ))}
            </div>
          )}

          {chainError && !chainLoading && (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Could not load chain for {ticker}. The ticker may not have listed options, or data is temporarily unavailable.</span>
            </div>
          )}

          {chain && !chainLoading && allStrikes.length > 0 && (
            <div className="relative overflow-x-auto">
              {/* Selected contract panel */}
              {selectedCell && contractForCell && (
                <div className="relative mb-3 min-h-[200px]">
                  <ContractDetailPanel
                    contract={contractForCell}
                    side={selectedCell.side}
                    ticker={ticker}
                    currentPrice={chain.currentPrice ?? 0}
                    expiry={chain.expiry}
                    dte={chain.dte}
                    onAddToQueue={() => addToQueueMutation.mutate({ contract: contractForCell, side: selectedCell.side })}
                    onClose={() => setSelectedCell(null)}
                  />
                </div>
              )}

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    {/* Calls header — left side */}
                    <th colSpan={5} className="py-2 text-center text-blue-400 font-semibold bg-blue-500/5 border-r border-slate-700">
                      CALLS — collect premium if stock stays below strike
                    </th>
                    {/* Strike — center */}
                    <th className="py-2 px-3 text-center text-slate-300 font-bold bg-slate-800/50 min-w-[80px]">
                      Strike
                    </th>
                    {/* Puts header — right side */}
                    <th colSpan={5} className="py-2 text-center text-emerald-400 font-semibold bg-emerald-500/5 border-l border-slate-700">
                      PUTS — collect premium if stock stays above strike
                    </th>
                  </tr>
                  <tr className="border-b border-slate-700/50 text-[11px] text-muted-foreground">
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">ROC/yr</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">Bid</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">Ask</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">OI</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5 border-r border-slate-700">IV%</th>
                    <th className="py-1.5 px-3 text-center bg-slate-800/50 font-medium text-slate-300">Price</th>
                    <th className="py-1.5 px-2 text-left bg-emerald-500/5 border-l border-slate-700">IV%</th>
                    <th className="py-1.5 px-2 text-left bg-emerald-500/5">OI</th>
                    <th className="py-1.5 px-2 text-left bg-emerald-500/5">Bid</th>
                    <th className="py-1.5 px-2 text-left bg-emerald-500/5">Ask</th>
                    <th className="py-1.5 px-2 text-left bg-emerald-500/5">ROC/yr</th>
                  </tr>
                </thead>
                <tbody>
                  {allStrikes.map((strike) => {
                    const call = callByStrike[strike];
                    const put  = putByStrike[strike];
                    const currentPrice = chain.currentPrice ?? 0;
                    const callItm  = strike < currentPrice;
                    const putItm   = strike > currentPrice;
                    const atMoney  = Math.abs(strike - currentPrice) / currentPrice < 0.015;
                    const callKey  = `${strike}-call`;
                    const putKey   = `${strike}-put`;
                    const callSelected = selectedCell?.strike === strike && selectedCell?.side === "call";
                    const putSelected  = selectedCell?.strike === strike && selectedCell?.side === "put";

                    return (
                      <tr
                        key={strike}
                        className={`border-b border-slate-800/50 transition-colors ${atMoney ? "bg-slate-700/20" : ""}`}
                      >
                        {/* Call ROC */}
                        <td
                          className={`py-2 px-2 text-right border-r border-slate-800/30 cursor-pointer ${callSelected ? "bg-blue-500/20" : callItm ? "bg-blue-500/5 text-slate-500" : "hover:bg-blue-500/10"}`}
                          onClick={() => call && setSelectedCell(callSelected ? null : { strike, side: "call" })}
                        >
                          {call?.annualizedROC != null ? (
                            <span className={call.annualizedROC >= 20 ? "text-emerald-400 font-semibold" : call.annualizedROC >= 10 ? "text-amber-400" : "text-slate-400"}>
                              {call.annualizedROC}%
                            </span>
                          ) : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Call bid */}
                        <td className={`py-2 px-2 text-right ${callItm ? "bg-blue-500/5 text-slate-500" : "hover:bg-blue-500/10"} cursor-pointer ${callSelected ? "bg-blue-500/20" : ""}`}
                          onClick={() => call && setSelectedCell(callSelected ? null : { strike, side: "call" })}>
                          {call?.bid != null ? `$${call.bid.toFixed(2)}` : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Call ask */}
                        <td className={`py-2 px-2 text-right ${callItm ? "bg-blue-500/5 text-slate-500" : "hover:bg-blue-500/10"} cursor-pointer ${callSelected ? "bg-blue-500/20" : ""}`}
                          onClick={() => call && setSelectedCell(callSelected ? null : { strike, side: "call" })}>
                          {call?.ask != null ? `$${call.ask.toFixed(2)}` : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Call OI */}
                        <td className={`py-2 px-2 text-right text-[10px] ${callItm ? "bg-blue-500/5 text-slate-500" : "text-slate-400"}`}>
                          {call?.openInterest != null ? (call.openInterest >= 1000 ? `${(call.openInterest/1000).toFixed(1)}k` : call.openInterest) : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Call IV */}
                        <td className={`py-2 px-2 text-right border-r border-slate-700 ${callItm ? "bg-blue-500/5 text-slate-500" : ""}`}>
                          {call?.iv != null ? (
                            <span className="flex items-center justify-end gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${premiumQualityDot(call.premiumQuality)}`} />
                              {call.iv}%
                            </span>
                          ) : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Strike price — center column */}
                        <td className={`py-2 px-3 text-center font-bold bg-slate-800/30 ${
                          atMoney ? "text-white bg-slate-700/40" : callItm ? "text-blue-300" : putItm ? "text-emerald-300" : "text-slate-300"
                        }`}>
                          ${strike}
                          {atMoney && <span className="block text-[9px] text-slate-400 font-normal">ATM</span>}
                        </td>

                        {/* Put IV */}
                        <td className={`py-2 px-2 border-l border-slate-700 ${putItm ? "bg-emerald-500/5 text-slate-500" : ""}`}>
                          {put?.iv != null ? (
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${premiumQualityDot(put.premiumQuality)}`} />
                              {put.iv}%
                            </span>
                          ) : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Put OI */}
                        <td className={`py-2 px-2 text-[10px] ${putItm ? "bg-emerald-500/5 text-slate-500" : "text-slate-400"}`}>
                          {put?.openInterest != null ? (put.openInterest >= 1000 ? `${(put.openInterest/1000).toFixed(1)}k` : put.openInterest) : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Put bid */}
                        <td className={`py-2 px-2 ${putItm ? "bg-emerald-500/5 text-slate-500" : "hover:bg-emerald-500/10"} cursor-pointer ${putSelected ? "bg-emerald-500/20" : ""}`}
                          onClick={() => put && setSelectedCell(putSelected ? null : { strike, side: "put" })}>
                          {put?.bid != null ? `$${put.bid.toFixed(2)}` : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Put ask */}
                        <td className={`py-2 px-2 ${putItm ? "bg-emerald-500/5 text-slate-500" : "hover:bg-emerald-500/10"} cursor-pointer ${putSelected ? "bg-emerald-500/20" : ""}`}
                          onClick={() => put && setSelectedCell(putSelected ? null : { strike, side: "put" })}>
                          {put?.ask != null ? `$${put.ask.toFixed(2)}` : <span className="text-slate-600">–</span>}
                        </td>

                        {/* Put ROC */}
                        <td
                          className={`py-2 px-2 border-l border-slate-800/30 cursor-pointer ${putSelected ? "bg-emerald-500/20" : putItm ? "bg-emerald-500/5 text-slate-500" : "hover:bg-emerald-500/10"}`}
                          onClick={() => put && setSelectedCell(putSelected ? null : { strike, side: "put" })}
                        >
                          {put?.annualizedROC != null ? (
                            <span className={put.annualizedROC >= 20 ? "text-emerald-400 font-semibold" : put.annualizedROC >= 10 ? "text-amber-400" : "text-slate-400"}>
                              {put.annualizedROC}%
                            </span>
                          ) : <span className="text-slate-600">–</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Click any cell to see full metrics and add to your review queue · ITM = in the money (shaded) ·{" "}
                {chain?.dataSource === "ibkr_live" ? (
                  <span className="text-emerald-400 font-medium">Live data via IBKR</span>
                ) : (
                  <span>Data cached 15 min from Yahoo Finance</span>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {/* Queue result dialog */}
      {queueResult && (
        <Dialog open onOpenChange={() => setQueueResult(null)}>
          <DialogContent className="bg-[#1a1f2e] border-slate-700 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                {queueResult.riskChecksPassed
                  ? <><CheckCircle className="w-4 h-4 text-emerald-400" /> Added to review queue</>
                  : <><AlertTriangle className="w-4 h-4 text-amber-400" /> Queued with risk flag</>
                }
              </DialogTitle>
              <DialogDescription className="text-slate-400">{queueResult.message}</DialogDescription>
            </DialogHeader>

            {queueResult.riskNotes.length > 0 && (
              <div className={`space-y-2 p-3 rounded-lg border text-xs ${
                queueResult.riskChecksPassed
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}>
                {queueResult.riskNotes.map((note, i) => (
                  <p key={i} className="leading-snug">{note}</p>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Go to the Options Signals page to review and place your order via IBKR.
            </p>

            <DialogFooter>
              <Button onClick={() => setQueueResult(null)} className="w-full">Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Scenario Compare Modal ─────────────────────────────────── */}
      {scenarioOpen && ticker && (
        <ScenarioCompareModal
          open={scenarioOpen}
          onClose={() => setScenarioOpen(false)}
          ticker={ticker}
          strategy={scenarioSide === "call" ? "SELL_CALL" : "SELL_PUT"}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OptionsScreener() {
  const qc = useQueryClient();

  const [activeView, setActiveView] = useState<"screener" | "chain">("screener");

  // Screener filter state
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
  const [screenerScenario, setScreenerScenario] = useState<{ ticker: string; strategy: string } | null>(null);

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
    enabled: activeView === "screener",
  });

  const signals    = data?.signals ?? [];
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
              {activeView === "screener"
                ? (isLoading ? "Loading signals…" : `${signals.length} opportunities · ranked by ${SORT_OPTIONS.find(s => s.key === sortBy)?.label}`)
                : "IBKR-style options chain — all strikes and expiries for any ticker"
              }
            </p>
          </div>
          <div className="flex gap-2">
            {activeView === "screener" && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* ── View tabs ── */}
        <div className="flex gap-1 border-b border-slate-800 pb-0">
          {[
            { key: "screener" as const, label: "Signals Screener",  icon: BarChart2,  desc: "AI-ranked trade ideas" },
            { key: "chain"    as const, label: "Chain View",        icon: Grid3X3,    desc: "All strikes & expiries" },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-violet-500 text-white font-medium"
                    : "border-transparent text-muted-foreground hover:text-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className="text-[11px] text-muted-foreground hidden md:inline">— {tab.desc}</span>
              </button>
            );
          })}
        </div>

        {/* ── Screener view ── */}
        {activeView === "screener" && (
          <>
            {/* Tier tabs */}
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

            {/* Filter panel */}
            {showFilters && (
              <Card className="bg-[#1a1f2e] border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-300 font-medium">Min. return on capital</Label>
                        <span className="text-xs text-emerald-400 font-mono">{minROC}%/yr</span>
                      </div>
                      <Slider value={[minROC]} onValueChange={([v]) => setMinROC(v)} min={0} max={60} step={5} />
                      <p className="text-[11px] text-muted-foreground">Only show trades returning at least {minROC}% annualised on the capital blocked</p>
                    </div>

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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-300 font-medium">Min. confidence score</Label>
                        <span className="text-xs text-violet-400 font-mono">{minConf}%</span>
                      </div>
                      <Slider value={[minConf]} onValueChange={([v]) => setMinConf(v)} min={0} max={90} step={5} />
                      <p className="text-[11px] text-muted-foreground">Composite of stock quality, IV quality, and probability of profit</p>
                    </div>

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

            {/* Stats summary */}
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

            {/* Results */}
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

                        <div className="space-y-1">
                          <Badge className={`text-[11px] border ${strat.style}`}>
                            <strat.Icon className="w-3 h-3 mr-1 inline" />
                            {strat.label}
                          </Badge>
                          <Badge className={`text-[11px] border block w-fit ${tier.style}`}>{tier.label}</Badge>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-white">${signal.strike}</p>
                          <p className="text-[11px] text-muted-foreground">{signal.dte} DTE · {signal.expiry.slice(5)}</p>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-white">${signal.premium.toFixed(2)}<span className="text-[11px] text-muted-foreground">/sh</span></p>
                          <p className="text-[11px] text-muted-foreground">${signal.maxProfit} max profit</p>
                          <IVBadge pct={signal.ivPercentile} />
                        </div>

                        <div>
                          <p className={`text-lg font-bold tabular-nums ${rocColor(signal.annualizedROC)}`}>
                            {signal.annualizedROC}%
                          </p>
                          <p className="text-[11px] text-muted-foreground">annualised</p>
                          {signal.probabilityProfit && (
                            <p className="text-[11px] text-slate-400">{Math.round(signal.probabilityProfit * 100)}% win rate</p>
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-white">{formatCap(signal.capitalRequired)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {signal.capitalRequired === 0 ? "already own shares" : "per contract (×100 shares)"}
                          </p>
                        </div>

                        <div className="min-w-[100px]">
                          <ConfidenceBar score={signal.confidenceScore} />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Fortress: {Math.round(signal.fortressScore * 100)}%
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                            onClick={() => setSelectedSignal(signal)}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-sky-400"
                            title="Compare scenarios"
                            onClick={() => setScreenerScenario({ ticker: signal.ticker, strategy: signal.strategy })}
                          >
                            <GitCompare className="w-3.5 h-3.5" />
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
                            className="ml-auto h-7 text-xs bg-violet-600 hover:bg-violet-700"
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

            {signals.some((s) => s.capitalRequired === 0) && (
              <p className="text-[11px] text-muted-foreground text-center pb-2">
                * "Free" covered calls require no additional capital because you already own the shares. Premium is pure income.
              </p>
            )}
          </>
        )}

        {/* ── Chain view ── */}
        {activeView === "chain" && <ChainView />}
      </div>

      {selectedSignal && (
        <RationaleModal signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
      )}

      {screenerScenario && (
        <ScenarioCompareModal
          open={!!screenerScenario}
          onClose={() => setScreenerScenario(null)}
          ticker={screenerScenario.ticker}
          strategy={screenerScenario.strategy as "SELL_PUT" | "SELL_CALL"}
        />
      )}
    </Layout>
  );
}
