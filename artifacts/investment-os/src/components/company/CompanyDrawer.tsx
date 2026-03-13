import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetCompany, useGetCompanyMetrics, useGetCompanyScoreHistory } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TrendingUp, AlertCircle, ShieldAlert, BarChart2, Award, Link2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EntryExitPanel } from "./EntryExitPanel";
import { FactorAccordion } from "./FactorAccordion";
import { PriceScoreChart } from "./PriceScoreChart";
import { ValuationBandChart } from "./ValuationBandChart";
import { ValueChainTab } from "./ValueChainTab";

const LEADERSHIP_LOOKUP: Record<string, { founderLed: boolean; dualClass: boolean; ceoTenureYears: number; visionRating: string }> = {
  NVDA: { founderLed: true,  dualClass: false, ceoTenureYears: 31, visionRating: "HIGH" },
  META: { founderLed: true,  dualClass: true,  ceoTenureYears: 20, visionRating: "HIGH" },
  TSLA: { founderLed: true,  dualClass: false, ceoTenureYears: 16, visionRating: "HIGH" },
  GOOGL:{ founderLed: false, dualClass: true,  ceoTenureYears: 10, visionRating: "MEDIUM" },
  DDOG: { founderLed: true,  dualClass: true,  ceoTenureYears: 16, visionRating: "HIGH" },
  CRWD: { founderLed: true,  dualClass: false, ceoTenureYears: 14, visionRating: "HIGH" },
  PLTR: { founderLed: true,  dualClass: true,  ceoTenureYears: 20, visionRating: "HIGH" },
  NET:  { founderLed: true,  dualClass: true,  ceoTenureYears: 15, visionRating: "HIGH" },
  ZS:   { founderLed: true,  dualClass: false, ceoTenureYears: 13, visionRating: "HIGH" },
  CRM:  { founderLed: true,  dualClass: false, ceoTenureYears: 25, visionRating: "HIGH" },
  SQ:   { founderLed: true,  dualClass: true,  ceoTenureYears: 14, visionRating: "HIGH" },
  MELI: { founderLed: true,  dualClass: true,  ceoTenureYears: 25, visionRating: "HIGH" },
  LVMUY:{ founderLed: true,  dualClass: true,  ceoTenureYears: 35, visionRating: "HIGH" },
  REGN: { founderLed: true,  dualClass: true,  ceoTenureYears: 35, visionRating: "HIGH" },
  NU:   { founderLed: true,  dualClass: true,  ceoTenureYears: 9,  visionRating: "HIGH" },
};

interface CompanyDrawerProps {
  ticker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyDrawer({ ticker, open, onOpenChange }: CompanyDrawerProps) {
  const { data, isLoading } = useGetCompany(ticker || "", {
    query: { enabled: !!ticker }
  });

  const { data: metricsData } = useGetCompanyMetrics(ticker || "", { limit: 1 }, {
    query: { enabled: !!ticker }
  });

  const { data: scoreHistoryData } = useGetCompanyScoreHistory(ticker || "", {
    query: { enabled: !!ticker }
  });

  const company = data?.company;
  const scores = data?.latestScores;
  const verdict = data?.latestVerdict;
  const valuation = data?.valuation;
  const driftSignals = data?.driftSignals || [];
  const latestMetrics = metricsData?.metrics?.[0];
  const entryTimingScore = scores?.entryTimingScore;

  const entryLabel = entryTimingScore == null ? null :
    entryTimingScore >= 0.70 ? { label: "Strong Entry", color: "bg-success text-white" } :
    entryTimingScore >= 0.55 ? { label: "Moderate", color: "bg-warning/20 text-warning border-warning/30" } :
    { label: "Poor Timing", color: "bg-destructive/20 text-destructive border-destructive/30" };

  const compounderScore  = (scores as any)?.compounderScore as number | null | undefined;
  const compounderRating = (scores as any)?.compounderRating as string | null | undefined;
  const leadershipInfo   = ticker ? LEADERSHIP_LOOKUP[ticker] : undefined;

  const compounderColor =
    compounderRating === "HIGH"   ? "text-emerald-400" :
    compounderRating === "MEDIUM" ? "text-amber-400" :
    compounderRating === "LOW"    ? "text-red-400" : "text-muted-foreground";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] sm:max-w-[640px] sm:w-[640px] border-l border-border bg-card p-0 flex flex-col">
        {isLoading || !company ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 border-b border-border bg-secondary/20">
              <div className="flex justify-between items-start">
                <div>
                  <SheetTitle className="text-2xl font-bold flex items-center gap-3">
                    {company.name}
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono">
                      {company.ticker}
                    </Badge>
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {company.sector} &middot; {company.industry} &middot; {company.exchange}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 mt-5">
                <ScorePanel label="Fortress" score={scores?.fortressScore} type="fortress" />
                <ScorePanel label="Rocket" score={scores?.rocketScore} type="rocket" />
                <ScorePanel label="Wave" score={scores?.waveScore} type="wave" />

                {/* Entry timing block */}
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div className="bg-secondary/50 rounded-lg p-3 border border-border cursor-help">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Entry</div>
                      {entryTimingScore != null ? (
                        <>
                          <div className="text-lg font-mono font-bold text-foreground">
                            {entryTimingScore.toFixed(2)}
                          </div>
                          {entryLabel && (
                            <span className={`mt-1 text-[9px] px-1 py-0.5 rounded font-medium border inline-block ${entryLabel.color}`}>
                              {entryLabel.label}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px] p-0 bg-card border border-border shadow-xl rounded-xl overflow-hidden z-[9999]">
                    <div className="px-3.5 py-2.5 border-b border-border bg-secondary/50">
                      <p className="text-xs font-semibold text-foreground">Entry Timing Score</p>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Signals whether now is a favourable moment to initiate or add to a position. Combines technical momentum (RSI, price vs moving averages), sentiment shifts, and relative value versus the stock's own history. A high score means the risk/reward skew is favourable right now.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-border/50 flex gap-1.5 items-start">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0 mt-0.5">Target</span>
                        <span className="text-[10px] text-emerald-300/80 leading-snug">&gt; 0.7 = strong entry. 0.55–0.7 = moderate. &lt; 0.55 = wait for better timing.</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Compounder block */}
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div className="bg-secondary/50 rounded-lg p-3 border border-border cursor-help">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Award className="w-2.5 h-2.5" />Compounder
                      </div>
                      {compounderScore != null ? (
                        <>
                          <div className={`text-lg font-mono font-bold ${compounderColor}`}>
                            {compounderScore}
                          </div>
                          <span className={`mt-1 text-[9px] px-1 py-0.5 rounded font-medium border inline-block border-current ${compounderColor}`}>
                            {compounderRating}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px] p-0 bg-card border border-border shadow-xl rounded-xl overflow-hidden z-[9999]">
                    <div className="px-3.5 py-2.5 border-b border-border bg-secondary/50">
                      <p className="text-xs font-semibold text-foreground">Compounder Score (0–100)</p>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        A composite long-term quality score across 8 factors: Growth (17%), Profitability (13%), Capital Efficiency (13%), Cash Flow Quality (13%), Financial Strength (12%), Sentiment (12%), Momentum (13%), and Leadership conviction (7%). Identifies companies built to compound for decades.
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-border/50 flex gap-1.5 items-start">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0 mt-0.5">Target</span>
                        <span className="text-[10px] text-emerald-300/80 leading-snug">70+ = High conviction compounder. 50–69 = Medium. &lt; 50 = Not a compounder.</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Leadership badges */}
              {leadershipInfo && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {leadershipInfo.founderLed && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 font-medium">Founder-Led</span>
                  )}
                  {leadershipInfo.dualClass && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 font-medium">Dual-Class</span>
                  )}
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground font-medium">
                    CEO {leadershipInfo.ceoTenureYears}yr tenure
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${
                    leadershipInfo.visionRating === "HIGH"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  }`}>
                    Vision: {leadershipInfo.visionRating}
                  </span>
                </div>
              )}
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-6">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="w-full grid grid-cols-6 mb-6 bg-secondary/50 text-[11px]">
                    <TabsTrigger value="overview" className="text-[11px]">AI Memo</TabsTrigger>
                    <TabsTrigger value="factors" className="text-[11px]">Factors</TabsTrigger>
                    <TabsTrigger value="valuation" className="text-[11px]">Entry/Exit</TabsTrigger>
                    <TabsTrigger value="charts" className="text-[11px] flex items-center gap-1">
                      <BarChart2 className="w-3 h-3" />Charts
                    </TabsTrigger>
                    <TabsTrigger value="signals" className="text-[11px]">
                      Signals
                      {driftSignals.length > 0 && (
                        <span className="ml-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse inline-block" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="value-chain" className="text-[11px] flex items-center gap-1">
                      <Link2 className="w-3 h-3" />Story
                    </TabsTrigger>
                  </TabsList>

                  {/* ── AI Memo ── */}
                  <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
                    {/* Compounder breakdown card */}
                    {compounderScore != null && (
                      <div className="rounded-xl border border-border bg-secondary/20 p-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Award className="w-3.5 h-3.5" />Compounder Score — {compounderScore}/100
                          <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-medium border border-current ${compounderColor}`}>{compounderRating}</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                          {[
                            { label: "Growth",             w: "17%", score: scores?.growthScore },
                            { label: "Profitability",      w: "13%", score: scores?.profitabilityScore },
                            { label: "Capital Efficiency", w: "13%", score: scores?.capitalEfficiencyScore },
                            { label: "Cash Flow Quality",  w: "13%", score: scores?.cashFlowQualityScore },
                            { label: "Financial Strength", w: "12%", score: scores?.financialStrengthScore },
                            { label: "Sentiment",          w: "12%", score: scores?.sentimentScore },
                            { label: "Momentum",           w: "13%", score: scores?.momentumScore },
                            { label: "Leadership",         w: "7%",  score: undefined },
                          ].map(({ label, w, score }) => (
                            <div key={label} className="space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">{label} <span className="opacity-50">({w})</span></span>
                                <span className="font-mono text-foreground">{score != null ? score.toFixed(2) : "—"}</span>
                              </div>
                              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${score != null && score >= 0.7 ? "bg-emerald-400" : score != null && score >= 0.5 ? "bg-amber-400" : "bg-red-400"}`}
                                  style={{ width: `${score != null ? score * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {verdict ? (
                      <div className="rounded-xl border border-border bg-gradient-to-br from-secondary/50 to-background p-5 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <TrendingUp className="w-32 h-32" />
                        </div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <span className="w-2 h-6 bg-primary rounded-full block" />
                          AI Research Memo
                        </h3>
                        <div className="mb-4 flex items-center gap-3">
                          <Badge className={
                            verdict.verdict.toUpperCase() === 'BUY' ? 'bg-success text-white' :
                            verdict.verdict.toUpperCase() === 'SELL' ? 'bg-destructive text-white' :
                            'bg-warning text-warning-foreground'
                          }>
                            {verdict.verdict.toUpperCase()}
                          </Badge>
                          {verdict.classification && (
                            <span className="text-xs font-mono text-muted-foreground border border-border px-2 py-0.5 rounded">
                              {verdict.classification}
                            </span>
                          )}
                        </div>
                        <div className="prose prose-invert prose-sm max-w-none text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                          {verdict.memo}
                        </div>
                        <div className="mt-4 text-[10px] font-mono text-muted-foreground/50 text-right">
                          Generated: {new Date(verdict.date).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                        No AI memo generated yet. Run the pipeline.
                      </div>
                    )}
                  </TabsContent>

                  {/* ── 120 Factors ── */}
                  <TabsContent value="factors" className="animate-in fade-in duration-300">
                    {latestMetrics ? (
                      <FactorAccordion metrics={latestMetrics} scores={scores} />
                    ) : (
                      <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                        No factor data available. Run the pipeline first.
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Entry/Exit Intelligence ── */}
                  <TabsContent value="valuation" className="animate-in fade-in duration-300">
                    <EntryExitPanel
                      entryTimingScore={entryTimingScore ?? null}
                      momentumIndicators={(data as any)?.momentumIndicators ?? null}
                      valuation={valuation ?? null}
                    />
                  </TabsContent>

                  {/* ── Charts ── */}
                  <TabsContent value="charts" className="animate-in fade-in duration-300 space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <BarChart2 className="w-3.5 h-3.5" />Price vs Strategy Scores (3yr)
                      </h4>
                      <PriceScoreChart
                        priceHistory={data?.priceHistory ?? []}
                        scoreHistory={scoreHistoryData?.history ?? []}
                      />
                    </div>
                    <div className="border-t border-border pt-6">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                        <BarChart2 className="w-3.5 h-3.5" />Price vs Intrinsic Value
                      </h4>
                      <ValuationBandChart
                        priceHistory={data?.priceHistory ?? []}
                        marginOfSafety={data?.valuation?.marginOfSafety}
                      />
                    </div>
                  </TabsContent>

                  {/* ── Drift Signals ── */}
                  <TabsContent value="signals" className="animate-in fade-in duration-300">
                    <div className="space-y-4">
                      <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wider">Active Factor Drift & Risk</h3>
                      {driftSignals.length > 0 ? (
                        driftSignals.map((signal) => (
                          <div key={signal.id} className={`p-4 rounded-xl border flex gap-4 items-start ${
                            signal.severity === 'high'
                              ? 'border-destructive/30 bg-destructive/5'
                              : 'border-warning/20 bg-warning/5'
                          }`}>
                            <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${signal.severity === 'high' ? 'text-destructive' : 'text-warning'}`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-semibold ${signal.severity === 'high' ? 'text-destructive' : 'text-warning'}`}>
                                  {signal.factorName || signal.signalType}
                                </span>
                                <Badge variant={signal.severity === 'high' ? 'destructive' : 'secondary'} className="text-[9px] h-4">
                                  {signal.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{signal.description}</p>
                              {signal.currentValue != null && signal.historicalAvg != null && (
                                <div className="mt-3 flex gap-6 text-xs font-mono">
                                  <span><span className="text-muted-foreground">Current: </span>{signal.currentValue.toFixed(3)}</span>
                                  <span><span className="text-muted-foreground">Hist avg: </span>{signal.historicalAvg.toFixed(3)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center border border-border rounded-xl bg-secondary/20 text-muted-foreground flex flex-col items-center">
                          <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                          No concerning factor drift detected.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Value Chain Story ── */}
                  <TabsContent value="value-chain" className="animate-in fade-in duration-300">
                    {ticker && <ValueChainTab ticker={ticker} />}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const SCORE_DESCRIPTIONS: Record<string, { title: string; explanation: string; good: string }> = {
  fortress: {
    title: "Fortress Score",
    explanation: "Measures business quality and durability: profitability (30%), capital efficiency (20%), financial strength (20%), and cash flow quality (15%). Named after Warren Buffett's 'economic moat' concept. A high Fortress score means the business can sustain high returns and withstand downturns.",
    good: "> 0.7 = exceptional quality. 0.5–0.7 = solid business. < 0.5 = quality concerns.",
  },
  rocket: {
    title: "Rocket Score",
    explanation: "Identifies high-growth compounders: weights growth trajectory (35%), innovation signals (20%), profitability trends (20%), and sentiment (15%). Finds companies on a steep growth curve with sustainable unit economics — the kind that 10× in 5 years.",
    good: "> 0.7 = high-conviction growth. 0.5–0.7 = moderate growth. < 0.5 = limited growth momentum.",
  },
  wave: {
    title: "Wave Score",
    explanation: "Captures medium-term price momentum and technical trend strength: 12-month price momentum (30%), trend signals (30%), momentum quality (20%), and valuation reasonableness (20%). Rides 3–12 month price waves aligned with fundamental improvement.",
    good: "> 0.7 = strong trend. 0.5–0.7 = moderate. < 0.5 = weak or deteriorating momentum.",
  },
};

function ScorePanel({ label, score, type }: { label: string; score?: number; type: "fortress" | "rocket" | "wave" | "neutral" }) {
  const desc = SCORE_DESCRIPTIONS[type];
  const inner = (
    <div className="bg-secondary/50 rounded-lg p-3 border border-border cursor-help">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{label}</div>
      <ScoreBadge score={score} type={type} className="text-lg px-3 py-1" />
    </div>
  );

  if (!desc) return inner;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-[260px] p-0 bg-card border border-border shadow-xl rounded-xl overflow-hidden z-[9999]"
      >
        <div className="px-3.5 py-2.5 border-b border-border bg-secondary/50">
          <p className="text-xs font-semibold text-foreground">{desc.title}</p>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">{desc.explanation}</p>
          <div className="mt-2.5 pt-2 border-t border-border/50 flex gap-1.5 items-start">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0 mt-0.5">Target</span>
            <span className="text-[10px] text-emerald-300/80 leading-snug">{desc.good}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ValuationCard({
  title, value, isPercentage, isRaw, optimal, highlight,
}: {
  title: string;
  value?: number | null;
  isPercentage?: boolean;
  isRaw?: boolean;
  optimal: string;
  highlight?: boolean;
}) {
  if (value == null) return null;

  const display = isPercentage
    ? `${(value * 100).toFixed(1)}%`
    : isRaw
    ? value.toFixed(1)
    : value.toFixed(2);

  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between ${
      highlight ? 'border-primary/20 bg-primary/5' : 'border-border bg-secondary/30'
    }`}>
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className={`text-lg font-mono font-medium ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {display}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
        Target: {optimal}
      </div>
    </div>
  );
}
