import { useState, useMemo, Fragment } from "react";
import { Layout } from "@/components/layout/Layout";
import { useListFactorSnapshots } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { PipelineTimestampBar } from "@/components/pipeline/PipelineTimestampBar";
import {
  Crown, ChevronDown, ChevronUp, ChevronsUpDown, Filter,
  Loader2, ArrowUpDown, Info, LayoutGrid, List, ExternalLink,
  Shield, TrendingUp, AlertTriangle, Star, Brain, Zap, Globe,
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

// ─── Score interpretation engine ────────────────────────────────────────────────

interface Interp { label: string; narration: string; color: string; bar: string }

function qualityInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Exceptional", color: "text-emerald-400", bar: "bg-emerald-500", narration: "Best-in-class business — high ROIC, durable margins, strong capital allocation and genuine pricing power across the cycle" };
  if (v >= 0.60) return { label: "Strong",      color: "text-blue-400",    bar: "bg-blue-500",    narration: "Above-average fundamentals — consistent profitability, solid capital returns and good balance sheet strength" };
  if (v >= 0.45) return { label: "Moderate",    color: "text-amber-400",   bar: "bg-amber-500",   narration: "Average quality — some competitive strengths but limited moat depth or meaningful cyclical revenue exposure" };
  if (v >= 0.30) return { label: "Below Avg",   color: "text-orange-400",  bar: "bg-orange-500",  narration: "Below-average returns — thin margins, limited pricing power or capital-intensive model compressing value creation" };
  return              { label: "Weak",          color: "text-red-400",     bar: "bg-red-500",     narration: "Weak fundamentals — poor capital returns, margin pressure or structural challenges threatening the business model" };
}

function opportunityInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Highly Attractive", color: "text-emerald-400", bar: "bg-emerald-500", narration: "Compelling stock setup — meaningful discount to intrinsic value vs history and peers, positive estimate revisions and improving momentum" };
  if (v >= 0.60) return { label: "Attractive",        color: "text-blue-400",    bar: "bg-blue-500",    narration: "Good opportunity — stock appears undervalued relative to fundamentals with favourable technical setup and rising estimates" };
  if (v >= 0.45) return { label: "Moderate",          color: "text-amber-400",   bar: "bg-amber-500",   narration: "Mixed setup — reasonably priced but lacking a clear directional catalyst or showing neutral momentum signals" };
  if (v >= 0.30) return { label: "Limited",           color: "text-orange-400",  bar: "bg-orange-500",  narration: "Modest opportunity — near full value, flat revisions and limited near-term upside based on current FCF yield" };
  return              { label: "Unattractive",        color: "text-red-400",     bar: "bg-red-500",     narration: "Poor setup — overvalued vs history and peers, or negative earnings revisions creating material downside risk" };
}

function mispricingInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Strong Edge",  color: "text-emerald-400", bar: "bg-emerald-500", narration: "High-conviction mispricing — temporary issue is masking durable quality, clear catalyst visible within 6–24 months" };
  if (v >= 0.60) return { label: "Clear Edge",   color: "text-blue-400",    bar: "bg-blue-500",    narration: "Market understates structural strengths — revisions turning positive, margin normalisation ahead and optionality underpriced" };
  if (v >= 0.45) return { label: "Plausible",    color: "text-amber-400",   bar: "bg-amber-500",   narration: "Some mispricing possible — temporary factors may be suppressing reported economics, thesis still building evidence" };
  if (v >= 0.30) return { label: "Weak",         color: "text-orange-400",  bar: "bg-orange-500",  narration: "Limited evidence of mispricing — market appears reasonably informed, limited near-term re-rating catalyst" };
  return              { label: "No Edge",        color: "text-red-400",     bar: "bg-red-500",     narration: "No clear market mispricing — stock appears fairly valued or even optimistically priced relative to visible fundamentals" };
}

function expectationInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Euphoric",   color: "text-red-400",     bar: "bg-red-500",     narration: "Perfection priced in — very high consensus bar means any disappointment risks a sharp de-rating; crowded long" };
  if (v >= 0.60) return { label: "Elevated",   color: "text-orange-400",  bar: "bg-orange-500",  narration: "High expectations — strong consensus optimism creates significant execution risk if growth misses or margins disappoint" };
  if (v >= 0.45) return { label: "Moderate",   color: "text-amber-400",   bar: "bg-amber-500",   narration: "Balanced bar — consensus is achievable; neither dangerously optimistic nor excessively pessimistic" };
  if (v >= 0.30) return { label: "Modest",     color: "text-blue-400",    bar: "bg-blue-500",    narration: "Low bar — meaningful room to positively surprise consensus and drive multiple expansion on a beat-and-raise quarter" };
  return              { label: "Depressed",    color: "text-emerald-400", bar: "bg-emerald-500", narration: "Market assumes failure — even modest positive news or earnings beat could trigger a significant sentiment re-rating" };
}

function fragilityInterp(v: number): Interp {
  if (v >= 0.75) return { label: "High Risk",   color: "text-red-400",     bar: "bg-red-500",     narration: "Fragile thesis — concentrated revenue, high leverage, regulatory overhang or technology disruption materially threatens the story" };
  if (v >= 0.60) return { label: "Elevated",    color: "text-orange-400",  bar: "bg-orange-500",  narration: "Multiple vulnerabilities — one or more structural weaknesses could derail the thesis; requires close monitoring" };
  if (v >= 0.45) return { label: "Moderate",    color: "text-amber-400",   bar: "bg-amber-500",   narration: "Manageable risks — thesis intact under most scenarios but execution quality and macro sensitivity matter here" };
  if (v >= 0.30) return { label: "Robust",      color: "text-blue-400",    bar: "bg-blue-500",    narration: "Resilient business — limited structural vulnerabilities, diversified revenue and strong interest coverage" };
  return              { label: "Very Robust",   color: "text-emerald-400", bar: "bg-emerald-500", narration: "Fortress-grade resilience — clean balance sheet, diversified revenue base and low regulatory or disruption exposure" };
}

function bandConfig(pns: number | null | undefined) {
  if (pns == null) return null;
  if (pns >= 0.75) return { label: "CORE",      border: "border-emerald-500/30 bg-emerald-950/20", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", minPct: 6,   maxPct: 10,  action: "Strong Buy", actionColor: "text-emerald-400", desc: "High-conviction, build to full position size" };
  if (pns >= 0.60) return { label: "STANDARD",  border: "border-blue-500/30 bg-blue-950/10",       badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",           minPct: 3,   maxPct: 5,   action: "Buy",        actionColor: "text-blue-400",    desc: "Quality position, establish at standard size" };
  if (pns >= 0.45) return { label: "STARTER",   border: "border-amber-500/30 bg-amber-950/10",     badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",         minPct: 1,   maxPct: 2.5, action: "Add",        actionColor: "text-amber-400",   desc: "Initial stake, build further on confirmation" };
  if (pns >= 0.30) return { label: "TACTICAL",  border: "border-orange-500/30 bg-orange-950/10",   badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",      minPct: 0.5, maxPct: 1,   action: "Watch",      actionColor: "text-orange-400",  desc: "Speculative only with tight risk controls" };
  return                  { label: "WATCHLIST", border: "border-border bg-card",                    badge: "bg-secondary text-muted-foreground border-border/50",        minPct: 0,   maxPct: 0,   action: "Avoid",      actionColor: "text-red-400",     desc: "Monitor only — do not add to portfolio" };
}

// ─── Score bar component ────────────────────────────────────────────────────────

function ScoreBar({ label, value, interp, weight, invert = false }: {
  label: string; value: number | null | undefined;
  interp: (v: number) => Interp; weight?: string; invert?: boolean;
}) {
  if (value == null) return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}{weight && <span className="ml-1 opacity-60">{weight}</span>}</span>
        <span className="text-muted-foreground/40 text-xs">—</span>
      </div>
    </div>
  );
  const i = interp(value);
  const pct = Math.round(value * 100);
  const displayPct = invert ? (100 - pct) : pct; // For fragility/expectation, invert bar fill to show "goodness"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider whitespace-nowrap">{label}</span>
          {weight && <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${invert ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>{weight}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold ${i.color}`}>{i.label}</span>
          <span className={`text-sm font-bold font-mono ${i.color}`}>{pct}</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${i.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{i.narration}</p>
    </div>
  );
}

// ─── Company Intelligence Card ─────────────────────────────────────────────────

function CompanyCard({ s, onOpen }: { s: any; onOpen: () => void }) {
  const pns  = s.portfolioNetScore as number | null | undefined;
  const band = bandConfig(pns);
  const pct  = pns != null ? Math.round(pns * 100) : null;

  const netColor =
    pct == null      ? "text-muted-foreground" :
    pct >= 75        ? "text-emerald-400" :
    pct >= 60        ? "text-blue-400" :
    pct >= 45        ? "text-amber-400" :
    pct >= 30        ? "text-orange-400" : "text-red-400";

  return (
    <div className={`rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${band?.border ?? "border-border"}`}
      onClick={onOpen}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg leading-none">{flag(s.country)}</span>
            <span className="font-mono font-bold text-foreground text-base">{s.ticker}</span>
            {band && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${band.badge}`}>
                {band.label}
              </span>
            )}
          </div>
          {pct != null && (
            <div className="text-right shrink-0">
              <div className={`text-2xl font-bold font-mono leading-none ${netColor}`}>{pct}</div>
              <div className="text-[9px] text-muted-foreground">Net Score</div>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-medium truncate">{s.name ?? s.ticker}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {s.sector && <span className="text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/30">{s.sector}</span>}
          {s.country && <span className="text-[10px] text-muted-foreground/60">{s.country}</span>}
        </div>
      </div>

      {/* Score bars */}
      <div className="px-4 py-3 space-y-3.5">
        <ScoreBar label="Company Quality"    value={s.companyQualityScore}   interp={qualityInterp}     weight="+2×" />
        <ScoreBar label="Stock Opportunity"  value={s.stockOpportunityScore} interp={opportunityInterp} weight="+1×" />
        <ScoreBar label="Mispricing"         value={s.mispricingScore}       interp={mispricingInterp}  weight="+2×" />
        <ScoreBar label="Expectation"        value={s.expectationScore}      interp={expectationInterp} weight="−1×" invert />
        <ScoreBar label="Fragility"          value={s.fragilityScore}        interp={fragilityInterp}   weight="−1×" invert />
      </div>

      {/* Card footer — action + position guidance */}
      <div className="px-4 pb-4">
        <div className={`rounded-lg border px-3 py-2 ${band?.border ?? "border-border"}`}>
          {band ? (
            <>
              <div className={`text-xs font-bold ${band.actionColor}`}>{band.action}</div>
              {band.minPct > 0 ? (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Position: <span className="text-foreground font-mono font-semibold">{band.minPct}–{band.maxPct}%</span> · {band.desc}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground mt-0.5">{band.desc}</div>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground">No Intelligence score available</div>
          )}
        </div>
        <button className="w-full mt-2 text-[10px] text-muted-foreground hover:text-primary flex items-center justify-center gap-1 group-hover:text-primary transition-colors">
          <ExternalLink className="w-3 h-3" />
          View full Investment Thesis
        </button>
      </div>
    </div>
  );
}

// ─── Sortable table header ──────────────────────────────────────────────────────

type SortKey = "portfolioNetScore" | "companyQualityScore" | "stockOpportunityScore"
  | "expectationScore" | "mispricingScore" | "fragilityScore";
type SortDir = "asc" | "desc";

function SortTh({ label, col, active, dir, onSort, className }: {
  label: string; col: SortKey; active: boolean; dir: SortDir;
  onSort: (c: SortKey) => void; className?: string;
}) {
  return (
    <th className={`text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 cursor-pointer hover:text-foreground select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? dir === "desc" ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />
          : <ChevronsUpDown className="w-2.5 h-2.5 opacity-30" />}
      </div>
    </th>
  );
}

// ─── Table row ─────────────────────────────────────────────────────────────────

function TableRow({ s, rank, onOpen }: { s: any; rank: number; onOpen: () => void }) {
  const pns   = s.portfolioNetScore as number | null | undefined;
  const band  = bandConfig(pns);
  const q     = s.companyQualityScore   != null ? qualityInterp(s.companyQualityScore)     : null;
  const op    = s.stockOpportunityScore != null ? opportunityInterp(s.stockOpportunityScore) : null;
  const mi    = s.mispricingScore       != null ? mispricingInterp(s.mispricingScore)       : null;
  const ex    = s.expectationScore      != null ? expectationInterp(s.expectationScore)     : null;
  const fr    = s.fragilityScore        != null ? fragilityInterp(s.fragilityScore)         : null;

  function MiniBar({ value, interp }: { value: number | null | undefined; interp: ((v: number) => Interp) | null }) {
    if (value == null || interp == null) return <span className="text-muted-foreground/30 text-xs">—</span>;
    const i = interp(value);
    const pct = Math.round(value * 100);
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1">
          <div className="h-1 w-10 bg-muted/30 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${i.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`font-mono text-[11px] font-bold ${i.color}`}>{pct}</span>
        </div>
        <span className={`text-[9px] ${i.color} opacity-80`}>{i.label}</span>
      </div>
    );
  }

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors" onClick={onOpen}>
      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground/50">{rank}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{flag(s.country)}</span>
          <span className="font-mono font-bold text-foreground text-sm">{s.ticker}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[160px]">{s.name ?? s.ticker}</span>
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell">
        {s.sector && <span className="text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/30">{s.sector}</span>}
      </td>
      <td className="px-3 py-2.5 text-right"><MiniBar value={s.companyQualityScore}   interp={q   ? qualityInterp   : null} /></td>
      <td className="px-3 py-2.5 text-right"><MiniBar value={s.stockOpportunityScore} interp={op  ? opportunityInterp : null} /></td>
      <td className="px-3 py-2.5 text-right"><MiniBar value={s.mispricingScore}       interp={mi  ? mispricingInterp  : null} /></td>
      <td className="px-3 py-2.5 text-right"><MiniBar value={s.expectationScore}      interp={ex  ? expectationInterp : null} /></td>
      <td className="px-3 py-2.5 text-right"><MiniBar value={s.fragilityScore}        interp={fr  ? fragilityInterp   : null} /></td>
      <td className="px-3 py-2.5 text-right">
        {pns != null ? (
          <span className={`text-sm font-mono font-bold ${
            pns >= 0.75 ? "text-emerald-400" : pns >= 0.60 ? "text-blue-400" :
            pns >= 0.45 ? "text-amber-400"   : pns >= 0.30 ? "text-orange-400" : "text-red-400"
          }`}>{Math.round(pns * 100)}</span>
        ) : <span className="text-muted-foreground/30 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {band ? (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${band.badge}`}>{band.label}</span>
        ) : <span className="text-muted-foreground/30 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {band && <span className={`text-[10px] font-semibold ${band.actionColor}`}>{band.action}</span>}
      </td>
    </tr>
  );
}

// ─── Country separator ─────────────────────────────────────────────────────────

function CountrySep({ country, count, avgNet }: { country: string; count: number; avgNet: number | null }) {
  return (
    <tr className="bg-muted/15 border-y border-border/40">
      <td colSpan={13} className="px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{flag(country)}</span>
          <span className="text-[11px] font-semibold text-foreground">{country}</span>
          <span className="text-[10px] text-muted-foreground">{count} companies</span>
          {avgNet != null && (
            <span className="text-[10px] text-muted-foreground ml-1">
              avg net <strong className="text-foreground font-mono">{Math.round(avgNet * 100)}</strong>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = "cards" | "table";
type BandFilter = "all" | "core" | "standard" | "starter" | "tactical" | "watchlist";

export default function Signals() {
  const [sortKey, setSortKey]       = useState<SortKey>("portfolioNetScore");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");
  const [viewMode, setViewMode]     = useState<ViewMode>("cards");
  const [tableGroup, setTableGroup] = useState<"ranked" | "by-country">("ranked");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [bandFilter, setBandFilter]     = useState<BandFilter>("all");
  const [drawerTicker, setDrawerTicker] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);

  const { market } = useAuth();
  const countryParam = market !== "All" ? market : undefined;

  const { data, isLoading } = useListFactorSnapshots(
    { limit: 500, country: countryParam },
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
        const pns = (r as any).portfolioNetScore as number | null;
        if (bandFilter === "core")      return pns != null && pns >= 0.75;
        if (bandFilter === "standard")  return pns != null && pns >= 0.60 && pns < 0.75;
        if (bandFilter === "starter")   return pns != null && pns >= 0.45 && pns < 0.60;
        if (bandFilter === "tactical")  return pns != null && pns >= 0.30 && pns < 0.45;
        if (bandFilter === "watchlist") return pns == null || pns < 0.30;
        return true;
      });
    }
    return out;
  }, [snapshots, sectorFilter, bandFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? -1;
      const bv = (b as any)[sortKey] ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, sortKey, sortDir]);

  const byCountry = useMemo(() => {
    const map = new Map<string, typeof sorted>();
    for (const s of sorted) {
      const c = s.country ?? "Unknown";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(s);
    }
    return Array.from(map.entries())
      .map(([country, rows]) => {
        const nets = rows.map(r => (r as any).portfolioNetScore as number | null).filter((v): v is number => v != null);
        const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null;
        return { country, rows, avgNet };
      })
      .sort((a, b) => (b.avgNet ?? -1) - (a.avgNet ?? -1));
  }, [sorted]);

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(col); setSortDir("desc"); }
  }

  function openDrawer(ticker: string) {
    setDrawerTicker(ticker);
    setDrawerOpen(true);
  }

  const withScore    = sorted.filter(r => (r as any).portfolioNetScore != null).length;
  const coreCount    = sorted.filter(r => (r as any).portfolioNetScore >= 0.75).length;
  const buyCount     = sorted.filter(r => (r as any).portfolioNetScore >= 0.60).length;
  const starterCount = sorted.filter(r => { const v = (r as any).portfolioNetScore; return v >= 0.45 && v < 0.60; }).length;

  const tableHeader = (
    <thead>
      <tr className="border-b border-border/60 bg-muted/10">
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 w-8 text-left">#</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Ticker</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Company</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left hidden lg:table-cell">Sector</th>
        <SortTh label="Quality"     col="companyQualityScore"   active={sortKey==="companyQualityScore"}   dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Opportunity" col="stockOpportunityScore" active={sortKey==="stockOpportunityScore"} dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Mispricing"  col="mispricingScore"       active={sortKey==="mispricingScore"}       dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Expectation" col="expectationScore"      active={sortKey==="expectationScore"}      dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Fragility"   col="fragilityScore"        active={sortKey==="fragilityScore"}        dir={sortDir} onSort={handleSort} className="text-right" />
        <SortTh label="Net Score"   col="portfolioNetScore"     active={sortKey==="portfolioNetScore"}     dir={sortDir} onSort={handleSort} className="text-right" />
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Band</th>
        <th className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-3 py-2.5 text-left">Action</th>
      </tr>
    </thead>
  );

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight mb-1 flex items-center gap-3">
              <Crown className="w-7 h-7 text-violet-400" />
              Investment Intelligence
            </h1>
            <p className="text-muted-foreground text-sm mb-2">
              5-layer premium scoring model. Each factor explained — click any company for full Investment Thesis.
            </p>
            <PipelineTimestampBar />
          </div>
        </div>

        {/* ── Formula banner ────────────────────────────────── */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-mono text-violet-400 uppercase tracking-wider font-semibold">Investment Intelligence Formula</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap font-mono text-sm">
            <span className="text-foreground font-semibold">Net Score</span>
            <span className="text-muted-foreground">=</span>
            <span className="text-emerald-400 font-bold">2 × Quality</span>
            <span className="text-muted-foreground">+</span>
            <span className="text-blue-400 font-bold">1 × Opportunity</span>
            <span className="text-muted-foreground">+</span>
            <span className="text-amber-400 font-bold">2 × Mispricing</span>
            <span className="text-muted-foreground">−</span>
            <span className="text-orange-400 font-bold">1 × Expectation</span>
            <span className="text-muted-foreground">−</span>
            <span className="text-red-400 font-bold">1 × Fragility</span>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Quality",     desc: "Business strength — ROIC, margins, moat",           color: "text-emerald-400" },
              { label: "Opportunity", desc: "Stock attractiveness — value vs history & peers",   color: "text-blue-400" },
              { label: "Mispricing",  desc: "Market edge — temporary issues, catalyst present",  color: "text-amber-400" },
              { label: "Expectation", desc: "How priced-in the good news already is (lower=better)",  color: "text-orange-400" },
              { label: "Fragility",   desc: "Thesis risk — leverage, concentration, disruption (lower=better)", color: "text-red-400" },
            ].map(f => (
              <div key={f.label} className="bg-background/40 rounded-lg px-2.5 py-2">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${f.color}`}>{f.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Universe</div>
            <div className="text-2xl font-bold">{filtered.length}</div>
            <div className="text-[10px] text-muted-foreground">companies</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Scored</div>
            <div className="text-2xl font-bold text-blue-400">{withScore}</div>
            <div className="text-[10px] text-muted-foreground">with full 5-layer data</div>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Buy-Grade</div>
            <div className="text-2xl font-bold text-emerald-400">{buyCount}</div>
            <div className="text-[10px] text-muted-foreground">Core + Standard</div>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Core</div>
            <div className="text-2xl font-bold text-violet-400">{coreCount}</div>
            <div className="text-[10px] text-muted-foreground">High-conviction picks</div>
          </div>
        </div>

        {/* ── Band breakdown bar ────────────────────────────── */}
        {withScore > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold flex items-center gap-2">
              <Star className="w-3 h-3" /> Position Band Distribution
            </div>
            <div className="flex h-4 rounded-full overflow-hidden gap-px">
              {[
                { count: coreCount, color: "bg-emerald-500", label: "Core" },
                { count: buyCount - coreCount, color: "bg-blue-500", label: "Standard" },
                { count: starterCount, color: "bg-amber-500", label: "Starter" },
                { count: sorted.filter(r => { const v = (r as any).portfolioNetScore; return v >= 0.30 && v < 0.45; }).length, color: "bg-orange-500", label: "Tactical" },
                { count: sorted.filter(r => { const v = (r as any).portfolioNetScore; return v == null || v < 0.30; }).length, color: "bg-muted/50", label: "Watchlist" },
              ].map(b => b.count > 0 && (
                <div key={b.label} className={`${b.color} transition-all`} style={{ width: `${(b.count / filtered.length) * 100}%` }} title={`${b.label}: ${b.count}`} />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {[
                { label: "CORE ≥75",     color: "text-emerald-400", count: coreCount },
                { label: "STANDARD ≥60", color: "text-blue-400",    count: buyCount - coreCount },
                { label: "STARTER ≥45",  color: "text-amber-400",   count: starterCount },
                { label: "TACTICAL ≥30", color: "text-orange-400",  count: sorted.filter(r => { const v = (r as any).portfolioNetScore; return v >= 0.30 && v < 0.45; }).length },
                { label: "WATCHLIST",    color: "text-muted-foreground", count: sorted.filter(r => { const v = (r as any).portfolioNetScore; return v == null || v < 0.30; }).length },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-1">
                  <span className={`text-[10px] font-semibold ${b.color}`}>{b.label}</span>
                  <span className="text-[10px] text-muted-foreground/60">({b.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Controls ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button onClick={() => setViewMode("cards")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === "cards" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-3 h-3" />Cards
              </button>
              <button onClick={() => setViewMode("table")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${viewMode === "table" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-3 h-3" />Table
              </button>
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
          </div>

          {/* Table sub-controls (shown only in table view) */}
          {viewMode === "table" && (
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button onClick={() => setTableGroup("ranked")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${tableGroup === "ranked" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <ArrowUpDown className="w-3 h-3" />Ranked
              </button>
              <button onClick={() => setTableGroup("by-country")}
                className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors ${tableGroup === "by-country" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Globe className="w-3 h-3" />By Country
              </button>
            </div>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed border-border rounded-xl gap-3">
            <Info className="w-8 h-8 opacity-30" />
            <p>No companies found. Run the pipeline to generate Intelligence scores.</p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map(s => (
              <CompanyCard key={s.ticker} s={s} onOpen={() => openDrawer(s.ticker)} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              {tableGroup === "ranked" ? (
                <table className="w-full text-sm">
                  {tableHeader}
                  <tbody>
                    {sorted.map((s, i) => <TableRow key={s.ticker} s={s} rank={i + 1} onOpen={() => openDrawer(s.ticker)} />)}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  {tableHeader}
                  <tbody>
                    {byCountry.map(({ country, rows, avgNet }) => (
                      <Fragment key={country}>
                        <CountrySep country={country} count={rows.length} avgNet={avgNet} />
                        {rows.map((s, i) => <TableRow key={s.ticker} s={s} rank={i + 1} onOpen={() => openDrawer(s.ticker)} />)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-4 py-3 border-t border-border/40 bg-muted/10 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Formula:</span>
              <span className="text-[10px] font-mono text-muted-foreground">Net = 2×Quality + 1×Opp + 2×Misp − 1×Exp − 1×Frag</span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto">Click any row → Investment Thesis</span>
            </div>
          </div>
        )}

      </div>

      <CompanyDrawer ticker={drawerTicker} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </Layout>
  );
}
