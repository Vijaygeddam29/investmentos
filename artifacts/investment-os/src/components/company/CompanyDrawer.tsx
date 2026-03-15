import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetCompany, useGetCompanyMetrics, useGetCompanyScoreHistory } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertCircle, ShieldAlert, BarChart2, Award, Link2, Brain, FileText, Activity, Layers, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Info } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PriceScoreChart } from "./PriceScoreChart";
import { ValuationBandChart } from "./ValuationBandChart";
import { ValueChainTab } from "./ValueChainTab";
import { FactorAccordion } from "./FactorAccordion";

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
  const verdictData = (data as any)?.verdictData as {
    verdict: string; base: number; riskFlags: string[]; softWarnings: string[];
    rationale: { topStrength: string; topDrag: string; sentence: string };
  } | undefined;
  const familyCoverage = (data as any)?.familyCoverage as Record<string, { total: number; available: number; pct: number }> | undefined;

  const entryLabel = entryTimingScore == null ? null :
    entryTimingScore >= 0.70 ? { label: "Strong Entry", color: "bg-success text-white" } :
    entryTimingScore >= 0.55 ? { label: "Moderate", color: "bg-warning/20 text-warning border-warning/30" } :
    { label: "Poor Timing", color: "bg-destructive/20 text-destructive border-destructive/30" };

  const compounderScore     = (scores as any)?.compounderScore as number | null | undefined;
  const compounderRating    = (scores as any)?.compounderRating as string | null | undefined;
  const leadershipInfo      = ticker ? LEADERSHIP_LOOKUP[ticker] : undefined;
  const momentumIndicators  = (data as any)?.momentumIndicators as Record<string, number | boolean | null> | undefined;

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
                <Tabs defaultValue="charts" className="w-full">
                  {/* Scrollable single-row tab list */}
                  <div className="overflow-x-auto mb-6 -mx-1 px-1">
                    <TabsList className="flex w-max min-w-full bg-secondary/50 h-8 gap-0.5 p-0.5">
                      <TabsTrigger value="charts" className="text-[10px] px-2.5 h-7 flex items-center gap-1 shrink-0">
                        <BarChart2 className="w-3 h-3" />Charts
                      </TabsTrigger>
                      <TabsTrigger value="ai-report" className="text-[10px] px-2.5 h-7 flex items-center gap-1 shrink-0">
                        <FileText className="w-3 h-3 text-blue-400" />AI Report
                      </TabsTrigger>
                      <TabsTrigger value="entry-exit" className="text-[10px] px-2.5 h-7 flex items-center gap-1 shrink-0">
                        <Activity className="w-3 h-3 text-emerald-400" />Entry/Exit
                      </TabsTrigger>
                      <TabsTrigger value="factors" className="text-[10px] px-2.5 h-7 flex items-center gap-1 shrink-0">
                        <Layers className="w-3 h-3 text-amber-400" />120 Factors
                      </TabsTrigger>
                      <TabsTrigger value="signals" className="text-[10px] px-2.5 h-7 flex items-center gap-1 shrink-0">
                        <ShieldAlert className="w-3 h-3" />Signals
                        {driftSignals.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse inline-block" />
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="value-chain" className="text-[10px] px-2.5 h-7 flex items-center gap-1 shrink-0">
                        <Link2 className="w-3 h-3" />Chain
                      </TabsTrigger>
                    </TabsList>
                  </div>

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

                  {/* ── AI Report ── */}
                  <TabsContent value="ai-report" className="animate-in fade-in duration-300 space-y-4">
                    {/* Verdict banner */}
                    {verdictData ? (
                      <>
                        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
                          verdictData.verdict === "STRONG BUY" ? "border-emerald-500/30 bg-emerald-500/5" :
                          verdictData.verdict === "BUY"        ? "border-blue-500/30 bg-blue-500/5" :
                          verdictData.verdict === "HOLD"       ? "border-amber-500/30 bg-amber-500/5" :
                          verdictData.verdict === "REDUCE"     ? "border-orange-500/30 bg-orange-500/5" :
                                                                 "border-red-500/30 bg-red-500/5"
                        }`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm font-bold ${
                                verdictData.verdict === "STRONG BUY" || verdictData.verdict === "BUY" ? "text-emerald-400" :
                                verdictData.verdict === "HOLD" ? "text-amber-400" : "text-red-400"
                              }`}>{verdictData.verdict}</span>
                              <span className="text-xs text-muted-foreground font-mono">base {(verdictData.base * 100).toFixed(0)}</span>
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed">{verdictData.rationale?.sentence}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <div className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold mb-1.5">Top Strength</div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{verdictData.rationale?.topStrength || "—"}</p>
                          </div>
                          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                            <div className="text-[9px] uppercase tracking-wider text-red-400 font-semibold mb-1.5">Top Risk</div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{verdictData.rationale?.topDrag || "—"}</p>
                          </div>
                        </div>

                        {verdictData.riskFlags?.length > 0 && (
                          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-1.5">
                            <div className="text-[9px] uppercase tracking-wider text-orange-400 font-semibold mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />Risk Flags
                            </div>
                            {verdictData.riskFlags.map((flag: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="w-1 h-1 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                                <span className="text-xs text-muted-foreground">{flag}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-border bg-secondary/20 p-5 text-center">
                        <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">Verdict not available</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Quality or opportunity scores are needed to generate a verdict. Run the pipeline to populate scores.</p>
                      </div>
                    )}

                    {/* AI Memo */}
                    <div className="rounded-xl border border-border bg-secondary/10 p-4">
                      <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-violet-400" />AI Investment Memo
                        {verdict?.date && <span className="text-muted-foreground/50 font-normal normal-case">— {verdict.date}</span>}
                      </h4>
                      {verdict?.memo ? (
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{verdict.memo}</p>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-xs text-muted-foreground/60">No AI memo generated yet for {company?.name}.</p>
                          <p className="text-[10px] text-muted-foreground/40 mt-1">Memos are generated automatically during each pipeline run when sufficient financial data is available.</p>
                        </div>
                      )}
                    </div>

                    {verdictData?.softWarnings?.length > 0 && (
                      <div className="rounded-xl border border-border/50 p-3 space-y-1">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Data Caveats</div>
                        {verdictData.softWarnings.map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <Info className="w-3 h-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                            <span className="text-[10px] text-muted-foreground/70">{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Entry / Exit ── */}
                  <TabsContent value="entry-exit" className="animate-in fade-in duration-300 space-y-4">
                    {/* Entry timing score card */}
                    <div className={`rounded-xl border p-4 flex items-center gap-4 ${
                      entryTimingScore == null     ? "border-border bg-secondary/20" :
                      entryTimingScore >= 0.70     ? "border-emerald-500/30 bg-emerald-500/5" :
                      entryTimingScore >= 0.55     ? "border-amber-500/30 bg-amber-500/5" :
                                                     "border-red-500/30 bg-red-500/5"
                    }`}>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Entry Timing Score</div>
                        {entryTimingScore != null ? (
                          <>
                            <div className="text-2xl font-mono font-bold text-foreground">{(entryTimingScore * 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                            {entryLabel && <span className={`mt-1 text-[10px] px-2 py-0.5 rounded font-semibold border inline-block ${entryLabel.color}`}>{entryLabel.label}</span>}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Score not available — pipeline data required</span>
                        )}
                      </div>
                      <div className="flex-1 text-xs text-muted-foreground/70 leading-relaxed border-l border-border pl-4 ml-2">
                        Combines RSI, MACD, price vs moving averages, and valuation timing to assess whether right now is a favourable moment to initiate or add to a position.
                      </div>
                    </div>

                    {/* Technical indicators */}
                    {momentumIndicators ? (
                      <>
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Technical Setup</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: "RSI (14)", value: momentumIndicators.rsi14 != null ? `${(momentumIndicators.rsi14 as number).toFixed(1)}` : null, note: momentumIndicators.rsi14 != null ? ((momentumIndicators.rsi14 as number) > 70 ? "Overbought" : (momentumIndicators.rsi14 as number) < 30 ? "Oversold" : "Neutral") : null },
                              { label: "MACD Signal", value: momentumIndicators.macdHistogram != null ? `${(momentumIndicators.macdHistogram as number) > 0 ? "+" : ""}${(momentumIndicators.macdHistogram as number).toFixed(3)}` : null, note: momentumIndicators.macdBullish != null ? (momentumIndicators.macdBullish ? "Bullish" : "Bearish") : null },
                              { label: "MA50", value: momentumIndicators.ma50 != null ? `$${(momentumIndicators.ma50 as number).toFixed(2)}` : null, note: momentumIndicators.priceAboveMa50 != null ? (momentumIndicators.priceAboveMa50 ? "Price above" : "Price below") : null },
                              { label: "MA200", value: momentumIndicators.ma200 != null ? `$${(momentumIndicators.ma200 as number).toFixed(2)}` : null, note: momentumIndicators.goldenCross != null ? (momentumIndicators.goldenCross ? "Golden Cross ✓" : "Death Cross") : null },
                              { label: "52w Range", value: momentumIndicators.rangePosition != null ? `${((momentumIndicators.rangePosition as number) * 100).toFixed(0)}%` : null, note: "position in range" },
                              { label: "vs 52w High", value: momentumIndicators.pctFrom52wHigh != null ? `${((momentumIndicators.pctFrom52wHigh as number) * 100).toFixed(1)}%` : null, note: "from peak" },
                            ].map(({ label, value, note }) => (
                              <div key={label} className="rounded-lg border border-border bg-secondary/20 p-3">
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
                                <div className="text-sm font-mono font-semibold mt-0.5 text-foreground">{value ?? <span className="text-muted-foreground/50 text-xs font-normal">Not available</span>}</div>
                                {note && <div className="text-[9px] text-muted-foreground/60 mt-0.5">{note}</div>}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Price Returns</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: "1 Month", value: momentumIndicators.ret1m as number | null },
                              { label: "3 Months", value: momentumIndicators.ret3m as number | null },
                              { label: "6 Months", value: momentumIndicators.ret6m as number | null },
                              { label: "1 Year", value: momentumIndicators.ret1y as number | null },
                            ].map(({ label, value }) => (
                              <div key={label} className={`rounded-lg border p-3 text-center ${value == null ? "border-border bg-secondary/20" : value >= 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                                {value != null ? (
                                  <div className={`text-sm font-mono font-bold flex items-center justify-center gap-0.5 ${value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {value >= 0 ? "+" : ""}{(value * 100).toFixed(1)}%
                                  </div>
                                ) : (
                                  <Minus className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Entry guidance */}
                        <div className="rounded-xl border border-border/50 bg-secondary/10 p-4">
                          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />Entry Guidance
                          </h4>
                          <p className="text-xs text-muted-foreground/80 leading-relaxed">
                            {entryTimingScore == null
                              ? "Entry timing score not available. Run the pipeline to generate technical and fundamental timing signals."
                              : entryTimingScore >= 0.70
                              ? `Strong entry conditions — RSI and momentum signals are aligned. Consider initiating or adding to position. Combine with your position band from the Intelligence layer before sizing.`
                              : entryTimingScore >= 0.55
                              ? `Moderate entry conditions. The setup is acceptable but not ideal — consider scaling in gradually rather than a full position immediately.`
                              : `Entry timing is unfavourable. Technicals or valuation suggest waiting for a better setup before adding capital. Monitor for improvement.`}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-border bg-secondary/20 p-5 text-center">
                        <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">Technical data not available</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Price history is required to compute momentum indicators. This is populated automatically during pipeline runs.</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── 120 Factors ── */}
                  <TabsContent value="factors" className="animate-in fade-in duration-300">
                    {latestMetrics ? (
                      <FactorAccordion
                        metrics={latestMetrics}
                        scores={scores ?? undefined}
                        familyCoverage={familyCoverage}
                      />
                    ) : (
                      <div className="rounded-xl border border-border bg-secondary/20 p-5 text-center mt-2">
                        <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">Factor data not available</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Run the pipeline to compute all 120 factor scores across 9 families for this company.</p>
                      </div>
                    )}
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
