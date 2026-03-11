import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetCompany, useGetCompanyMetrics } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Loader2, TrendingUp, AlertCircle, ShieldAlert } from "lucide-react";
import { FactorAccordion } from "./FactorAccordion";
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

  const company = data?.company;
  const scores = data?.latestScores;
  const verdict = data?.latestVerdict;
  const valuation = data?.valuation;
  const driftSignals = data?.driftSignals || [];
  const latestMetrics = metricsData?.metrics?.[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[90vw] sm:max-w-[600px] sm:w-[600px] border-l border-border bg-card p-0 flex flex-col">
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
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fortress Score</div>
                  <ScoreBadge score={scores?.fortressScore} type="fortress" className="text-lg px-3 py-1" />
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Rocket Score</div>
                  <ScoreBadge score={scores?.rocketScore} type="rocket" className="text-lg px-3 py-1" />
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Wave Score</div>
                  <ScoreBadge score={scores?.waveScore} type="wave" className="text-lg px-3 py-1" />
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-6">
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="w-full grid grid-cols-4 mb-6 bg-secondary/50">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="factors">120 Factors</TabsTrigger>
                    <TabsTrigger value="valuation">Valuation</TabsTrigger>
                    <TabsTrigger value="signals">
                      Signals
                      {driftSignals.length > 0 && (
                        <span className="ml-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {verdict ? (
                      <div className="rounded-xl border border-border bg-gradient-to-br from-secondary/50 to-background p-5 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <TrendingUp className="w-32 h-32" />
                        </div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <span className="w-2 h-6 bg-primary rounded-full block"></span>
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
                        No AI verdict generated yet. Run the pipeline.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="factors" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {latestMetrics ? (
                      <FactorAccordion metrics={latestMetrics} scores={scores} />
                    ) : (
                      <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                        No factor data available.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="valuation" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {valuation ? (
                      <div className="grid grid-cols-2 gap-4">
                        <ValuationCard title="P/E Ratio" value={valuation.peRatio} optimal="< 25" />
                        <ValuationCard title="Forward P/E" value={valuation.forwardPe} optimal="< 20" />
                        <ValuationCard title="PEG Ratio" value={valuation.pegRatio} optimal="< 1.5" />
                        <ValuationCard title="EV / EBITDA" value={valuation.evToEbitda} optimal="< 15" />
                        <ValuationCard title="Price / FCF" value={valuation.priceToFcf} optimal="< 20" />
                        <ValuationCard title="FCF Yield" value={valuation.fcfYield} isPercentage optimal="> 4%" />
                        <div className="col-span-2 mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                          <div>
                            <div className="text-sm text-primary font-medium mb-1">Margin of Safety</div>
                            <div className="text-xs text-muted-foreground">Discount to intrinsic value</div>
                          </div>
                          <div className="text-2xl font-mono font-bold text-primary">
                            {valuation.marginOfSafety ? `${(valuation.marginOfSafety * 100).toFixed(1)}%` : '-'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground">
                        No valuation data available.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="signals" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-4">
                      <h3 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wider">Active Factor Drift</h3>
                      {driftSignals.length > 0 ? (
                        driftSignals.map((signal) => (
                          <div key={signal.id} className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex gap-4 items-start">
                            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <div className="font-medium text-destructive text-sm">{signal.signalType}</div>
                              <p className="text-sm text-muted-foreground mt-1">{signal.description}</p>
                              {signal.currentValue !== undefined && signal.historicalAvg !== undefined && (
                                <div className="mt-3 flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-muted-foreground mr-2">Current:</span>
                                    <span className="text-foreground">{signal.currentValue.toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground mr-2">Hist Avg:</span>
                                    <span className="text-foreground">{signal.historicalAvg.toFixed(2)}</span>
                                  </div>
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

function ValuationCard({ title, value, isPercentage, optimal }: { title: string, value?: number, isPercentage?: boolean, optimal: string }) {
  if (value === undefined || value === null) return null;
  const displayValue = isPercentage ? `${(value * 100).toFixed(2)}%` : value.toFixed(2);
  
  return (
    <div className="p-4 rounded-xl border border-border bg-secondary/30 flex flex-col justify-between">
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className="text-lg font-mono font-medium text-foreground">{displayValue}</div>
      <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">Optimal: {optimal}</div>
    </div>
  );
}
