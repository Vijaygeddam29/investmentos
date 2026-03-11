import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MetricSnapshot, ScoreItem } from "@workspace/api-client-react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";

interface FactorAccordionProps {
  metrics: MetricSnapshot;
  scores?: ScoreItem;
}

export function FactorAccordion({ metrics, scores }: FactorAccordionProps) {
  
  const families = [
    { id: "profitability", label: "Profitability", score: scores?.profitabilityScore, data: metrics.profitability },
    { id: "growth", label: "Growth", score: scores?.growthScore, data: metrics.growth },
    { id: "capitalEfficiency", label: "Capital Efficiency", score: scores?.capitalEfficiencyScore, data: metrics.capitalEfficiency },
    { id: "financialStrength", label: "Financial Strength", score: scores?.financialStrengthScore, data: metrics.financialStrength },
    { id: "cashFlowQuality", label: "Cash Flow Quality", score: scores?.cashFlowQualityScore, data: metrics.cashFlowQuality },
    { id: "innovation", label: "Innovation & Founder", score: scores?.innovationScore, data: metrics.innovation },
    { id: "valuation", label: "Valuation", score: scores?.valuationScore, data: metrics.valuation },
  ];

  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/Pct/i, '%')
      .replace(/To/i, 'to')
      .replace(/Vs/i, 'vs');
  };

  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {families.map((family) => {
        if (!family.data || Object.keys(family.data).length === 0) return null;
        
        return (
          <AccordionItem value={family.id} key={family.id} className="border border-border rounded-lg bg-secondary/20 px-1 overflow-hidden data-[state=open]:bg-secondary/40 transition-colors">
            <AccordionTrigger className="px-3 hover:no-underline py-3">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="font-semibold text-sm">{family.label}</span>
                <ScoreBadge score={family.score} type="neutral" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-4 pt-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2 border-t border-border/50">
                {Object.entries(family.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-1 group">
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate pr-2">
                      {formatKey(key)}
                    </span>
                    <span className="text-xs font-mono font-medium text-foreground">
                      {typeof value === 'number' ? (Math.abs(value) < 0.01 ? value.toExponential(2) : value.toFixed(2)) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
