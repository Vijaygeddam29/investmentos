import { Crown, ShieldCheck, Rocket, TrendingUp, Eye, Target, ShieldAlert, AlertCircle, CheckCircle2, Minus, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function scoreColor(v: number | null | undefined, invertedGood = false): string {
  if (v == null) return "text-muted-foreground";
  const pct = v;
  if (invertedGood) {
    if (pct <= 0.30) return "text-emerald-400";
    if (pct <= 0.45) return "text-blue-400";
    if (pct <= 0.60) return "text-amber-400";
    if (pct <= 0.75) return "text-orange-400";
    return "text-red-400";
  }
  if (pct >= 0.70) return "text-emerald-400";
  if (pct >= 0.55) return "text-blue-400";
  if (pct >= 0.40) return "text-amber-400";
  if (pct >= 0.25) return "text-orange-400";
  return "text-red-400";
}

function MetricChip({ label, value, norm, good }: {
  label: string; value: string | null; norm?: string; good?: boolean | null;
}) {
  const border = good == null ? "border-border/40"
    : good ? "border-emerald-500/30 bg-emerald-500/5"
    : "border-orange-500/30 bg-orange-500/5";
  const indicator = good == null ? null : good
    ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
    : <AlertCircle className="w-2.5 h-2.5 text-orange-400 shrink-0" />;
  return (
    <div className={`rounded-lg border p-2.5 space-y-0.5 ${border}`}>
      <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-semibold flex items-center justify-between">
        <span>{label}</span>
        {indicator}
      </div>
      <div className="text-sm font-mono font-bold text-foreground">{value ?? "—"}</div>
      {norm && <div className="text-[9px] text-muted-foreground/60">{norm}</div>}
    </div>
  );
}

function PeerRow({ label, company, peer, higherIsBetter }: {
  label: string;
  company: number | null | undefined;
  peer: number | null | undefined;
  higherIsBetter: boolean;
}) {
  if (company == null) return null;
  const delta = peer != null ? ((company - peer) / Math.abs(peer || 1)) * 100 : null;
  const isAbove = delta != null ? delta > 0 : null;
  const isBetter = isAbove != null ? (higherIsBetter ? isAbove : !isAbove) : null;
  return (
    <div className="flex items-center justify-between text-[10px] py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 font-mono">
        <span className="text-foreground">{fmtX(company)}</span>
        {peer != null ? (
          <span className={`text-[9px] ${isBetter ? "text-emerald-400" : "text-orange-400"}`}>
            vs peer {fmtX(peer)} ({delta! > 0 ? "+" : ""}{delta!.toFixed(0)}%)
          </span>
        ) : (
          <span className="text-[9px] text-muted-foreground/40" title="Peer data populated on next pipeline run">vs peer —</span>
        )}
      </div>
    </div>
  );
}

// ─── Position Band Logic ──────────────────────────────────────────────────────

function getPositionBand(score: number | null | undefined) {
  if (score == null) return null;
  if (score >= 0.75) return { band: "core",      label: "CORE",      alloc: "6–10%",  color: "emerald", desc: "Highest-conviction position — maximum weight within guidelines" };
  if (score >= 0.60) return { band: "standard",  label: "STANDARD",  alloc: "3–5%",   color: "blue",    desc: "Full position — strong quality + opportunity alignment" };
  if (score >= 0.45) return { band: "starter",   label: "STARTER",   alloc: "1–2.5%", color: "amber",   desc: "Initiate small position — monitor for conviction to build" };
  if (score >= 0.30) return { band: "tactical",  label: "TACTICAL",  alloc: "0.5–1%", color: "orange",  desc: "Speculative allocation — thesis not fully proven yet" };
  return                    { band: "watchlist", label: "WATCHLIST", alloc: "0%",     color: "red",     desc: "Watch only — risk/reward not yet compelling" };
}

// ─── Layer Descriptors ────────────────────────────────────────────────────────

function qualityLabel(score: number | null | undefined) {
  if (score == null) return { label: "Unknown", color: "text-muted-foreground" };
  if (score >= 0.70) return { label: "Exceptional",   color: "text-emerald-400" };
  if (score >= 0.55) return { label: "Strong",        color: "text-blue-400" };
  if (score >= 0.40) return { label: "Moderate",      color: "text-amber-400" };
  if (score >= 0.25) return { label: "Below Average", color: "text-orange-400" };
  return                    { label: "Weak",          color: "text-red-400" };
}

function opportunityLabel(score: number | null | undefined) {
  if (score == null) return { label: "Unknown", color: "text-muted-foreground" };
  if (score >= 0.70) return { label: "Excellent Entry", color: "text-emerald-400" };
  if (score >= 0.55) return { label: "Good Entry",      color: "text-blue-400" };
  if (score >= 0.40) return { label: "Fair Entry",      color: "text-amber-400" };
  if (score >= 0.25) return { label: "Weak Entry",      color: "text-orange-400" };
  return                    { label: "Poor Entry",      color: "text-red-400" };
}

function expectationLabel(score: number | null | undefined) {
  if (score == null) return { label: "Unknown", color: "text-muted-foreground" };
  if (score >= 0.75) return { label: "Euphoric",  color: "text-red-400" };
  if (score >= 0.60) return { label: "Elevated",  color: "text-orange-400" };
  if (score >= 0.45) return { label: "Moderate",  color: "text-amber-400" };
  if (score >= 0.30) return { label: "Modest",    color: "text-blue-400" };
  return                    { label: "Depressed", color: "text-emerald-400" };
}

function mispricingLabel(score: number | null | undefined) {
  if (score == null) return { label: "Unknown",         color: "text-muted-foreground" };
  if (score >= 0.70) return { label: "Strong Edge",     color: "text-emerald-400" };
  if (score >= 0.55) return { label: "Reasonable Edge", color: "text-blue-400" };
  if (score >= 0.40) return { label: "Plausible",       color: "text-amber-400" };
  if (score >= 0.25) return { label: "Weak",            color: "text-orange-400" };
  return                    { label: "No Edge",         color: "text-red-400" };
}

function fragilityLabel(score: number | null | undefined) {
  if (score == null) return { label: "Unknown",     color: "text-muted-foreground" };
  if (score >= 0.70) return { label: "Very Fragile", color: "text-red-400" };
  if (score >= 0.55) return { label: "Fragile",      color: "text-orange-400" };
  if (score >= 0.40) return { label: "Moderate",     color: "text-amber-400" };
  if (score >= 0.25) return { label: "Robust",       color: "text-blue-400" };
  return                    { label: "Very Robust",  color: "text-emerald-400" };
}

// ─── Narrative Generator ──────────────────────────────────────────────────────

function buildNarrative(company: any, scores: any, m: any): string {
  const name = company?.name ?? "This company";
  const q  = qualityLabel(scores?.companyQualityScore);
  const ex = expectationLabel(scores?.expectationScore);
  const mi = mispricingLabel(scores?.mispricingScore);
  const fr = fragilityLabel(scores?.fragilityScore);

  const qualityStr = q.label === "Exceptional" || q.label === "Strong"
    ? `demonstrates ${q.label.toLowerCase()} business quality with a ROIC of ${fmtPct(m?.roic)} and gross margins of ${fmtPct(m?.grossMargin)}`
    : `shows ${q.label.toLowerCase()} fundamentals with room for improvement`;

  const valuationStr = scores?.expectationScore != null
    ? ex.label === "Depressed" || ex.label === "Modest"
      ? "Market expectations are low, creating asymmetric upside if execution continues"
      : ex.label === "Euphoric" || ex.label === "Elevated"
        ? `Market expectations are ${ex.label.toLowerCase()} — the stock is priced for perfection, requiring flawless execution`
        : "Market expectations are balanced — stock can re-rate on moderate positive surprises"
    : "";

  const mispricingStr = mi.label === "Strong Edge" || mi.label === "Reasonable Edge"
    ? `Evidence of mispricing is ${mi.label.toLowerCase().replace(" edge", "")} — insiders, margins and earnings surprises point to the market underestimating fair value`
    : mi.label === "No Edge" || mi.label === "Weak"
      ? "Mispricing evidence is limited — the current price likely reflects known information"
      : "";

  const fragilityStr = fr.label === "Very Robust" || fr.label === "Robust"
    ? `The balance sheet is ${fr.label.toLowerCase()} — leverage is controlled and cash conversion is reliable, limiting downside scenarios`
    : fr.label === "Fragile" || fr.label === "Very Fragile"
      ? `Thesis fragility is elevated — leverage of ${fmtX(m?.netDebtEbitda)} net debt/EBITDA and interest coverage of ${fmtX(m?.interestCoverage)} require monitoring`
      : "";

  const sentences = [
    `${name} ${qualityStr}.`,
    valuationStr,
    mispricingStr,
    fragilityStr,
  ].filter(Boolean);

  return sentences.join(" ");
}

// ─── Action Recommendation ────────────────────────────────────────────────────

function getAction(scores: any): { action: string; color: string; bg: string; conditions: string } {
  const pns = scores?.portfolioNetScore;
  const ex  = scores?.expectationScore;
  const fr  = scores?.fragilityScore;
  const mi  = scores?.mispricingScore;

  if (pns == null) return { action: "EVALUATE", color: "text-muted-foreground", bg: "bg-muted/20", conditions: "Run pipeline to generate scores before making allocation decisions." };

  if (pns >= 0.75 && (ex == null || ex < 0.7) && (fr == null || fr < 0.6)) {
    return { action: "BUY", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",
      conditions: "Initiate or build to core position (6–10%). High quality, evidence of mispricing, manageable expectations." };
  }
  if (pns >= 0.60 && (ex == null || ex < 0.75)) {
    return { action: "ADD", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20",
      conditions: "Increase to standard position (3–5%). Strong quality profile with acceptable entry conditions." };
  }
  if (pns >= 0.45) {
    return { action: "HOLD", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20",
      conditions: "Maintain existing position. Fundamentals support holding but not aggressive sizing up." };
  }
  if (pns >= 0.30) {
    return { action: "MONITOR", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20",
      conditions: "Small tactical allocation only (0.5–1%). Watch for catalyst or improved quality before sizing up." };
  }
  return { action: "AVOID", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20",
    conditions: "Risk/reward not compelling. Either quality is too weak or expectations are too high for current price." };
}

// ─── Layer Card ───────────────────────────────────────────────────────────────

function LayerCard({
  number, name, label, labelColor, scoreValue, evidence, interpretation, icon: Icon
}: {
  number: number; name: string; label: string; labelColor: string;
  scoreValue: number | null | undefined;
  evidence: React.ReactNode; interpretation: string;
  icon: React.ElementType;
}) {
  const pct = scoreValue != null ? Math.round(scoreValue * 100) : null;
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-secondary/20">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">Layer {number} · {name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${labelColor}`}>{label}</span>
          {pct != null && <span className="text-[10px] font-mono text-muted-foreground/60">{pct}/100</span>}
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-[10px] text-muted-foreground space-y-1">
          {evidence}
        </div>
        {pct != null && (
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${labelColor.replace("text-", "bg-")}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed italic">{interpretation}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface InvestmentThesisTabProps {
  company: any;
  scores: any;
  latestMetrics: any;
  countryContext?: string | null;
}

export function InvestmentThesisTab({ company, scores, latestMetrics: m, countryContext }: InvestmentThesisTabProps) {
  const band      = getPositionBand(scores?.portfolioNetScore);
  const action    = getAction(scores);
  const narrative = buildNarrative(company, scores, m);

  const bandColors: Record<string, string> = {
    emerald: "from-emerald-950/40 via-emerald-900/20 border-emerald-500/30 text-emerald-300",
    blue:    "from-blue-950/40 via-blue-900/20 border-blue-500/30 text-blue-300",
    amber:   "from-amber-950/30 via-amber-900/10 border-amber-500/30 text-amber-300",
    orange:  "from-orange-950/30 via-orange-900/10 border-orange-500/30 text-orange-300",
    red:     "from-red-950/30 via-red-900/10 border-red-500/30 text-red-300",
  };

  const bandColor = band ? (bandColors[band.color] ?? bandColors.red) : "from-muted/40 border-border text-muted-foreground";

  const netPct = scores?.portfolioNetScore != null ? Math.round(scores.portfolioNetScore * 100) : null;

  const q  = qualityLabel(scores?.companyQualityScore);
  const op = opportunityLabel(scores?.stockOpportunityScore);
  const ex = expectationLabel(scores?.expectationScore);
  const mi = mispricingLabel(scores?.mispricingScore);
  const fr = fragilityLabel(scores?.fragilityScore);

  // Peer comparison delta display helper
  const peerPeDelta = m?.peRatio != null && m?.pePeerMedian != null
    ? ((m.peRatio - m.pePeerMedian) / m.pePeerMedian * 100).toFixed(0) : null;

  return (
    <div className="space-y-5">

      {/* ── Position Verdict Banner ── */}
      <div className={`rounded-xl border bg-gradient-to-br ${bandColor} p-5`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                {band?.band === "watchlist" ? "Watchlist" : "Position Verdict"}
              </span>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight">
              {band?.label ?? "EVALUATING"} POSITION
            </div>
            <div className="text-sm opacity-80 mt-0.5">
              Target allocation: <strong>{band?.alloc ?? "—"}</strong>
            </div>
            <p className="text-[11px] opacity-60 mt-1">{band?.desc}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Portfolio Net Score</div>
            <div className="text-4xl font-mono font-bold">
              {netPct != null ? `${netPct}` : "—"}
            </div>
            {netPct != null && <div className="text-xs opacity-60">/100</div>}
            {countryContext && (
              <div className="text-[9px] mt-1 opacity-50 uppercase tracking-wider">
                {countryContext} market norms
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Six Layer Breakdown ── */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">6-Layer Intelligence Breakdown</h4>

        {/* Layer 1: Company Quality */}
        <LayerCard
          number={1} name="Company Quality" label={q.label} labelColor={q.color}
          scoreValue={scores?.companyQualityScore}
          icon={ShieldCheck}
          evidence={
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>ROIC</span><span className="font-mono text-foreground">{fmtPct(m?.roic)}</span></div>
              <div className="flex justify-between"><span>ROE</span><span className="font-mono text-foreground">{fmtPct(m?.roe)}</span></div>
              <div className="flex justify-between"><span>Gross Margin</span><span className="font-mono text-foreground">{fmtPct(m?.grossMargin)}</span></div>
              <div className="flex justify-between"><span>Op. Margin</span><span className="font-mono text-foreground">{fmtPct(m?.operatingMargin)}</span></div>
              <div className="flex justify-between"><span>FCF Margin</span><span className="font-mono text-foreground">{fmtPct(m?.fcfMargin)}</span></div>
              <div className="flex justify-between"><span>Revenue Growth 1Y</span><span className="font-mono text-foreground">{fmtPct(m?.revenueGrowth1y)}</span></div>
            </div>
          }
          interpretation="Measures how strong the underlying business is — profitability, capital efficiency, and consistency of returns."
        />

        {/* Layer 2: Stock Opportunity */}
        <LayerCard
          number={2} name="Stock Opportunity" label={op.label} labelColor={op.color}
          scoreValue={scores?.stockOpportunityScore}
          icon={TrendingUp}
          evidence={
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>FCF Yield</span><span className="font-mono text-foreground">{fmtPct(m?.fcfYield)}</span></div>
              <div className="flex justify-between"><span>EV/EBITDA</span><span className="font-mono text-foreground">{fmtX(m?.evToEbitda)}</span></div>
              <div className="flex justify-between"><span>Forward P/E</span><span className="font-mono text-foreground">{fmtX(m?.forwardPe)}</span></div>
              <div className="flex justify-between"><span>Trailing P/E</span><span className="font-mono text-foreground">{fmtX(m?.peRatio)}</span></div>
              <div className="flex justify-between"><span>EV/Sales</span><span className="font-mono text-foreground">{fmtX(m?.evToSales)}</span></div>
              <div className="flex justify-between"><span>Momentum RSI</span><span className="font-mono text-foreground">{m?.rsi14 != null ? m.rsi14.toFixed(0) : "—"}</span></div>
            </div>
          }
          interpretation="Combines valuation and momentum to determine whether now is a good moment to enter. Separate from business quality."
        />

        {/* Layer 3: Expectation */}
        <LayerCard
          number={3} name="Expectation" label={ex.label} labelColor={ex.color}
          scoreValue={scores?.expectationScore}
          icon={Eye}
          evidence={
            <div className="space-y-0.5">
              <PeerRow label="P/E vs Peers" company={m?.peRatio} peer={m?.pePeerMedian} higherIsBetter={false} />
              <PeerRow label="EV/EBITDA vs Peers" company={m?.evToEbitda} peer={m?.evEbitdaPeerMedian} higherIsBetter={false} />
              <div className="flex justify-between"><span>Forward P/E</span><span className="font-mono text-foreground">{fmtX(m?.forwardPe)}</span></div>
              <div className="flex justify-between"><span>Analyst Upside</span><span className="font-mono text-foreground">{fmtPct(m?.analystUpside)}</span></div>
              <div className="flex justify-between"><span>FCF Yield</span><span className="font-mono text-foreground">{fmtPct(m?.fcfYield)}</span></div>
              <div className="flex justify-between text-muted-foreground/40 text-[9px]"><span>Peer data note</span><span>{m?.pePeerMedian == null ? "Populated on next pipeline run" : `${countryContext ?? ""} peers`}</span></div>
            </div>
          }
          interpretation="How much success is already priced into the stock. Low expectation = upside surprise creates outsized moves. High expectation = requires perfect execution."
        />

        {/* Layer 4: Mispricing */}
        <LayerCard
          number={4} name="Mispricing Evidence" label={mi.label} labelColor={mi.color}
          scoreValue={scores?.mispricingScore}
          icon={Target}
          evidence={
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Earnings Surprise</span><span className="font-mono text-foreground">{fmtPct(m?.earningsSurprises)}</span></div>
              <div className="flex justify-between"><span>Insider Buying</span><span className="font-mono text-foreground">{m?.insiderBuying != null ? (m.insiderBuying > 0.5 ? "Positive signal" : "Neutral") : "—"}</span></div>
              <div className="flex justify-between"><span>Gross Margin Trend</span><span className="font-mono text-foreground">{fmtPct(m?.grossMarginTrend)}</span></div>
              <div className="flex justify-between"><span>Op. Margin Trend</span><span className="font-mono text-foreground">{fmtPct(m?.operatingMarginTrend)}</span></div>
              <div className="flex justify-between"><span>Altman Z-Score</span><span className="font-mono text-foreground">{fmt(m?.altmanZScore, 1)}</span></div>
              <div className="flex justify-between"><span>Analyst Upside</span><span className="font-mono text-foreground">{fmtPct(m?.analystUpside)}</span></div>
            </div>
          }
          interpretation="Evidence that the market is pricing this incorrectly and that the reality will be better than priced. Higher = stronger case for a market error."
        />

        {/* Layer 5: Fragility */}
        <LayerCard
          number={5} name="Thesis Fragility" label={fr.label} labelColor={fr.color}
          scoreValue={scores?.fragilityScore}
          icon={ShieldAlert}
          evidence={
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Net Debt / EBITDA</span><span className="font-mono text-foreground">{fmtX(m?.netDebtEbitda)}</span></div>
              <div className="flex justify-between"><span>Interest Coverage</span><span className="font-mono text-foreground">{fmtX(m?.interestCoverage)}</span></div>
              <div className="flex justify-between"><span>Debt / Equity</span><span className="font-mono text-foreground">{fmtX(m?.debtToEquity)}</span></div>
              <div className="flex justify-between"><span>Current Ratio</span><span className="font-mono text-foreground">{fmt(m?.currentRatio, 2)}</span></div>
              <div className="flex justify-between"><span>FCF → Net Income</span><span className="font-mono text-foreground">{fmtX(m?.fcfToNetIncome)}</span></div>
            </div>
          }
          interpretation="How much financial stress would it take to break this thesis? Fragile = reliant on external conditions that can change quickly. Robust = thesis survives shocks."
        />

        {/* Layer 6: Portfolio Net Score */}
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider">Layer 6 · Portfolio Net Score</span>
            </div>
            <span className="text-sm font-mono font-bold text-violet-300">{netPct ?? "—"}/100</span>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Formula</span>
              <span className="font-mono text-foreground/80">2×Quality + 1×Opportunity + 2×Mispricing − 1×Expectation − 1×Fragility</span>
            </div>
          </div>
          {netPct != null && (
            <div className="mt-2 h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${netPct}%` }} />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed italic mt-2">
            The composite portfolio-construction signal. Penalises euphoric expectations and fragile balance sheets. Rewards high quality with mispricing evidence.
          </p>
        </div>
      </div>

      {/* ── Investment Narrative ── */}
      <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Info className="w-3 h-3" />Investment Rationale
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{narrative}</p>
      </div>

      {/* ── 12-Cell Metrics Grid ── */}
      <div>
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Key Metrics</h4>
        <div className="grid grid-cols-3 gap-1.5">
          <MetricChip label="ROIC"          value={fmtPct(m?.roic)}         good={m?.roic != null ? m.roic > 0.12 : null}  norm="norm >12%" />
          <MetricChip label="Revenue Growth" value={fmtPct(m?.revenueGrowth1y)} good={m?.revenueGrowth1y != null ? m.revenueGrowth1y > 0.10 : null} norm="norm >10%" />
          <MetricChip label="Gross Margin"  value={fmtPct(m?.grossMargin)}  good={m?.grossMargin != null ? m.grossMargin > 0.40 : null}  norm="norm >40%" />
          <MetricChip label="FCF Yield"     value={fmtPct(m?.fcfYield)}     good={m?.fcfYield != null ? m.fcfYield > 0.03 : null}        norm="norm >3%" />
          <MetricChip label="P/E (Trail)"   value={fmtX(m?.peRatio)}
            norm={m?.pePeerMedian != null ? `peer ${fmtX(m.pePeerMedian)}` : "vs peer —"}
            good={m?.peRatio != null && m?.pePeerMedian != null ? m.peRatio < m.pePeerMedian * 1.2 : null} />
          <MetricChip label="P/E (Fwd)"     value={fmtX(m?.forwardPe)}     good={m?.forwardPe != null ? m.forwardPe < 35 : null}        norm="norm <35×" />
          <MetricChip label="EV/EBITDA"     value={fmtX(m?.evToEbitda)}
            norm={m?.evEbitdaPeerMedian != null ? `peer ${fmtX(m.evEbitdaPeerMedian)}` : "vs peer —"}
            good={m?.evToEbitda != null && m?.evEbitdaPeerMedian != null ? m.evToEbitda < m.evEbitdaPeerMedian * 1.2 : null} />
          <MetricChip label="Net Debt/EBITDA" value={fmtX(m?.netDebtEbitda)} good={m?.netDebtEbitda != null ? m.netDebtEbitda < 3 : null} norm="norm <3×" />
          <MetricChip label="Int. Coverage"  value={fmtX(m?.interestCoverage)} good={m?.interestCoverage != null ? m.interestCoverage > 5 : null} norm="norm >5×" />
          <MetricChip label="Earnings Surprise" value={fmtPct(m?.earningsSurprises)} good={m?.earningsSurprises != null ? m.earningsSurprises > 0 : null} norm="beat vs est." />
          <MetricChip label="Analyst Upside" value={fmtPct(m?.analystUpside)} good={m?.analystUpside != null ? m.analystUpside > 0.10 : null} norm="cons. upside" />
          <MetricChip label="ROE"           value={fmtPct(m?.roe)}          good={m?.roe != null ? m.roe > 0.15 : null}               norm="norm >15%" />
        </div>
      </div>

      {/* ── Action Recommendation ── */}
      <div className={`rounded-xl border p-4 ${action.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recommended Action</h4>
          <span className={`text-xl font-display font-black tracking-widest ${action.color}`}>{action.action}</span>
        </div>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{action.conditions}</p>
        <div className="mt-2 pt-2 border-t border-border/30 text-[9px] text-muted-foreground/40 flex items-center gap-1">
          <Info className="w-2.5 h-2.5" />
          Algorithmic recommendation. Not financial advice. Always apply your own judgement and portfolio context.
        </div>
      </div>

    </div>
  );
}
