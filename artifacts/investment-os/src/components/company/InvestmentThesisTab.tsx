import { Crown, ShieldCheck, Rocket, TrendingUp, Eye, Target, ShieldAlert, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

function fmt(v: number | null | undefined, decimals = 1, suffix = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtX(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}×`;
}

function scoreBarColor(v: number): string {
  if (v >= 70) return "bg-emerald-500";
  if (v >= 55) return "bg-blue-500";
  if (v >= 40) return "bg-amber-500";
  if (v >= 25) return "bg-orange-500";
  return "bg-red-500";
}

function scoreBarColorInverted(v: number): string {
  if (v <= 30) return "bg-emerald-500";
  if (v <= 45) return "bg-blue-500";
  if (v <= 60) return "bg-amber-500";
  if (v <= 75) return "bg-orange-500";
  return "bg-red-500";
}

function ratingColor(label: string): string {
  const map: Record<string, string> = {
    "Exceptional": "text-emerald-400", "Strong": "text-emerald-400",
    "Excellent Entry": "text-emerald-400", "Good Entry": "text-blue-400",
    "Very Robust": "text-emerald-400", "Robust": "text-blue-400",
    "Strong Edge": "text-emerald-400", "Reasonable Edge": "text-blue-400",
    "Depressed": "text-emerald-400", "Modest": "text-blue-400",
    "Moderate": "text-amber-400",
    "Fair Entry": "text-amber-400", "Plausible": "text-amber-400",
    "Below Average": "text-orange-400", "Weak Entry": "text-orange-400",
    "Weak": "text-orange-400", "Elevated": "text-orange-400",
    "Poor Entry": "text-red-400", "No Edge": "text-red-400",
    "Fragile": "text-orange-400", "Very Fragile": "text-red-400",
    "Euphoric": "text-red-400",
  };
  return map[label] ?? "text-muted-foreground";
}

interface LayerDef {
  number: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  inverted?: boolean;
  getLabel: (v: number | null | undefined) => string;
  scoreKey: string;
  metrics: { label: string; value: string | null; barPct?: number | null }[];
  narrative: string;
}

function MetricBar({ label, value, barPct }: { label: string; value: string | null; barPct?: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        {barPct != null && (
          <div
            className={`h-full rounded-full ${barPct >= 70 ? "bg-emerald-500/70" : barPct >= 40 ? "bg-blue-500/70" : "bg-amber-500/70"}`}
            style={{ width: `${Math.min(100, Math.max(2, barPct))}%` }}
          />
        )}
      </div>
      <span className="text-xs font-mono text-foreground w-16 text-right shrink-0">{value ?? "—"}</span>
    </div>
  );
}

function LayerSection({ layer, defaultOpen = true }: { layer: LayerDef; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = layer.icon;
  const scorePct = layer.metrics.length > 0 ? null : null;
  const rawScore = (layer as any)._rawScore as number | null | undefined;
  const pct = rawScore != null ? Math.round(rawScore * 100) : null;
  const label = layer.getLabel(rawScore);
  const labelColor = ratingColor(label);
  const barColor = layer.inverted ? (pct != null ? scoreBarColorInverted(pct) : "bg-muted/40") : (pct != null ? scoreBarColor(pct) : "bg-muted/40");

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
          <span className="text-[10px] font-bold text-primary">L{layer.number}</span>
        </div>
        <Icon className="w-4 h-4 text-muted-foreground/60 shrink-0" />
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-foreground">{layer.title}</div>
          <div className="text-[10px] text-muted-foreground/70">{layer.subtitle}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold ${labelColor}`}>{label}</span>
          {pct != null && (
            <span className="text-sm font-mono font-bold text-foreground">{pct}</span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30">
          {pct != null && (
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-muted-foreground/60">Score</span>
                <span className={`text-[10px] font-bold ${labelColor}`}>{pct}/100</span>
              </div>
              <div className="h-2.5 bg-muted/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {layer.metrics.map(m => (
              <MetricBar key={m.label} label={m.label} value={m.value} barPct={m.barPct} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border/20 pt-2.5">
            {layer.narrative}
          </p>
        </div>
      )}
    </div>
  );
}

function qualityRating(v: number | null | undefined): string {
  if (v == null) return "Unknown";
  const p = v * 100;
  if (p >= 70) return "Exceptional";
  if (p >= 55) return "Strong";
  if (p >= 40) return "Moderate";
  if (p >= 25) return "Below Average";
  return "Weak";
}

function opportunityRating(v: number | null | undefined): string {
  if (v == null) return "Unknown";
  const p = v * 100;
  if (p >= 70) return "Excellent Entry";
  if (p >= 55) return "Good Entry";
  if (p >= 40) return "Fair Entry";
  if (p >= 25) return "Weak Entry";
  return "Poor Entry";
}

function expectationRating(v: number | null | undefined): string {
  if (v == null) return "Unknown";
  const p = v * 100;
  if (p >= 75) return "Euphoric";
  if (p >= 60) return "Elevated";
  if (p >= 45) return "Moderate";
  if (p >= 30) return "Modest";
  return "Depressed";
}

function mispricingRating(v: number | null | undefined): string {
  if (v == null) return "Unknown";
  const p = v * 100;
  if (p >= 70) return "Strong Edge";
  if (p >= 55) return "Reasonable Edge";
  if (p >= 40) return "Plausible";
  if (p >= 25) return "Weak";
  return "No Edge";
}

function fragilityRating(v: number | null | undefined): string {
  if (v == null) return "Unknown";
  const p = v * 100;
  if (p >= 70) return "Very Fragile";
  if (p >= 55) return "Fragile";
  if (p >= 40) return "Moderate";
  if (p >= 25) return "Robust";
  return "Very Robust";
}

function pctBar(v: number | null | undefined, scale = 100): number | null {
  if (v == null) return null;
  return Math.min(100, Math.max(0, (v / scale) * 100));
}

function buildQualityNarrative(name: string, m: any, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to generate a quality assessment for ${name}.`;
  const rating = qualityRating(score);
  const roicStr = m?.roic != null ? `ROIC of ${fmtPct(m.roic)}` : "ROIC data pending";
  const marginStr = m?.grossMargin != null ? `gross margins of ${fmtPct(m.grossMargin)}` : "";
  const growthStr = m?.revenueGrowth1y != null ? `revenue growing at ${fmtPct(m.revenueGrowth1y)} year-over-year` : "";
  const parts = [roicStr, marginStr, growthStr].filter(Boolean);
  if (rating === "Exceptional" || rating === "Strong") {
    return `${name} demonstrates ${rating.toLowerCase()} business quality with ${parts.join(", ")}. This is a business that consistently generates high returns on invested capital and has pricing power to protect margins.`;
  }
  if (rating === "Moderate") {
    return `${name} shows moderate fundamentals with ${parts.join(", ")}. The business has solid foundations but lacks the exceptional returns that distinguish top-tier compounders.`;
  }
  return `${name} currently shows weaker fundamentals with ${parts.join(", ")}. There is room for improvement in profitability and capital efficiency before this qualifies as a high-conviction holding.`;
}

function buildOpportunityNarrative(name: string, m: any, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess entry timing for ${name}.`;
  const rating = opportunityRating(score);
  const peStr = m?.peRatio != null ? `trading at ${fmtX(m.peRatio)} trailing P/E` : "";
  const fcfStr = m?.fcfYield != null ? `FCF yield of ${fmtPct(m.fcfYield)}` : "";
  const rsiStr = m?.rsi14 != null ? `RSI at ${m.rsi14.toFixed(0)}` : "";
  const parts = [peStr, fcfStr, rsiStr].filter(Boolean);
  if (rating === "Excellent Entry" || rating === "Good Entry") {
    return `${name} is ${parts.length ? parts.join(", ") : "attractively valued"}, suggesting a ${rating.toLowerCase()} point. The combination of valuation and momentum points to favourable risk/reward for initiating or adding to a position now.`;
  }
  if (rating === "Fair Entry") {
    return `${name} is ${parts.length ? parts.join(", ") : "reasonably valued"}. Entry conditions are acceptable but not compelling — consider scaling in gradually rather than building a full position immediately.`;
  }
  return `${name} shows ${parts.length ? parts.join(", ") : "stretched valuations or weak momentum"}. Consider waiting for a better entry price or improved technical setup before allocating capital.`;
}

function buildExpectationNarrative(name: string, m: any, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess market expectations for ${name}.`;
  const rating = expectationRating(score);
  const peStr = m?.forwardPe != null ? `Forward P/E of ${fmtX(m.forwardPe)}` : "";
  const analystStr = m?.analystUpside != null ? `analyst consensus targets ${fmtPct(m.analystUpside)} upside` : "";
  const parts = [peStr, analystStr].filter(Boolean);
  if (rating === "Euphoric" || rating === "Elevated") {
    return `The market has priced ${name} for near-perfect execution — ${parts.length ? parts.join(", ") : "valuations are stretched"}. Any disappointment in growth or margins could trigger a sharp correction. This is the biggest risk factor for this stock.`;
  }
  if (rating === "Modest" || rating === "Depressed") {
    return `Expectations for ${name} are ${rating.toLowerCase()} — ${parts.length ? parts.join(", ") : "the market isn't pricing in much upside"}. This creates asymmetric upside: even modest positive surprises in earnings or guidance can drive significant re-rating.`;
  }
  return `Market expectations for ${name} are balanced — ${parts.length ? parts.join(", ") : "neither stretched nor depressed"}. The stock can re-rate on moderate positive surprises but doesn't have the coiled spring of deeply low expectations.`;
}

function buildMispricingNarrative(name: string, m: any, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess mispricing evidence for ${name}.`;
  const rating = mispricingRating(score);
  const surpriseStr = m?.earningsSurprises != null ? `earnings surprises of ${fmtPct(m.earningsSurprises)}` : "";
  const insiderStr = m?.insiderBuying != null ? (m.insiderBuying > 0.5 ? "positive insider buying signals" : "neutral insider activity") : "";
  const marginStr = m?.grossMarginTrend != null ? `gross margin trending ${m.grossMarginTrend > 0 ? "up" : "down"} (${fmtPct(m.grossMarginTrend)})` : "";
  const parts = [surpriseStr, insiderStr, marginStr].filter(Boolean);
  if (rating === "Strong Edge" || rating === "Reasonable Edge") {
    return `Evidence suggests the market is undervaluing ${name} — ${parts.length ? parts.join(", ") : "multiple signals point to mispricing"}. The combination of fundamental improvement and market scepticism creates a ${rating.toLowerCase()} for patient investors.`;
  }
  if (rating === "Plausible") {
    return `There is some evidence of mispricing in ${name} — ${parts.length ? parts.join(", ") : "but it's not conclusive"}. The thesis requires monitoring for confirmation through continued earnings beats or margin expansion.`;
  }
  return `Mispricing evidence for ${name} is limited — ${parts.length ? parts.join(", ") : "the current price likely reflects known information"}. Wait for clearer signals of market error before building a conviction position.`;
}

function buildFragilityNarrative(name: string, m: any, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess thesis fragility for ${name}.`;
  const rating = fragilityRating(score);
  const debtStr = m?.netDebtEbitda != null ? `net debt/EBITDA of ${fmtX(m.netDebtEbitda)}` : "";
  const coverStr = m?.interestCoverage != null ? `interest coverage of ${fmtX(m.interestCoverage)}` : "";
  const currentStr = m?.currentRatio != null ? `current ratio of ${fmt(m.currentRatio, 2)}` : "";
  const parts = [debtStr, coverStr, currentStr].filter(Boolean);
  if (rating === "Very Robust" || rating === "Robust") {
    return `${name} has a ${rating.toLowerCase()} financial position — ${parts.length ? parts.join(", ") : "strong balance sheet"}. The thesis can withstand economic shocks, rate increases, and temporary revenue slowdowns without existential risk.`;
  }
  if (rating === "Moderate") {
    return `${name} has moderate financial resilience — ${parts.length ? parts.join(", ") : "acceptable but not exceptional leverage"}. The thesis holds under normal conditions but could come under pressure in a severe downturn or credit crunch.`;
  }
  return `${name} shows elevated fragility — ${parts.length ? parts.join(", ") : "leverage is concerning"}. The thesis is sensitive to external conditions: rate changes, credit availability, or revenue misses could force a fundamental reassessment. Position size accordingly.`;
}

interface SixLayerPanelProps {
  company: any;
  scores: any;
  latestMetrics: any;
  countryContext?: string | null;
}

export function InvestmentThesisTab({ company, scores, latestMetrics: m, countryContext }: SixLayerPanelProps) {
  const name = company?.name ?? "This company";
  const netScore = scores?.portfolioNetScore;
  const netPct = netScore != null ? Math.round(netScore * 100) : null;

  const bandInfo = getPositionBand(netPct);

  const layers: (LayerDef & { _rawScore: number | null | undefined })[] = [
    {
      number: 1,
      title: "Business Quality",
      subtitle: "How strong is this business fundamentally?",
      icon: ShieldCheck,
      scoreKey: "companyQualityScore",
      _rawScore: scores?.companyQualityScore,
      getLabel: qualityRating,
      metrics: [
        { label: "ROIC", value: fmtPct(m?.roic), barPct: pctBar(m?.roic, 0.30) },
        { label: "Gross Margin", value: fmtPct(m?.grossMargin), barPct: pctBar(m?.grossMargin, 0.80) },
        { label: "Operating Margin", value: fmtPct(m?.operatingMargin), barPct: pctBar(m?.operatingMargin, 0.40) },
        { label: "FCF Margin", value: fmtPct(m?.fcfMargin), barPct: pctBar(m?.fcfMargin, 0.30) },
        { label: "Revenue Growth 1Y", value: fmtPct(m?.revenueGrowth1y), barPct: pctBar(m?.revenueGrowth1y, 0.40) },
        { label: "ROE", value: fmtPct(m?.roe), barPct: pctBar(m?.roe, 0.30) },
      ],
      narrative: buildQualityNarrative(name, m, scores?.companyQualityScore),
    },
    {
      number: 2,
      title: "Stock Opportunity",
      subtitle: "Is this a good entry point right now?",
      icon: TrendingUp,
      scoreKey: "stockOpportunityScore",
      _rawScore: scores?.stockOpportunityScore,
      getLabel: opportunityRating,
      metrics: [
        { label: "FCF Yield", value: fmtPct(m?.fcfYield), barPct: pctBar(m?.fcfYield, 0.08) },
        { label: "EV/EBITDA", value: fmtX(m?.evToEbitda), barPct: m?.evToEbitda != null ? Math.max(0, 100 - (m.evToEbitda / 40) * 100) : null },
        { label: "Trailing P/E", value: fmtX(m?.peRatio), barPct: m?.peRatio != null ? Math.max(0, 100 - (m.peRatio / 60) * 100) : null },
        { label: "Forward P/E", value: fmtX(m?.forwardPe), barPct: m?.forwardPe != null ? Math.max(0, 100 - (m.forwardPe / 50) * 100) : null },
        { label: "Momentum (RSI)", value: m?.rsi14 != null ? m.rsi14.toFixed(0) : "—", barPct: m?.rsi14 != null ? m.rsi14 : null },
      ],
      narrative: buildOpportunityNarrative(name, m, scores?.stockOpportunityScore),
    },
    {
      number: 3,
      title: "Market Expectations",
      subtitle: "What has the market already priced in?",
      icon: Eye,
      inverted: true,
      scoreKey: "expectationScore",
      _rawScore: scores?.expectationScore,
      getLabel: expectationRating,
      metrics: [
        { label: "Forward P/E", value: fmtX(m?.forwardPe), barPct: m?.forwardPe != null ? Math.min(100, (m.forwardPe / 50) * 100) : null },
        { label: "EV/Sales", value: fmtX(m?.evToSales), barPct: m?.evToSales != null ? Math.min(100, (m.evToSales / 20) * 100) : null },
        { label: "Analyst Upside", value: fmtPct(m?.analystUpside), barPct: m?.analystUpside != null ? Math.min(100, (m.analystUpside + 0.2) * 200) : null },
        { label: "P/E vs Peers", value: m?.peRatio != null && m?.pePeerMedian != null ? `${fmtX(m.peRatio)} vs ${fmtX(m.pePeerMedian)}` : "—", barPct: null },
      ],
      narrative: buildExpectationNarrative(name, m, scores?.expectationScore),
    },
    {
      number: 4,
      title: "Mispricing Edge",
      subtitle: "Is the market pricing this stock wrong?",
      icon: Target,
      scoreKey: "mispricingScore",
      _rawScore: scores?.mispricingScore,
      getLabel: mispricingRating,
      metrics: [
        { label: "Earnings Surprise", value: fmtPct(m?.earningsSurprises), barPct: m?.earningsSurprises != null ? Math.min(100, (m.earningsSurprises + 0.1) * 300) : null },
        { label: "Insider Activity", value: m?.insiderBuying != null ? (m.insiderBuying > 0.5 ? "Buying" : "Neutral") : "—", barPct: m?.insiderBuying != null ? m.insiderBuying * 100 : null },
        { label: "Gross Margin Trend", value: fmtPct(m?.grossMarginTrend), barPct: m?.grossMarginTrend != null ? Math.min(100, (m.grossMarginTrend + 0.1) * 300) : null },
        { label: "Op. Margin Trend", value: fmtPct(m?.operatingMarginTrend), barPct: m?.operatingMarginTrend != null ? Math.min(100, (m.operatingMarginTrend + 0.1) * 300) : null },
        { label: "Altman Z-Score", value: fmt(m?.altmanZScore, 1), barPct: m?.altmanZScore != null ? Math.min(100, (m.altmanZScore / 5) * 100) : null },
      ],
      narrative: buildMispricingNarrative(name, m, scores?.mispricingScore),
    },
    {
      number: 5,
      title: "Thesis Fragility",
      subtitle: "What could break this investment thesis?",
      icon: ShieldAlert,
      inverted: true,
      scoreKey: "fragilityScore",
      _rawScore: scores?.fragilityScore,
      getLabel: fragilityRating,
      metrics: [
        { label: "Net Debt / EBITDA", value: fmtX(m?.netDebtEbitda), barPct: m?.netDebtEbitda != null ? Math.max(0, 100 - (m.netDebtEbitda / 5) * 100) : null },
        { label: "Interest Coverage", value: fmtX(m?.interestCoverage), barPct: m?.interestCoverage != null ? Math.min(100, (m.interestCoverage / 20) * 100) : null },
        { label: "Debt / Equity", value: fmtX(m?.debtToEquity), barPct: m?.debtToEquity != null ? Math.max(0, 100 - (m.debtToEquity / 3) * 100) : null },
        { label: "Current Ratio", value: fmt(m?.currentRatio, 2), barPct: m?.currentRatio != null ? Math.min(100, (m.currentRatio / 3) * 100) : null },
        { label: "FCF / Net Income", value: fmtX(m?.fcfToNetIncome), barPct: m?.fcfToNetIncome != null ? Math.min(100, (m.fcfToNetIncome / 2) * 100) : null },
      ],
      narrative: buildFragilityNarrative(name, m, scores?.fragilityScore),
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Net Score + Position Verdict ── */}
      <div className={`rounded-xl border p-5 ${bandInfo.borderClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-violet-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Portfolio Net Score</span>
            </div>
            <div className="text-4xl font-mono font-bold text-foreground mb-1">
              {netPct != null ? netPct : "—"}
              {netPct != null && <span className="text-lg text-muted-foreground/40 ml-1">/100</span>}
            </div>
            <div className={`text-sm font-bold mb-1 ${bandInfo.labelColor}`}>
              {bandInfo.label}
            </div>
            <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-md">
              {bandInfo.description}
            </p>
            {countryContext && (
              <div className="text-[9px] mt-2 text-muted-foreground/50 uppercase tracking-wider">
                Scored against {countryContext} market norms
              </div>
            )}
          </div>
          {netPct != null && (
            <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center shrink-0"
              style={{ borderColor: bandInfo.ringColor }}>
              <span className="text-xl font-mono font-bold">{netPct}</span>
            </div>
          )}
        </div>

        {netPct != null && (
          <div className="mt-3 h-2 bg-muted/20 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBarColor(netPct)}`} style={{ width: `${netPct}%` }} />
          </div>
        )}
      </div>

      {/* ── Six Layer Breakdown ── */}
      <div className="space-y-2">
        {layers.map(layer => (
          <LayerSection key={layer.number} layer={layer} defaultOpen={true} />
        ))}
      </div>

      {/* ── Action Recommendation ── */}
      <div className={`rounded-xl border p-4 ${bandInfo.actionBg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recommended Action</span>
          <span className={`text-lg font-display font-black tracking-widest ${bandInfo.actionColor}`}>{bandInfo.action}</span>
        </div>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{bandInfo.actionText}</p>
        <div className="mt-2 pt-2 border-t border-border/30 text-[9px] text-muted-foreground/40 flex items-center gap-1">
          <Info className="w-2.5 h-2.5" />
          Algorithmic recommendation based on quantitative analysis. Not financial advice.
        </div>
      </div>

    </div>
  );
}

function getPositionBand(netPct: number | null) {
  if (netPct == null) return {
    label: "EVALUATING",
    description: "Run the pipeline to generate scores. Once scored, you'll see a clear recommendation on whether to buy, hold, or avoid this stock.",
    labelColor: "text-muted-foreground",
    borderClass: "border-border bg-card",
    ringColor: "var(--border)",
    action: "EVALUATE",
    actionColor: "text-muted-foreground",
    actionBg: "bg-muted/10",
    actionText: "No scores available yet. Run the pipeline to generate a full 6-layer assessment before making any allocation decisions.",
  };
  if (netPct >= 75) return {
    label: "CORE HOLDING",
    description: "Highest-conviction position — build to 6–10% of your portfolio. This stock scores well across quality, opportunity, and mispricing with manageable expectations and low fragility.",
    labelColor: "text-emerald-400",
    borderClass: "border-emerald-500/30 bg-emerald-950/20",
    ringColor: "rgb(16 185 129)",
    action: "BUY",
    actionColor: "text-emerald-400",
    actionBg: "bg-emerald-500/10 border-emerald-500/20",
    actionText: "Initiate or build to a core position (6–10% of portfolio). High quality business with evidence of mispricing and manageable market expectations.",
  };
  if (netPct >= 60) return {
    label: "STRONG POSITION",
    description: "Strong conviction — allocate 3–5% of your portfolio. Good fundamentals and acceptable entry conditions. This is a stock you can build a meaningful position in.",
    labelColor: "text-blue-400",
    borderClass: "border-blue-500/30 bg-blue-950/20",
    ringColor: "rgb(59 130 246)",
    action: "ADD",
    actionColor: "text-blue-400",
    actionBg: "bg-blue-500/10 border-blue-500/20",
    actionText: "Increase to a normal-weight position (3–5% of portfolio). Strong quality profile with acceptable entry conditions and reasonable expectations.",
  };
  if (netPct >= 45) return {
    label: "STARTER POSITION",
    description: "Promising but still proving itself — open a small starter position of 1–2%. Monitor earnings and execution closely before building to a full position.",
    labelColor: "text-amber-400",
    borderClass: "border-amber-500/30 bg-amber-950/20",
    ringColor: "rgb(245 158 11)",
    action: "HOLD",
    actionColor: "text-amber-400",
    actionBg: "bg-amber-500/10 border-amber-500/20",
    actionText: "Maintain any existing position. Fundamentals support holding but conviction isn't strong enough to size up aggressively. Watch for improving quality or better entry timing.",
  };
  if (netPct >= 30) return {
    label: "SPECULATIVE",
    description: "Thesis is still developing — allocate only 0.5–1% if at all. The investment case has potential but lacks the quality or mispricing evidence needed for conviction.",
    labelColor: "text-orange-400",
    borderClass: "border-orange-500/30 bg-orange-950/20",
    ringColor: "rgb(249 115 22)",
    action: "MONITOR",
    actionColor: "text-orange-400",
    actionBg: "bg-orange-500/10 border-orange-500/20",
    actionText: "Small tactical allocation only (0.5–1%). Watch for a catalyst, improved quality metrics, or better entry pricing before committing more capital.",
  };
  return {
    label: "DO NOT BUY",
    description: "Risk/reward is not compelling — keep this on your watchlist only. Either the business quality is too weak, expectations are too high, or the balance sheet is too fragile.",
    labelColor: "text-red-400",
    borderClass: "border-red-500/30 bg-red-950/20",
    ringColor: "rgb(239 68 68)",
    action: "AVOID",
    actionColor: "text-red-400",
    actionBg: "bg-red-500/10 border-red-500/20",
    actionText: "Do not allocate capital. Either quality is too weak, expectations are too stretched, or the thesis is too fragile. Monitor from the watchlist until conditions improve.",
  };
}
