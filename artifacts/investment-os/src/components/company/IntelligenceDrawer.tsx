/**
 * IntelligenceDrawer
 *
 * Full Investment Intelligence detail view.
 * Shows every factor that feeds each component, with:
 *  - Factor name + weight (from scoring config)
 *  - Actual raw DB value (financial_metrics + factor_snapshots)
 *  - Contextual assessment (Excellent / Good / Average / Weak)
 *  - Visual bar
 *
 * Formula: Net = (2×Quality + 1×Opportunity + 2×Mispricing − 1×Expectation − 1×Fragility + 200) / 700 × 100
 *
 * This is SEPARATE from CompanyDrawer (Dashboard / 120-factor view).
 * Powered by GET /api/intelligence/:ticker
 */

import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Brain, Loader2, AlertTriangle, CheckCircle2, Target, BarChart3,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IntelligenceSnapshot {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  country?: string | null;
  marketCap?: number | null;
  companyQualityScore?: number | null;
  stockOpportunityScore?: number | null;
  mispricingScore?: number | null;
  expectationScore?: number | null;
  fragilityScore?: number | null;
  portfolioNetScore?: number | null;
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

interface RawMetrics {
  // Profitability
  roic?: number | null;
  roic_5yr_avg?: number | null;
  roic_stability?: number | null;
  roe?: number | null;
  gross_margin?: number | null;
  gross_margin_trend?: number | null;
  operating_margin?: number | null;
  operating_margin_trend?: number | null;
  net_margin?: number | null;
  fcf_margin?: number | null;
  ebit_margin?: number | null;
  ebitda_margin?: number | null;
  incremental_margin?: number | null;
  // Cash flow
  fcf_yield?: number | null;
  fcf_stability?: number | null;
  fcf_to_net_income?: number | null;
  accrual_ratio?: number | null;
  cash_flow_volatility?: number | null;
  stock_based_comp_pct?: number | null;
  capital_allocation_discipline?: number | null;
  operating_cf_to_revenue?: number | null;
  // Leverage / balance sheet
  debt_to_equity?: number | null;
  net_debt_ebitda?: number | null;
  interest_coverage?: number | null;
  current_ratio?: number | null;
  quick_ratio?: number | null;
  cash_to_debt?: number | null;
  altman_z_score?: number | null;
  // Growth
  revenue_growth_1y?: number | null;
  revenue_growth_3y?: number | null;
  revenue_growth_5y?: number | null;
  eps_growth_1y?: number | null;
  eps_growth_3y?: number | null;
  eps_growth_5y?: number | null;
  fcf_growth?: number | null;
  operating_income_growth?: number | null;
  // Capital efficiency
  asset_turnover?: number | null;
  capex_to_revenue?: number | null;
  reinvestment_rate?: number | null;
  working_capital_efficiency?: number | null;
  operating_leverage?: number | null;
  // Valuation
  pe_ratio?: number | null;
  forward_pe?: number | null;
  peg_ratio?: number | null;
  ev_to_ebitda?: number | null;
  ev_to_sales?: number | null;
  price_to_fcf?: number | null;
  price_to_book?: number | null;
  rule_of_40?: number | null;
  revenue_multiple_vs_growth?: number | null;
  // Signals
  insider_buying?: number | null;
  insider_ownership?: number | null;
  institutional_ownership?: number | null;
  earnings_surprises?: number | null;
  dividend_yield?: number | null;
  shareholder_yield?: number | null;
  payout_ratio?: number | null;
  // Forensics / mispricing
  days_sales_outstanding?: number | null;
  receivables_growth_vs_revenue?: number | null;
  deferred_revenue_growth?: number | null;
  working_capital_drift?: number | null;
  tax_efficiency?: number | null;
  // Innovation
  rd_to_revenue?: number | null;
  rd_productivity?: number | null;
  employee_productivity?: number | null;
}

interface IntelligenceDetail {
  ticker: string;
  snapshot: Record<string, any>;
  metrics: RawMetrics | null;
}

// ─── Formatters ────────────────────────────────────────────────────────────────

const fmt = {
  pct: (v: number | null | undefined, decimals = 1): string =>
    v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(decimals)}%`,
  pctAbs: (v: number | null | undefined, decimals = 1): string =>
    v == null ? "—" : `${(v * 100).toFixed(decimals)}%`,
  x: (v: number | null | undefined, decimals = 1): string =>
    v == null ? "—" : `${v.toFixed(decimals)}×`,
  num: (v: number | null | undefined, decimals = 1): string =>
    v == null ? "—" : v.toFixed(decimals),
  mktCap: (v: number | null | undefined): string => {
    if (v == null) return "—";
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
    if (v >= 1)    return `$${v.toFixed(1)}B`;
    return `$${(v * 1000).toFixed(0)}M`;
  },
};

// ─── Assessment logic ──────────────────────────────────────────────────────────

type Level = "excellent" | "good" | "average" | "weak" | "poor" | "na";

interface Assessment { level: Level; label: string; color: string; bar: string; bg: string }

const LEVELS: Record<Level, Omit<Assessment, "level">> = {
  excellent: { label: "Excellent", color: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/10" },
  good:      { label: "Good",      color: "text-blue-400",    bar: "bg-blue-500",    bg: "bg-blue-500/10"    },
  average:   { label: "Average",   color: "text-amber-400",   bar: "bg-amber-500",   bg: "bg-amber-500/10"   },
  weak:      { label: "Weak",      color: "text-orange-400",  bar: "bg-orange-500",  bg: "bg-orange-500/10"  },
  poor:      { label: "Poor",      color: "text-red-400",     bar: "bg-red-500",     bg: "bg-red-500/10"     },
  na:        { label: "No data",   color: "text-muted-foreground", bar: "bg-muted/30", bg: "bg-muted/5"      },
};

function assess(level: Level): Assessment { return { level, ...LEVELS[level] }; }

// Higher-is-better assessments
function roicAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  const p = v; // stored as fraction
  if (p > 0.25) return assess("excellent");
  if (p > 0.15) return assess("good");
  if (p > 0.08) return assess("average");
  if (p > 0)    return assess("weak");
  return assess("poor");
}
function marginAssess(v: number | null | undefined, tiers = [0.25, 0.15, 0.08, 0.02]): Assessment {
  if (v == null) return assess("na");
  if (v > tiers[0]) return assess("excellent");
  if (v > tiers[1]) return assess("good");
  if (v > tiers[2]) return assess("average");
  if (v > tiers[3]) return assess("weak");
  return assess("poor");
}
function growthAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.20) return assess("excellent");
  if (v > 0.10) return assess("good");
  if (v > 0.05) return assess("average");
  if (v > 0)    return assess("weak");
  return assess("poor");
}
function trendAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.02) return assess("excellent");
  if (v > 0)    return assess("good");
  if (v > -0.02) return assess("average");
  if (v > -0.05) return assess("weak");
  return assess("poor");
}
function altmanAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 3.0) return assess("excellent");
  if (v > 2.0) return assess("good");
  if (v > 1.8) return assess("average");
  return assess("poor");
}
function currentRatioAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 2.5) return assess("excellent");
  if (v > 1.5) return assess("good");
  if (v > 1.0) return assess("average");
  if (v > 0.7) return assess("weak");
  return assess("poor");
}
function interestCoverageAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 10) return assess("excellent");
  if (v > 5)  return assess("good");
  if (v > 2)  return assess("average");
  if (v > 1)  return assess("weak");
  return assess("poor");
}
function netDebtEbitdaAssess(v: number | null | undefined): Assessment {
  // Lower is better for fragility (less debt = less fragile)
  if (v == null) return assess("na");
  if (v < 0)    return assess("excellent"); // net cash
  if (v < 1)    return assess("good");
  if (v < 2)    return assess("average");
  if (v < 3.5)  return assess("weak");
  return assess("poor");
}
function fcfYieldAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.06) return assess("excellent");
  if (v > 0.03) return assess("good");
  if (v > 0.01) return assess("average");
  if (v > 0)    return assess("weak");
  return assess("poor");
}
function peAssess(v: number | null | undefined): Assessment {
  // For opportunity: low PE = good; for expectation: high PE = elevated
  if (v == null) return assess("na");
  if (v < 15)   return assess("excellent");
  if (v < 22)   return assess("good");
  if (v < 30)   return assess("average");
  if (v < 40)   return assess("weak");
  return assess("poor");
}
function peAssessExp(v: number | null | undefined): Assessment {
  // For expectation: high PE = high expectation = WARN
  if (v == null) return assess("na");
  if (v > 50)   return assess("poor");   // very elevated
  if (v > 35)   return assess("weak");
  if (v > 25)   return assess("average");
  if (v > 15)   return assess("good");
  return assess("excellent");
}
function rsiAssess(v: number | null | undefined, forExpectation = false): Assessment {
  if (v == null) return assess("na");
  if (forExpectation) {
    if (v > 75)   return assess("poor");
    if (v > 65)   return assess("weak");
    if (v > 45)   return assess("average");
    if (v > 35)   return assess("good");
    return assess("excellent");
  }
  if (v < 30)   return assess("excellent"); // oversold = opportunity
  if (v < 45)   return assess("good");
  if (v < 65)   return assess("average");
  if (v < 75)   return assess("weak");
  return assess("poor");
}
function earningsSurprisesAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.08) return assess("excellent");
  if (v > 0.03) return assess("good");
  if (v > -0.01) return assess("average");
  if (v > -0.05) return assess("weak");
  return assess("poor");
}
function insiderBuyingAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.5)  return assess("excellent");
  if (v > 0.2)  return assess("good");
  if (v > 0)    return assess("average");
  return assess("weak");
}
function accrualAssess(v: number | null | undefined): Assessment {
  // Accrual ratio: lower = better earnings quality
  if (v == null) return assess("na");
  if (v < -0.05) return assess("excellent");
  if (v < 0.02) return assess("good");
  if (v < 0.08) return assess("average");
  if (v < 0.15) return assess("weak");
  return assess("poor");
}
function marginSafetyAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.35) return assess("excellent");
  if (v > 0.20) return assess("good");
  if (v > 0.10) return assess("average");
  if (v > 0)    return assess("weak");
  return assess("poor");
}
function ret3mAssess(v: number | null | undefined, forExpectation = false): Assessment {
  if (v == null) return assess("na");
  if (forExpectation) {
    // For expectation: large positive run-up = high expectations priced in
    if (v > 0.30)  return assess("poor");
    if (v > 0.15)  return assess("weak");
    if (v > 0.05)  return assess("average");
    if (v > -0.10) return assess("good");
    return assess("excellent"); // fell = expectation reset
  }
  if (v > 0.15) return assess("excellent");
  if (v > 0.05) return assess("good");
  if (v > -0.05) return assess("average");
  if (v > -0.15) return assess("weak");
  return assess("poor");
}
function cashVolAssess(v: number | null | undefined): Assessment {
  // Lower cash flow volatility = better (for fragility)
  if (v == null) return assess("na");
  if (v < 0.05) return assess("excellent");
  if (v < 0.10) return assess("good");
  if (v < 0.20) return assess("average");
  if (v < 0.35) return assess("weak");
  return assess("poor");
}
function fcfToNiAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 1.2) return assess("excellent");
  if (v > 0.9) return assess("good");
  if (v > 0.6) return assess("average");
  if (v > 0.3) return assess("weak");
  return assess("poor");
}
function institutionalAssess(v: number | null | undefined): Assessment {
  // For expectation: very high institutional = crowded
  if (v == null) return assess("na");
  if (v > 0.85)  return assess("poor");   // very crowded
  if (v > 0.70)  return assess("weak");
  if (v > 0.50)  return assess("average");
  if (v > 0.30)  return assess("good");
  return assess("excellent");
}
function rdAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.12) return assess("excellent");
  if (v > 0.06) return assess("good");
  if (v > 0.02) return assess("average");
  return assess("weak");
}
function capAllocAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v > 0.75) return assess("excellent");
  if (v > 0.55) return assess("good");
  if (v > 0.35) return assess("average");
  if (v > 0.15) return assess("weak");
  return assess("poor");
}
function pbAssess(v: number | null | undefined): Assessment {
  if (v == null) return assess("na");
  if (v < 1)    return assess("excellent");
  if (v < 3)    return assess("good");
  if (v < 6)    return assess("average");
  if (v < 12)   return assess("weak");
  return assess("poor");
}

// Bar width for display (0-100)
function barWidth(v: number | null | undefined, max: number, min = 0): number {
  if (v == null) return 0;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

// ─── Factor Row component ──────────────────────────────────────────────────────

function FactorRow({ name, weight, value, assessment, barPct, note }: {
  name: string;
  weight: number;
  value: string;
  assessment: Assessment;
  barPct: number;
  note?: string;
}) {
  return (
    <tr className="border-b border-border/20 hover:bg-muted/5 transition-colors">
      <td className="py-2 pr-2 text-left align-top">
        <div className="text-[11px] text-foreground font-medium">{name}</div>
        {note && <div className="text-[9px] text-muted-foreground/50 mt-0.5 leading-relaxed">{note}</div>}
      </td>
      <td className="py-2 px-2 text-center align-middle">
        <span className="text-[10px] font-bold text-muted-foreground/60">{weight}%</span>
      </td>
      <td className="py-2 pl-2 align-middle w-48">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted/25 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${assessment.bar}`}
              style={{ width: `${barPct}%` }} />
          </div>
          <span className={`font-mono text-[11px] font-bold whitespace-nowrap w-16 text-right ${assessment.color}`}>
            {value}
          </span>
          <span className={`text-[9px] font-semibold whitespace-nowrap w-14 ${assessment.color}`}>
            {assessment.label}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ─── Component Section ─────────────────────────────────────────────────────────

function ComponentSection({ label, weight, weightSign, score, accentColor, accentBorder, children, narration }: {
  label: string;
  weight: string;
  weightSign: "positive" | "negative";
  score: number | null;
  accentColor: string;
  accentBorder: string;
  children: React.ReactNode;
  narration: string;
}) {
  const [open, setOpen] = React.useState(true);
  const pct = score != null ? Math.round(score * 100) : null;

  return (
    <div className={`rounded-xl border ${accentBorder} overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            weightSign === "positive"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}>{weight}</span>
          <span className="text-sm font-bold text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {pct != null && (
            <span className={`text-xl font-bold font-mono ${accentColor}`}>{pct}<span className="text-xs text-muted-foreground">/100</span></span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/30">
          {/* Narration */}
          <div className={`px-4 py-2.5 bg-muted/5`}>
            <p className={`text-[11px] font-medium leading-relaxed ${accentColor}`}>{narration}</p>
          </div>

          {/* Factor table */}
          <div className="px-4 pb-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left text-[9px] text-muted-foreground/40 uppercase tracking-wider py-1.5 font-semibold">Factor</th>
                  <th className="text-center text-[9px] text-muted-foreground/40 uppercase tracking-wider py-1.5 font-semibold px-2">Wt</th>
                  <th className="text-left text-[9px] text-muted-foreground/40 uppercase tracking-wider py-1.5 font-semibold pl-2">Raw Value  ·  Score  ·  Assessment</th>
                </tr>
              </thead>
              <tbody>
                {children}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Narration functions ───────────────────────────────────────────────────────

function qualityNarr(v: number): string {
  const p = Math.round(v * 100);
  if (p >= 75) return "Exceptional business quality — high ROIC, durable margins, strong capital allocation and genuine pricing power across the cycle. A best-in-class compounder.";
  if (p >= 60) return "Above-average fundamentals — consistent profitability, solid capital returns and a healthy balance sheet. Demonstrates competitive strength.";
  if (p >= 45) return "Average quality business. Some competitive strengths but limited moat depth or meaningful cyclical revenue exposure.";
  if (p >= 30) return "Below-average returns — thin margins, limited pricing power or a capital-intensive model compressing value creation.";
  return "Weak fundamentals — poor capital returns, margin pressure or structural challenges threatening the business model.";
}
function opportunityNarr(v: number): string {
  const p = Math.round(v * 100);
  if (p >= 75) return "Compelling stock setup — meaningful discount to intrinsic value with positive estimate revisions and improving entry timing.";
  if (p >= 60) return "Good opportunity — stock appears undervalued relative to fundamentals with favourable valuation and momentum signals.";
  if (p >= 45) return "Mixed setup — reasonably priced but lacking a clear directional catalyst. Risk/reward is balanced.";
  if (p >= 30) return "Modest opportunity — stock near full value with flat revisions. Limited near-term upside from current FCF yield.";
  return "Poor stock setup — overvalued vs history and peers, or negative revisions creating material downside risk.";
}
function mispricingNarr(v: number): string {
  const p = Math.round(v * 100);
  if (p >= 75) return "High-conviction mispricing — temporary issue is masking durable quality. Clear catalyst visible within 6–24 months.";
  if (p >= 60) return "Market is understating structural strengths — revisions turning positive, margin normalisation ahead, optionality underpriced.";
  if (p >= 45) return "Plausible mispricing — temporary factors may be suppressing true economics. Thesis is building but lacks full confirmation.";
  if (p >= 30) return "Limited mispricing evidence — market appears reasonably informed. No clear near-term re-rating catalyst.";
  return "No detectable edge — the stock appears fairly or optimistically priced relative to visible fundamentals.";
}
function expectationNarr(v: number): string {
  const p = Math.round(v * 100);
  if (p >= 75) return "Perfection priced in — the bar is extremely high. Any disappointment risks a sharp de-rating from a crowded long.";
  if (p >= 60) return "High consensus optimism creates execution risk. The bar to beat is demanding. Even small misses trigger multiple compression.";
  if (p >= 45) return "Balanced expectation bar — consensus is achievable. Neither dangerously optimistic nor excessively pessimistic.";
  if (p >= 30) return "Low bar — meaningful room to positively surprise consensus and drive multiple expansion. Beat-and-raise potential.";
  return "Market assumes failure — even modest positive newsflow or a beat could trigger a significant sentiment-driven re-rating.";
}
function fragilityNarr(v: number): string {
  const p = Math.round(v * 100);
  if (p >= 75) return "Highly fragile thesis — concentrated revenue, elevated leverage or significant regulatory exposure materially threatens the story.";
  if (p >= 60) return "Multiple structural vulnerabilities — one or more risk factors could derail the thesis and require close monitoring.";
  if (p >= 45) return "Manageable risks — thesis holds under most scenarios but execution quality matters. Watch macro sensitivity.";
  if (p >= 30) return "Resilient business — limited vulnerabilities, diversified revenue and strong interest coverage make the thesis durable.";
  return "Fortress-grade resilience — clean balance sheet, diversified revenue and low regulatory or technology disruption exposure.";
}

// ─── Main Component ────────────────────────────────────────────────────────────

import React from "react";

const FLAGS: Record<string, string> = {
  "United States": "🇺🇸", "United Kingdom": "🇬🇧", "India": "🇮🇳",
  "Germany": "🇩🇪", "France": "🇫🇷", "Japan": "🇯🇵", "China": "🇨🇳",
  "Netherlands": "🇳🇱", "Switzerland": "🇨🇭", "Australia": "🇦🇺",
  "Canada": "🇨🇦", "Brazil": "🇧🇷", "Ireland": "🇮🇪", "Taiwan": "🇹🇼",
  "Denmark": "🇩🇰", "Israel": "🇮🇱", "Singapore": "🇸🇬", "Uruguay": "🇺🇾",
};

interface Props {
  snapshot: IntelligenceSnapshot | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function IntelligenceDrawer({ snapshot, open, onOpenChange }: Props) {
  const ticker = snapshot?.ticker;

  const { data, isLoading } = useQuery<IntelligenceDetail>({
    queryKey: ["intelligence-detail", ticker],
    queryFn: () => customFetch(`/api/intelligence/${ticker}`),
    enabled: !!ticker && open,
    staleTime: 10 * 60_000,
  });

  if (!snapshot) return null;

  // Use fetched data if available, fall back to passed snapshot
  const snap = data?.snapshot ?? snapshot as any;
  const m: RawMetrics = data?.metrics ?? {};

  const Q  = snap.company_quality_score   != null ? Math.round(snap.company_quality_score   * 100) : null;
  const O  = snap.stock_opportunity_score != null ? Math.round(snap.stock_opportunity_score * 100) : null;
  const M  = snap.mispricing_score        != null ? Math.round(snap.mispricing_score        * 100) : null;
  const E  = snap.expectation_score       != null ? Math.round(snap.expectation_score       * 100) : null;
  const F  = snap.fragility_score         != null ? Math.round(snap.fragility_score         * 100) : null;
  const N  = snap.portfolio_net_score     != null ? Math.round(snap.portfolio_net_score     * 100) : null;

  const rawWeighted = Q != null && O != null && M != null && E != null && F != null
    ? (2 * Q + 1 * O + 2 * M - 1 * E - 1 * F) : null;

  const name    = snap.name    ?? snapshot.name;
  const sector  = snap.sector  ?? snapshot.sector;
  const country = snap.country ?? snapshot.country;
  const mktCap  = snap.effective_market_cap ?? snap.market_cap ?? snapshot.marketCap;

  function bandConfig() {
    if (N == null) return null;
    if (N >= 75) return { label: "CORE",      action: "Strong Buy", ac: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", minPct: 6,   maxPct: 10  };
    if (N >= 60) return { label: "STANDARD",  action: "Buy",        ac: "text-blue-400",    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",           minPct: 3,   maxPct: 5   };
    if (N >= 45) return { label: "STARTER",   action: "Add",        ac: "text-amber-400",   badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",        minPct: 1,   maxPct: 2.5 };
    if (N >= 30) return { label: "TACTICAL",  action: "Watch",      ac: "text-orange-400",  badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",     minPct: 0.5, maxPct: 1   };
    return              { label: "WATCHLIST", action: "Avoid",      ac: "text-red-400",     badge: "bg-secondary text-muted-foreground border-border/50",        minPct: 0,   maxPct: 0   };
  }
  const band = bandConfig();
  const netColor = N == null ? "text-muted-foreground" : N >= 75 ? "text-emerald-400" : N >= 60 ? "text-blue-400" : N >= 45 ? "text-amber-400" : N >= 30 ? "text-orange-400" : "text-red-400";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Investment Intelligence — {ticker}</SheetTitle>
        </SheetHeader>

        {/* ── Header ───────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[9px] font-mono text-violet-400 uppercase tracking-wider">Investment Intelligence Thesis</span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl">{FLAGS[country ?? ""] ?? "🌐"}</span>
                <span className="text-2xl font-bold font-mono">{ticker}</span>
                {band && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${band.badge}`}>{band.label}</span>}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{name}</div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {sector  && <span className="text-[10px] text-muted-foreground/60 bg-secondary/50 px-1.5 py-0.5 rounded border border-border/30">{sector}</span>}
                {country && <span className="text-[10px] text-muted-foreground/50">{country}</span>}
                {mktCap  && <span className="text-[10px] text-muted-foreground/50">{fmt.mktCap(mktCap)}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              {N != null ? (
                <>
                  <div className={`text-5xl font-bold font-mono leading-none ${netColor}`}>{N}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Net Score / 100</div>
                  {band && <div className={`text-sm font-bold mt-1 ${band.ac}`}>{band.action}</div>}
                </>
              ) : isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-2" />
              ) : <span className="text-muted-foreground/30">—</span>}
            </div>
          </div>
        </div>

        {isLoading && !data && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading detailed factor data…</p>
          </div>
        )}

        <div className="px-5 py-5 space-y-4">

          {/* ── Formula Derivation ────────────────────── */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-950/8 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-mono text-violet-400 uppercase tracking-wider font-semibold">Score Derivation</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground mb-3">
              Net = (<span className="text-emerald-400">2×Quality</span> + <span className="text-blue-400">1×Opportunity</span> + <span className="text-amber-400">2×Mispricing</span> − <span className="text-orange-400">1×Expectation</span> − <span className="text-red-400">1×Fragility</span> + 200) ÷ 700 × 100
            </div>

            {rawWeighted != null ? (
              <div className="space-y-1.5 font-mono text-xs">
                {[
                  { label: `2 × ${Q}  (Quality)`,     val: `+${2*(Q??0)}`, color: "text-emerald-400", note: "double weight — business foundation" },
                  { label: `1 × ${O}  (Opportunity)`, val: `+${O}`,       color: "text-blue-400",    note: "single weight — stock setup" },
                  { label: `2 × ${M}  (Mispricing)`,  val: `+${2*(M??0)}`, color: "text-amber-400",  note: "double weight — market edge" },
                  { label: `1 × ${E}  (Expectation)`, val: `−${E}`,       color: "text-orange-400",  note: "penalised — priced-in optimism" },
                  { label: `1 × ${F}  (Fragility)`,   val: `−${F}`,       color: "text-red-400",     note: "penalised — thesis risk" },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3 flex-wrap">
                    <span className={`w-36 ${r.color}`}>{r.label}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className={`font-bold w-10 ${r.color}`}>{r.val}</span>
                    <span className="text-[10px] text-muted-foreground/50">{r.note}</span>
                  </div>
                ))}
                <div className="border-t border-border/40 mt-2 pt-2 space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-36">Raw weighted sum</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-foreground font-bold">{rawWeighted}</span>
                    <span className="text-[10px] text-muted-foreground/40">(scale: −200 to +500)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-36">Normalised</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-[10px] text-muted-foreground/50">({rawWeighted} + 200) ÷ 700 × 100</span>
                    <span className="text-muted-foreground">=</span>
                    <span className={`font-bold text-lg ${netColor}`}>{N ?? "—"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Score data not yet available for this company.</p>
            )}
          </div>

          {/* ══ COMPONENT 1: COMPANY QUALITY ══ */}
          <ComponentSection
            label="Company Quality" weight="+2× weight" weightSign="positive"
            score={snap.company_quality_score}
            accentColor="text-emerald-400" accentBorder="border-emerald-500/20"
            narration={Q != null ? qualityNarr(Q / 100) : "Score not available."}
          >
            <FactorRow name="Returns on Capital" weight={15}
              value={fmt.pctAbs(m.roic)}
              assessment={roicAssess(m.roic)}
              barPct={barWidth(m.roic, 0.40)}
              note="ROIC — return on invested capital. Target >15% to indicate genuine economic moat." />
            <FactorRow name="Gross Margin Stability" weight={10}
              value={m.gross_margin_trend != null ? fmt.pct(m.gross_margin_trend) + "/yr trend" : fmt.pctAbs(m.gross_margin)}
              assessment={m.gross_margin_trend != null ? trendAssess(m.gross_margin_trend) : marginAssess(m.gross_margin, [0.60, 0.40, 0.25, 0.10])}
              barPct={m.gross_margin_trend != null ? barWidth(m.gross_margin_trend + 0.10, 0.20) : barWidth(m.gross_margin, 0.80)}
              note="Stable or improving gross margin = durable pricing power and supply-chain leverage." />
            <FactorRow name="Operating Margin" weight={10}
              value={fmt.pctAbs(m.operating_margin)}
              assessment={marginAssess(m.operating_margin, [0.30, 0.18, 0.08, 0.02])}
              barPct={barWidth(m.operating_margin, 0.45)}
              note="Operating margin reflects scalability and cost structure durability." />
            <FactorRow name="FCF Margin" weight={10}
              value={fmt.pctAbs(m.fcf_margin)}
              assessment={marginAssess(m.fcf_margin, [0.25, 0.15, 0.07, 0.01])}
              barPct={barWidth(m.fcf_margin, 0.40)}
              note="FCF margin = cash actually generated per revenue dollar. Better than GAAP earnings." />
            <FactorRow name="Balance Sheet Strength" weight={10}
              value={m.altman_z_score != null ? `Altman Z: ${fmt.num(m.altman_z_score)}` : m.current_ratio != null ? `Current ratio: ${fmt.num(m.current_ratio)}` : "—"}
              assessment={m.altman_z_score != null ? altmanAssess(m.altman_z_score) : currentRatioAssess(m.current_ratio)}
              barPct={m.altman_z_score != null ? barWidth(m.altman_z_score, 6, 0) : barWidth(m.current_ratio, 4)}
              note="Altman Z >3 = safe zone. Current ratio >1.5 = adequate liquidity runway." />
            <FactorRow name="Revenue Growth (3Y)" weight={10}
              value={fmt.pct(m.revenue_growth_3y) + " /yr"}
              assessment={growthAssess(m.revenue_growth_3y)}
              barPct={barWidth((m.revenue_growth_3y ?? 0) + 0.05, 0.35)}
              note="3-year compounded revenue growth — structural demand trajectory." />
            <FactorRow name="EPS Growth (3Y)" weight={10}
              value={fmt.pct(m.eps_growth_3y) + " /yr"}
              assessment={growthAssess(m.eps_growth_3y)}
              barPct={barWidth((m.eps_growth_3y ?? 0) + 0.05, 0.40)}
              note="Earnings growth translating revenue to shareholder value. Ideally ahead of revenue growth." />
            <FactorRow name="Customer Stickiness" weight={10}
              value={m.fcf_stability != null ? `FCF stability: ${fmt.num(m.fcf_stability)}` : m.operating_cf_to_revenue != null ? fmt.pctAbs(m.operating_cf_to_revenue) : "—"}
              assessment={m.fcf_stability != null ? marginAssess(m.fcf_stability, [0.8, 0.6, 0.4, 0.2]) : marginAssess(m.operating_cf_to_revenue, [0.25, 0.15, 0.07, 0.02])}
              barPct={barWidth(m.fcf_stability ?? m.operating_cf_to_revenue, 1)}
              note="Proxy: FCF stability / operating cash conversion — reflects recurring revenue and pricing power." />
            <FactorRow name="Capital Allocation" weight={7.5}
              value={m.capital_allocation_discipline != null ? `Score: ${fmt.num(m.capital_allocation_discipline)}` : m.roic_5yr_avg != null ? `ROIC 5Y avg: ${fmt.pctAbs(m.roic_5yr_avg)}` : "—"}
              assessment={m.capital_allocation_discipline != null ? capAllocAssess(m.capital_allocation_discipline) : roicAssess(m.roic_5yr_avg)}
              barPct={barWidth(m.capital_allocation_discipline ?? (m.roic_5yr_avg ? m.roic_5yr_avg / 0.30 : null), 1)}
              note="Capital allocation discipline: ROIC on reinvested capital, buyback vs dilution, M&A track record." />
            <FactorRow name="Pricing Power" weight={7.5}
              value={fmt.pctAbs(m.gross_margin)}
              assessment={marginAssess(m.gross_margin, [0.65, 0.45, 0.28, 0.12])}
              barPct={barWidth(m.gross_margin, 0.85)}
              note="Gross margin level is the best objective proxy for real pricing power vs suppliers and customers." />
          </ComponentSection>

          {/* ══ COMPONENT 2: STOCK OPPORTUNITY ══ */}
          <ComponentSection
            label="Stock Opportunity" weight="+1× weight" weightSign="positive"
            score={snap.stock_opportunity_score}
            accentColor="text-blue-400" accentBorder="border-blue-500/20"
            narration={O != null ? opportunityNarr(O / 100) : "Score not available."}
          >
            <FactorRow name="Valuation vs History" weight={20}
              value={m.forward_pe != null && m.pe_ratio != null
                ? `Fwd PE ${fmt.num(m.forward_pe)}× vs PE ${fmt.num(m.pe_ratio)}×`
                : m.forward_pe != null ? `Fwd PE: ${fmt.num(m.forward_pe)}×`
                : m.pe_ratio   != null ? `PE: ${fmt.num(m.pe_ratio)}×` : "—"}
              assessment={peAssess(m.forward_pe ?? m.pe_ratio)}
              barPct={m.forward_pe != null ? Math.max(0, 100 - barWidth(m.forward_pe, 60, 5)) : 50}
              note="Forward PE vs trailing PE gap signals whether earnings expectations are rising or falling." />
            <FactorRow name="Valuation vs Peers" weight={15}
              value={m.ev_to_ebitda != null ? `EV/EBITDA: ${fmt.num(m.ev_to_ebitda)}×` : m.price_to_book != null ? `P/B: ${fmt.num(m.price_to_book)}×` : "—"}
              assessment={m.ev_to_ebitda != null ? (m.ev_to_ebitda < 12 ? assess("excellent") : m.ev_to_ebitda < 18 ? assess("good") : m.ev_to_ebitda < 25 ? assess("average") : m.ev_to_ebitda < 35 ? assess("weak") : assess("poor")) : pbAssess(m.price_to_book)}
              barPct={m.ev_to_ebitda != null ? Math.max(0, 100 - barWidth(m.ev_to_ebitda, 50, 5)) : barWidth(m.price_to_book ? 20 / m.price_to_book : null, 1)}
              note="EV/EBITDA is the best cross-sector valuation comparator. Below sector median = opportunity." />
            <FactorRow name="FCF Yield" weight={15}
              value={fmt.pctAbs(m.fcf_yield)}
              assessment={fcfYieldAssess(m.fcf_yield)}
              barPct={barWidth(m.fcf_yield, 0.12)}
              note="FCF yield >5% = value territory. >3% = reasonable. Price-to-FCF = 1 / FCF yield." />
            <FactorRow name="Earnings Revision Trend" weight={10}
              value={m.earnings_surprises != null ? fmt.pct(m.earnings_surprises) + " avg surprise" : "—"}
              assessment={earningsSurprisesAssess(m.earnings_surprises)}
              barPct={barWidth((m.earnings_surprises ?? 0) + 0.10, 0.25)}
              note="Consistent positive earnings surprises signal upward revision momentum — the most powerful re-rating catalyst." />
            <FactorRow name="Re-rating Risk" weight={10}
              value={m.ret3m != null ? fmt.pct(m.ret3m) + " 3M return" : "—"}
              assessment={ret3mAssess(m.ret3m)}
              barPct={barWidth((m.ret3m ?? 0) + 0.30, 0.60)}
              note="Recent large price appreciation means multiple expansion already occurred — less re-rating left." />
            <FactorRow name="Technical Damage" weight={5}
              value={snap.rsi != null ? `RSI: ${fmt.num(snap.rsi, 0)}` : "—"}
              assessment={rsiAssess(snap.rsi)}
              barPct={snap.rsi != null ? Math.max(0, 100 - barWidth(snap.rsi, 100)) : 0}
              note="Low RSI = technically oversold = better entry. RSI <35 signals maximum technical damage (opportunity)." />
            <FactorRow name="Moat Duration" weight={10}
              value={m.rd_to_revenue != null ? `R&D: ${fmt.pctAbs(m.rd_to_revenue)}` : m.gross_margin != null ? `Gross margin: ${fmt.pctAbs(m.gross_margin)}` : "—"}
              assessment={m.rd_to_revenue != null ? rdAssess(m.rd_to_revenue) : marginAssess(m.gross_margin, [0.65, 0.45, 0.28, 0.12])}
              barPct={barWidth(m.rd_to_revenue ?? m.gross_margin, 0.20)}
              note="Proxy: R&D intensity and gross margin level. High R&D + high margins = long moat runway." />
            <FactorRow name="Duration Underappreciated" weight={15}
              value={snap.margin_of_safety != null ? fmt.pctAbs(snap.margin_of_safety) + " margin of safety" : "—"}
              assessment={marginSafetyAssess(snap.margin_of_safety)}
              barPct={barWidth(snap.margin_of_safety, 0.60)}
              note="Margin of safety vs estimated intrinsic value. >20% = meaningful discount. <10% = fully priced." />
          </ComponentSection>

          {/* ══ COMPONENT 3: MISPRICING ══ */}
          <ComponentSection
            label="Mispricing" weight="+2× weight" weightSign="positive"
            score={snap.mispricing_score}
            accentColor="text-amber-400" accentBorder="border-amber-500/20"
            narration={M != null ? mispricingNarr(M / 100) : "Score not available."}
          >
            <FactorRow name="Temporary Issue Present?" weight={15}
              value={m.operating_margin_trend != null ? fmt.pct(m.operating_margin_trend) + " op margin trend" : "—"}
              assessment={m.operating_margin_trend != null ? (m.operating_margin_trend < -0.03 ? assess("excellent") : m.operating_margin_trend < 0 ? assess("good") : m.operating_margin_trend < 0.02 ? assess("average") : assess("weak")) : assess("na")}
              barPct={m.operating_margin_trend != null ? barWidth(-m.operating_margin_trend + 0.10, 0.20) : 0}
              note="Negative operating margin trend suggests temporary suppression — a signal that underlying quality may be understated right now." />
            <FactorRow name="No Structural Impairment" weight={15}
              value={m.altman_z_score != null ? `Altman Z: ${fmt.num(m.altman_z_score)}` : m.interest_coverage != null ? `Interest cov: ${fmt.num(m.interest_coverage)}×` : "—"}
              assessment={m.altman_z_score != null ? altmanAssess(m.altman_z_score) : interestCoverageAssess(m.interest_coverage)}
              barPct={m.altman_z_score != null ? barWidth(m.altman_z_score, 6) : barWidth(m.interest_coverage, 20)}
              note="Absence of structural impairment is required for a valid mispricing thesis. If balance sheet is broken, it may be fundamentally impaired." />
            <FactorRow name="EPS Revisions Turning" weight={10}
              value={m.earnings_surprises != null ? fmt.pct(m.earnings_surprises) + " avg beat" : "—"}
              assessment={earningsSurprisesAssess(m.earnings_surprises)}
              barPct={barWidth((m.earnings_surprises ?? 0) + 0.10, 0.25)}
              note="Consistent positive surprises = EPS revisions inflecting upward. This is the most direct evidence of a mispricing thesis playing out." />
            <FactorRow name="Margin Normalisation" weight={15}
              value={[m.gross_margin_trend != null ? `GM trend: ${fmt.pct(m.gross_margin_trend)}/yr` : null, m.operating_margin_trend != null ? `OP trend: ${fmt.pct(m.operating_margin_trend)}/yr` : null].filter(Boolean).join(" · ") || "—"}
              assessment={m.gross_margin_trend != null ? trendAssess(m.gross_margin_trend) : trendAssess(m.operating_margin_trend)}
              barPct={barWidth((m.gross_margin_trend ?? m.operating_margin_trend ?? 0) + 0.05, 0.15)}
              note="Improving margin trends = normalisation is underway. This is the core driver of earnings estimate upgrades." />
            <FactorRow name="Optionality Underappreciated" weight={15}
              value={[m.rd_to_revenue != null ? `R&D: ${fmt.pctAbs(m.rd_to_revenue)}` : null, m.deferred_revenue_growth != null ? `Def rev growth: ${fmt.pct(m.deferred_revenue_growth)}` : null].filter(Boolean).join(" · ") || "—"}
              assessment={m.rd_to_revenue != null ? rdAssess(m.rd_to_revenue) : assess("na")}
              barPct={barWidth(m.rd_to_revenue, 0.20)}
              note="High R&D investment + deferred revenue growth = unrecognised value creation. Market often ignores long-duration optionality." />
            <FactorRow name="Accounting Distortion?" weight={10}
              value={[m.accrual_ratio != null ? `Accrual ratio: ${fmt.num(m.accrual_ratio, 2)}` : null, m.fcf_to_net_income != null ? `FCF/NI: ${fmt.num(m.fcf_to_net_income, 2)}×` : null].filter(Boolean).join(" · ") || "—"}
              assessment={m.accrual_ratio != null ? accrualAssess(m.accrual_ratio) : fcfToNiAssess(m.fcf_to_net_income)}
              barPct={m.accrual_ratio != null ? barWidth(-m.accrual_ratio + 0.15, 0.25) : barWidth(m.fcf_to_net_income, 1.5)}
              note="Low accrual ratio + high FCF/Net Income = earnings are real. Accounting distortion can cause mispricing when cash quality is high but GAAP looks weak." />
            <FactorRow name="Mgmt Capital Allocation" weight={10}
              value={[m.insider_buying != null ? `Insider buying: ${fmt.num(m.insider_buying, 2)}` : null, m.capital_allocation_discipline != null ? `Alloc score: ${fmt.num(m.capital_allocation_discipline, 2)}` : null].filter(Boolean).join(" · ") || "—"}
              assessment={m.insider_buying != null ? insiderBuyingAssess(m.insider_buying) : capAllocAssess(m.capital_allocation_discipline)}
              barPct={barWidth(m.insider_buying ?? m.capital_allocation_discipline, 1)}
              note="Management buying their own stock + high capital discipline = alignment. Reduces risk of value-destroying M&A or dilution." />
            <FactorRow name="Clear Catalyst (6–24M)" weight={10}
              value={[m.earnings_surprises != null ? fmt.pct(m.earnings_surprises) + " beat" : null, snap.margin_of_safety != null ? `${fmt.pctAbs(snap.margin_of_safety)} MoS` : null].filter(Boolean).join(" · ") || "—"}
              assessment={m.earnings_surprises != null ? earningsSurprisesAssess(m.earnings_surprises) : assess("na")}
              barPct={barWidth((m.earnings_surprises ?? 0) + 0.10, 0.20)}
              note="Proxy: consistent earnings beats combined with margin of safety. A clear upcoming catalyst makes the mispricing time-bounded rather than indefinite." />
          </ComponentSection>

          {/* ══ COMPONENT 4: EXPECTATION ══ */}
          <ComponentSection
            label="Expectation" weight="−1× penalised" weightSign="negative"
            score={snap.expectation_score}
            accentColor="text-orange-400" accentBorder="border-orange-500/20"
            narration={E != null ? expectationNarr(E / 100) : "Score not available."}
          >
            <FactorRow name="PE vs History" weight={20}
              value={m.forward_pe != null ? `Fwd PE: ${fmt.num(m.forward_pe)}×` : m.pe_ratio != null ? `PE: ${fmt.num(m.pe_ratio)}×` : "—"}
              assessment={peAssessExp(m.forward_pe ?? m.pe_ratio)}
              barPct={barWidth(m.forward_pe ?? m.pe_ratio, 60, 5)}
              note="Forward PE above 30× typically implies perfection. The higher vs its own history, the more expectation is baked in." />
            <FactorRow name="EV/EBIT vs History" weight={15}
              value={m.ev_to_ebitda != null ? `EV/EBITDA: ${fmt.num(m.ev_to_ebitda)}×` : "—"}
              assessment={m.ev_to_ebitda != null ? (m.ev_to_ebitda > 35 ? assess("poor") : m.ev_to_ebitda > 25 ? assess("weak") : m.ev_to_ebitda > 18 ? assess("average") : m.ev_to_ebitda > 12 ? assess("good") : assess("excellent")) : assess("na")}
              barPct={barWidth(m.ev_to_ebitda, 50, 5)}
              note="EV/EBITDA >25× implies high long-duration growth expectations. Any rate shock or growth miss is amplified at high multiples." />
            <FactorRow name="PE vs Peers" weight={10}
              value={m.pe_ratio != null ? `PE: ${fmt.num(m.pe_ratio)}×` : "—"}
              assessment={peAssessExp(m.pe_ratio)}
              barPct={barWidth(m.pe_ratio, 60, 5)}
              note="PE relative to sector peers. A premium multiple requires premium execution — there is no margin for error." />
            <FactorRow name="PEG vs Peers" weight={10}
              value={m.peg_ratio != null ? `PEG: ${fmt.num(m.peg_ratio)}×` : "—"}
              assessment={m.peg_ratio != null ? (m.peg_ratio < 1 ? assess("excellent") : m.peg_ratio < 1.5 ? assess("good") : m.peg_ratio < 2.5 ? assess("average") : m.peg_ratio < 4 ? assess("weak") : assess("poor")) : assess("na")}
              barPct={barWidth(m.peg_ratio, 5)}
              note="PEG >2.5 = expensive growth. PEG <1 = growth at a reasonable price. Relative to peers shows whether premium is justified." />
            <FactorRow name="Reverse DCF: Implied Revenue CAGR" weight={15}
              value={m.revenue_multiple_vs_growth != null ? `Rev/Growth ratio: ${fmt.num(m.revenue_multiple_vs_growth)}×` : m.revenue_growth_3y != null && m.ev_to_sales != null ? `EV/Sales: ${fmt.num(m.ev_to_sales)}× on ${fmt.pct(m.revenue_growth_3y)}/yr` : "—"}
              assessment={m.revenue_multiple_vs_growth != null ? (m.revenue_multiple_vs_growth > 10 ? assess("poor") : m.revenue_multiple_vs_growth > 6 ? assess("weak") : m.revenue_multiple_vs_growth > 3 ? assess("average") : assess("good")) : assess("na")}
              barPct={barWidth(m.revenue_multiple_vs_growth, 15)}
              note="What revenue growth rate must the company sustain to justify its current multiple? Higher required CAGR = higher expectation baked in." />
            <FactorRow name="Reverse DCF: Implied Margin" weight={10}
              value={fmt.pctAbs(m.operating_margin)}
              assessment={m.operating_margin != null ? (m.operating_margin > 0.30 ? assess("poor") : m.operating_margin > 0.20 ? assess("weak") : m.operating_margin > 0.12 ? assess("average") : assess("good")) : assess("na")}
              barPct={barWidth(m.operating_margin, 0.50)}
              note="Current operating margin as proxy for the margin the market is implying in its valuation. High current margin = high margin already priced in." />
            <FactorRow name="Multiple Expansion Already Happened" weight={10}
              value={snap.ret3m != null ? fmt.pct(snap.ret3m) + " 3M return" : "—"}
              assessment={ret3mAssess(snap.ret3m, true)}
              barPct={barWidth((snap.ret3m ?? 0) + 0.30, 0.70)}
              note="Large recent price gain that outpaced earnings = multiple expansion already happened. Less upside left from further re-rating." />
            <FactorRow name="Ownership / Crowding" weight={10}
              value={m.institutional_ownership != null ? fmt.pctAbs(m.institutional_ownership) + " inst. owned" : "—"}
              assessment={institutionalAssess(m.institutional_ownership)}
              barPct={barWidth(m.institutional_ownership, 1)}
              note=">80% institutional ownership = crowded long. Crowded positions have more forced sellers and less incremental buyers to drive further appreciation." />
          </ComponentSection>

          {/* ══ COMPONENT 5: FRAGILITY ══ */}
          <ComponentSection
            label="Fragility" weight="−1× penalised" weightSign="negative"
            score={snap.fragility_score}
            accentColor="text-red-400" accentBorder="border-red-500/20"
            narration={F != null ? fragilityNarr(F / 100) : "Score not available."}
          >
            <FactorRow name="Revenue Concentration" weight={15}
              value="Qualitative assessment"
              assessment={assess("na")}
              barPct={0}
              note="High customer / product / geography concentration = single-point-of-failure risk. Assessed qualitatively — no single financial ratio captures this." />
            <FactorRow name="Margin Volatility" weight={15}
              value={[m.cash_flow_volatility != null ? `CF vol: ${fmt.num(m.cash_flow_volatility, 2)}` : null, m.operating_margin_trend != null ? `OP trend: ${fmt.pct(m.operating_margin_trend)}` : null].filter(Boolean).join(" · ") || "—"}
              assessment={m.cash_flow_volatility != null ? cashVolAssess(m.cash_flow_volatility) : assess("na")}
              barPct={barWidth(m.cash_flow_volatility, 0.5)}
              note="High cash flow volatility = cyclical or commodity-exposed business. Increases earnings uncertainty and makes valuation harder to anchor." />
            <FactorRow name="Net Debt / EBITDA" weight={15}
              value={m.net_debt_ebitda != null ? `${fmt.num(m.net_debt_ebitda)}×` : m.cash_to_debt != null ? `Cash/Debt: ${fmt.num(m.cash_to_debt)}×` : m.debt_to_equity != null ? `D/E: ${fmt.num(m.debt_to_equity)}×` : "—"}
              assessment={netDebtEbitdaAssess(m.net_debt_ebitda)}
              barPct={m.net_debt_ebitda != null ? Math.max(0, 100 - barWidth(Math.max(0, m.net_debt_ebitda), 6)) : 50}
              note="Net Debt/EBITDA: <1× = safe, 1–2× = manageable, >3× = fragile. Net cash position (negative) = fortress-grade resilience." />
            <FactorRow name="Interest Coverage" weight={10}
              value={m.interest_coverage != null ? `${fmt.num(m.interest_coverage)}× coverage` : m.current_ratio != null ? `Current ratio: ${fmt.num(m.current_ratio)}×` : "—"}
              assessment={interestCoverageAssess(m.interest_coverage)}
              barPct={barWidth(m.interest_coverage, 20)}
              note="EBIT / interest expense. Below 2× = dangerous. Below 1× = cannot service debt from operations. Target >5× for robust thesis." />
            <FactorRow name="Estimate Dispersion" weight={10}
              value={m.earnings_surprises != null ? `Avg surprise: ${fmt.pct(m.earnings_surprises)}` : "—"}
              assessment={m.earnings_surprises != null ? (Math.abs(m.earnings_surprises) > 0.10 ? assess("poor") : Math.abs(m.earnings_surprises) > 0.05 ? assess("weak") : Math.abs(m.earnings_surprises) > 0.02 ? assess("average") : assess("good")) : assess("na")}
              barPct={m.earnings_surprises != null ? Math.max(0, 100 - barWidth(Math.abs(m.earnings_surprises), 0.20)) : 0}
              note="High earnings surprise magnitude (positive or negative) = wide analyst dispersion. Uncertainty makes position sizing harder and pricing more fragile." />
            <FactorRow name="Guidance Reliability" weight={10}
              value={m.accrual_ratio != null ? `Accrual ratio: ${fmt.num(m.accrual_ratio, 2)}` : m.fcf_to_net_income != null ? `FCF/NI: ${fmt.num(m.fcf_to_net_income, 2)}×` : "—"}
              assessment={m.accrual_ratio != null ? (m.accrual_ratio < 0.03 ? assess("excellent") : m.accrual_ratio < 0.08 ? assess("good") : m.accrual_ratio < 0.15 ? assess("average") : assess("weak")) : assess("na")}
              barPct={m.accrual_ratio != null ? Math.max(0, 100 - barWidth(m.accrual_ratio, 0.25)) : 0}
              note="Proxy via accrual ratio: low accruals = guidance based on real cash, not accounting judgements. High accruals = earnings are fragile." />
            <FactorRow name="Regulatory / Event Risk" weight={10}
              value="Sector-dependent"
              assessment={assess("na")}
              barPct={0}
              note="Regulatory, reimbursement and litigation risk. Particularly important for healthcare, financials, energy and tech. Assessed qualitatively." />
            <FactorRow name="Technology Disruption Risk" weight={10}
              value={m.rd_to_revenue != null ? `R&D: ${fmt.pctAbs(m.rd_to_revenue)} of revenue` : "—"}
              assessment={m.rd_to_revenue != null ? (m.rd_to_revenue > 0.10 ? assess("excellent") : m.rd_to_revenue > 0.05 ? assess("good") : m.rd_to_revenue > 0.02 ? assess("average") : assess("weak")) : assess("na")}
              barPct={barWidth(m.rd_to_revenue, 0.20)}
              note="High R&D spend is a partial offset to disruption risk — companies investing in their own obsolescence are less likely to be caught off-guard." />
            <FactorRow name="Beta / Drawdown Risk" weight={5}
              value={[snap.rsi != null ? `RSI: ${fmt.num(snap.rsi, 0)}` : null, m.cash_flow_volatility != null ? `CF vol: ${fmt.num(m.cash_flow_volatility, 2)}` : null].filter(Boolean).join(" · ") || "—"}
              assessment={snap.rsi != null ? rsiAssess(snap.rsi, true) : cashVolAssess(m.cash_flow_volatility)}
              barPct={snap.rsi != null ? barWidth(snap.rsi, 100) : barWidth(m.cash_flow_volatility, 0.5)}
              note="High RSI + high cash flow volatility = elevated beta. High-beta names amplify both gains and drawdowns, making sizing more difficult." />
          </ComponentSection>

          {/* ══ FINAL RECOMMENDATION ══ */}
          {band && (
            <div className={`rounded-xl border p-5 ${
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
                  <div className={`text-3xl font-bold mb-1 ${band.ac}`}>{band.action}</div>
                  <div className="text-xs text-muted-foreground">Position band: <strong className="text-foreground">{band.label}</strong></div>
                  {band.minPct > 0
                    ? <div className="text-xs text-muted-foreground mt-0.5">Recommended size: <strong className={`font-mono ${band.ac}`}>{band.minPct}–{band.maxPct}% of portfolio</strong></div>
                    : <div className="text-xs text-muted-foreground mt-0.5">Do not initiate position — monitor only</div>
                  }
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold font-mono ${netColor}`}>{N}</div>
                  <div className="text-[10px] text-muted-foreground">Net Score / 100</div>
                </div>
              </div>

              {/* Risk flags */}
              {F != null && F >= 60 && (
                <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-400 leading-relaxed">
                    <strong>High Fragility ({F}/100):</strong> Consider sizing below the band minimum until structural risks (leverage, concentration, regulatory) are resolved. A high-quality business can still be a fragile investment if execution must be flawless.
                  </p>
                </div>
              )}
              {E != null && E >= 70 && (
                <div className="mt-3 flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-orange-400 leading-relaxed">
                    <strong>Elevated Expectations ({E}/100):</strong> The market is pricing in continued excellence. Any miss on margins, growth or guidance could trigger a sharp de-rating even if the business is fundamentally intact.
                  </p>
                </div>
              )}
              {N != null && N >= 70 && F != null && F < 45 && E != null && E < 50 && (
                <div className="mt-3 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-emerald-400 leading-relaxed">
                    <strong>High-Conviction Setup:</strong> Quality, opportunity and mispricing align, with low expectations and limited fragility. This is the profile of a core holding where the risk/reward strongly favours ownership.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
