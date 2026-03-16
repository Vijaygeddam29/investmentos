import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { IntelligenceDrawer, type IntelligenceSnapshot } from "@/components/company/IntelligenceDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Wand2, Loader2, Info, Shield, Rocket, Waves,
  TrendingUp, Globe, ChevronDown, ChevronRight, AlertCircle,
  Zap, AlertTriangle, Crown, Star, Target,
  Plus, Search, X, Lock, Unlock, Brain, Layers,
  ChevronUp, ExternalLink, BarChart3, TrendingDown,
  Banknote, LayoutGrid, EyeOff,
} from "lucide-react";

type Strategy     = "fortress" | "rocket" | "wave";
type WeightMethod = "equal" | "score" | "risk" | "power";
type MarketCapTier = "all" | "top50" | "large" | "mid" | "small";
type BuildMode    = "approaching" | "momentum" | "model1" | "model2";

interface M1Settings { minFortress: number; minRocket: number; minWave: number }
interface M2Settings { minQ: number; minO: number; minM: number; maxE: number; maxF: number }

const DEFAULT_M1: M1Settings = { minFortress: 50, minRocket: 50, minWave: 50 };
const DEFAULT_M2: M2Settings = { minQ: 60, minO: 50, minM: 45, maxE: 75, maxF: 75 };

interface AllSnapshot {
  ticker: string; name: string; sector: string; country: string; marketCap: number | null;
  portfolioNetScore: number | null; companyQualityScore: number | null;
  stockOpportunityScore: number | null; mispricingScore: number | null;
  expectationScore: number | null; fragilityScore: number | null;
  fortressScore: number | null; rocketScore: number | null; waveScore: number | null;
  momentumScore: number | null; rsi: number | null; ret3m: number | null;
  macdHistogram: number | null; entryScore: number | null; marginOfSafety: number | null;
}

interface BuilderHolding {
  rank:                  number;
  ticker:                string;
  name:                  string;
  sector:                string;
  country:               string;
  weight:                number;
  compositeScore:        number;
  fortressScore:         number | null;
  rocketScore:           number | null;
  waveScore:             number | null;
  entryScore:            number | null;
  marketCap:             number | null;
  volatility:            number | null;
  highValuation:         boolean;
  innovationTier:        string | null;
  rationale:             string;
  portfolioNetScore:     number | null;
  expectationScore:      number | null;
  mispricingScore:       number | null;
  fragilityScore:        number | null;
  companyQualityScore:   number | null;
  stockOpportunityScore: number | null;
  positionBand:          { band: string; label: string; minPct: number; maxPct: number } | null;
}

interface BuilderResponse {
  holdings:       BuilderHolding[];
  portfolioScore: { fortress: number; rocket: number; wave: number } | null;
  snapshotDate:   string | null;
  universeSize:   number;
  regime:         { name: string; confidence: string } | null;
  params:         Record<string, unknown>;
}

interface SearchResult {
  ticker: string; name: string; sector: string; country: string;
  marketCap: number | null;
  fortressScore: number | null; rocketScore: number | null; waveScore: number | null;
  portfolioNetScore: number | null; companyQualityScore: number | null;
  stockOpportunityScore: number | null; expectationScore: number | null;
  mispricingScore: number | null; fragilityScore: number | null;
}
interface ManualHolding extends BuilderHolding { isManual: boolean }

// ─── Flags ────────────────────────────────────────────────────────────────────
const FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", India: "🇮🇳",
  Germany: "🇩🇪", France: "🇫🇷", Italy: "🇮🇹", Japan: "🇯🇵",
  China: "🇨🇳", Taiwan: "🇹🇼", Netherlands: "🇳🇱", Canada: "🇨🇦",
  Australia: "🇦🇺", Brazil: "🇧🇷", Denmark: "🇩🇰", "Hong Kong": "🇭🇰",
  Ireland: "🇮🇪", Israel: "🇮🇱", Singapore: "🇸🇬", Switzerland: "🇨🇭",
  Uruguay: "🇺🇾",
};
const flag = (c: string) => FLAGS[c] ?? "🌐";

// ─── Intelligence interpretation engine ────────────────────────────────────────
interface Interp { label: string; narration: string; color: string; bar: string; bg: string }

function qualityInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Exceptional", color: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", narration: "Best-in-class business — high ROIC, durable margins, strong capital allocation and genuine pricing power across the cycle" };
  if (v >= 0.60) return { label: "Strong",      color: "text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10",    narration: "Above-average fundamentals — consistent profitability, solid capital returns and good balance sheet strength" };
  if (v >= 0.45) return { label: "Moderate",    color: "text-amber-400",   bar: "bg-amber-500",   bg: "bg-amber-500/10",   narration: "Average quality — some competitive strengths but limited moat depth or meaningful cyclical revenue exposure" };
  if (v >= 0.30) return { label: "Below Avg",   color: "text-orange-400",  bar: "bg-orange-500",  bg: "bg-orange-500/10",  narration: "Below-average returns — thin margins, limited pricing power or capital-intensive model compressing value creation" };
  return              { label: "Weak",          color: "text-red-400",     bar: "bg-red-500",     bg: "bg-red-500/10",     narration: "Weak fundamentals — poor capital returns, margin pressure or structural business challenges" };
}
function opportunityInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Highly Attractive", color: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", narration: "Compelling setup — meaningful discount to intrinsic value vs history and peers with positive estimate revisions" };
  if (v >= 0.60) return { label: "Attractive",        color: "text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10",    narration: "Good opportunity — stock appears undervalued relative to fundamentals with favourable momentum signals" };
  if (v >= 0.45) return { label: "Moderate",          color: "text-amber-400",   bar: "bg-amber-500",   bg: "bg-amber-500/10",   narration: "Mixed setup — reasonably priced but lacking a clear catalyst or showing neutral momentum" };
  if (v >= 0.30) return { label: "Limited",           color: "text-orange-400",  bar: "bg-orange-500",  bg: "bg-orange-500/10",  narration: "Modest opportunity — near full value, flat revisions and limited near-term upside from current FCF yield" };
  return              { label: "Unattractive",        color: "text-red-400",     bar: "bg-red-500",     bg: "bg-red-500/10",     narration: "Poor setup — overvalued vs history and peers, or negative revisions creating material downside risk" };
}
function mispricingInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Strong Edge",  color: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", narration: "High-conviction mispricing — temporary issue masking durable quality, clear catalyst visible within 6–24 months" };
  if (v >= 0.60) return { label: "Clear Edge",   color: "text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10",    narration: "Market understates structural strengths — revisions turning positive with margin normalisation ahead" };
  if (v >= 0.45) return { label: "Plausible",    color: "text-amber-400",   bar: "bg-amber-500",   bg: "bg-amber-500/10",   narration: "Some mispricing possible — temporary factors suppressing reported economics, thesis still building evidence" };
  if (v >= 0.30) return { label: "Weak",         color: "text-orange-400",  bar: "bg-orange-500",  bg: "bg-orange-500/10",  narration: "Limited mispricing evidence — market appears reasonably informed, limited near-term re-rating catalyst" };
  return              { label: "No Edge",        color: "text-red-400",     bar: "bg-red-500",     bg: "bg-red-500/10",     narration: "No clear market mispricing — fairly valued or even optimistically priced relative to visible fundamentals" };
}
function expectationInterp(v: number): Interp {
  if (v >= 0.75) return { label: "Euphoric",   color: "text-red-400",     bar: "bg-red-500",     bg: "bg-red-500/10",     narration: "Perfection priced in — very high bar means any disappointment risks a sharp de-rating; crowded long" };
  if (v >= 0.60) return { label: "Elevated",   color: "text-orange-400",  bar: "bg-orange-500",  bg: "bg-orange-500/10",  narration: "High expectations — strong consensus optimism creates significant execution risk if growth disappoints" };
  if (v >= 0.45) return { label: "Moderate",   color: "text-amber-400",   bar: "bg-amber-500",   bg: "bg-amber-500/10",   narration: "Balanced bar — consensus is achievable; neither dangerously optimistic nor excessively pessimistic" };
  if (v >= 0.30) return { label: "Modest",     color: "text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10",    narration: "Low bar set — meaningful room to positively surprise consensus and drive multiple expansion" };
  return              { label: "Depressed",    color: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", narration: "Market assumes failure — even modest positive news or a beat could trigger a significant re-rating" };
}
function fragilityInterp(v: number): Interp {
  if (v >= 0.75) return { label: "High Risk",   color: "text-red-400",     bar: "bg-red-500",     bg: "bg-red-500/10",     narration: "Fragile thesis — concentrated revenue, high leverage or major regulatory exposure threatens the story" };
  if (v >= 0.60) return { label: "Elevated",    color: "text-orange-400",  bar: "bg-orange-500",  bg: "bg-orange-500/10",  narration: "Multiple vulnerabilities — structural weaknesses could derail the thesis; requires close monitoring" };
  if (v >= 0.45) return { label: "Moderate",    color: "text-amber-400",   bar: "bg-amber-500",   bg: "bg-amber-500/10",   narration: "Manageable risks — thesis intact under most scenarios but execution quality matters significantly" };
  if (v >= 0.30) return { label: "Robust",      color: "text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10",    narration: "Resilient business — limited structural vulnerabilities, diversified revenue and strong interest coverage" };
  return              { label: "Very Robust",   color: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10", narration: "Fortress-grade resilience — clean balance sheet, diversified revenue and low disruption exposure" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function derivePositionBand(netScore: number | null): BuilderHolding["positionBand"] {
  if (netScore == null) return null;
  if (netScore >= 0.75) return { band: "core",      label: "Core",      minPct: 6,   maxPct: 10  };
  if (netScore >= 0.60) return { band: "standard",  label: "Standard",  minPct: 3,   maxPct: 5   };
  if (netScore >= 0.45) return { band: "starter",   label: "Starter",   minPct: 1,   maxPct: 2.5 };
  if (netScore >= 0.30) return { band: "tactical",  label: "Tactical",  minPct: 0.5, maxPct: 1   };
  return                       { band: "watchlist", label: "Watchlist", minPct: 0,   maxPct: 0   };
}

function bandStyle(band: string | undefined) {
  if (band === "core")      return { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", action: "Strong Buy", actionColor: "text-emerald-400" };
  if (band === "standard")  return { badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",          action: "Buy",        actionColor: "text-blue-400" };
  if (band === "starter")   return { badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",       action: "Add",        actionColor: "text-amber-400" };
  if (band === "tactical")  return { badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",    action: "Watch",      actionColor: "text-orange-400" };
  return                           { badge: "bg-secondary text-muted-foreground border-border/50",       action: "Avoid",      actionColor: "text-red-400" };
}

// ─── Pre-entry classification helpers ─────────────────────────────────────────

function approachingCriteria(s: AllSnapshot, m2: M2Settings) {
  const qThr = m2.minQ * 0.8, oThr = m2.minO * 0.8, mThr = m2.minM * 0.8;
  return [
    { label: "Quality",     met: s.companyQualityScore   != null && s.companyQualityScore   * 100 >= qThr, value: s.companyQualityScore,   threshold: qThr, color: "text-emerald-400", icon: "Q" },
    { label: "Mispricing",  met: s.mispricingScore       != null && s.mispricingScore       * 100 >= mThr, value: s.mispricingScore,       threshold: mThr, color: "text-amber-400",   icon: "M" },
    { label: "Opportunity", met: s.stockOpportunityScore != null && s.stockOpportunityScore * 100 >= oThr, value: s.stockOpportunityScore, threshold: oThr, color: "text-blue-400",    icon: "O" },
    { label: "Expectation ✓", met: s.expectationScore   != null && s.expectationScore      * 100 <= m2.maxE, value: s.expectationScore,   threshold: m2.maxE, color: "text-orange-400", icon: "E", inverted: true },
    { label: "Fragility ✓",   met: s.fragilityScore     != null && s.fragilityScore        * 100 <= m2.maxF, value: s.fragilityScore,     threshold: m2.maxF, color: "text-red-400",    icon: "F", inverted: true },
  ];
}

function momentumSignals(s: AllSnapshot) {
  const rsiOk  = s.rsi          != null && s.rsi          >= 50 && s.rsi          <= 70;
  const momOk  = s.momentumScore != null && s.momentumScore * 100 >= 60;
  const retOk  = s.ret3m         != null && s.ret3m         > 0;
  const macdOk = s.macdHistogram != null && s.macdHistogram > 0;
  return { rsiOk, momOk, retOk, macdOk, count: [rsiOk, momOk, retOk, macdOk].filter(Boolean).length, qualifies: rsiOk && momOk && retOk };
}

function funnelCounts(
  allSnaps: AllSnapshot[],
  mode: BuildMode,
  m1: M1Settings,
  m2: M2Settings,
  sectorCap: number,
  holdings: ManualHolding[]
) {
  const universe = allSnaps.length;
  let scoreFiltered = allSnaps;

  if (mode === "model1" || mode === "approaching") {
    scoreFiltered = allSnaps.filter(s =>
      (s.fortressScore ?? 0) * 100 >= m1.minFortress ||
      (s.rocketScore   ?? 0) * 100 >= m1.minRocket   ||
      (s.waveScore     ?? 0) * 100 >= m1.minWave
    );
  } else if (mode === "model2") {
    scoreFiltered = allSnaps.filter(s =>
      (s.companyQualityScore   ?? 0) * 100 >= m2.minQ &&
      (s.stockOpportunityScore ?? 0) * 100 >= m2.minO &&
      (s.mispricingScore       ?? 0) * 100 >= m2.minM &&
      (s.expectationScore      ?? 1) * 100 <= m2.maxE &&
      (s.fragilityScore        ?? 1) * 100 <= m2.maxF
    );
  } else if (mode === "momentum") {
    scoreFiltered = allSnaps.filter(s => momentumSignals(s).qualifies);
  }

  const sectorMap: Record<string, number> = {};
  const sectorCapped = scoreFiltered.filter(s => {
    const cnt = (sectorMap[s.sector] ?? 0);
    if (cnt >= sectorCap) return false;
    sectorMap[s.sector] = cnt + 1;
    return true;
  });

  return { universe, scoreFiltered: scoreFiltered.length, sectorCapped: sectorCapped.length, portfolio: holdings.length };
}

// ─── Funnel Bar component ─────────────────────────────────────────────────────

function FunnelBar({ counts }: { counts: { universe: number; scoreFiltered: number; sectorCapped: number; portfolio: number } }) {
  const steps = [
    { label: "Universe",      count: counts.universe,      color: "bg-muted/60",     textColor: "text-muted-foreground" },
    { label: "Score filter",  count: counts.scoreFiltered, color: "bg-blue-500/70",  textColor: "text-blue-400" },
    { label: "Sector cap",    count: counts.sectorCapped,  color: "bg-amber-500/70", textColor: "text-amber-400" },
    { label: "Portfolio",     count: counts.portfolio,     color: "bg-emerald-500",  textColor: "text-emerald-400" },
  ];
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Portfolio Funnel</span>
      </div>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className="flex-1 min-w-0">
              <div className={`h-2 rounded-full ${step.color} mb-1.5`} style={{ width: `${Math.max(4, (step.count / (steps[0].count || 1)) * 100)}%` }} />
              <div className={`text-xs font-bold font-mono ${step.textColor}`}>{step.count}</div>
              <div className="text-[10px] text-muted-foreground truncate">{step.label}</div>
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0 mb-4" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Model Settings Panel ─────────────────────────────────────────────────────

function ModelSettingsPanel({
  mode, m1, m2, onM1, onM2,
}: {
  mode: BuildMode; m1: M1Settings; m2: M2Settings;
  onM1: (v: M1Settings) => void; onM2: (v: M2Settings) => void;
}) {
  if (mode === "model1" || mode === "approaching") {
    const items = [
      { key: "minFortress" as const, label: "Min Fortress",  color: "text-blue-400",   bar: "bg-blue-500",   val: m1.minFortress },
      { key: "minRocket"   as const, label: "Min Rocket",    color: "text-orange-400", bar: "bg-orange-500", val: m1.minRocket },
      { key: "minWave"     as const, label: "Min Wave",      color: "text-cyan-400",   bar: "bg-cyan-500",   val: m1.minWave },
    ];
    const tooStrict = items.some(i => i.val > 80);
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Model 1 Thresholds</div>
        {items.map(item => (
          <div key={item.key}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${item.color}`}>{item.label}</span>
              <span className={`text-xs font-bold font-mono ${item.color}`}>{item.val}</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={item.val}
              onChange={e => onM1({ ...m1, [item.key]: Number(e.target.value) })}
              className="w-full accent-primary h-1"
            />
          </div>
        ))}
        {tooStrict && (
          <div className="flex items-start gap-1.5 text-amber-400 text-[10px] bg-amber-500/10 rounded-lg p-2">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>Thresholds above 80 may return very few stocks.</span>
          </div>
        )}
        <button onClick={() => onM1(DEFAULT_M1)} className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors">Reset to defaults</button>
      </div>
    );
  }

  const m2Items = [
    { key: "minQ" as const, label: "Min Quality",     color: "text-emerald-400", sign: "min", val: m2.minQ },
    { key: "minO" as const, label: "Min Opportunity", color: "text-blue-400",    sign: "min", val: m2.minO },
    { key: "minM" as const, label: "Min Mispricing",  color: "text-amber-400",   sign: "min", val: m2.minM },
    { key: "maxE" as const, label: "Max Expectation", color: "text-orange-400",  sign: "max", val: m2.maxE },
    { key: "maxF" as const, label: "Max Fragility",   color: "text-red-400",     sign: "max", val: m2.maxF },
  ];
  const tooStrict = m2.minQ > 80 || m2.minO > 80 || m2.minM > 80 || m2.maxE < 40 || m2.maxF < 40;
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Model 2 Thresholds</div>
      {m2Items.map(item => (
        <div key={item.key}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium ${item.color}`}>{item.label}</span>
            <span className={`text-xs font-bold font-mono ${item.color}`}>{item.sign === "min" ? "≥" : "≤"}{item.val}</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={item.val}
            onChange={e => onM2({ ...m2, [item.key]: Number(e.target.value) })}
            className="w-full accent-primary h-1"
          />
        </div>
      ))}
      {tooStrict && (
        <div className="flex items-start gap-1.5 text-amber-400 text-[10px] bg-amber-500/10 rounded-lg p-2">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>Thresholds are strict — few stocks may qualify.</span>
        </div>
      )}
      <button onClick={() => onM2(DEFAULT_M2)} className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors">Reset to defaults</button>
    </div>
  );
}

// ─── Approaching Buy Zone view ────────────────────────────────────────────────

function ApproachingView({ snaps, m2, onOpenDrawer }: {
  snaps: AllSnapshot[]; m2: M2Settings;
  onOpenDrawer: (s: AllSnapshot) => void;
}) {
  const [capFilter, setCapFilter] = useState<"all" | "large" | "mid" | "small">("all");
  const [sectorFilter, setSectorFilter] = useState("all");

  const approaching = useMemo(() => {
    return snaps
      .filter(s => {
        const n = s.portfolioNetScore;
        if (n == null) return false;
        if (n >= 0.60) return false;
        const criteria = approachingCriteria(s, m2);
        return criteria.filter(c => c.met).length >= 3;
      })
      .filter(s => {
        if (capFilter === "large") return (s.marketCap ?? 0) >= 10;
        if (capFilter === "mid")   return (s.marketCap ?? 0) >= 2 && (s.marketCap ?? 0) < 10;
        if (capFilter === "small") return (s.marketCap ?? 0) < 2;
        return true;
      })
      .filter(s => sectorFilter === "all" || s.sector === sectorFilter)
      .sort((a, b) => (b.portfolioNetScore ?? 0) - (a.portfolioNetScore ?? 0));
  }, [snaps, m2, capFilter, sectorFilter]);

  const sectors = useMemo(() => {
    const s = new Set(snaps.map(r => r.sector).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [snaps]);

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">Approaching Buy Zone</span>
          <span className="ml-auto text-xs font-mono text-amber-400">{approaching.length} stocks</span>
        </div>
        <p className="text-xs text-muted-foreground">Stocks not yet meeting the full Model 2 threshold but passing 3+ of 5 criteria at 80% of the bar. Watch these for upgrades.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(["all", "large", "mid", "small"] as const).map(c => (
            <button key={c} onClick={() => setCapFilter(c)}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-all ${capFilter === c ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
            >{c === "all" ? "All Cap" : c === "large" ? "Large" : c === "mid" ? "Mid" : "Small"}</button>
          ))}
        </div>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          className="appearance-none bg-muted/30 border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none"
        >
          {sectors.map(s => <option key={s} value={s}>{s === "all" ? "All Sectors" : s}</option>)}
        </select>
      </div>

      {approaching.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No stocks currently approaching the buy zone with current thresholds.
        </div>
      )}

      <div className="space-y-2">
        {approaching.map(s => {
          const criteria = approachingCriteria(s, m2);
          const met = criteria.filter(c => c.met).length;
          const netPct = s.portfolioNetScore != null ? Math.round(s.portfolioNetScore * 100) : null;
          const gapToEntry = netPct != null ? 60 - netPct : null;
          return (
            <div key={s.ticker} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{flag(s.country)}</span>
                    <span className="font-mono font-bold text-foreground">{s.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{s.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.sector}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-2xl font-bold font-mono ${netPct == null ? "text-muted-foreground" : netPct >= 50 ? "text-amber-400" : "text-orange-400"}`}>{netPct ?? "—"}</div>
                  <div className="text-[9px] text-muted-foreground">net score</div>
                  {gapToEntry != null && gapToEntry > 0 && (
                    <div className="text-[10px] text-muted-foreground">+{gapToEntry} to Standard</div>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">{met}/5 criteria met</span>
                  <span className={`text-[10px] font-semibold ${met >= 4 ? "text-amber-400" : "text-orange-400"}`}>{met >= 4 ? "Near entry" : "Watching"}</span>
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(met / 5) * 100}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {criteria.map(c => (
                  <div key={c.label} className={`text-center rounded p-1.5 ${c.met ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/20 border border-border/50"}`}>
                    <div className="text-[9px] font-bold mb-0.5">{c.icon}</div>
                    <div className={`text-[10px] font-bold font-mono ${c.met ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {c.value != null ? Math.round(c.value * 100) : "—"}
                    </div>
                    <div className={`text-[8px] ${c.met ? "text-emerald-400/70" : "text-muted-foreground/50"}`}>{c.met ? "✓" : `${c.inverted ? ">" : "<"}${Math.round(c.threshold)}`}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => onOpenDrawer(s)} className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-3 h-3" />Full Intelligence view
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Momentum Breakout view ───────────────────────────────────────────────────

function MomentumView({ snaps, onOpenDrawer }: {
  snaps: AllSnapshot[];
  onOpenDrawer: (s: AllSnapshot) => void;
}) {
  const [capFilter, setCapFilter] = useState<"all" | "large" | "mid" | "small">("all");
  const [minMom, setMinMom] = useState(60);

  const momentum = useMemo(() => {
    return snaps
      .filter(s => {
        if (capFilter === "large") return (s.marketCap ?? 0) >= 10;
        if (capFilter === "mid")   return (s.marketCap ?? 0) >= 2 && (s.marketCap ?? 0) < 10;
        if (capFilter === "small") return (s.marketCap ?? 0) < 2;
        return true;
      })
      .map(s => ({ s, sig: momentumSignals(s) }))
      .filter(({ s, sig }) => sig.count >= 2 && (s.momentumScore != null && s.momentumScore * 100 >= minMom))
      .sort((a, b) => (b.sig.count - a.sig.count) || ((b.s.momentumScore ?? 0) - (a.s.momentumScore ?? 0)))
      .slice(0, 60);
  }, [snaps, capFilter, minMom]);

  const qualifiedCount = momentum.filter(({ sig }) => sig.qualifies).length;

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-400">Momentum Breakout</span>
          <span className="ml-auto text-xs font-mono text-blue-400">{qualifiedCount} fully qualified · {momentum.length} shown</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Stocks with RSI 50–70 (bullish, not overbought) + momentum score ≥ {minMom} + positive 3m return. Full qualification requires all 3.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(["all", "large", "mid", "small"] as const).map(c => (
            <button key={c} onClick={() => setCapFilter(c)}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-all ${capFilter === c ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
            >{c === "all" ? "All Cap" : c === "large" ? "Large" : c === "mid" ? "Mid" : "Small"}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Min Momentum:</span>
          <input type="range" min={40} max={85} step={5} value={minMom} onChange={e => setMinMom(Number(e.target.value))} className="w-20 accent-primary h-1" />
          <span className="font-mono text-foreground w-6">{minMom}</span>
        </div>
      </div>

      {momentum.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No stocks meet momentum criteria with current settings.
        </div>
      )}

      <div className="space-y-2">
        {momentum.map(({ s, sig }) => {
          const netPct = s.portfolioNetScore != null ? Math.round(s.portfolioNetScore * 100) : null;
          const bs = bandStyle(derivePositionBand(s.portfolioNetScore)?.band);
          return (
            <div key={s.ticker} className={`bg-card border rounded-xl p-4 ${sig.qualifies ? "border-blue-500/30" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{flag(s.country)}</span>
                    <span className="font-mono font-bold text-foreground">{s.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{s.name}</span>
                    {sig.qualifies && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">BREAKOUT</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.sector}</div>
                </div>
                <div className="text-right shrink-0">
                  {netPct != null && <div className={`text-lg font-bold font-mono ${bs.actionColor}`}>{netPct}<span className="text-xs text-muted-foreground"> net</span></div>}
                  <div className="text-[10px] text-muted-foreground">{sig.count}/4 signals</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "RSI",      ok: sig.rsiOk,  val: s.rsi != null ? s.rsi.toFixed(0) : "—",                          target: "50–70",   color: "text-blue-400" },
                  { label: "Mom",      ok: sig.momOk,  val: s.momentumScore != null ? Math.round(s.momentumScore * 100) : "—", target: `≥${minMom}`,  color: "text-emerald-400" },
                  { label: "Ret 3m",   ok: sig.retOk,  val: s.ret3m != null ? `${(s.ret3m * 100).toFixed(1)}%` : "—",         target: "> 0",     color: "text-cyan-400" },
                  { label: "MACD",     ok: sig.macdOk, val: s.macdHistogram != null ? (s.macdHistogram > 0 ? "+" : "−") : "—", target: "> 0",    color: "text-violet-400" },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-2 text-center ${item.ok ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/10 border border-border/40"}`}>
                    <div className="text-[9px] text-muted-foreground mb-0.5">{item.label}</div>
                    <div className={`text-sm font-bold font-mono ${item.ok ? item.color : "text-muted-foreground"}`}>{item.val}</div>
                    <div className={`text-[8px] mt-0.5 ${item.ok ? "text-emerald-400/70" : "text-muted-foreground/50"}`}>{item.ok ? "✓" : item.target}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => onOpenDrawer(s)} className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-3 h-3" />Full Intelligence view
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeWeightsTo100(weights: Record<string, number>, locked: Set<string>): Record<string, number> {
  const result = { ...weights };
  const total = Object.values(result).reduce((s, w) => s + w, 0);
  if (Math.abs(total - 100) < 0.05) return result;
  const allTickers = Object.keys(result);
  const unlockedTickers = allTickers.filter(t => !locked.has(t));
  if (unlockedTickers.length === 0) {
    if (total <= 0 || allTickers.length === 0) return result;
    const scale = 100 / total;
    for (const t of allTickers) result[t] = parseFloat(((result[t] ?? 0) * scale).toFixed(1));
    const finalTotal = Object.values(result).reduce((s, w) => s + w, 0);
    const residual = parseFloat((100 - finalTotal).toFixed(1));
    if (Math.abs(residual) >= 0.05) result[allTickers[0]] = parseFloat(((result[allTickers[0]] ?? 0) + residual).toFixed(1));
    return result;
  }
  const lockedTotal = Object.entries(result).filter(([t]) => locked.has(t)).reduce((s, [, w]) => s + w, 0);
  if (lockedTotal >= 100) {
    const lockedTickers = Object.keys(result).filter(t => locked.has(t));
    const scale = 100 / lockedTotal;
    for (const t of lockedTickers) result[t] = parseFloat(((result[t] ?? 0) * scale).toFixed(1));
    for (const t of unlockedTickers) result[t] = 0;
    const finalTotal = Object.values(result).reduce((s, w) => s + w, 0);
    const residual = parseFloat((100 - finalTotal).toFixed(1));
    if (Math.abs(residual) >= 0.05 && lockedTickers.length > 0) result[lockedTickers[0]] = parseFloat(((result[lockedTickers[0]] ?? 0) + residual).toFixed(1));
    return result;
  }
  const unlockedTotal = unlockedTickers.reduce((s, t) => s + (result[t] ?? 0), 0);
  const target = 100 - lockedTotal;
  if (unlockedTotal <= 0) {
    const each = parseFloat((target / unlockedTickers.length).toFixed(1));
    for (const t of unlockedTickers) result[t] = each;
  } else {
    const scale = target / unlockedTotal;
    for (const t of unlockedTickers) result[t] = Math.max(0, parseFloat(((result[t] ?? 0) * scale).toFixed(1)));
  }
  const finalTotal = Object.values(result).reduce((s, w) => s + w, 0);
  const residual = parseFloat((100 - finalTotal).toFixed(1));
  if (Math.abs(residual) >= 0.05) result[unlockedTickers[0]] = Math.max(0, parseFloat(((result[unlockedTickers[0]] ?? 0) + residual).toFixed(1)));
  return result;
}

function formatMktCap(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}T`;
  if (v >= 1)    return `${v.toFixed(1)}B`;
  return `${(v * 1000).toFixed(0)}M`;
}

// ─── Intelligence inline bar ───────────────────────────────────────────────────

function IntelBar({ label: _label, value, interp, weight, compact = false }: {
  label: string; value: number | null; interp: (v: number) => Interp; weight?: string; compact?: boolean;
}) {
  if (value == null) return null;
  const i   = interp(value);
  const pct = Math.round(value * 100);
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${i.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`font-mono text-[11px] font-bold w-6 text-right ${i.color}`}>{pct}</span>
        {weight && <span className="text-[9px] text-muted-foreground w-6">{weight}</span>}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {weight && <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${i.bg} ${i.color}`}>{weight}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold ${i.color}`}>{i.label}</span>
          <span className={`font-mono text-xs font-bold ${i.color}`}>{pct}</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${i.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{i.narration}</p>
    </div>
  );
}

// ─── Portfolio Intelligence summary ───────────────────────────────────────────

function PortfolioIntelligenceSummary({ holdings, weights }: { holdings: ManualHolding[]; weights: Record<string, number> }) {
  if (!holdings.length) return null;

  type LayerKey = "companyQualityScore" | "stockOpportunityScore" | "mispricingScore" | "expectationScore" | "fragilityScore" | "portfolioNetScore";
  const layers: { key: LayerKey; label: string; color: string; bar: string; weight?: string }[] = [
    { key: "companyQualityScore",   label: "Quality",     color: "text-emerald-400", bar: "bg-emerald-500", weight: "×2" },
    { key: "stockOpportunityScore", label: "Opportunity", color: "text-blue-400",    bar: "bg-blue-500",    weight: "×1" },
    { key: "mispricingScore",       label: "Mispricing",  color: "text-amber-400",   bar: "bg-amber-500",   weight: "×2" },
    { key: "expectationScore",      label: "Expectation", color: "text-orange-400",  bar: "bg-orange-500",  weight: "−1" },
    { key: "fragilityScore",        label: "Fragility",   color: "text-red-400",     bar: "bg-red-500",     weight: "−1" },
    { key: "portfolioNetScore",     label: "Net Score",   color: "text-violet-400",  bar: "bg-violet-500" },
  ];

  const avgs = layers.map(l => {
    let wSum = 0, wTotal = 0;
    for (const h of holdings) {
      const val = h[l.key];
      const w = weights[h.ticker] ?? 0;
      if (val != null && w > 0) { wSum += val * w; wTotal += w; }
    }
    return { ...l, avg: wTotal > 0 ? Math.round((wSum / wTotal) * 100) : null };
  });

  const bandCounts = { core: 0, standard: 0, starter: 0, tactical: 0, watchlist: 0 };
  for (const h of holdings) {
    const b = h.positionBand?.band ?? "watchlist";
    if (b in bandCounts) bandCounts[b as keyof typeof bandCounts]++;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-400" />
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Portfolio Intelligence Summary</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">weighted avg · {holdings.length} holdings</span>
      </div>

      {/* Weighted averages */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {avgs.map(l => (
          <div key={l.key} className="text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">{l.label}</div>
            {l.weight && <div className="text-[9px] text-muted-foreground/60 mb-0.5">{l.weight}</div>}
            <div className={`text-xl font-bold font-mono ${l.avg == null ? "text-muted-foreground" : l.avg >= 70 ? "text-emerald-400" : l.avg >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {l.avg ?? "—"}
            </div>
            {l.avg != null && (
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden mt-1">
                <div className={`h-full rounded-full ${l.bar}`} style={{ width: `${l.avg}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Band distribution */}
      <div className="border-t border-border/40 pt-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Position Band Distribution</div>
        <div className="flex h-3 rounded-full overflow-hidden gap-px">
          {[
            { key: "core",      color: "bg-emerald-500", label: "Core" },
            { key: "standard",  color: "bg-blue-500",    label: "Standard" },
            { key: "starter",   color: "bg-amber-500",   label: "Starter" },
            { key: "tactical",  color: "bg-orange-500",  label: "Tactical" },
            { key: "watchlist", color: "bg-muted/50",    label: "Watchlist" },
          ].map(b => {
            const count = bandCounts[b.key as keyof typeof bandCounts];
            return count > 0 ? (
              <div key={b.key} className={`${b.color}`} style={{ width: `${(count / holdings.length) * 100}%` }} title={`${b.label}: ${count}`} />
            ) : null;
          })}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {[
            { key: "core",      label: "CORE",      color: "text-emerald-400" },
            { key: "standard",  label: "STANDARD",  color: "text-blue-400" },
            { key: "starter",   label: "STARTER",   color: "text-amber-400" },
            { key: "tactical",  label: "TACTICAL",  color: "text-orange-400" },
            { key: "watchlist", label: "WATCHLIST", color: "text-muted-foreground" },
          ].map(b => {
            const count = bandCounts[b.key as keyof typeof bandCounts];
            if (count === 0) return null;
            return (
              <span key={b.key} className={`text-[10px] font-semibold ${b.color}`}>
                {b.label} {count}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Holding Intelligence panel (expanded) ─────────────────────────────────────

function HoldingIntelPanel({ h, weight }: { h: ManualHolding; weight: number }) {
  const net  = h.portfolioNetScore;
  const band = h.positionBand;
  const bs   = bandStyle(band?.band);
  const pct  = net != null ? Math.round(net * 100) : null;

  const isRisky    = (h.fragilityScore ?? 0) >= 0.60;
  const isExpensive = (h.expectationScore ?? 0) >= 0.65;
  const hasEdge    = (h.mispricingScore ?? 0) >= 0.60;
  const isQuality  = (h.companyQualityScore ?? 0) >= 0.65;

  const tags: { text: string; color: string }[] = [];
  if (isQuality)   tags.push({ text: "High Quality", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" });
  if (hasEdge)     tags.push({ text: "Clear Edge",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20" });
  if (isExpensive) tags.push({ text: "High Exp.",    color: "text-orange-400 bg-orange-500/10 border-orange-500/20" });
  if (isRisky)     tags.push({ text: "Fragile",      color: "text-red-400 bg-red-500/10 border-red-500/20" });

  return (
    <div className="px-4 pb-4 pt-3 bg-muted/5 border-t border-border/30 space-y-4">

      {/* Net score + band + action */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Investment Intelligence Net Score</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono ${pct == null ? "text-muted-foreground" : pct >= 75 ? "text-emerald-400" : pct >= 60 ? "text-blue-400" : pct >= 45 ? "text-amber-400" : pct >= 30 ? "text-orange-400" : "text-red-400"}`}>
              {pct ?? "—"}
            </span>
            {pct != null && <span className="text-muted-foreground text-sm">/100</span>}
          </div>
          <div className={`text-sm font-bold mt-0.5 ${bs.actionColor}`}>{bs.action}</div>
        </div>
        <div className="space-y-1.5">
          {band && band.minPct > 0 && (
            <div className="bg-card border border-border rounded-lg px-3 py-2 text-right">
              <div className="text-[10px] text-muted-foreground">Recommended Position Size</div>
              <div className="text-lg font-bold font-mono text-foreground">{band.minPct}–{band.maxPct}%</div>
              <div className="text-[10px] text-muted-foreground">Current: <span className="text-foreground font-mono font-semibold">{weight.toFixed(1)}%</span></div>
              {weight > band.maxPct * 1.2 && (
                <div className="text-[10px] text-orange-400 flex items-center gap-1 justify-end mt-0.5">
                  <AlertTriangle className="w-3 h-3" />Overweight
                </div>
              )}
              {weight < band.minPct * 0.5 && band.minPct > 0 && (
                <div className="text-[10px] text-blue-400 flex items-center gap-1 justify-end mt-0.5">
                  <TrendingUp className="w-3 h-3" />Room to add
                </div>
              )}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {tags.map(t => (
                <span key={t.text} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${t.color}`}>{t.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Formula */}
      <div className="text-[10px] font-mono text-muted-foreground/60 bg-muted/20 rounded-lg px-3 py-1.5">
        Net = 2×Quality + 1×Opportunity + 2×Mispricing − 1×Expectation − 1×Fragility
      </div>

      {/* 5 score bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Company Quality <span className="text-emerald-400">+2×</span></div>
            <IntelBar label="Quality" value={h.companyQualityScore} interp={qualityInterp} />
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Stock Opportunity <span className="text-blue-400">+1×</span></div>
            <IntelBar label="Opportunity" value={h.stockOpportunityScore} interp={opportunityInterp} />
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Mispricing <span className="text-amber-400">+2×</span></div>
            <IntelBar label="Mispricing" value={h.mispricingScore} interp={mispricingInterp} />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Expectation <span className="text-orange-400">−1×</span></div>
            <IntelBar label="Expectation" value={h.expectationScore} interp={expectationInterp} />
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Fragility <span className="text-red-400">−1×</span></div>
            <IntelBar label="Fragility" value={h.fragilityScore} interp={fragilityInterp} />
          </div>
          {isRisky && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-semibold">
                <AlertTriangle className="w-3 h-3" />Risk Warning
              </div>
              <p className="text-[10px] text-red-400/80 mt-0.5">High fragility detected. Consider sizing below the recommended band until structural risk is resolved.</p>
            </div>
          )}
          {isExpensive && !isRisky && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
              <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-semibold">
                <AlertTriangle className="w-3 h-3" />Expectation Caution
              </div>
              <p className="text-[10px] text-orange-400/80 mt-0.5">Elevated consensus optimism — high bar to beat. Execution must be flawless to maintain multiple.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add stock panel ───────────────────────────────────────────────────────────

function AddStockPanel({ onAdd, existingTickers }: { onAdd: (r: SearchResult) => void; existingTickers: Set<string> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchData, isLoading: searching } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["portfolio-search", query],
    queryFn: () => customFetch(`/api/portfolio/builder/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 60_000,
  });

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const results = (searchData?.results ?? []).filter(r => !existingTickers.has(r.ticker));

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-primary/40 text-primary text-xs font-medium hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />Add Stock
      </button>
      {open && (
        <div className="absolute top-10 right-0 w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input ref={inputRef} type="text" placeholder="Search ticker or company name…" value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button onClick={() => { setOpen(false); setQuery(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {searching && <div className="p-4 text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />Searching…</div>}
            {!searching && query.length >= 1 && results.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No results found</div>}
            {results.map(r => {
              const net  = r.portfolioNetScore != null ? Math.round(r.portfolioNetScore * 100) : null;
              const bs   = bandStyle(derivePositionBand(r.portfolioNetScore)?.band);
              return (
                <button key={r.ticker} onClick={() => { onAdd(r); setQuery(""); setOpen(false); }}
                  className="w-full px-3 py-3 text-left hover:bg-muted/20 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm">{flag(r.country)}</span>
                      <span className="font-mono font-semibold text-sm text-foreground">{r.ticker}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{r.name}</span>
                    </div>
                    {net != null && (
                      <span className={`font-mono text-xs font-bold shrink-0 ${bs.actionColor}`}>Net {net} · {bs.action}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{r.sector}</div>
                  {r.portfolioNetScore != null && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {[
                        { v: r.companyQualityScore, label: "Q", color: "bg-emerald-500" },
                        { v: r.stockOpportunityScore, label: "O", color: "bg-blue-500" },
                        { v: r.mispricingScore, label: "M", color: "bg-amber-500" },
                        { v: r.expectationScore, label: "E", color: "bg-orange-500" },
                        { v: r.fragilityScore, label: "F", color: "bg-red-500" },
                      ].map(s => s.v != null && (
                        <div key={s.label} className="flex items-center gap-0.5" title={s.label}>
                          <span className="text-[9px] text-muted-foreground">{s.label}</span>
                          <div className="h-1 w-8 bg-muted/30 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.color}`} style={{ width: `${Math.round(s.v * 100)}%` }} />
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground">{Math.round(s.v * 100)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PortfolioBuilder() {
  const [buildMode, setBuildMode] = useState<BuildMode>(() => {
    return (localStorage.getItem("pb-build-mode") as BuildMode) || "model2";
  });
  const [m1Settings, setM1Settings] = useState<M1Settings>(() => {
    try { return JSON.parse(localStorage.getItem("pb-m1-settings") || "null") || DEFAULT_M1; } catch { return DEFAULT_M1; }
  });
  const [m2Settings, setM2Settings] = useState<M2Settings>(() => {
    try { return JSON.parse(localStorage.getItem("pb-m2-settings") || "null") || DEFAULT_M2; } catch { return DEFAULT_M2; }
  });

  const handleSetBuildMode = (m: BuildMode) => {
    setBuildMode(m);
    localStorage.setItem("pb-build-mode", m);
  };
  const handleSetM1 = (v: M1Settings) => { setM1Settings(v); localStorage.setItem("pb-m1-settings", JSON.stringify(v)); };
  const handleSetM2 = (v: M2Settings) => { setM2Settings(v); localStorage.setItem("pb-m2-settings", JSON.stringify(v)); };

  const [strategy, setStrategy]           = useState<Strategy>("rocket");
  const [size, setSize]                   = useState(10);
  const [weightMethod, setWeightMethod]   = useState<WeightMethod>("score");
  const [sectorCap, setSectorCap]         = useState(2);
  const [marketCap, setMarketCap]         = useState<MarketCapTier>("all");
  const [hasBuilt, setHasBuilt]           = useState(false);
  const [buildParams, setBuildParams]     = useState<Record<string, unknown> | null>(null);

  const [drawerSnapshot, setDrawerSnapshot]   = useState<IntelligenceSnapshot | null>(null);
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [expandedTicker, setExpandedTicker]   = useState<string | null>(null);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen]     = useState(false);

  const [manualWeights, setManualWeights]   = useState<Record<string, number>>({});
  const [lockedWeights, setLockedWeights]   = useState<Set<string>>(new Set());
  const [manualMode, setManualMode]         = useState(false);
  const [manualHoldings, setManualHoldings] = useState<ManualHolding[]>([]);

  const { data, isLoading, error } = useQuery<BuilderResponse>({
    queryKey: ["portfolio-builder", buildParams],
    queryFn: () => {
      if (!buildParams) return Promise.resolve({ holdings: [], portfolioScore: null, snapshotDate: null, universeSize: 0, regime: null, params: {} });
      const q = new URLSearchParams({
        strategy:     buildParams.strategy as string,
        size:         String(buildParams.size),
        weightMethod: buildParams.weightMethod as string,
        sectorCap:    String(buildParams.sectorCap),
        marketCap:    buildParams.marketCap as string,
      });
      return customFetch(`/api/portfolio/builder?${q}`);
    },
    enabled: hasBuilt && !!buildParams,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allSnapsData, isLoading: allSnapsLoading } = useQuery<{ snapshots: AllSnapshot[] }>({
    queryKey: ["all-snapshots-preentry"],
    queryFn: () => customFetch("/api/factor-snapshots?limit=500"),
    staleTime: 5 * 60 * 1000,
    enabled: buildMode === "approaching" || buildMode === "momentum" || buildMode === "model1" || buildMode === "model2",
  });
  const allSnaps = allSnapsData?.snapshots ?? [];

  function openDrawerFromSnapshot(s: AllSnapshot) {
    setDrawerSnapshot({
      ticker: s.ticker, name: s.name, sector: s.sector, country: s.country,
      marketCap: s.marketCap, companyQualityScore: s.companyQualityScore,
      stockOpportunityScore: s.stockOpportunityScore, mispricingScore: s.mispricingScore,
      expectationScore: s.expectationScore, fragilityScore: s.fragilityScore,
      portfolioNetScore: s.portfolioNetScore, profitabilityScore: null, growthScore: null,
      capitalEfficiencyScore: null, financialStrengthScore: null, cashFlowQualityScore: null,
      valuationScore: null, momentumScore: s.momentumScore, sentimentScore: null,
      entryScore: s.entryScore, marginOfSafety: s.marginOfSafety, rsi: s.rsi, ret3m: s.ret3m,
    });
    setDrawerOpen(true);
  }

  useEffect(() => {
    if (data?.holdings?.length && !manualMode) {
      const apiHoldings: ManualHolding[] = data.holdings.map(h => ({ ...h, isManual: false }));
      setManualHoldings(apiHoldings);
      const wMap: Record<string, number> = {};
      for (const h of data.holdings) wMap[h.ticker] = parseFloat((h.weight * 100).toFixed(1));
      setManualWeights(wMap);
      setLockedWeights(new Set());
    }
  }, [data?.holdings]);

  function handleBuild() {
    setManualMode(false);
    setExpandedTicker(null);
    setBuildParams({ strategy, size, weightMethod, sectorCap, marketCap });
    setHasBuilt(true);
  }

  const handleWeightChange = useCallback((ticker: string, newVal: string) => {
    const parsed = parseFloat(newVal);
    if (isNaN(parsed) || parsed < 0) return;
    setManualMode(true);
    setManualWeights(prev => {
      const oldVal = prev[ticker] ?? 0;
      const delta  = parsed - oldVal;
      const next   = { ...prev, [ticker]: parsed };
      const otherTickers = Object.keys(next).filter(t => t !== ticker && !lockedWeights.has(t));
      if (otherTickers.length > 0 && Math.abs(delta) > 0.01) {
        const otherTotal = otherTickers.reduce((s, t) => s + (next[t] ?? 0), 0);
        if (otherTotal > 0) {
          for (const t of otherTickers) {
            const share = (next[t] ?? 0) / otherTotal;
            next[t] = Math.max(0, parseFloat(((next[t] ?? 0) - delta * share).toFixed(1)));
          }
        }
      }
      return normalizeWeightsTo100(next, lockedWeights);
    });
  }, [lockedWeights]);

  const redistributeWeights = useCallback(() => {
    setManualWeights(prev => {
      const next = { ...prev };
      const lockedTotal = Array.from(lockedWeights).reduce((s, t) => s + (next[t] ?? 0), 0);
      const unlockedTickers = Object.keys(next).filter(t => !lockedWeights.has(t));
      const remaining = Math.max(0, 100 - lockedTotal);
      if (unlockedTickers.length === 0) return next;
      const each = parseFloat((remaining / unlockedTickers.length).toFixed(1));
      for (const t of unlockedTickers) next[t] = each;
      return next;
    });
  }, [lockedWeights]);

  const resetToAiWeights = useCallback(() => {
    if (data?.holdings?.length) {
      const wMap: Record<string, number> = {};
      for (const h of data.holdings) wMap[h.ticker] = parseFloat((h.weight * 100).toFixed(1));
      setManualHoldings(data.holdings.map(h => ({ ...h, isManual: false })));
      setManualWeights(wMap);
      setLockedWeights(new Set());
      setManualMode(false);
    }
  }, [data?.holdings]);

  const toggleLock = useCallback((ticker: string) => {
    setLockedWeights(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
      return next;
    });
  }, []);

  const removeHolding = useCallback((ticker: string) => {
    setManualMode(true);
    setManualHoldings(prev => prev.filter(h => h.ticker !== ticker));
    setManualWeights(prev => {
      const freedWeight = prev[ticker] ?? 0;
      const next = { ...prev };
      delete next[ticker];
      const remaining = Object.keys(next).filter(t => !lockedWeights.has(t));
      if (remaining.length > 0 && freedWeight > 0) {
        const remainingTotal = remaining.reduce((s, t) => s + (next[t] ?? 0), 0);
        for (const t of remaining) {
          const share = remainingTotal > 0 ? (next[t] ?? 0) / remainingTotal : 1 / remaining.length;
          next[t] = parseFloat(((next[t] ?? 0) + freedWeight * share).toFixed(1));
        }
      }
      return normalizeWeightsTo100(next, lockedWeights);
    });
    setLockedWeights(prev => { const next = new Set(prev); next.delete(ticker); return next; });
  }, [lockedWeights]);

  const handleAddStock = useCallback((result: SearchResult) => {
    setManualMode(true);
    const newHolding: ManualHolding = {
      rank: manualHoldings.length + 1,
      ticker: result.ticker,
      name: result.name,
      sector: result.sector,
      country: result.country,
      weight: 0,
      compositeScore: result.portfolioNetScore ?? 0,
      fortressScore: result.fortressScore,
      rocketScore: result.rocketScore,
      waveScore: result.waveScore,
      entryScore: null,
      marketCap: result.marketCap,
      volatility: null,
      highValuation: false,
      innovationTier: null,
      rationale: "Manually added",
      portfolioNetScore: result.portfolioNetScore,
      expectationScore: result.expectationScore,
      mispricingScore: result.mispricingScore,
      fragilityScore: result.fragilityScore,
      companyQualityScore: result.companyQualityScore,
      stockOpportunityScore: result.stockOpportunityScore,
      positionBand: derivePositionBand(result.portfolioNetScore),
      isManual: true,
    };
    const defaultWeight = 2;
    setManualHoldings(prev => [...prev, newHolding]);
    setManualWeights(prev => {
      const next = { ...prev, [result.ticker]: defaultWeight };
      const otherTickers = Object.keys(prev).filter(t => !lockedWeights.has(t));
      const otherTotal = otherTickers.reduce((s, t) => s + (prev[t] ?? 0), 0);
      if (otherTickers.length > 0 && otherTotal > 0) {
        for (const t of otherTickers) {
          const share = (prev[t] ?? 0) / otherTotal;
          next[t] = Math.max(0, parseFloat(((prev[t] ?? 0) - defaultWeight * share).toFixed(1)));
        }
      }
      return normalizeWeightsTo100(next, lockedWeights);
    });
  }, [manualHoldings, lockedWeights]);

  const holdings     = manualHoldings;
  const regimeInfo   = data?.regime;
  const isPowerLaw   = (buildParams?.weightMethod as string) === "power";
  const totalWeight  = useMemo(() => Object.values(manualWeights).reduce((s, w) => s + w, 0), [manualWeights]);
  const weightDelta  = useMemo(() => parseFloat((100 - totalWeight).toFixed(1)), [totalWeight]);

  const sectorCounts: Record<string, number> = {};
  for (const h of holdings) sectorCounts[h.sector] = (sectorCounts[h.sector] ?? 0) + 1;

  const existingTickers = useMemo(() => new Set(holdings.map(h => h.ticker)), [holdings]);

  // Aggregate Intelligence scores for portfolio
  const portfolioIntelAvg = useMemo(() => {
    if (!holdings.length) return null;
    const nets = holdings.map(h => h.portfolioNetScore).filter((v): v is number => v != null);
    if (!nets.length) return null;
    const tw = Object.values(manualWeights).reduce((s, w) => s + w, 0) || 1;
    let wSum = 0, wTot = 0;
    for (const h of holdings) {
      const v = h.portfolioNetScore;
      const w = manualWeights[h.ticker] ?? 0;
      if (v != null && w > 0) { wSum += v * w; wTot += w; }
    }
    return wTot > 0 ? Math.round((wSum / wTot) * 100) : null;
  }, [holdings, manualWeights]);

  const BAND_ORDER = ["core", "standard", "starter", "tactical", "watchlist"] as const;
  const BAND_META: Record<string, { label: string; color: string; barColor: string; borderColor: string; suggestLabel: string }> = {
    core:      { label: "Core",      color: "text-emerald-400", barColor: "bg-emerald-500", borderColor: "border-emerald-500/30", suggestLabel: "6–10% each"   },
    standard:  { label: "Standard",  color: "text-blue-400",    barColor: "bg-blue-500",    borderColor: "border-blue-500/30",    suggestLabel: "3–5% each"    },
    starter:   { label: "Starter",   color: "text-amber-400",   barColor: "bg-amber-500",   borderColor: "border-amber-500/30",   suggestLabel: "1–2.5% each"  },
    tactical:  { label: "Tactical",  color: "text-orange-400",  barColor: "bg-orange-500",  borderColor: "border-orange-500/30",  suggestLabel: "0.5–1% each"  },
    watchlist: { label: "Watchlist",  color: "text-red-400",     barColor: "bg-red-500",     borderColor: "border-red-500/30",     suggestLabel: "No position"  },
  };

  const bandGroups = useMemo(() => {
    const groups: Record<string, ManualHolding[]> = {};
    for (const b of BAND_ORDER) groups[b] = [];
    for (const h of holdings) {
      const b = h.positionBand?.band ?? "watchlist";
      if (!groups[b]) groups[b] = [];
      groups[b].push(h);
    }
    return groups;
  }, [holdings]);

  const bandWeights = useMemo(() => {
    const result: Record<string, number> = {};
    for (const b of BAND_ORDER) {
      result[b] = (bandGroups[b] ?? []).reduce((s, h) => s + (manualWeights[h.ticker] ?? 0), 0);
    }
    return result;
  }, [bandGroups, manualWeights]);

  const funnel = useMemo(() =>
    allSnaps.length > 0 ? funnelCounts(allSnaps, buildMode, m1Settings, m2Settings, sectorCap, holdings) : null,
    [allSnaps, buildMode, m1Settings, m2Settings, sectorCap, holdings]
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-5 h-5 text-violet-400" />
              <h1 className="text-xl font-display font-bold">Intelligence Portfolio Builder</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Build a portfolio ranked by the Investment Intelligence model. Expand any holding to see its full 5-layer analysis and position guidance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {regimeInfo && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${regimeInfo.name === "BULL" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : regimeInfo.name === "BEAR" ? "bg-red-500/10 border-red-500/30 text-red-400" : regimeInfo.name === "RECOVERY" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-muted/30 border-border text-muted-foreground"}`}>
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs font-mono font-semibold">{regimeInfo.name} Market</span>
              </div>
            )}
            {data?.snapshotDate && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 rounded-lg border border-border">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">Snapshot: {data.snapshotDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Build Mode Tabs ─────────────────────────────── */}
        <div className="flex gap-1 bg-muted/20 rounded-xl p-1 border border-border">
          {([
            { id: "approaching", label: "Approaching Buy Zone", icon: Target,     color: "text-amber-400",  desc: "Pre-entry watchlist" },
            { id: "momentum",    label: "Momentum Breakout",    icon: TrendingUp, color: "text-blue-400",   desc: "RSI + trend signals" },
            { id: "model1",      label: "Model 1 Portfolio",    icon: Shield,     color: "text-cyan-400",   desc: "Fortress / Rocket / Wave" },
            { id: "model2",      label: "Model 2 Portfolio",    icon: Brain,      color: "text-violet-400", desc: "Intelligence (Q·O·M·E·F)" },
          ] as const).map(({ id, label, icon: Icon, color, desc }) => (
            <button key={id} onClick={() => handleSetBuildMode(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${buildMode === id ? "bg-card border border-border shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className={`w-4 h-4 ${buildMode === id ? color : "text-muted-foreground"}`} />
              <span className="hidden sm:block font-semibold text-[11px]">{label}</span>
              <span className={`text-[9px] ${buildMode === id ? "text-muted-foreground" : "text-muted-foreground/50"} hidden md:block`}>{desc}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">

          {/* ── Sidebar ─────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Pre-entry modes: minimal sidebar */}
            {(buildMode === "approaching" || buildMode === "momentum") && (
              <>
                <ModelSettingsPanel mode={buildMode} m1={m1Settings} m2={m2Settings} onM1={handleSetM1} onM2={handleSetM2} />
                {funnel && <FunnelBar counts={funnel} />}
              </>
            )}

            {/* Builder modes: full sidebar */}
            {(buildMode === "model1" || buildMode === "model2") && (<>
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">

              {buildMode === "model1" && <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Base Strategy Engine</label>
                <p className="text-[10px] text-muted-foreground mb-2">Selects which companies enter the pool. Intelligence scoring then ranks them.</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: "fortress", label: "Fortress", icon: Shield,  color: "text-blue-400",   desc: "Quality compounders" },
                    { id: "rocket",   label: "Rocket",   icon: Rocket,  color: "text-orange-400", desc: "High-growth names" },
                    { id: "wave",     label: "Wave",     icon: Waves,   color: "text-cyan-400",   desc: "Momentum plays" },
                  ] as const).map(({ id, label, icon: Icon, color, desc }) => (
                    <button key={id} onClick={() => setStrategy(id)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-all ${strategy === id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
                    >
                      <Icon className={`w-4 h-4 ${strategy === id ? color : "text-muted-foreground"}`} />
                      <span>{label}</span>
                      <span className="text-[9px] text-muted-foreground">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>}

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
                  Portfolio Size — <span className="text-foreground font-semibold">{size} stocks</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[5, 10, 15, 20, 25].map(n => (
                    <button key={n} onClick={() => setSize(n)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium border transition-all ${size === n ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Weighting Method</label>
                <div className="space-y-1.5">
                  {([
                    { id: "equal", label: "Equal weight",          desc: "Each stock gets the same allocation." },
                    { id: "score", label: "Score-proportional",    desc: "Higher net scores get a larger slice." },
                    { id: "risk",  label: "Risk-adjusted",         desc: "Score ÷ volatility — reward per unit risk." },
                    { id: "power", label: "Power Law (α=1.8)",     desc: "Regime-composite, sector-normalised, valuation-checked." },
                  ] as const).map(({ id, label, desc }) => (
                    <button key={id} onClick={() => setWeightMethod(id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${weightMethod === id ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/50"}`}
                    >
                      <div className={`font-medium ${weightMethod === id ? "text-foreground" : "text-muted-foreground"}`}>{label}</div>
                      <div className="text-muted-foreground/70 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
                  Max per Sector — <span className="text-foreground font-semibold">{sectorCap}</span>
                </label>
                <input type="range" min={1} max={5} step={1} value={sectorCap}
                  onChange={e => setSectorCap(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono mt-0.5">
                  <span>1 (max diversification)</span><span>5 (concentrated)</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Cap Size</label>
                <div className="relative">
                  <select value={marketCap} onChange={e => setMarketCap(e.target.value as MarketCapTier)}
                    className="w-full appearance-none bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm pr-8 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">All</option>
                    <option value="top50">Top 50</option>
                    <option value="large">Large Cap ($10B+)</option>
                    <option value="mid">Mid Cap ($2B–$10B)</option>
                    <option value="small">Small Cap (&lt;$2B)</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <button onClick={handleBuild} disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Building…</> : <><Wand2 className="w-4 h-4" />Build Portfolio</>}
              </button>
            </div>

            {/* Sector distribution */}
            {holdings.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Sector Distribution</h3>
                <div className="space-y-1.5">
                  {Object.entries(sectorCounts).sort(([, a], [, b]) => b - a).map(([sec, count]) => (
                    <div key={sec} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground truncate flex-1">{sec}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden" style={{ width: `${count * 16}px` }}>
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: "100%" }} />
                        </div>
                        <span className="text-xs font-mono text-foreground w-3">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Power law methodology */}
            {isPowerLaw && holdings.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setMethodologyOpen(!methodologyOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Power Law Methodology</h3>
                  {methodologyOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {methodologyOpen && (
                  <div className="px-4 pb-4 space-y-2 text-xs text-muted-foreground border-t border-border pt-3">
                    <p>Selection uses <strong className="text-foreground">regime-weighted composite</strong> scores ({regimeInfo?.name ?? "NEUTRAL"} regime).</p>
                    <p>Weights are <strong className="text-foreground">sector-percentile normalised</strong> then raised to exponent <strong className="text-foreground">α=1.8</strong>.</p>
                    <p>Companies with PE &gt; 1.5× sector median receive a <strong className="text-foreground">30% weight haircut</strong>.</p>
                  </div>
                )}
              </div>
            )}

            {/* Model settings panel + funnel bar */}
            <ModelSettingsPanel mode={buildMode} m1={m1Settings} m2={m2Settings} onM1={handleSetM1} onM2={handleSetM2} />
            {funnel && <FunnelBar counts={funnel} />}
            </>)}
          </div>

          {/* ── Main content ────────────────────────────────── */}
          <div className="space-y-4">

            {/* Pre-entry views */}
            {buildMode === "approaching" && (
              allSnapsLoading ? (
                <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading universe…</span>
                </div>
              ) : (
                <ApproachingView snaps={allSnaps} m2={m2Settings} onOpenDrawer={openDrawerFromSnapshot} />
              )
            )}
            {buildMode === "momentum" && (
              allSnapsLoading ? (
                <div className="bg-card border border-border rounded-xl p-8 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading universe…</span>
                </div>
              ) : (
                <MomentumView snaps={allSnaps} onOpenDrawer={openDrawerFromSnapshot} />
              )
            )}

            {/* Builder views (Model 1 / Model 2) */}
            {(buildMode === "model1" || buildMode === "model2") && <>
            {!hasBuilt && (
              <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-violet-400" />
                </div>
                <div className="text-center max-w-sm">
                  <h3 className="text-base font-semibold text-foreground mb-1">Configure & Build</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a base strategy, set your constraints, then hit <em>Build Portfolio</em>. Each holding will show its full 5-layer Investment Intelligence analysis.
                  </p>
                  <div className="mt-3 text-[11px] text-muted-foreground font-mono bg-muted/20 rounded-lg px-3 py-1.5 inline-block">
                    Net = 2×Quality + 1×Opp + 2×Misp − 1×Exp − 1×Frag
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-red-400">Could not build portfolio</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Run the pipeline first to generate factor snapshots, then try again.</div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="bg-card border border-border rounded-xl p-6 space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center animate-pulse">
                    <div className="w-6 h-3 bg-muted/40 rounded" />
                    <div className="w-16 h-3 bg-muted/40 rounded" />
                    <div className="flex-1 h-3 bg-muted/30 rounded" />
                    <div className="w-20 h-3 bg-muted/40 rounded" />
                  </div>
                ))}
              </div>
            )}

            {/* Portfolio Intelligence Summary */}
            {!isLoading && hasBuilt && holdings.length > 0 && (
              <PortfolioIntelligenceSummary holdings={holdings} weights={manualWeights} />
            )}

            {/* Weight controls bar */}
            {!isLoading && hasBuilt && data && (
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Universe: <strong className="text-foreground">{data.universeSize}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Selected: <strong className="text-foreground">{holdings.length}</strong></span>
                  </div>
                  {portfolioIntelAvg != null && (
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-violet-400" />
                      <span>Avg Net Score: <strong className={`font-mono ${portfolioIntelAvg >= 65 ? "text-emerald-400" : portfolioIntelAvg >= 50 ? "text-amber-400" : "text-red-400"}`}>{portfolioIntelAvg}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span className={`font-mono font-semibold ${Math.abs(weightDelta) < 0.2 ? "text-emerald-400" : "text-amber-400"}`}>
                      {totalWeight.toFixed(1)}% allocated
                    </span>
                    {Math.abs(weightDelta) >= 0.2 && (
                      <span className="text-amber-400 text-[10px]">({weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)}%)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {manualMode && (
                    <>
                      <button onClick={resetToAiWeights}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Wand2 className="w-3 h-3" />Rebalance
                      </button>
                      <button onClick={redistributeWeights}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
                      >
                        <Target className="w-3 h-3" />Even out
                      </button>
                    </>
                  )}
                  <AddStockPanel onAdd={handleAddStock} existingTickers={existingTickers} />
                </div>
              </div>
            )}

            {/* Holdings list */}
            {!isLoading && holdings.length > 0 && (
              <div className="space-y-2">

                {/* ── Portfolio Bank ─────────────────────────── */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-foreground">Portfolio Bank</span>
                      <span className="text-[10px] text-muted-foreground ml-1">Allocation by conviction tier</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Allocated: <strong className={`font-mono ${Math.abs(weightDelta) < 0.2 ? "text-emerald-400" : "text-amber-400"}`}>{totalWeight.toFixed(1)}%</strong></span>
                      <span className="text-muted-foreground">Remaining: <strong className={`font-mono ${weightDelta > 0.2 ? "text-amber-400" : "text-emerald-400"}`}>{Math.max(0, 100 - totalWeight).toFixed(1)}%</strong></span>
                    </div>
                  </div>

                  {/* Segmented 100% allocation bar */}
                  <div className="h-3 w-full flex rounded-full overflow-hidden bg-muted/30 mb-3" title="Portfolio allocation by conviction tier">
                    {BAND_ORDER.filter(b => b !== "watchlist").map(b => {
                      const alloc = bandWeights[b] ?? 0;
                      const pct   = Math.min(alloc, 100);
                      if (pct <= 0) return null;
                      return <div key={b} className={`${BAND_META[b].barColor} transition-all`} style={{ width: `${pct}%` }} title={`${BAND_META[b].label}: ${alloc.toFixed(1)}%`} />;
                    })}
                    {/* Remaining (unallocated) */}
                    {totalWeight < 100 && (
                      <div className="flex-1 bg-transparent" />
                    )}
                  </div>

                  {/* Per-band stats */}
                  <div className="grid grid-cols-5 gap-2">
                    {BAND_ORDER.map(b => {
                      const meta  = BAND_META[b];
                      const alloc = bandWeights[b] ?? 0;
                      const count = (bandGroups[b] ?? []).length;
                      return (
                        <div key={b} className={`rounded-lg border ${meta.borderColor} bg-muted/10 p-2.5 flex flex-col gap-1`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                          <div className={`text-xl font-bold font-mono leading-none ${meta.color}`}>{alloc.toFixed(1)}<span className="text-xs">%</span></div>
                          <div className="text-[9px] text-muted-foreground">{count} stock{count !== 1 ? "s" : ""}</div>
                          <div className="text-[8px] text-muted-foreground/70 mt-0.5">{meta.suggestLabel}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>


                {/* ── Shared holding row renderer ─────────────── */}
                {(() => {
                  function HoldingRow({ h, rank, showBandBadge }: { h: ManualHolding; rank: number; showBandBadge: boolean }) {
                    const w        = manualWeights[h.ticker] ?? 0;
                    const pns      = h.portfolioNetScore;
                    const pct      = pns != null ? Math.round(pns * 100) : null;
                    const bs       = bandStyle(h.positionBand?.band);
                    const band     = h.positionBand;
                    const isExp    = expandedTicker === h.ticker;
                    const isLocked = lockedWeights.has(h.ticker);
                    const netColor = pct == null ? "text-muted-foreground" : pct >= 75 ? "text-emerald-400" : pct >= 60 ? "text-blue-400" : pct >= 45 ? "text-amber-400" : pct >= 30 ? "text-orange-400" : "text-red-400";
                    const SCORE_BARS = [
                      { v: h.companyQualityScore,   label: "Q", color: "bg-emerald-500", tip: "Quality ×2 — ROIC, margins, capital allocation. Double-weighted." },
                      { v: h.stockOpportunityScore, label: "O", color: "bg-blue-500",    tip: "Opportunity ×1 — stock attractiveness: valuation, timing, insider signals." },
                      { v: h.mispricingScore,       label: "M", color: "bg-amber-500",   tip: "Mispricing ×2 — market edge: temporary discount vs intrinsic value. Double-weighted." },
                      { v: h.expectationScore,      label: "E", color: "bg-orange-500",  tip: "Expectation −1 — penalised. High = crowded optimism already priced in." },
                      { v: h.fragilityScore,        label: "F", color: "bg-red-500",     tip: "Fragility −1 — penalised. High = balance sheet risk, revenue concentration, SBC dilution." },
                    ];
                    return (
                      <div className="bg-card border border-border rounded-xl overflow-hidden mb-2">
                        <div
                          className="flex items-center gap-2 px-3 py-3 hover:bg-muted/10 transition-colors cursor-pointer select-none"
                          onClick={() => setExpandedTicker(isExp ? null : h.ticker)}
                          title={isExp ? "Click to collapse analysis" : "Click to expand analysis"}
                        >
                          <span className="text-[10px] text-muted-foreground/50 font-mono w-5">{rank}</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm">{flag(h.country)}</span>
                            <span className="font-mono font-bold text-foreground text-sm">{h.ticker}</span>
                            <span className="text-xs text-muted-foreground truncate hidden sm:block">{h.name}</span>
                            {showBandBadge && band && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 hidden md:inline ${bs.badge}`}>
                                {band.label}
                              </span>
                            )}
                          </div>
                          {pct != null && (
                            <div className="text-right shrink-0">
                              <div className={`text-lg font-bold font-mono leading-none ${netColor}`}>{pct}</div>
                              <div className="text-[9px] text-muted-foreground">net</div>
                            </div>
                          )}
                          <div className="hidden lg:flex items-center gap-2 w-48 shrink-0">
                            {SCORE_BARS.map(s => (
                              <Tooltip key={s.label} delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col items-center gap-0.5 flex-1 cursor-help">
                                    <div className="h-6 w-3 bg-muted/30 rounded-sm overflow-hidden flex flex-col justify-end">
                                      {s.v != null && <div className={`w-full rounded-sm ${s.color}`} style={{ height: `${Math.round(s.v * 100)}%` }} />}
                                    </div>
                                    <span className="text-[8px] text-muted-foreground">{s.label}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-relaxed z-[9999]">
                                  <strong className="block mb-0.5">{s.label}: {s.v != null ? Math.round(s.v * 100) : "—"}</strong>
                                  {s.tip}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                          <div className="shrink-0 hidden sm:block">
                            <span className={`text-[10px] font-bold ${bs.actionColor}`}>{bs.action}</span>
                          </div>
                          {/* Suggested range — band-colored */}
                          {band && band.minPct != null && band.maxPct != null && (
                            <div className="text-[9px] text-center shrink-0 hidden lg:block w-14">
                              <div className="text-[8px] text-muted-foreground/60">suggest</div>
                              <div className={`font-mono font-semibold ${BAND_META[band.band]?.color ?? "text-muted-foreground"}`}>{band.minPct}–{band.maxPct}%</div>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleLock(h.ticker)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {isLocked ? <Lock className="w-3 h-3 text-primary" /> : <Unlock className="w-3 h-3" />}
                            </button>
                            <div className="relative w-16">
                              <input
                                type="number" min={0} max={100} step={0.1}
                                value={w.toFixed(1)}
                                onChange={e => handleWeightChange(h.ticker, e.target.value)}
                                className="w-full bg-muted/30 border border-border rounded-md px-2 py-1 text-xs font-mono text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="absolute right-1.5 top-1 text-[9px] text-muted-foreground">%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            <span className="p-1 text-muted-foreground/50 inline-flex">
                              {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                            <button onClick={() => {
                              setDrawerSnapshot({
                                ticker: h.ticker,
                                name: h.name,
                                sector: h.sector,
                                country: h.country,
                                marketCap: (h as any).marketCap,
                                companyQualityScore: h.companyQualityScore,
                                stockOpportunityScore: h.stockOpportunityScore,
                                mispricingScore: h.mispricingScore,
                                expectationScore: h.expectationScore,
                                fragilityScore: h.fragilityScore,
                                portfolioNetScore: h.portfolioNetScore,
                                profitabilityScore: (h as any).profitabilityScore,
                                growthScore: (h as any).growthScore,
                                capitalEfficiencyScore: (h as any).capitalEfficiencyScore,
                                financialStrengthScore: (h as any).financialStrengthScore,
                                cashFlowQualityScore: (h as any).cashFlowQualityScore,
                                valuationScore: (h as any).valuationScore,
                                momentumScore: (h as any).momentumScore,
                                sentimentScore: (h as any).sentimentScore,
                                entryScore: (h as any).entryScore,
                                marginOfSafety: (h as any).marginOfSafety,
                                rsi: (h as any).rsi,
                                ret3m: (h as any).ret3m,
                              });
                              setDrawerOpen(true);
                            }} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="View Intelligence analysis">
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeHolding(h.ticker)} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {isExp && <HoldingIntelPanel h={h} weight={w} />}
                      </div>
                    );
                  }

                  /* ── Band view ─────────────────────────────── */
                  {
                    let globalRank = 0;
                    return (
                      <>
                        {BAND_ORDER.filter(b => b !== "watchlist").map(b => {
                          const group = bandGroups[b] ?? [];
                          if (group.length === 0) return null;
                          const meta  = BAND_META[b];
                          const alloc = bandWeights[b] ?? 0;
                          return (
                            <div key={b}>
                              <div className={`flex items-center gap-2 px-2 py-2 rounded-t-lg border-b ${meta.borderColor} bg-muted/5`}>
                                <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                                <span className="text-[10px] text-muted-foreground">{group.length} stock{group.length !== 1 ? "s" : ""}</span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-muted-foreground">
                                  <strong className={`font-mono ${meta.color}`}>{alloc.toFixed(1)}%</strong> allocated
                                </span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className={`text-[10px] text-muted-foreground/70`}>suggested: {meta.suggestLabel}</span>
                              </div>
                              {group.map(h => {
                                globalRank++;
                                return <HoldingRow key={h.ticker} h={h} rank={globalRank} showBandBadge={false} />;
                              })}
                            </div>
                          );
                        })}

                        {/* Watch / Avoid section — collapsible */}
                        {(bandGroups["watchlist"] ?? []).length > 0 && (
                          <div>
                            <button
                              onClick={() => setWatchlistOpen(o => !o)}
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-t-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                            >
                              <EyeOff className="w-3.5 h-3.5 text-red-400" />
                              <span className="text-xs font-bold uppercase tracking-wide text-red-400">Watch / Avoid</span>
                              <span className="text-[10px] text-muted-foreground">{(bandGroups["watchlist"] ?? []).length} stock{(bandGroups["watchlist"] ?? []).length !== 1 ? "s" : ""}</span>
                              <span className="text-[10px] text-muted-foreground">· No position recommended — monitor only</span>
                              <span className="ml-auto">
                                {watchlistOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                              </span>
                            </button>
                            {watchlistOpen && (bandGroups["watchlist"] ?? []).map((h, i) => (
                              <HoldingRow key={h.ticker} h={h} rank={holdings.length - (bandGroups["watchlist"] ?? []).length + i + 1} showBandBadge={false} />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  }

                })()}

                {/* Total weight bar */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Total Allocation</span>
                    <span className={`text-sm font-bold font-mono ${Math.abs(weightDelta) < 0.2 ? "text-emerald-400" : "text-amber-400"}`}>
                      {totalWeight.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${totalWeight > 103 ? "bg-red-500" : Math.abs(weightDelta) < 0.5 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(totalWeight, 100)}%` }}
                    />
                  </div>
                  {Math.abs(weightDelta) >= 0.5 && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      {weightDelta > 0 ? `${weightDelta.toFixed(1)}% unallocated — use "Even out" to distribute` : `${Math.abs(weightDelta).toFixed(1)}% over-allocated — reduce some positions`}
                    </p>
                  )}
                </div>
              </div>
            )}
            </>}

          </div>
        </div>
      </div>

      <IntelligenceDrawer snapshot={drawerSnapshot} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </Layout>
  );
}
