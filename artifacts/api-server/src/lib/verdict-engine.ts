/**
 * Unified Verdict Engine
 *
 * Single source of truth for all verdict computation.
 * Imported by scores.ts, ai-memo.ts, and any future consumers.
 *
 * Architecture:
 *   base = companyQualityScore * 0.60 + stockOpportunityScore * 0.40
 *   gates (hard caps) applied before verdict
 *   rules evaluated top-down: STRONG BUY → BUY → ADD → HOLD → TRIM → SELL
 */

export interface VerdictInput {
  qualityScore: number;
  opportunityScore: number;
  altmanZScore?: number | null;
  interestCoverage?: number | null;
  netDebtEbitda?: number | null;
  dataCoveragePercent?: number | null;
}

export interface VerdictOutput {
  verdict: string;
  base: number;
  riskFlags: string[];
  softWarnings: string[];
}

export function computeVerdict(params: VerdictInput): VerdictOutput {
  const { qualityScore, opportunityScore } = params;
  const base = qualityScore * 0.60 + opportunityScore * 0.40;

  const riskFlags: string[] = [];
  const softWarnings: string[] = [];

  const altmanDistress = params.altmanZScore != null && params.altmanZScore < 1.81;
  const interestWeak   = params.interestCoverage != null && params.interestCoverage < 2;
  const highLeverage   = params.netDebtEbitda != null && params.netDebtEbitda > 5;
  const coverageWeak   = params.dataCoveragePercent != null && params.dataCoveragePercent < 70;

  if (altmanDistress) riskFlags.push("Altman Z-Score below 1.81 — financial distress risk");
  if (interestWeak)   riskFlags.push("Interest coverage below 2× — debt servicing risk");
  if (highLeverage)   riskFlags.push("Net Debt/EBITDA above 5× — high leverage");
  if (coverageWeak)   riskFlags.push("Data coverage below 70% — reduced confidence");

  const cappedAtHold = altmanDistress || interestWeak;
  const cappedAtAdd  = highLeverage || coverageWeak;
  const hasHardGate  = cappedAtHold || cappedAtAdd;

  const isTrimCondition =
    qualityScore >= 0.65 && opportunityScore <= 0.35;

  if (cappedAtHold && base < 0.50) {
    return { verdict: "SELL", base, riskFlags, softWarnings };
  }
  if (base < 0.40) {
    return { verdict: "SELL", base, riskFlags, softWarnings };
  }

  if (isTrimCondition) {
    if (cappedAtHold) return { verdict: "HOLD", base, riskFlags, softWarnings };
    return { verdict: "TRIM", base, riskFlags, softWarnings };
  }

  if (!cappedAtHold && !cappedAtAdd &&
      base >= 0.78 && qualityScore >= 0.72 && opportunityScore >= 0.65) {
    return { verdict: "STRONG BUY", base, riskFlags, softWarnings };
  }

  if (!cappedAtHold && base >= 0.70 && qualityScore >= 0.62 && opportunityScore >= 0.52) {
    if (cappedAtAdd) return { verdict: "ADD", base, riskFlags, softWarnings };
    return { verdict: "BUY", base, riskFlags, softWarnings };
  }

  const isAddCondition =
    base >= 0.60 ||
    (qualityScore >= 0.70 && opportunityScore >= 0.35 && opportunityScore < 0.52);

  if (isAddCondition) {
    if (cappedAtHold) return { verdict: "HOLD", base, riskFlags, softWarnings };
    if (cappedAtAdd)  return { verdict: "ADD",  base, riskFlags, softWarnings };
    return { verdict: "ADD", base, riskFlags, softWarnings };
  }

  if (base >= 0.50 || cappedAtHold) {
    return { verdict: "HOLD", base, riskFlags, softWarnings };
  }

  if (base >= 0.40) {
    return { verdict: "TRIM", base, riskFlags, softWarnings };
  }

  return { verdict: "SELL", base, riskFlags, softWarnings };
}

/**
 * Compute Company Quality Score from family sub-scores.
 * Weights: Profitability 30%, Growth 20%, Balance Sheet 20%, Cash Flow 20%, CapEfficiency 10%
 */
export function computeCompanyQualityScore(subScores: {
  profitability: number;
  growth: number;
  financialStrength: number;
  cashFlowQuality: number;
  capitalEfficiency: number;
}): number {
  return (
    subScores.profitability    * 0.30 +
    subScores.growth           * 0.20 +
    subScores.financialStrength * 0.20 +
    subScores.cashFlowQuality  * 0.20 +
    subScores.capitalEfficiency * 0.10
  );
}

/**
 * Compute Stock Opportunity Score from market-facing sub-scores.
 * Weights: Valuation 40%, Momentum 35%, Sentiment 25%
 * When sentimentScore is null (phantom/unavailable): Valuation 55%, Momentum 45%
 */
export function computeStockOpportunityScore(subScores: {
  valuation: number;
  momentum: number;
  sentiment: number | null;
}): number {
  if (subScores.sentiment == null) {
    return subScores.valuation * 0.55 + subScores.momentum * 0.45;
  }
  return (
    subScores.valuation  * 0.40 +
    subScores.momentum   * 0.35 +
    subScores.sentiment  * 0.25
  );
}

/**
 * Compute data coverage percentage for a set of metric values.
 * Returns a 0–100 value representing how many expected signals are non-null.
 */
export function computeDataCoverage(metrics: Record<string, unknown>): number {
  const values = Object.values(metrics);
  if (!values.length) return 0;
  const nonNull = values.filter(v => v != null && !Number.isNaN(v)).length;
  return Math.round((nonNull / values.length) * 100);
}

/**
 * Determine score confidence level from harvest path and coverage.
 * - High:   FMP primary, ≥ 80% coverage, no major proxy substitutions
 * - Medium: FMP + YF patch, 60–79% coverage, or some proxy use
 * - Low:    YF-only, < 60% coverage, or missing balance sheet depth
 */
export function computeConfidenceLevel(
  coveragePercent: number,
  isYfOnly: boolean,
): "High" | "Medium" | "Low" {
  if (isYfOnly) return coveragePercent >= 75 ? "Medium" : "Low";
  if (coveragePercent >= 80) return "High";
  if (coveragePercent >= 60) return "Medium";
  return "Low";
}

/**
 * Generate a plain-English rationale sentence for the verdict.
 * Used in the verdict rationale card above the factor accordion.
 */
export function generateVerdictRationale(params: {
  verdict: string;
  qualityScore: number;
  opportunityScore: number;
  base: number;
  familyScores: Record<string, number | null | undefined>;
  riskFlags: string[];
}): {
  topStrength: string;
  topDrag: string;
  sentence: string;
} {
  const { verdict, qualityScore, opportunityScore, riskFlags, familyScores } = params;

  const labelMap: Record<string, string> = {
    profitabilityScore:     "Profitability",
    growthScore:            "Growth",
    capitalEfficiencyScore: "Capital Efficiency",
    financialStrengthScore: "Financial Strength",
    cashFlowQualityScore:   "Cash Flow Quality",
    innovationScore:        "R&D & Innovation",
    momentumScore:          "Momentum",
    valuationScore:         "Valuation",
    sentimentScore:         "Market Signals",
  };

  const entries = Object.entries(familyScores)
    .filter(([, v]) => v != null)
    .map(([k, v]) => ({ key: labelMap[k] ?? k, score: v as number }))
    .sort((a, b) => b.score - a.score);

  const topStrength = entries[0]?.key ?? "Fundamentals";
  const topDrag     = entries[entries.length - 1]?.key ?? "Entry timing";

  const qualityLabel =
    qualityScore >= 0.72 ? "exceptional" :
    qualityScore >= 0.62 ? "solid" :
    qualityScore >= 0.50 ? "average" : "weak";

  const opportunityLabel =
    opportunityScore >= 0.65 ? "attractive entry" :
    opportunityScore >= 0.52 ? "moderate setup" :
    opportunityScore >= 0.35 ? "neutral setup" : "stretched / poor entry";

  let sentence = "";
  if (riskFlags.length > 0) {
    sentence = `Risk flag active: ${riskFlags[0].split("—")[0].trim()} caps this verdict at ${verdict}.`;
  } else {
    switch (verdict) {
      case "STRONG BUY":
        sentence = `${qualityLabel.charAt(0).toUpperCase() + qualityLabel.slice(1)} business quality with ${opportunityLabel} — strongest conviction setup.`;
        break;
      case "BUY":
        sentence = `${qualityLabel.charAt(0).toUpperCase() + qualityLabel.slice(1)} business quality and ${opportunityLabel}. Good risk/reward now.`;
        break;
      case "ADD":
        sentence = `${qualityLabel.charAt(0).toUpperCase() + qualityLabel.slice(1)} business quality with ${opportunityLabel}. Consider adding on weakness.`;
        break;
      case "HOLD":
        sentence = `Business quality is ${qualityLabel}. Entry conditions are ${opportunityLabel}. Hold current position.`;
        break;
      case "TRIM":
        sentence = `Strong business quality but ${opportunityLabel} — consider trimming into strength.`;
        break;
      case "SELL":
        sentence = `Weak overall setup. ${topDrag} is the primary drag.`;
        break;
      default:
        sentence = `${topStrength} is the strongest signal. ${topDrag} is the key drag.`;
    }
  }

  return { topStrength, topDrag, sentence };
}
