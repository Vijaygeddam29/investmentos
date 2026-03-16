import { useState, useMemo, Fragment } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListFactorSnapshots } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { PipelineTimestampBar } from "@/components/pipeline/PipelineTimestampBar";
import { IntelligenceDrawer, type IntelligenceSnapshot } from "@/components/company/IntelligenceDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Crown, ChevronDown, ChevronUp, ChevronsUpDown, Filter,
  Loader2, Info, Brain, ChevronRight,
} from "lucide-react";

// ─── Country flags ─────────────────────────────────────────────────────────────
const FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Netherlands": "🇳🇱", "Switzerland": "🇨🇭", "Australia": "🇦🇺",
  "Canada": "🇨🇦", "Brazil": "🇧🇷", "Ireland": "🇮🇪", "Spain": "🇪🇸",
  "Italy": "🇮🇹", "Taiwan": "🇹🇼", "South Korea": "🇰🇷", "Singapore": "🇸🇬",
  "Israel": "🇮🇱", "Denmark": "🇩🇰", "Hong Kong": "🇭🇰", "Uruguay": "🇺🇾",
};
const flag = (c?: string | null) => (c ? FLAGS[c] ?? "🌐" : "🌐");

// ─── Score interpretation ──────────────────────────────────────────────────────

interface Interp { label: string; color: string; bar: string }

function qualityInterp(v: number): Interp {
  if (v >= 75) return { label: "Exceptional",       color: "text-emerald-400", bar: "bg-emerald-500" };
  if (v >= 60) return { label: "Strong",            color: "text-blue-400",    bar: "bg-blue-500"    };
  if (v >= 45) return { label: "Moderate",          color: "text-amber-400",   bar: "bg-amber-500"   };
  if (v >= 30) return { label: "Below Average",     color: "text-orange-400",  bar: "bg-orange-500"  };
  return              { label: "Weak",              color: "text-red-400",     bar: "bg-red-500"     };
}
function opportunityInterp(v: number): Interp {
  if (v >= 75) return { label: "Highly Attractive", color: "text-emerald-400", bar: "bg-emerald-500" };
  if (v >= 60) return { label: "Attractive",        color: "text-blue-400",    bar: "bg-blue-500"    };
  if (v >= 45) return { label: "Moderate",          color: "text-amber-400",   bar: "bg-amber-500"   };
  if (v >= 30) return { label: "Limited",           color: "text-orange-400",  bar: "bg-orange-500"  };
  return              { label: "Unattractive",      color: "text-red-400",     bar: "bg-red-500"     };
}
function mispricingInterp(v: number): Interp {
  if (v >= 75) return { label: "Strong Edge",       color: "text-emerald-400", bar: "bg-emerald-500" };
  if (v >= 60) return { label: "Clear Edge",        color: "text-blue-400",    bar: "bg-blue-500"    };
  if (v >= 45) return { label: "Plausible",         color: "text-amber-400",   bar: "bg-amber-500"   };
  if (v >= 30) return { label: "Weak",              color: "text-orange-400",  bar: "bg-orange-500"  };
  return              { label: "No Edge",           color: "text-red-400",     bar: "bg-red-500"     };
}
// For Expectation and Fragility: LOWER is better, so colours are inverted
function expectationInterp(v: number): Interp {
  if (v >= 75) return { label: "Euphoric",          color: "text-red-400",     bar: "bg-red-500"     };
  if (v >= 60) return { label: "Elevated",          color: "text-orange-400",  bar: "bg-orange-500"  };
  if (v >= 45) return { label: "Moderate",          color: "text-amber-400",   bar: "bg-amber-500"   };
  if (v >= 30) return { label: "Modest",            color: "text-blue-400",    bar: "bg-blue-500"    };
  return              { label: "Depressed",         color: "text-emerald-400", bar: "bg-emerald-500" };
}
function fragilityInterp(v: number): Interp {
  if (v >= 75) return { label: "High Risk",         color: "text-red-400",     bar: "bg-red-500"     };
  if (v >= 60) return { label: "Elevated",          color: "text-orange-400",  bar: "bg-orange-500"  };
  if (v >= 45) return { label: "Moderate",          color: "text-amber-400",   bar: "bg-amber-500"   };
  if (v >= 30) return { label: "Robust",            color: "text-blue-400",    bar: "bg-blue-500"    };
  return              { label: "Very Robust",       color: "text-emerald-400", bar: "bg-emerald-500" };
}

function bandConfig(n: number | null | undefined) {
  if (n == null) return null;
  if (n >= 75) return { label: "CORE",      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", action: "Strong Buy", ac: "text-emerald-400", minPct: 6,   maxPct: 10  };
  if (n >= 60) return { label: "STANDARD",  badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",          action: "Buy",        ac: "text-blue-400",    minPct: 3,   maxPct: 5   };
  if (n >= 45) return { label: "STARTER",   badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",       action: "Add",        ac: "text-amber-400",   minPct: 1,   maxPct: 2.5 };
  if (n >= 30) return { label: "TACTICAL",  badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",    action: "Watch",      ac: "text-orange-400",  minPct: 0.5, maxPct: 1   };
  return              { label: "WATCHLIST", badge: "bg-secondary text-muted-foreground border-border/50",       action: "Avoid",      ac: "text-red-400",     minPct: 0,   maxPct: 0   };
}

// ─── Inline score bar (compact, for table rows) ────────────────────────────────

function MiniBar({ value, interp }: { value: number | null | undefined; interp: Interp | null }) {
  if (value == null || interp == null) return <span className="text-muted-foreground/30 text-xs">—</span>;
  return (
    <div className="flex flex-col items-end gap-0.5 min-w-[52px]">
      <div className="flex items-center gap-1 w-full justify-end">
        <div className="h-1.5 w-10 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${interp.bar}`} style={{ width: `${value}%` }} />
        </div>
        <span className={`font-mono text-[11px] font-bold ${interp.color}`}>{value}</span>
      </div>
      <span className={`text-[9px] ${interp.color} opacity-80 leading-none`}>{interp.label}</span>
    </div>
  );
}

// ─── Expanded analysis row ─────────────────────────────────────────────────────

function ExpandedRow({ s, onOpenDrawer }: { s: any; onOpenDrawer: () => void }) {
  const Q = s.companyQualityScore   != null ? Math.round(s.companyQualityScore   * 100) : null;
  const O = s.stockOpportunityScore != null ? Math.round(s.stockOpportunityScore * 100) : null;
  const M = s.mispricingScore       != null ? Math.round(s.mispricingScore       * 100) : null;
  const E = s.expectationScore      != null ? Math.round(s.expectationScore      * 100) : null;
  const F = s.fragilityScore        != null ? Math.round(s.fragilityScore        * 100) : null;
  const N = s.portfolioNetScore     != null ? Math.round(s.portfolioNetScore     * 100) : null;

  const rawWeighted = Q != null && O != null && M != null && E != null && F != null
    ? (2 * Q + 1 * O + 2 * M - 1 * E - 1 * F) : null;

  const band = bandConfig(N);

  const narrations: { label: string; color: string; bg: string; weight: string; v: number | null; text: string }[] = [
    {
      label: "Company Quality", color: "text-emerald-400", bg: "border-emerald-500/20 bg-emerald-950/5",
      weight: "+2×",
      v: Q,
      text: Q == null ? "" : Q >= 75 ? "Exceptional business — high ROIC, durable margins, strong capital allocation and genuine pricing power."
        : Q >= 60 ? "Above-average fundamentals — consistent profitability, solid capital returns and healthy balance sheet."
        : Q >= 45 ? "Average quality business with some competitive strengths but limited moat depth."
        : Q >= 30 ? "Below-average returns — thin margins or capital-intensive model compressing value creation."
        : "Weak fundamentals — poor capital returns, margin pressure or structural business challenges.",
    },
    {
      label: "Stock Opportunity", color: "text-blue-400", bg: "border-blue-500/20 bg-blue-950/5",
      weight: "+1×",
      v: O,
      text: O == null ? "" : O >= 75 ? "Compelling setup — meaningful discount to intrinsic value with positive revisions and improving entry timing."
        : O >= 60 ? "Good opportunity — stock undervalued vs fundamentals with favourable momentum signals."
        : O >= 45 ? "Mixed setup — reasonably priced but lacks a clear directional catalyst."
        : O >= 30 ? "Limited upside — near full value with flat revisions and limited near-term potential."
        : "Poor setup — overvalued vs history and peers, or negative revisions creating downside risk.",
    },
    {
      label: "Mispricing", color: "text-amber-400", bg: "border-amber-500/20 bg-amber-950/5",
      weight: "+2×",
      v: M,
      text: M == null ? "" : M >= 75 ? "High-conviction edge — temporary issue masking durable quality. Clear catalyst visible within 6–24 months."
        : M >= 60 ? "Market understates structural strengths — revisions turning positive with margin normalisation ahead."
        : M >= 45 ? "Plausible mispricing — temporary factors may be suppressing true economics. Thesis still building."
        : M >= 30 ? "Limited evidence of mispricing — market appears reasonably informed about business conditions."
        : "No detectable edge — stock appears fairly or optimistically priced vs visible fundamentals.",
    },
    {
      label: "Expectation", color: E != null && E >= 60 ? "text-orange-400" : E != null && E >= 45 ? "text-amber-400" : "text-emerald-400",
      bg: E != null && E >= 60 ? "border-orange-500/20 bg-orange-950/5" : "border-emerald-500/20 bg-emerald-950/5",
      weight: "−1×",
      v: E,
      text: E == null ? "" : E >= 75 ? "Perfection priced in — very high bar. Any disappointment risks a sharp de-rating from a crowded long."
        : E >= 60 ? "High consensus optimism creates execution risk — the bar to beat is demanding."
        : E >= 45 ? "Balanced expectation bar — consensus achievable, neither too optimistic nor too pessimistic."
        : E >= 30 ? "Low bar — meaningful room to positively surprise consensus and drive multiple expansion."
        : "Market assumes failure — even modest positive news could trigger a significant re-rating.",
    },
    {
      label: "Fragility", color: F != null && F >= 60 ? "text-red-400" : F != null && F >= 45 ? "text-amber-400" : "text-emerald-400",
      bg: F != null && F >= 60 ? "border-red-500/20 bg-red-950/5" : "border-emerald-500/20 bg-emerald-950/5",
      weight: "−1×",
      v: F,
      text: F == null ? "" : F >= 75 ? "Fragile thesis — concentrated revenue, high leverage or regulatory exposure threatens the investment story."
        : F >= 60 ? "Multiple vulnerabilities present — structural weaknesses could derail the thesis."
        : F >= 45 ? "Manageable risks — thesis intact under most scenarios but execution quality matters."
        : F >= 30 ? "Resilient business — limited vulnerabilities, diversified revenue and strong interest coverage."
        : "Fortress-grade resilience — clean balance sheet, diversified revenue and low disruption exposure.",
    },
  ];

  return (
    <tr>
      <td colSpan={12} className="px-4 pb-4 pt-2 bg-muted/5 border-b border-border/40">

        {/* Formula calculation */}
        {rawWeighted != null && (
          <div className="mb-3 rounded-lg border border-violet-500/20 bg-violet-950/10 px-4 py-3">
            <div className="text-[10px] text-violet-400 uppercase tracking-wider font-semibold mb-2">Score Derivation — hover each term for explanation</div>
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              {[
                { val: `2×${Q}`, color: "text-emerald-400", tip: "Quality ×2 — business durability: ROIC, margins, capital allocation. Double-weighted as the strongest long-term predictor." },
                { val: `+1×${O}`, color: "text-blue-400",    tip: "Opportunity ×1 — stock attractiveness: FCF yield, valuation vs history, entry timing, insider signals." },
                { val: `+2×${M}`, color: "text-amber-400",   tip: "Mispricing ×2 — market edge: temporary factors depressing the price vs intrinsic value. Double-weighted for high-conviction opportunities." },
                { val: `−1×${E}`, color: "text-orange-400",  tip: "Expectation ×1 — penalised. Priced-in optimism: forward P/E premium, analyst saturation, crowded long positioning." },
                { val: `−1×${F}`, color: "text-red-400",     tip: "Fragility ×1 — penalised. Thesis risks: high leverage, revenue concentration, SBC dilution, cash flow instability." },
              ].map(({ val, color, tip }, i) => (
                <Tooltip key={i} delayDuration={150}>
                  <TooltipTrigger asChild>
                    <span className={`${color} cursor-help underline decoration-dotted underline-offset-2`}>{val}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-relaxed z-[9999]">
                    {tip}
                  </TooltipContent>
                </Tooltip>
              ))}
              <span className="text-muted-foreground">=</span>
              <span className="text-foreground font-bold">{rawWeighted} raw</span>
              <span className="text-muted-foreground">→</span>
              <span className={`font-bold ${N != null && N >= 75 ? "text-emerald-400" : N != null && N >= 60 ? "text-blue-400" : N != null && N >= 45 ? "text-amber-400" : "text-orange-400"}`}>
                {N}/100
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground/50 mt-1 font-mono">Normalisation: (raw + 200) ÷ 700 × 100</div>
          </div>
        )}

        {/* 5-component narration grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 mb-3">
          {narrations.map(n => (
            <div key={n.label} className={`rounded-lg border px-3 py-2.5 ${n.bg}`}>
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-bold ${n.v != null && n.label === "Expectation" && n.v <= 45 ? "text-emerald-400" : n.v != null && n.label === "Fragility" && n.v <= 45 ? "text-emerald-400" : n.color}`}>{n.weight}</span>
                  <span className="text-[10px] font-semibold text-foreground">{n.label}</span>
                </div>
                {n.v != null && <span className={`font-mono text-xs font-bold ${n.color}`}>{n.v}</span>}
              </div>
              {n.v != null && (
                <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full ${
                    n.label === "Expectation" ? (n.v >= 60 ? "bg-orange-500" : n.v >= 45 ? "bg-amber-500" : "bg-emerald-500") :
                    n.label === "Fragility"   ? (n.v >= 60 ? "bg-red-500"    : n.v >= 45 ? "bg-amber-500" : "bg-emerald-500") :
                    n.v >= 65 ? "bg-emerald-500" : n.v >= 50 ? "bg-blue-500" : n.v >= 35 ? "bg-amber-500" : "bg-red-500"
                  }`} style={{ width: `${n.v}%` }} />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-relaxed">{n.text || "No data"}</p>
            </div>
          ))}
        </div>

        {/* Recommendation + drill-down */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {band && (
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              band.label === "CORE" ? "border-emerald-500/30 bg-emerald-950/10" :
              band.label === "STANDARD" ? "border-blue-500/30 bg-blue-950/10" :
              band.label === "STARTER" ? "border-amber-500/30 bg-amber-950/10" :
              band.label === "TACTICAL" ? "border-orange-500/30 bg-orange-950/10" :
              "border-border"
            }`}>
              <div>
                <div className={`text-sm font-bold ${band.ac}`}>{band.action}</div>
                <div className="text-[10px] text-muted-foreground">
                  Band: <strong className="text-foreground">{band.label}</strong>
                  {band.minPct > 0 && <span> · Suggested size: <strong className={`font-mono ${band.ac}`}>{band.minPct}–{band.maxPct}%</strong></span>}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={onOpenDrawer}
            className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium border border-primary/30 hover:border-primary/60 rounded-lg px-3 py-2 transition-colors"
          >
            <Brain className="w-3.5 h-3.5" />
            Full Intelligence Thesis
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Sort key types ────────────────────────────────────────────────────────────

type SortKey = "portfolioNetScore" | "companyQualityScore" | "stockOpportunityScore"
  | "expectationScore" | "mispricingScore" | "fragilityScore";
type SortDir = "asc" | "desc";
type BandFilter = "all" | "core" | "standard" | "starter" | "tactical" | "watchlist";

function SortTh({ label, col, active, dir, onSort, className }: {
  label: string; col: SortKey; active: boolean; dir: SortDir;
  onSort: (c: SortKey) => void; className?: string;
}) {
  return (
    <th className={`cursor-pointer hover:text-foreground select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-0.5">
        {label}
        {active ? dir === "desc" ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />
          : <ChevronsUpDown className="w-2.5 h-2.5 opacity-30" />}
      </div>
    </th>
  );
}

// ─── Country separator ─────────────────────────────────────────────────────────

function CountrySep({ country, count, avgNet }: { country: string; count: number; avgNet: number | null }) {
  return (
    <tr className="bg-muted/20 border-y border-border/50">
      <td colSpan={12} className="px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{flag(country)}</span>
          <span className="text-xs font-bold text-foreground">{country}</span>
          <span className="text-[10px] text-muted-foreground">{count} companies</span>
          {avgNet != null && (
            <span className="text-[10px] text-muted-foreground">
              · avg net <strong className="text-foreground font-mono">{avgNet}</strong>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Signals() {
  const [sortKey, setSortKey]         = useState<SortKey>("portfolioNetScore");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [bandFilter, setBandFilter]   = useState<BandFilter>("all");
  const [capTier, setCapTier]         = useState<"all" | "top50" | "large" | "mid" | "small">("all");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [drawerSnapshot, setDrawerSnapshot] = useState<IntelligenceSnapshot | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [defsOpen, setDefsOpen]       = useState(false);

  const { market } = useAuth();
  const countryParam = market !== "All" ? market : undefined;

  const capParams = (() => {
    if (capTier === "large") return { market_cap_min: 10_000_000_000 };
    if (capTier === "mid")   return { market_cap_min: 2_000_000_000, market_cap_max: 10_000_000_000 };
    if (capTier === "small") return { market_cap_max: 2_000_000_000 };
    return {};
  })();

  const { data, isLoading } = useListFactorSnapshots(
    { limit: 500, country: countryParam, ...capParams },
    { query: { refetchOnWindowFocus: false } }
  );

  const snapshots = data?.snapshots ?? [];

  const sectors = useMemo(() => {
    const s = new Set(snapshots.map(r => r.sector).filter(Boolean) as string[]);
    return ["all", ...Array.from(s).sort()];
  }, [snapshots]);

  const filtered = useMemo(() => {
    let out = snapshots;
    if (sectorFilter !== "all") out = out.filter(r => r.sector === sectorFilter);
    if (bandFilter !== "all") {
      out = out.filter(r => {
        const n = (r as any).portfolioNetScore != null ? Math.round((r as any).portfolioNetScore * 100) : null;
        if (bandFilter === "core")      return n != null && n >= 75;
        if (bandFilter === "standard")  return n != null && n >= 60 && n < 75;
        if (bandFilter === "starter")   return n != null && n >= 45 && n < 60;
        if (bandFilter === "tactical")  return n != null && n >= 30 && n < 45;
        if (bandFilter === "watchlist") return n == null || n < 30;
        return true;
      });
    }
    return out;
  }, [snapshots, sectorFilter, bandFilter]);

  const sorted = useMemo(() => {
    const base = [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? -1;
      const bv = (b as any)[sortKey] ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return capTier === "top50" ? base.slice(0, 50) : base;
  }, [filtered, sortKey, sortDir, capTier]);

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(col); setSortDir("desc"); }
  }

  function toggleExpand(ticker: string) {
    setExpandedTicker(prev => prev === ticker ? null : ticker);
  }

  function openDrawer(s: any) {
    setDrawerSnapshot({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      country: s.country,
      marketCap: s.marketCap,
      companyQualityScore: (s as any).companyQualityScore,
      stockOpportunityScore: (s as any).stockOpportunityScore,
      mispricingScore: (s as any).mispricingScore,
      expectationScore: (s as any).expectationScore,
      fragilityScore: (s as any).fragilityScore,
      portfolioNetScore: (s as any).portfolioNetScore,
      profitabilityScore: (s as any).profitabilityScore,
      growthScore: (s as any).growthScore,
      capitalEfficiencyScore: (s as any).capitalEfficiencyScore,
      financialStrengthScore: (s as any).financialStrengthScore,
      cashFlowQualityScore: (s as any).cashFlowQualityScore,
      valuationScore: (s as any).valuationScore,
      momentumScore: (s as any).momentumScore,
      sentimentScore: (s as any).sentimentScore,
      entryScore: (s as any).entryScore,
      marginOfSafety: (s as any).marginOfSafety,
      rsi: (s as any).rsi,
      ret3m: (s as any).ret3m,
    });
    setDrawerOpen(true);
  }

  function renderRow(s: any, rank: number) {
    const n  = (s as any).portfolioNetScore   != null ? Math.round((s as any).portfolioNetScore   * 100) : null;
    const q  = (s as any).companyQualityScore != null ? Math.round((s as any).companyQualityScore * 100) : null;
    const o  = (s as any).stockOpportunityScore != null ? Math.round((s as any).stockOpportunityScore * 100) : null;
    const m  = (s as any).mispricingScore      != null ? Math.round((s as any).mispricingScore      * 100) : null;
    const e  = (s as any).expectationScore     != null ? Math.round((s as any).expectationScore     * 100) : null;
    const fr = (s as any).fragilityScore       != null ? Math.round((s as any).fragilityScore       * 100) : null;

    const band      = bandConfig(n);
    const isExpanded = expandedTicker === s.ticker;

    const netColor = n == null ? "text-muted-foreground" : n >= 75 ? "text-emerald-400" : n >= 60 ? "text-blue-400" : n >= 45 ? "text-amber-400" : n >= 30 ? "text-orange-400" : "text-red-400";

    return (
      <Fragment key={s.ticker}>
        <tr
          className={`border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer select-none ${isExpanded ? "bg-muted/5" : ""}`}
          onClick={() => toggleExpand(s.ticker)}
          title={isExpanded ? "Click to collapse" : "Click to expand analysis"}
        >
          {/* Rank */}
          <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 font-mono w-8">{rank}</td>

          {/* Company — click opens Intelligence Drawer (stop row expand propagation) */}
          <td className="px-3 py-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); openDrawer(s); }}
              className="flex items-center gap-2 hover:text-primary transition-colors text-left"
            >
              <span className="text-sm leading-none">{flag(s.country)}</span>
              <div>
                <div className="font-mono font-bold text-foreground text-sm leading-tight hover:text-primary">{s.ticker}</div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[140px] leading-tight">{s.name ?? s.ticker}</div>
              </div>
            </button>
          </td>

          {/* Sector */}
          <td className="px-3 py-2.5 hidden lg:table-cell">
            {s.sector && <span className="text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/30 whitespace-nowrap">{s.sector}</span>}
          </td>

          {/* 5 score bars */}
          <td className="px-2 py-2.5 text-right"><MiniBar value={q}  interp={q  != null ? qualityInterp(q)     : null} /></td>
          <td className="px-2 py-2.5 text-right"><MiniBar value={o}  interp={o  != null ? opportunityInterp(o) : null} /></td>
          <td className="px-2 py-2.5 text-right"><MiniBar value={m}  interp={m  != null ? mispricingInterp(m)  : null} /></td>
          <td className="px-2 py-2.5 text-right"><MiniBar value={e}  interp={e  != null ? expectationInterp(e) : null} /></td>
          <td className="px-2 py-2.5 text-right"><MiniBar value={fr} interp={fr != null ? fragilityInterp(fr)  : null} /></td>

          {/* Net score */}
          <td className="px-3 py-2.5 text-right">
            {n != null ? (
              <span className={`text-sm font-bold font-mono ${netColor}`}>{n}</span>
            ) : <span className="text-muted-foreground/30 text-xs">—</span>}
          </td>

          {/* Band */}
          <td className="px-2 py-2.5">
            {band ? (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${band.badge}`}>{band.label}</span>
            ) : <span className="text-muted-foreground/30 text-xs">—</span>}
          </td>

          {/* Action */}
          <td className="px-2 py-2.5">
            {band && <span className={`text-[10px] font-bold whitespace-nowrap ${band.ac}`}>{band.action}</span>}
          </td>

          {/* Expand indicator (row click handles expand) */}
          <td className="px-2 py-2.5">
            <span className="p-1 text-muted-foreground/50 inline-flex">
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </td>
        </tr>

        {/* Expanded analysis row */}
        {isExpanded && <ExpandedRow s={s} onOpenDrawer={() => openDrawer(s)} />}
      </Fragment>
    );
  }

  // Column header definitions (always visible)
  const COLUMN_DEFS = [
    { key: "companyQualityScore",   label: "Quality",     abbr: "Q", color: "text-emerald-400", def: "Business strength: ROIC, margins, capital allocation — double weight in formula", weight: "+2×" },
    { key: "stockOpportunityScore", label: "Opportunity", abbr: "O", color: "text-blue-400",    def: "Stock attractiveness: valuation vs history, FCF yield, entry timing",              weight: "+1×" },
    { key: "mispricingScore",       label: "Mispricing",  abbr: "M", color: "text-amber-400",   def: "Market edge: temporary issues, catalyst visibility, revisions inflecting — double weight", weight: "+2×" },
    { key: "expectationScore",      label: "Expectation", abbr: "E", color: "text-orange-400",  def: "Priced-in optimism: high = overvalued/crowded = PENALISED in formula",            weight: "−1×" },
    { key: "fragilityScore",        label: "Fragility",   abbr: "F", color: "text-red-400",     def: "Thesis risk: leverage, concentration, disruption exposure — PENALISED in formula", weight: "−1×" },
  ] as const;

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-4">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2.5">
              <Crown className="w-6 h-6 text-violet-400" />
              Investment Intelligence
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              5-layer premium scoring model. Click any ticker for full Intelligence Thesis. Expand rows for analysis.
            </p>
            <div className="mt-1.5">
              <PipelineTimestampBar />
            </div>
          </div>
        </div>

        {/* ── Formula + definitions (collapsible) ─────────── */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 overflow-hidden">
          <button
            onClick={() => setDefsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-950/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-mono text-violet-400 uppercase tracking-wider font-semibold">Formula &amp; Definitions</span>
              <div className="flex items-center gap-1 font-mono text-xs ml-2">
                <span className="text-emerald-400">2×Q</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-blue-400">1×O</span>
                <span className="text-muted-foreground">+</span>
                <span className="text-amber-400">2×M</span>
                <span className="text-muted-foreground">−</span>
                <span className="text-orange-400">1×E</span>
                <span className="text-muted-foreground">−</span>
                <span className="text-red-400">1×F</span>
              </div>
            </div>
            {defsOpen ? <ChevronUp className="w-4 h-4 text-violet-400" /> : <ChevronDown className="w-4 h-4 text-violet-400" />}
          </button>

          {defsOpen && (
            <div className="px-4 pb-4 border-t border-violet-500/20">
              <p className="text-xs text-muted-foreground mt-3 mb-3">
                <strong className="text-foreground">Net Score = (2×Quality + 1×Opportunity + 2×Mispricing − 1×Expectation − 1×Fragility + 200) ÷ 700 × 100</strong><br/>
                Raw range is −200 to +500. Normalised to 0–100. Quality and Mispricing carry double weight because they are the most predictive of long-term risk-adjusted returns.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {COLUMN_DEFS.map(c => (
                  <div key={c.key} className="bg-background/40 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold ${c.color}`}>{c.weight}</span>
                      <span className={`text-[11px] font-bold ${c.color}`}>{c.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{c.def}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px]">
                {[
                  { band: "CORE ≥75",      color: "text-emerald-400", size: "6–10%",  action: "Strong Buy" },
                  { band: "STANDARD ≥60",  color: "text-blue-400",    size: "3–5%",   action: "Buy" },
                  { band: "STARTER ≥45",   color: "text-amber-400",   size: "1–2.5%", action: "Add" },
                  { band: "TACTICAL ≥30",  color: "text-orange-400",  size: "0.5–1%", action: "Watch" },
                  { band: "WATCHLIST <30", color: "text-red-400",     size: "0%",     action: "Avoid" },
                ].map(b => (
                  <div key={b.band} className="bg-background/30 rounded-lg px-2.5 py-2">
                    <div className={`font-bold ${b.color}`}>{b.band}</div>
                    <div className="text-muted-foreground mt-0.5">{b.action} · {b.size} of portfolio</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Filter bar ──────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cap size filter */}
          <div className="relative">
            <select value={capTier} onChange={e => setCapTier(e.target.value as typeof capTier)}
              className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-1.5 pr-7 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Caps</option>
              <option value="top50">Top 50</option>
              <option value="large">Large Cap ($10B+)</option>
              <option value="mid">Mid Cap ($2B–$10B)</option>
              <option value="small">Small Cap (&lt;$2B)</option>
            </select>
            <ChevronDown className="absolute right-2 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Sector filter */}
          <div className="relative">
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
              className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-1.5 pr-7 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {sectors.map(s => <option key={s} value={s}>{s === "all" ? "All Sectors" : s}</option>)}
            </select>
            <Filter className="absolute right-2 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Band filter */}
          <div className="relative">
            <select value={bandFilter} onChange={e => setBandFilter(e.target.value as BandFilter)}
              className="text-xs bg-muted/30 border border-border rounded-lg px-3 py-1.5 pr-7 text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Bands</option>
              <option value="core">CORE ≥75</option>
              <option value="standard">STANDARD ≥60</option>
              <option value="starter">STARTER ≥45</option>
              <option value="tactical">TACTICAL ≥30</option>
              <option value="watchlist">WATCHLIST</option>
            </select>
            <ChevronDown className="absolute right-2 top-1.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          <span className="text-xs text-muted-foreground ml-1">{sorted.length} companies</span>
        </div>

        {/* ── Table ───────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed border-border rounded-xl gap-3">
            <Info className="w-8 h-8 opacity-30" />
            <p>No companies found. Run the pipeline to generate Intelligence scores.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">

                {/* Sticky header with definitions on hover */}
                <thead className="sticky top-0 z-10 bg-card border-b border-border/60">
                  {/* Column header */}
                  <tr className="bg-muted/10">
                    <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left w-8">#</th>
                    <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Ticker / Company</th>
                    <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left hidden lg:table-cell">Sector</th>

                    {COLUMN_DEFS.map(c => (
                      <th key={c.key} className="text-right px-2 py-2.5 group relative">
                        <button
                          onClick={() => handleSort(c.key as SortKey)}
                          className="flex flex-col items-end gap-0 cursor-pointer"
                          title={c.def}
                        >
                          <div className="flex items-center gap-0.5">
                            <span className={`text-[9px] font-bold ${c.color}`}>{c.weight}</span>
                            {sortKey === c.key
                              ? sortDir === "desc" ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />
                              : <ChevronsUpDown className="w-2.5 h-2.5 opacity-30" />}
                          </div>
                          <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${c.color}`}>{c.abbr}</span>
                          <span className="text-[9px] text-muted-foreground/70">{c.label}</span>
                        </button>
                        {/* Tooltip on hover */}
                        <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-lg p-2.5 text-[10px] text-muted-foreground z-50 hidden group-hover:block shadow-xl text-left">
                          <strong className={`block mb-0.5 ${c.color}`}>{c.label} {c.weight}</strong>
                          {c.def}
                        </div>
                      </th>
                    ))}

                    <SortTh label="Net" col="portfolioNetScore" active={sortKey === "portfolioNetScore"} dir={sortDir} onSort={handleSort}
                      className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-right" />
                    <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-2 py-2.5 text-left">Band</th>
                    <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-2 py-2.5 text-left">Action</th>
                    <th className="w-8 px-2 py-2.5"></th>
                  </tr>
                </thead>

                <tbody>
                  {sorted.map((s, i) => renderRow(s, i + 1))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-muted-foreground/50 font-mono">Net = (2×Q + 1×O + 2×M − 1×E − 1×F + 200) ÷ 700 × 100</span>
              <span className="text-[10px] text-muted-foreground/40 ml-auto">Click ticker → Intelligence Thesis · Click ▼ → Inline analysis</span>
            </div>
          </div>
        )}

      </div>

      {/* ── Intelligence Thesis Drawer ─────────────────── */}
      <IntelligenceDrawer
        snapshot={drawerSnapshot}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </Layout>
  );
}
