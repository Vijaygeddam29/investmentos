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
    "Core": "text-emerald-400", "Standard": "text-blue-400",
    "Starter": "text-amber-400", "Tactical": "text-orange-400",
    "Watchlist": "text-red-400",
  };
  return map[label] ?? "text-muted-foreground";
}

interface MetricChip {
  label: string;
  value: string | null;
  barPct?: number | null;
}

interface LayerDef {
  number: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  inverted?: boolean;
  getLabel: (v: number | null | undefined) => string;
  scoreKey: string;
  rawScore: number | null | undefined;
  metrics: MetricChip[];
  narrative: string;
}

function MetricChipRow({ chips }: { chips: MetricChip[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((m) => (
        <div key={m.label} className="flex items-center gap-2 bg-muted/20 rounded-lg px-2.5 py-1.5 border border-border/30">
          <span className="text-[10px] text-muted-foreground shrink-0">{m.label}</span>
          {m.barPct != null && (
            <div className="h-1.5 w-10 bg-muted/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${m.barPct >= 70 ? "bg-emerald-500/70" : m.barPct >= 40 ? "bg-blue-500/70" : "bg-amber-500/70"}`}
                style={{ width: `${Math.min(100, Math.max(2, m.barPct))}%` }}
              />
            </div>
          )}
          <span className="text-xs font-mono text-foreground shrink-0">{m.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function LayerSection({ layer, defaultOpen = true }: { layer: LayerDef; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = layer.icon;
  const pct = layer.rawScore != null ? Math.round(layer.rawScore * 100) : null;
  const label = layer.getLabel(layer.rawScore);
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

          <MetricChipRow chips={layer.metrics} />

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

function netScoreRating(v: number | null | undefined): string {
  if (v == null) return "Unknown";
  const p = v * 100;
  if (p >= 75) return "Core";
  if (p >= 60) return "Standard";
  if (p >= 45) return "Starter";
  if (p >= 30) return "Tactical";
  return "Watchlist";
}

function pctBar(v: number | null | undefined, scale = 100): number | null {
  if (v == null) return null;
  return Math.min(100, Math.max(0, (v / scale) * 100));
}

function buildQualityNarrative(name: string, m: Record<string, number | null | undefined>, score: number | null | undefined): string {
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

function buildOpportunityNarrative(name: string, m: Record<string, number | null | undefined>, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess entry timing for ${name}.`;
  const rating = opportunityRating(score);
  const peStr = m?.peRatio != null ? `trading at ${fmtX(m.peRatio)} trailing P/E` : "";
  const fcfStr = m?.fcfYield != null ? `FCF yield of ${fmtPct(m.fcfYield)}` : "";
  const parts = [peStr, fcfStr].filter(Boolean);
  if (rating === "Excellent Entry" || rating === "Good Entry") {
    return `${name} is ${parts.length ? parts.join(", ") : "attractively valued"}, suggesting a ${rating.toLowerCase()} point. The combination of valuation and momentum points to favourable risk/reward for initiating or adding to a position now.`;
  }
  if (rating === "Fair Entry") {
    return `${name} is ${parts.length ? parts.join(", ") : "reasonably valued"}. Entry conditions are acceptable but not compelling — consider scaling in gradually rather than building a full position immediately.`;
  }
  return `${name} shows ${parts.length ? parts.join(", ") : "stretched valuations or weak momentum"}. Consider waiting for a better entry price or improved technical setup before allocating capital.`;
}

function buildExpectationNarrative(name: string, m: Record<string, number | null | undefined>, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess market expectations for ${name}.`;
  const rating = expectationRating(score);
  const peStr = m?.forwardPe != null ? `Forward P/E of ${fmtX(m.forwardPe)}` : "";
  const parts = [peStr].filter(Boolean);
  if (rating === "Euphoric" || rating === "Elevated") {
    return `The market has priced ${name} for near-perfect execution — ${parts.length ? parts.join(", ") : "valuations are stretched"}. Any disappointment in growth or margins could trigger a sharp correction.`;
  }
  if (rating === "Modest" || rating === "Depressed") {
    return `Expectations for ${name} are ${rating.toLowerCase()} — ${parts.length ? parts.join(", ") : "the market isn't pricing in much upside"}. This creates asymmetric upside: even modest positive surprises in earnings or guidance can drive significant re-rating.`;
  }
  return `Market expectations for ${name} are balanced — ${parts.length ? parts.join(", ") : "neither stretched nor depressed"}. The stock can re-rate on moderate positive surprises but doesn't have the coiled spring of deeply low expectations.`;
}

function buildMispricingNarrative(name: string, m: Record<string, number | null | undefined>, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess mispricing evidence for ${name}.`;
  const rating = mispricingRating(score);
  const surpriseStr = m?.earningsSurprises != null ? `earnings surprises of ${fmtPct(m.earningsSurprises)}` : "";
  const marginStr = m?.grossMarginTrend != null ? `gross margin trending ${(m.grossMarginTrend ?? 0) > 0 ? "up" : "down"}` : "";
  const parts = [surpriseStr, marginStr].filter(Boolean);
  if (rating === "Strong Edge" || rating === "Reasonable Edge") {
    return `Evidence suggests the market is undervaluing ${name} — ${parts.length ? parts.join(", ") : "multiple signals point to mispricing"}. The combination of fundamental improvement and market scepticism creates a ${rating.toLowerCase()} for patient investors.`;
  }
  if (rating === "Plausible") {
    return `There is some evidence of mispricing in ${name} — ${parts.length ? parts.join(", ") : "but it's not conclusive"}. The thesis requires monitoring for confirmation through continued earnings beats or margin expansion.`;
  }
  return `Mispricing evidence for ${name} is limited — ${parts.length ? parts.join(", ") : "the current price likely reflects known information"}. Wait for clearer signals of market error before building a conviction position.`;
}

function buildFragilityNarrative(name: string, m: Record<string, number | null | undefined>, score: number | null | undefined): string {
  if (score == null) return `Run the pipeline to assess thesis fragility for ${name}.`;
  const rating = fragilityRating(score);
  const debtStr = m?.netDebtEbitda != null ? `net debt/EBITDA of ${fmtX(m.netDebtEbitda)}` : "";
  const coverStr = m?.interestCoverage != null ? `interest coverage of ${fmtX(m.interestCoverage)}` : "";
  const parts = [debtStr, coverStr].filter(Boolean);
  if (rating === "Very Robust" || rating === "Robust") {
    return `${name} has a ${rating.toLowerCase()} financial position — ${parts.length ? parts.join(", ") : "strong balance sheet"}. The thesis can withstand economic shocks, rate increases, and temporary revenue slowdowns without existential risk.`;
  }
  if (rating === "Moderate") {
    return `${name} has moderate financial resilience — ${parts.length ? parts.join(", ") : "acceptable but not exceptional leverage"}. The thesis holds under normal conditions but could come under pressure in a severe downturn.`;
  }
  return `${name} shows elevated fragility — ${parts.length ? parts.join(", ") : "leverage is concerning"}. The thesis is sensitive to external conditions: rate changes, credit availability, or revenue misses could force a fundamental reassessment.`;
}

function buildNetScoreNarrative(name: string, netPct: number | null, band: ReturnType<typeof getPositionBand>): string {
  if (netPct == null) return `Run the pipeline to generate a full 6-layer assessment for ${name}.`;
  return band.description;
}

interface SixLayerPanelProps {
  company: { name?: string; ticker?: string; [key: string]: unknown } | null | undefined;
  scores: Record<string, number | null | undefined> | null | undefined;
  latestMetrics: Record<string, number | null | undefined> | null | undefined;
  countryContext?: string | null;
}

export function SixLayerPanel({ company, scores, latestMetrics: m, countryContext }: SixLayerPanelProps) {
  const name = company?.name as string ?? "This company";
  const netScore = scores?.portfolioNetScore;
  const netPct = netScore != null ? Math.round(netScore * 100) : null;
  const bandInfo = getPositionBand(netPct);
  const metricsMap = (m ?? {}) as Record<string, number | null | undefined>;

  const layers: LayerDef[] = [
    {
      number: 1,
      title: "Business Quality",
      subtitle: "How strong is this business fundamentally?",
      icon: ShieldCheck,
      scoreKey: "companyQualityScore",
      rawScore: scores?.companyQualityScore,
      getLabel: qualityRating,
      metrics: [
        { label: "ROIC", value: fmtPct(metricsMap.roic), barPct: pctBar(metricsMap.roic, 0.30) },
        { label: "Gross Margin", value: fmtPct(metricsMap.grossMargin), barPct: pctBar(metricsMap.grossMargin, 0.80) },
        { label: "Op. Margin", value: fmtPct(metricsMap.operatingMargin), barPct: pctBar(metricsMap.operatingMargin, 0.40) },
        { label: "Rev Growth 1Y", value: fmtPct(metricsMap.revenueGrowth1y), barPct: pctBar(metricsMap.revenueGrowth1y, 0.40) },
      ],
      narrative: buildQualityNarrative(name, metricsMap, scores?.companyQualityScore),
    },
    {
      number: 2,
      title: "Stock Opportunity",
      subtitle: "Is this a good entry point right now?",
      icon: TrendingUp,
      scoreKey: "stockOpportunityScore",
      rawScore: scores?.stockOpportunityScore,
      getLabel: opportunityRating,
      metrics: [
        { label: "FCF Yield", value: fmtPct(metricsMap.fcfYield), barPct: pctBar(metricsMap.fcfYield, 0.08) },
        { label: "Trailing P/E", value: fmtX(metricsMap.peRatio), barPct: metricsMap.peRatio != null ? Math.max(0, 100 - (metricsMap.peRatio / 60) * 100) : null },
        { label: "EV/EBITDA", value: fmtX(metricsMap.evToEbitda), barPct: metricsMap.evToEbitda != null ? Math.max(0, 100 - (metricsMap.evToEbitda / 40) * 100) : null },
      ],
      narrative: buildOpportunityNarrative(name, metricsMap, scores?.stockOpportunityScore),
    },
    {
      number: 3,
      title: "Market Expectations",
      subtitle: "What has the market already priced in?",
      icon: Eye,
      inverted: true,
      scoreKey: "expectationScore",
      rawScore: scores?.expectationScore,
      getLabel: expectationRating,
      metrics: [
        { label: "Forward P/E", value: fmtX(metricsMap.forwardPe), barPct: metricsMap.forwardPe != null ? Math.min(100, (metricsMap.forwardPe / 50) * 100) : null },
        { label: "EV/Sales", value: fmtX(metricsMap.evToSales), barPct: metricsMap.evToSales != null ? Math.min(100, (metricsMap.evToSales / 20) * 100) : null },
        { label: "Analyst Upside", value: fmtPct(metricsMap.analystUpside), barPct: metricsMap.analystUpside != null ? Math.min(100, (metricsMap.analystUpside + 0.2) * 200) : null },
      ],
      narrative: buildExpectationNarrative(name, metricsMap, scores?.expectationScore),
    },
    {
      number: 4,
      title: "Mispricing Edge",
      subtitle: "Is the market pricing this stock wrong?",
      icon: Target,
      scoreKey: "mispricingScore",
      rawScore: scores?.mispricingScore,
      getLabel: mispricingRating,
      metrics: [
        { label: "Earnings Surprise", value: fmtPct(metricsMap.earningsSurprises), barPct: metricsMap.earningsSurprises != null ? Math.min(100, (metricsMap.earningsSurprises + 0.1) * 300) : null },
        { label: "Margin Trend", value: fmtPct(metricsMap.grossMarginTrend), barPct: metricsMap.grossMarginTrend != null ? Math.min(100, (metricsMap.grossMarginTrend + 0.1) * 300) : null },
        { label: "Altman Z", value: fmt(metricsMap.altmanZScore, 1), barPct: metricsMap.altmanZScore != null ? Math.min(100, (metricsMap.altmanZScore / 5) * 100) : null },
      ],
      narrative: buildMispricingNarrative(name, metricsMap, scores?.mispricingScore),
    },
    {
      number: 5,
      title: "Thesis Fragility",
      subtitle: "What could break this investment thesis?",
      icon: ShieldAlert,
      inverted: true,
      scoreKey: "fragilityScore",
      rawScore: scores?.fragilityScore,
      getLabel: fragilityRating,
      metrics: [
        { label: "Debt / EBITDA", value: fmtX(metricsMap.netDebtEbitda), barPct: metricsMap.netDebtEbitda != null ? Math.max(0, 100 - (metricsMap.netDebtEbitda / 5) * 100) : null },
        { label: "Interest Cover", value: fmtX(metricsMap.interestCoverage), barPct: metricsMap.interestCoverage != null ? Math.min(100, (metricsMap.interestCoverage / 20) * 100) : null },
        { label: "Current Ratio", value: fmt(metricsMap.currentRatio, 2), barPct: metricsMap.currentRatio != null ? Math.min(100, (metricsMap.currentRatio / 3) * 100) : null },
      ],
      narrative: buildFragilityNarrative(name, metricsMap, scores?.fragilityScore),
    },
    {
      number: 6,
      title: "Portfolio Net Score",
      subtitle: "Final blended score — where does this stock belong in your portfolio?",
      icon: Crown,
      scoreKey: "portfolioNetScore",
      rawScore: scores?.portfolioNetScore,
      getLabel: netScoreRating,
      metrics: [
        { label: "Position Band", value: bandInfo.label, barPct: null },
        { label: "Sizing Range", value: bandInfo.sizingRange, barPct: null },
        { label: "Action", value: bandInfo.action, barPct: null },
      ],
      narrative: buildNetScoreNarrative(name, netPct, bandInfo),
    },
  ];

  return (
    <div className="space-y-2">
      {layers.map(layer => (
        <LayerSection key={layer.number} layer={layer} defaultOpen={layer.number <= 2 || layer.number === 6} />
      ))}

      {countryContext && (
        <div className="text-[9px] mt-2 text-muted-foreground/50 uppercase tracking-wider text-center">
          Scored against {countryContext} market norms
        </div>
      )}

      <div className="rounded-xl border border-border/30 p-3 mt-2 text-center">
        <div className="text-[9px] text-muted-foreground/40 flex items-center justify-center gap-1">
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
    sizingRange: "—",
    action: "EVALUATE",
  };
  if (netPct >= 75) return {
    label: "CORE",
    description: `Net score of ${netPct} places this stock in the Core tier — the highest conviction names in your portfolio. These are businesses with exceptional quality, favourable entry conditions, and robust balance sheets. Allocate 6–10% of your portfolio and hold through volatility.`,
    sizingRange: "6–10%",
    action: "BUY / ADD",
  };
  if (netPct >= 60) return {
    label: "STANDARD",
    description: `Net score of ${netPct} places this in the Standard tier — strong positions with good fundamentals and acceptable valuations. Allocate 3–5% and monitor for upgrades to Core or downgrades on deteriorating metrics.`,
    sizingRange: "3–5%",
    action: "BUY",
  };
  if (netPct >= 45) return {
    label: "STARTER",
    description: `Net score of ${netPct} qualifies as a Starter position — worth owning but not yet proven enough for a full position. Allocate 1–2% and look for catalysts to size up or cut.`,
    sizingRange: "1–2%",
    action: "SMALL BUY",
  };
  if (netPct >= 30) return {
    label: "TACTICAL",
    description: `Net score of ${netPct} is in the Tactical tier — there are risks or gaps in the thesis. A small speculative allocation of 0.5–1% is appropriate only if you have a specific catalyst or thesis that isn't captured by the model.`,
    sizingRange: "0.5–1%",
    action: "HOLD / TRIM",
  };
  return {
    label: "WATCHLIST",
    description: `Net score of ${netPct} places this on the Watchlist — the quantitative evidence does not support a position. Monitor for improvement but do not allocate capital until the score improves above 30.`,
    sizingRange: "0%",
    action: "DO NOT BUY",
  };
}
