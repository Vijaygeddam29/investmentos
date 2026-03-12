import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MetricSnapshot, ScoreItem } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { getMetricInfo } from "@/lib/metrics-glossary";
import { HelpCircle } from "lucide-react";

interface FactorAccordionProps {
  metrics: MetricSnapshot;
  scores?: ScoreItem;
}

export function FactorAccordion({ metrics, scores }: FactorAccordionProps) {
  const families = [
    {
      id: "profitability",
      label: "Profitability",
      score: scores?.profitabilityScore,
      description: "ROIC, ROE, ROA, all margin types, employee productivity",
      data: metrics.profitability,
    },
    {
      id: "growth",
      label: "Growth",
      score: scores?.growthScore,
      description: "Revenue, EPS, FCF growth across 1/3/5 year horizons, margin trends",
      data: metrics.growth,
    },
    {
      id: "capitalEfficiency",
      label: "Capital Efficiency",
      score: scores?.capitalEfficiencyScore,
      description: "Asset & inventory turnover, CapEx discipline, shareholder yield",
      data: metrics.capitalEfficiency,
    },
    {
      id: "financialStrength",
      label: "Financial Strength",
      score: scores?.financialStrengthScore,
      description: "Leverage, liquidity, interest coverage, Altman Z-Score",
      data: metrics.financialStrength,
    },
    {
      id: "cashFlowQuality",
      label: "Cash Flow Quality",
      score: scores?.cashFlowQualityScore,
      description: "FCF conversion, accruals, earnings quality, working capital",
      data: metrics.cashFlowQuality,
    },
    {
      id: "innovation",
      label: "Innovation & Founder Signals",
      score: scores?.innovationScore,
      description: "R&D intensity, insider ownership, institutional conviction",
      data: metrics.innovation,
    },
    {
      id: "momentum",
      label: "Market Momentum",
      score: scores?.momentumScore,
      description: "RSI, moving averages, 52-week range, price returns, volume trend",
      data: metrics.momentum,
    },
    {
      id: "valuation",
      label: "Valuation",
      score: scores?.valuationScore,
      description: "P/E, PEG, EV multiples, FCF yield, Rule of 40, Margin of Safety, P/E vs peers",
      data: metrics.valuation,
    },
    {
      id: "sentiment",
      label: "Sentiment",
      score: scores?.sentimentScore,
      description: "Insider conviction, institutional ownership, earnings surprises, analyst revisions, P/E vs peers",
      data: metrics.sentiment,
    },
  ];

  const formatKey = (key: string) =>
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, s => s.toUpperCase())
      .replace(/\bPct\b/gi, "%")
      .replace(/\bTo\b/gi, "to")
      .replace(/\bVs\b/gi, "vs")
      .replace(/\b1y\b/gi, "1Y")
      .replace(/\b3y\b/gi, "3Y")
      .replace(/\b5y\b/gi, "5Y")
      .replace(/\bFcf\b/gi, "FCF")
      .replace(/\bEps\b/gi, "EPS")
      .replace(/\bRsi\b/gi, "RSI")
      .replace(/\bMa(\d+)\b/gi, "MA$1")
      .replace(/\bRd\b/gi, "R&D")
      .trim();

  const formatValue = (key: string, value: any): string => {
    if (value == null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes ✓" : "No ✗";
    if (typeof value !== "number") return String(value);

    const pctKeys = [
      "grossMargin", "operatingMargin", "netMargin", "ebitMargin", "ebitdaMargin", "fcfMargin",
      "roic", "roe", "roa", "revenueGrowth1y", "revenueGrowth3y", "revenueGrowth5y",
      "epsGrowth1y", "epsGrowth3y", "epsGrowth5y", "fcfGrowth", "operatingIncomeGrowth",
      "grossMarginTrend", "operatingMarginTrend", "dividendYield", "fcfYield", "shareholderYield",
      "capexToRevenue", "rdToRevenue", "taxEfficiency", "accrualRatio", "stockBasedCompPct",
      "receivablesGrowthVsRevenue", "inventoryGrowthVsRevenue", "deferredRevenueGrowth",
      "workingCapitalDrift", "operatingCfToRevenue", "marginOfSafety", "dcfDiscount",
      "intrinsicValueGap", "insiderOwnership", "institutionalOwnership", "reinvestmentRate",
      "ret1m", "ret3m", "ret6m", "ret1y", "pctFrom52wHigh", "rangePosition",
    ];
    if (pctKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      return `${(value * 100).toFixed(1)}%`;
    }

    const largeKeys = ["freeCashFlow", "rdExpense", "currentPrice", "high52w", "low52w", "ma10", "ma20", "ma50", "ma200", "employeeProductivity"];
    if (largeKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      return Math.abs(value) > 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : value.toFixed(2);
    }

    return Math.abs(value) < 0.001 ? value.toExponential(2) : value.toFixed(2);
  };

  const getScoreColor = (score?: number | null) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 0.7) return "text-emerald-400";
    if (score >= 0.5) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-4 px-1">
        120+ factors across 9 families. Hover any metric name to learn what it means.
      </p>
      <Accordion type="multiple" className="w-full space-y-2">
        {families.map((family) => {
          const entries = family.data
            ? Object.entries(family.data).filter(([, v]) => v != null)
            : [];

          return (
            <AccordionItem
              value={family.id}
              key={family.id}
              className="border border-border rounded-lg bg-secondary/20 px-1 overflow-hidden data-[state=open]:bg-secondary/40 transition-colors"
            >
              <AccordionTrigger className="px-3 hover:no-underline py-3">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="text-left">
                    <div className="font-semibold text-sm">{family.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{family.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-mono font-bold ${getScoreColor(family.score)}`}>
                      {family.score != null ? family.score.toFixed(2) : "—"}
                    </span>
                    <ScoreBadge score={family.score} type="neutral" />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-4 pt-1">
                {entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No data available for this period.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-3 border-t border-border/50">
                    {entries.map(([key, value]) => {
                      const info = getMetricInfo(key);
                      return (
                        <div key={key} className="flex justify-between items-center py-1 group border-b border-border/20 last:border-0">
                          {info ? (
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate pr-2 max-w-[55%] cursor-help underline decoration-dotted underline-offset-2">
                                  {formatKey(key)}
                                  <HelpCircle className="w-2.5 h-2.5 shrink-0 opacity-50" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="left"
                                align="start"
                                className="max-w-[280px] p-0 bg-card border border-border shadow-xl rounded-xl overflow-hidden z-[9999]"
                              >
                                <div className="px-3.5 py-2.5 border-b border-border bg-secondary/50">
                                  <p className="text-xs font-semibold text-foreground">{info.label}</p>
                                  {info.category && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{info.category}</p>
                                  )}
                                </div>
                                <div className="px-3.5 py-2.5">
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {info.explanation}
                                  </p>
                                  <div className="mt-2.5 pt-2 border-t border-border/50 flex gap-1.5 items-start">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0 mt-0.5">
                                      Target
                                    </span>
                                    <span className="text-[10px] text-emerald-300/80 leading-snug">
                                      {info.good}
                                    </span>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate pr-2 max-w-[55%]">
                              {formatKey(key)}
                            </span>
                          )}
                          <span className="text-[11px] font-mono font-medium text-foreground">
                            {formatValue(key, value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
