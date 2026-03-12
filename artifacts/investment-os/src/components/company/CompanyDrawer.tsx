import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetCompany, useGetCompanyMetrics, useGetCompanyScoreHistory } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TrendingUp, AlertCircle, ShieldAlert, Target, BarChart2 } from "lucide-react";
import { FactorAccordion } from "./FactorAccordion";
import { PriceScoreChart } from "./PriceScoreChart";
import { ValuationBandChart } from "./ValuationBandChart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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

              <div className="grid grid-cols-4 gap-3 mt-5">
                <ScorePanel label="Fortress" score={scores?.fortressScore} type="fortress" />
                <ScorePanel label="Rocket" score={scores?.rocketScore} type="rocket" />
                <ScorePanel label="Wave" score={scores?.waveScore} type="wave" />
                <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Entry Timing</div>
                  {entryTimingScore != null ? (
                    <>
                      <div className="text-xl font-mono font-bold text-foreground">
                        {entryTimingScore.toFixed(2)}
                      </div>
                      {entryLabel && (
                        <span className={`mt-1 text-[9px] px-1.5 py-0.5 rounded font-medium border inline-block ${entryLabel.color}`}>
                          {entryLabel.label}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-6">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="w-full grid grid-cols-5 mb-6 bg-secondary/50">
                    <TabsTrigger value="overview">AI Memo</TabsTrigger>
                    <TabsTrigger value="factors">120 Factors</TabsTrigger>
                    <TabsTrigger value="valuation">Entry/Exit</TabsTrigger>
                    <TabsTrigger value="charts" className="flex items-center gap-1">
                      <BarChart2 className="w-3 h-3" />Charts
                    </TabsTrigger>
                    <TabsTrigger value="signals">
                      Signals
                      {driftSignals.length > 0 && (
                        <span className="ml-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse inline-block" />
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* ── AI Memo ── */}
                  <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
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

                  {/* ── Entry/Exit Signals ── */}
                  <TabsContent value="valuation" className="animate-in fade-in duration-300">
                    {valuation ? (
                      <div className="space-y-6">
                        {/* Entry timing banner */}
                        {entryTimingScore != null && (
                          <div className={`p-4 rounded-xl border flex items-center justify-between
                            ${entryTimingScore >= 0.70 ? 'border-success/30 bg-success/5' :
                              entryTimingScore >= 0.55 ? 'border-warning/30 bg-warning/5' :
                              'border-destructive/30 bg-destructive/5'}`}>
                            <div className="flex items-center gap-3">
                              <Target className={`w-5 h-5 ${
                                entryTimingScore >= 0.70 ? 'text-success' :
                                entryTimingScore >= 0.55 ? 'text-warning' : 'text-destructive'
                              }`} />
                              <div>
                                <div className="text-sm font-semibold">Entry Timing Score</div>
                                <div className="text-xs text-muted-foreground">Valuation + Momentum + Earnings Revision</div>
                              </div>
                            </div>
                            <div className="text-2xl font-mono font-bold">{entryTimingScore.toFixed(2)}</div>
                          </div>
                        )}

                        {/* DCF & intrinsic value signals */}
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Intrinsic Value Signals</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <ValuationCard title="Margin of Safety" value={valuation.marginOfSafety} isPercentage optimal="> 20%" highlight />
                            <ValuationCard title="DCF Discount" value={valuation.dcfDiscount} isPercentage optimal="> 0%" highlight />
                            <ValuationCard title="Rule of 40" value={valuation.ruleOf40} optimal="> 40" isRaw />
                            <ValuationCard title="Shareholder Yield" value={valuation.shareholderYield} isPercentage optimal="> 3%" />
                          </div>
                        </div>

                        {/* Relative valuation */}
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Relative Valuation Multiples</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <ValuationCard title="P/E Ratio" value={valuation.peRatio} optimal="< 25" />
                            <ValuationCard title="Forward P/E" value={valuation.forwardPe} optimal="< 20" />
                            <ValuationCard title="PEG Ratio" value={valuation.pegRatio} optimal="< 1.5" />
                            <ValuationCard title="EV / EBITDA" value={valuation.evToEbitda} optimal="< 15" />
                            <ValuationCard title="EV / Sales" value={valuation.evToSales} optimal="< 5" />
                            <ValuationCard title="Price / FCF" value={valuation.priceToFcf} optimal="< 20" />
                            <ValuationCard title="Price / Book" value={valuation.priceToBook} optimal="< 5" />
                            <ValuationCard title="FCF Yield" value={valuation.fcfYield} isPercentage optimal="> 4%" />
                          </div>
                        </div>

                        {/* Peer-relative valuation */}
                        {(valuation.peVsPeerMedian != null || valuation.pePeerMedian != null) && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">P/E vs Peers</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {valuation.peVsPeerMedian != null && (
                                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                                  <div className="text-[10px] text-muted-foreground mb-1">P/E vs Peer Median</div>
                                  <div className={`text-sm font-bold font-mono ${valuation.peVsPeerMedian > 1.2 ? "text-amber-400" : valuation.peVsPeerMedian < 0.85 ? "text-emerald-400" : "text-foreground"}`}>
                                    {(valuation.peVsPeerMedian * 100).toFixed(0)}%
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {valuation.peVsPeerMedian > 1.2 ? "Premium to peers" : valuation.peVsPeerMedian < 0.85 ? "Discount to peers ✓" : "In-line with peers"}
                                  </div>
                                </div>
                              )}
                              {valuation.pePeerMedian != null && (
                                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                                  <div className="text-[10px] text-muted-foreground mb-1">Peer Median P/E</div>
                                  <div className="text-sm font-bold font-mono">
                                    {valuation.pePeerMedian.toFixed(1)}x
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">Sector benchmark</div>
                                </div>
                              )}
                              {valuation.evEbitdaPeerMedian != null && (
                                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                                  <div className="text-[10px] text-muted-foreground mb-1">Peer Median EV/EBITDA</div>
                                  <div className="text-sm font-bold font-mono">
                                    {valuation.evEbitdaPeerMedian.toFixed(1)}x
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5">Sector benchmark</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                        No valuation data available. Run the pipeline first.
                      </div>
                    )}
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
