/**
 * IntelligenceDrawer
 *
 * Dedicated Investment Intelligence analysis drawer.
 * Shows the 5-component formula with ACTUAL numbers, sub-score attribution,
 * and a final recommendation.
 *
 * This is SEPARATE from CompanyDrawer (which is the Dashboard/120-factor view).
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Zap, BarChart3 } from "lucide-react";

const FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Netherlands": "🇳🇱", "Switzerland": "🇨🇭", "Australia": "🇦🇺",
  "Canada": "🇨🇦", "Brazil": "🇧🇷", "Ireland": "🇮🇪", "Spain": "🇪🇸",
  "Italy": "🇮🇹", "Taiwan": "🇹🇼", "South Korea": "🇰🇷", "Singapore": "🇸🇬",
  "Israel": "🇮🇱", "Denmark": "🇩🇰", "Hong Kong": "🇭🇰", "Uruguay": "🇺🇾",
};
const flag = (c?: string | null) => (c ? FLAGS[c] ?? "🌐" : "🌐");

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IntelligenceSnapshot {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  country?: string | null;
  marketCap?: number | null;
  // 5-layer scores (0–1)
  companyQualityScore?: number | null;
  stockOpportunityScore?: number | null;
  mispricingScore?: number | null;
  expectationScore?: number | null;
  fragilityScore?: number | null;
  portfolioNetScore?: number | null;
  // Sub-scores (0–1) — used for factor attribution
  profitabilityScore?: number | null;
  growthScore?: number | null;
  capitalEfficiencyScore?: number | null;
  financialStrengthScore?: number | null;
  cashFlowQualityScore?: number | null;
  valuationScore?: number | null;
  momentumScore?: number | null;
  sentimentScore?: number | null;
  entryScore?: number | null;
  marginOfSafety?: number | null;
  rsi?: number | null;
  ret3m?: number | null;
}

// ─── Helper functions ──────────────────────────────────────────────────────────

function pct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round(v * 100);
}

function fmtMktCap(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
  if (v >= 1)    return `$${v.toFixed(1)}B`;
  return `$${(v * 1000).toFixed(0)}M`;
}

// ─── Score colour helpers ──────────────────────────────────────────────────────

function scoreColor(v: number | null, invert = false): string {
  if (v == null) return "text-muted-foreground";
  const n = invert ? 100 - v : v;
  if (n >= 70) return "text-emerald-400";
  if (n >= 55) return "text-blue-400";
  if (n >= 40) return "text-amber-400";
  if (n >= 25) return "text-orange-400";
  return "text-red-400";
}
function barColor(v: number | null, invert = false): string {
  if (v == null) return "bg-muted/40";
  const n = invert ? 100 - v : v;
  if (n >= 70) return "bg-emerald-500";
  if (n >= 55) return "bg-blue-500";
  if (n >= 40) return "bg-amber-500";
  if (n >= 25) return "bg-orange-500";
  return "bg-red-500";
}

// ─── Sub-score bar ──────────────────────────────────────────────────────────────

function SubBar({ label, desc, value, invert = false }: { label: string; desc: string; value: number | null | undefined; invert?: boolean }) {
  const v = pct(value);
  if (v == null) return (
    <div className="flex items-center gap-2">
      <div className="w-28 shrink-0">
        <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
        <div className="text-[9px] text-muted-foreground/50">{desc}</div>
      </div>
      <span className="text-muted-foreground/30 text-xs ml-2">No data</span>
    </div>
  );
  const c = scoreColor(v, invert);
  const b = barColor(v, invert);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0">
        <div className="text-[10px] font-semibold text-foreground">{label}</div>
        <div className="text-[9px] text-muted-foreground/60">{desc}</div>
      </div>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${b}`} style={{ width: `${v}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold w-7 text-right ${c}`}>{v}</span>
    </div>
  );
}

// ─── Component panel ───────────────────────────────────────────────────────────

function ComponentPanel({ label, weight, weightSign, value, accentColor, accentBg, definition, subScores, narration }: {
  label: string;
  weight: string;
  weightSign: "positive" | "negative";
  value: number | null | undefined;
  accentColor: string;
  accentBg: string;
  definition: string;
  subScores: { label: string; desc: string; value: number | null | undefined; invert?: boolean }[];
  narration: string;
}) {
  const v = pct(value);
  const c = scoreColor(v, weightSign === "negative");
  const b = barColor(v, weightSign === "negative");
  const isNegative = weightSign === "negative";

  return (
    <div className={`rounded-xl border ${accentBg} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${isNegative ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
            {weight}
          </span>
          <span className="text-sm font-bold text-foreground">{label}</span>
        </div>
        {v != null ? (
          <div className="text-right shrink-0">
            <div className={`text-2xl font-bold font-mono leading-none ${c}`}>{v}</div>
            <div className="text-[9px] text-muted-foreground">/100</div>
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm">—</span>
        )}
      </div>

      {/* Score bar */}
      {v != null && (
        <div className="px-4 pb-2">
          <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${b}`} style={{ width: `${v}%` }} />
          </div>
        </div>
      )}

      {/* Definition */}
      <div className="px-4 py-2 border-t border-border/30">
        <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">What this measures</div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{definition}</p>
      </div>

      {/* Sub-scores */}
      {subScores.some(s => s.value != null) && (
        <div className="px-4 py-2 border-t border-border/30 space-y-2">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Contributing factors</div>
          {subScores.map(s => <SubBar key={s.label} {...s} />)}
        </div>
      )}

      {/* Narration */}
      <div className={`px-4 py-3 border-t border-border/30 ${accentBg}`}>
        <p className={`text-[11px] font-medium leading-relaxed ${accentColor}`}>{narration}</p>
      </div>
    </div>
  );
}

// ─── Narration functions (same as Signals page) ────────────────────────────────

function qualityNarr(v: number) {
  if (v >= 75) return "Exceptional business quality — high ROIC, durable margins, strong capital allocation and genuine pricing power across the cycle. This is a best-in-class compounder.";
  if (v >= 60) return "Above-average fundamentals — consistent profitability, solid capital returns and a healthy balance sheet. The business demonstrates competitive strength.";
  if (v >= 45) return "Average quality business with some competitive strengths but limited moat depth. Performance is adequate but not exceptional across cycles.";
  if (v >= 30) return "Below-average business returns — thin margins, limited pricing power or a capital-intensive model that compresses value creation.";
  return "Weak fundamentals — poor capital returns, margin pressure or structural challenges that threaten the long-term business model.";
}
function opportunityNarr(v: number) {
  if (v >= 75) return "Compelling stock setup — meaningful discount to intrinsic value vs both history and peers. Positive estimate revisions and improving entry timing add conviction.";
  if (v >= 60) return "Good opportunity — stock appears undervalued relative to fundamentals. Favourable valuation and momentum signals support the entry.";
  if (v >= 45) return "Mixed setup — stock is reasonably priced but lacks a clear directional catalyst. Risk/reward is balanced, not skewed in your favour.";
  if (v >= 30) return "Modest opportunity — stock trades near full value with flat revisions. Limited near-term upside based on current FCF yield and valuation.";
  return "Poor setup — overvalued versus history and peers, or negative revisions creating meaningful downside risk from current prices.";
}
function mispricingNarr(v: number) {
  if (v >= 75) return "High-conviction mispricing — temporary issues are masking durable quality. A clear catalyst is visible within 6–24 months that should drive a re-rating.";
  if (v >= 60) return "Market is understating structural strengths — revisions are turning positive, margin normalisation is ahead and optionality appears underpriced.";
  if (v >= 45) return "Some mispricing possible — temporary factors may be suppressing reported economics. The thesis is building but lacks full confirmation.";
  if (v >= 30) return "Limited mispricing evidence — market appears reasonably informed. No clear near-term re-rating catalyst is identifiable.";
  return "No detectable market mispricing — the stock appears fairly valued or even optimistically priced relative to visible fundamentals.";
}
function expectationNarr(v: number) {
  if (v >= 75) return "Perfection is priced in — the consensus bar is extremely high. Any disappointment in execution or macro risks a sharp de-rating from a crowded long.";
  if (v >= 60) return "High consensus optimism creates execution risk — the bar to beat is demanding. Even small misses could trigger multiple compression.";
  if (v >= 45) return "Balanced expectation bar — consensus is achievable. Neither dangerously optimistic nor excessively pessimistic. Normal risk/reward.";
  if (v >= 30) return "Low bar set by the market — meaningful room to positively surprise consensus. A beat-and-raise quarter could drive material multiple expansion.";
  return "Market assumes failure — even modest positive newsflow or an earnings beat could trigger a significant sentiment-driven re-rating.";
}
function fragilityNarr(v: number) {
  if (v >= 75) return "Highly fragile thesis — concentrated revenue, elevated leverage or significant regulatory/disruption exposure materially threatens the investment story.";
  if (v >= 60) return "Multiple structural vulnerabilities present — one or more risk factors could derail the thesis and require close ongoing monitoring.";
  if (v >= 45) return "Manageable risks — the thesis holds under most scenarios but execution quality matters. Watch macro sensitivity and competitive dynamics.";
  if (v >= 30) return "Resilient business — limited structural vulnerabilities, diversified revenue and strong interest coverage make the thesis durable.";
  return "Fortress-grade resilience — clean balance sheet, diversified revenue base and low regulatory or technology disruption exposure.";
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  snapshot: IntelligenceSnapshot | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function IntelligenceDrawer({ snapshot: s, open, onOpenChange }: Props) {
  if (!s) return null;

  const Q  = pct(s.companyQualityScore);
  const O  = pct(s.stockOpportunityScore);
  const M  = pct(s.mispricingScore);
  const E  = pct(s.expectationScore);
  const F  = pct(s.fragilityScore);
  const N  = pct(s.portfolioNetScore);

  // Raw weighted sum for formula display
  const rawWeighted =
    Q != null && O != null && M != null && E != null && F != null
      ? (2 * Q + 1 * O + 2 * M - 1 * E - 1 * F)
      : null;

  // Normalization: (raw + 200) / 700 × 100
  const rawNormalised = rawWeighted != null ? Math.round(((rawWeighted + 200) / 700) * 100) : null;

  function bandConfig() {
    if (N == null) return null;
    if (N >= 75) return { label: "CORE",     badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", action: "Strong Buy", actionColor: "text-emerald-400", minPct: 6, maxPct: 10 };
    if (N >= 60) return { label: "STANDARD", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",          action: "Buy",        actionColor: "text-blue-400",    minPct: 3, maxPct: 5  };
    if (N >= 45) return { label: "STARTER",  badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",       action: "Add",        actionColor: "text-amber-400",   minPct: 1, maxPct: 2.5};
    if (N >= 30) return { label: "TACTICAL", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",    action: "Watch",      actionColor: "text-orange-400",  minPct: 0.5, maxPct: 1 };
    return              { label: "WATCHLIST",badge: "bg-secondary text-muted-foreground border-border/50",      action: "Avoid",      actionColor: "text-red-400",     minPct: 0, maxPct: 0  };
  }
  const band = bandConfig();

  // Generate recommendation text
  function recommendation(): string {
    if (N == null) return "Insufficient data to generate a recommendation.";
    const qLevel = Q != null && Q >= 65 ? "strong quality foundation" : Q != null && Q >= 45 ? "moderate quality base" : "limited quality foundation";
    const mLevel = M != null && M >= 65 ? "clear mispricing edge" : M != null && M >= 45 ? "some mispricing signal" : "no identifiable mispricing";
    const eLevel = E != null && E <= 35 ? "low expectation bar creates room to surprise" : E != null && E <= 55 ? "balanced consensus bar" : "elevated expectations increase execution risk";
    const fLevel = F != null && F <= 35 ? "robust thesis with limited downside risk" : F != null && F <= 55 ? "manageable thesis risks" : "fragile thesis — requires careful position sizing";
    return `Built on a ${qLevel}, with ${mLevel}. ${eLevel.charAt(0).toUpperCase() + eLevel.slice(1)}. ${fLevel.charAt(0).toUpperCase() + fLevel.slice(1)}.`;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Investment Intelligence — {s.ticker}</SheetTitle>
        </SheetHeader>

        {/* ── Fixed header ───────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-mono text-violet-400 uppercase tracking-wider">Investment Intelligence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{flag(s.country)}</span>
                <span className="text-xl font-bold font-mono">{s.ticker}</span>
                {band && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${band.badge}`}>{band.label}</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{s.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {s.sector && <span className="text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/30">{s.sector}</span>}
                {s.country && <span className="text-[10px] text-muted-foreground/60">{s.country}</span>}
                {s.marketCap && <span className="text-[10px] text-muted-foreground/60">{fmtMktCap(s.marketCap)}</span>}
              </div>
            </div>
            {N != null && (
              <div className="text-right shrink-0">
                <div className={`text-4xl font-bold font-mono leading-none ${N >= 75 ? "text-emerald-400" : N >= 60 ? "text-blue-400" : N >= 45 ? "text-amber-400" : N >= 30 ? "text-orange-400" : "text-red-400"}`}>{N}</div>
                <div className="text-[10px] text-muted-foreground">Net Score</div>
                {band && <div className={`text-xs font-bold mt-0.5 ${band.actionColor}`}>{band.action}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-5 space-y-6">

          {/* ── Formula calculation ────────────────────────── */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
            <div className="text-[10px] text-violet-400 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" /> Score Derivation
            </div>
            <div className="text-xs text-muted-foreground font-mono mb-3">
              Net Score = <span className="text-emerald-400">2×Quality</span> + <span className="text-blue-400">1×Opportunity</span> + <span className="text-amber-400">2×Mispricing</span> − <span className="text-orange-400">1×Expectation</span> − <span className="text-red-400">1×Fragility</span>
            </div>

            {rawWeighted != null ? (
              <div className="space-y-1 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 w-28">2 × {Q} (Quality)</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-emerald-400 font-bold">+{2 * Q!}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">business quality, double weight</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 w-28">1 × {O} (Opp.)</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-blue-400 font-bold">+{O}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">stock setup attractiveness</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 w-28">2 × {M} (Mispricing)</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-amber-400 font-bold">+{2 * M!}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">market edge signal, double weight</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-400 w-28">1 × {E} (Expectation)</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-orange-400 font-bold">−{E}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">priced-in optimism, penalised</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400 w-28">1 × {F} (Fragility)</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-red-400 font-bold">−{F}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">thesis risk, penalised</span>
                </div>
                <div className="border-t border-border/40 mt-2 pt-2 flex items-center gap-2">
                  <span className="text-muted-foreground w-28">Raw weighted</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-foreground font-bold">{rawWeighted}</span>
                  <span className="text-muted-foreground/50 text-[10px] ml-2">(range: −200 to +500)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28">Normalised</span>
                  <span className="text-muted-foreground">=</span>
                  <span className="text-foreground/50 text-[10px]">({rawWeighted} + 200) ÷ 700 × 100</span>
                  <span className="text-muted-foreground">=</span>
                  <span className={`font-bold text-base ml-1 ${N != null && N >= 75 ? "text-emerald-400" : N != null && N >= 60 ? "text-blue-400" : N != null && N >= 45 ? "text-amber-400" : "text-orange-400"}`}>{rawNormalised ?? N}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Insufficient data to show full calculation.</p>
            )}
          </div>

          {/* ── Component 1: Quality ───────────────────────── */}
          <ComponentPanel
            label="Company Quality"
            weight="+2× weight"
            weightSign="positive"
            value={s.companyQualityScore}
            accentColor="text-emerald-400"
            accentBg="border-emerald-500/20 bg-emerald-950/5"
            definition="Measures the structural quality of the underlying business — return on invested capital, durability of margins, cash generation, balance sheet health and pricing power across economic cycles. A high score indicates a genuine compounder with durable competitive advantages."
            subScores={[
              { label: "Profitability",      desc: "ROIC, gross & operating margin",     value: s.profitabilityScore },
              { label: "Capital Efficiency", desc: "Asset turnover, capital returns",     value: s.capitalEfficiencyScore },
              { label: "Financial Strength", desc: "Balance sheet, debt coverage",        value: s.financialStrengthScore },
              { label: "Cash Flow Quality",  desc: "FCF conversion, earnings quality",    value: s.cashFlowQualityScore },
              { label: "Growth",             desc: "3-year revenue & EPS trajectory",     value: s.growthScore },
            ]}
            narration={Q != null ? qualityNarr(Q) : "No quality score available."}
          />

          {/* ── Component 2: Opportunity ───────────────────── */}
          <ComponentPanel
            label="Stock Opportunity"
            weight="+1× weight"
            weightSign="positive"
            value={s.stockOpportunityScore}
            accentColor="text-blue-400"
            accentBg="border-blue-500/20 bg-blue-950/5"
            definition="Measures how attractively priced and technically positioned the stock is right now. Considers valuation versus historical norms and sector peers, FCF yield, analyst estimate revisions, entry timing, and margin of safety vs estimated intrinsic value."
            subScores={[
              { label: "Valuation",       desc: "PE vs history, EV/EBIT vs peers",    value: s.valuationScore },
              { label: "Entry Timing",    desc: "Technical entry quality, MACD, RSI", value: s.entryScore },
              { label: "Margin of Safety",desc: "Discount to intrinsic value",        value: s.marginOfSafety },
              { label: "Momentum",        desc: "Price trend, relative strength",     value: s.momentumScore },
            ]}
            narration={O != null ? opportunityNarr(O) : "No opportunity score available."}
          />

          {/* ── Component 3: Mispricing ────────────────────── */}
          <ComponentPanel
            label="Mispricing"
            weight="+2× weight"
            weightSign="positive"
            value={s.mispricingScore}
            accentColor="text-amber-400"
            accentBg="border-amber-500/20 bg-amber-950/5"
            definition="The most important component (double weight). Measures whether the market has made an identifiable error in pricing this stock. Looks for temporary issues masking durable quality, positive EPS revisions beginning to inflect, visible catalysts in 6–24 months, undiscovered optionality, and accounting distortions obscuring true economics."
            subScores={[
              { label: "Analyst Sentiment", desc: "EPS revisions, estimate inflections", value: s.sentimentScore },
              { label: "Margin of Safety",  desc: "Gap between price and fair value",    value: s.marginOfSafety },
              { label: "Valuation vs Peers",desc: "Discount vs sector comparables",      value: s.valuationScore },
            ]}
            narration={M != null ? mispricingNarr(M) : "No mispricing score available."}
          />

          {/* ── Component 4: Expectation ──────────────────── */}
          <ComponentPanel
            label="Expectation"
            weight="−1× penalised"
            weightSign="negative"
            value={s.expectationScore}
            accentColor="text-orange-400"
            accentBg="border-orange-500/20 bg-orange-950/5"
            definition="Measures how much success is already priced into the stock — the higher the expectation, the bigger the penalty to the net score. This prevents the system from recommending 'great but fully priced' companies. Looks at valuation premium, analyst crowding, recent price appreciation and consensus optimism levels."
            subScores={[
              { label: "Valuation Level",  desc: "PE premium vs history/peers",        value: s.valuationScore,  invert: true },
              { label: "Price Momentum",   desc: "12M & 3M return — recent run-up",    value: s.momentumScore,   invert: true },
              { label: "RSI",              desc: "Relative strength (overbought risk)", value: s.rsi != null ? s.rsi / 100 : null, invert: true },
            ]}
            narration={E != null ? expectationNarr(E) : "No expectation score available."}
          />

          {/* ── Component 5: Fragility ────────────────────── */}
          <ComponentPanel
            label="Fragility"
            weight="−1× penalised"
            weightSign="negative"
            value={s.fragilityScore}
            accentColor="text-red-400"
            accentBg="border-red-500/20 bg-red-950/5"
            definition="Measures how easily the investment thesis could break down. A high fragility score reduces the net score to prevent loading up on 'cheap but fragile' names. Considers leverage, revenue concentration, margin volatility, interest coverage, analyst estimate dispersion, regulatory risk and technology disruption exposure."
            subScores={[
              { label: "Balance Sheet",    desc: "Net debt/EBITDA, interest coverage",  value: s.financialStrengthScore, invert: true },
              { label: "Momentum Stability", desc: "Trend consistency, volatility",    value: s.momentumScore, invert: true },
              { label: "Estimate Dispersion", desc: "Analyst disagreement on earnings", value: s.sentimentScore, invert: true },
            ]}
            narration={F != null ? fragilityNarr(F) : "No fragility score available."}
          />

          {/* ── Final recommendation ────────────────────────── */}
          {band && (
            <div className={`rounded-xl border p-4 ${
              band.label === "CORE"      ? "border-emerald-500/30 bg-emerald-950/10" :
              band.label === "STANDARD"  ? "border-blue-500/30 bg-blue-950/10" :
              band.label === "STARTER"   ? "border-amber-500/30 bg-amber-950/10" :
              band.label === "TACTICAL"  ? "border-orange-500/30 bg-orange-950/10" :
              "border-border bg-muted/10"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider font-semibold">Final Recommendation</span>
              </div>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className={`text-2xl font-bold mb-0.5 ${band.actionColor}`}>{band.action}</div>
                  <div className="text-xs text-muted-foreground">Position band: <strong className="text-foreground">{band.label}</strong></div>
                  {band.minPct > 0 ? (
                    <div className="text-xs text-muted-foreground mt-0.5">Recommended size: <strong className={`font-mono ${band.actionColor}`}>{band.minPct}–{band.maxPct}%</strong> of portfolio</div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-0.5">Do not add to portfolio — monitor only</div>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold font-mono ${band.actionColor}`}>{N}/100</div>
                  <div className="text-[10px] text-muted-foreground">Intelligence Net Score</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[11px] text-muted-foreground leading-relaxed">{recommendation()}</p>
              </div>

              {/* Risk warnings */}
              {F != null && F >= 60 && (
                <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-red-400">High fragility detected. Consider sizing below the band minimum until structural risks are resolved.</p>
                </div>
              )}
              {E != null && E >= 70 && (
                <div className="mt-2 flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-orange-400">Elevated expectations — the bar to beat is very high. Any earnings miss or guidance cut risks a sharp de-rating.</p>
                </div>
              )}
              {N != null && N >= 75 && (
                <div className="mt-2 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-emerald-400">Core position — all five components align. This is a high-conviction pick with quality, opportunity, and mispricing edge.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
