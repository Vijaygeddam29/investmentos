import { db } from "@workspace/db";
import { aiVerdictsTable, scoresTable, financialMetricsTable, driftSignalsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import OpenAI from "openai";
import { computeVerdict } from "./verdict-engine";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
});

/** Cap ROIC at 100% for display/prompt — raw value preserved in DB */
function displayROIC(roic: number | null | undefined): string {
  if (roic == null) return "N/A";
  const capped = Math.min(roic, 1.0);
  const pct = (capped * 100).toFixed(1) + "%";
  return roic > 1.0 ? `${pct} (capped — accounting distortion in raw data)` : pct;
}

export async function generateAiMemo(ticker: string) {
  const scores = await db.select().from(scoresTable)
    .where(eq(scoresTable.ticker, ticker))
    .orderBy(desc(scoresTable.date))
    .limit(1);

  const metrics = await db.select().from(financialMetricsTable)
    .where(eq(financialMetricsTable.ticker, ticker))
    .orderBy(desc(financialMetricsTable.date))
    .limit(1);

  const signals = await db.select().from(driftSignalsTable)
    .where(eq(driftSignalsTable.ticker, ticker))
    .orderBy(desc(driftSignalsTable.date))
    .limit(10);

  const s = scores[0];
  const m = metrics[0];

  const signalsSummary = signals.length
    ? signals.map(sig => `- ${sig.description} (${sig.severity})`).join("\n")
    : "No active drift signals.";

  const qualityScore    = (s as any)?.companyQualityScore ?? null;
  const opportunityScore = (s as any)?.stockOpportunityScore ?? null;

  const prompt = `You are an institutional investment analyst at a top-tier hedge fund.

Company: ${ticker}

ENGINE SCORES (0-1 scale):
- Fortress Score: ${s?.fortressScore?.toFixed(2) || "N/A"} (long-term compounder quality)
- Rocket Score: ${s?.rocketScore?.toFixed(2) || "N/A"} (high-growth innovator)
- Wave Score: ${s?.waveScore?.toFixed(2) || "N/A"} (tactical momentum)

TWO-SCORE FRAMEWORK:
- Company Quality Score: ${qualityScore != null ? qualityScore.toFixed(2) : "N/A"} (how good is this business?)
- Stock Opportunity Score: ${opportunityScore != null ? opportunityScore.toFixed(2) : "N/A"} (is this a good entry now?)

FACTOR SCORES:
- Profitability: ${s?.profitabilityScore?.toFixed(2) || "N/A"}
- Growth: ${s?.growthScore?.toFixed(2) || "N/A"}
- Capital Efficiency: ${s?.capitalEfficiencyScore?.toFixed(2) || "N/A"}
- Financial Strength: ${s?.financialStrengthScore?.toFixed(2) || "N/A"}
- Cash Flow Quality: ${s?.cashFlowQualityScore?.toFixed(2) || "N/A"}
- R&D & Innovation: ${s?.innovationScore?.toFixed(2) || "N/A"}
- Market Momentum: ${s?.momentumScore?.toFixed(2) || "N/A"}
- Valuation: ${s?.valuationScore?.toFixed(2) || "N/A"}
- Market Signals: ${s?.sentimentScore != null ? s.sentimentScore.toFixed(2) : "Unavailable (no insider/analyst data)"}

KEY METRICS:
- Revenue: ${m?.revenue ? "$" + (m.revenue / 1e9).toFixed(2) + "B" : "N/A"}
- ROIC: ${displayROIC(m?.roic)}
- Gross Margin: ${m?.grossMargin ? (m.grossMargin * 100).toFixed(1) + "%" : "N/A"}
- Operating Margin: ${m?.operatingMargin ? (m.operatingMargin * 100).toFixed(1) + "%" : "N/A"}
- D/E Ratio: ${m?.debtToEquity?.toFixed(2) || "N/A"}
- P/E Ratio: ${m?.peRatio?.toFixed(1) || "N/A"}
- EV/EBITDA: ${m?.evToEbitda?.toFixed(1) || "N/A"}
- FCF Yield: ${m?.fcfYield ? (m.fcfYield * 100).toFixed(1) + "%" : "N/A"}
- Revenue Growth: ${m?.revenueGrowth1y ? (m.revenueGrowth1y * 100).toFixed(1) + "%" : "N/A"}

DRIFT SIGNALS:
${signalsSummary}

Write a concise investment research memo covering:
1. BUSINESS QUALITY — What is the economic moat and competitive position?
2. GROWTH POTENTIAL — What are the growth drivers and trajectory?
3. RISK FACTORS — What could go wrong? Include drift signal analysis.
4. ENTRY/EXIT TIMING — Based on valuation and momentum, is this a good entry point?
5. FINAL VERDICT — Strong Buy, Buy, Add, Hold, Trim, or Sell with conviction level (High/Medium/Low)
6. CLASSIFICATION — Classify as: FORTRESS, ROCKET, WAVE, or HYBRID (e.g., "FORTRESS + ROCKET")

Be specific and data-driven. Reference the actual numbers.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
    });

    const memo = response.choices[0]?.message?.content || "Unable to generate memo.";

    const verdictMatch = memo.match(/(?:verdict|recommendation)[:\s]*\**\s*(strong buy|buy|add|hold|trim|sell)\s*\**/i);
    const verdictRaw = verdictMatch ? verdictMatch[1].toUpperCase() : null;
    const verdict = verdictRaw || determineFallbackVerdict(s, m);

    const classMatch = memo.match(/(?:classification|classify)[:\s]*\**(FORTRESS|ROCKET|WAVE|HYBRID[\w\s+]*)\**/i);
    const classification = classMatch ? classMatch[1].trim() : determineClassification(s);

    const today = new Date().toISOString().split("T")[0];

    await db.delete(aiVerdictsTable).where(eq(aiVerdictsTable.ticker, ticker));
    await db.insert(aiVerdictsTable).values({ ticker, date: today, verdict, classification, memo });

    return { ticker, date: today, verdict, classification, memo };
  } catch (error: any) {
    const fallbackMemo = generateFallbackMemo(ticker, s, m, signals);
    const today = new Date().toISOString().split("T")[0];
    const verdict = determineFallbackVerdict(s, m);
    const classification = determineClassification(s);

    await db.delete(aiVerdictsTable).where(eq(aiVerdictsTable.ticker, ticker));
    await db.insert(aiVerdictsTable).values({ ticker, date: today, verdict, classification, memo: fallbackMemo });

    return { ticker, date: today, verdict, classification, memo: fallbackMemo };
  }
}

function determineClassification(s: any): string {
  if (!s) return "UNSCORED";
  const types: string[] = [];
  if (s.fortressScore > 0.7) types.push("FORTRESS");
  if (s.rocketScore > 0.65) types.push("ROCKET");
  if (s.waveScore > 0.6) types.push("WAVE");
  return types.length ? types.join(" + ") : "UNCLASSIFIED";
}

function determineFallbackVerdict(s: any, m?: any): string {
  if (!s) return "HOLD";
  const qualityScore    = (s as any)?.companyQualityScore;
  const opportunityScore = (s as any)?.stockOpportunityScore;

  if (qualityScore != null && opportunityScore != null) {
    const result = computeVerdict({
      qualityScore,
      opportunityScore,
      altmanZScore:    m?.altmanZScore,
      interestCoverage: m?.interestCoverage,
      netDebtEbitda:   m?.netDebtEbitda,
    });
    return result.verdict;
  }

  const avgScore = ((s.fortressScore || 0) + (s.rocketScore || 0) + (s.waveScore || 0)) / 3;
  if (avgScore > 0.7) return "BUY";
  if (avgScore < 0.35) return "SELL";
  return "HOLD";
}

function generateFallbackMemo(ticker: string, s: any, m: any, signals: any[]): string {
  const parts = [`# Investment Memo: ${ticker}\n`];

  parts.push(`## Business Quality`);
  if (m?.roic) parts.push(`ROIC of ${displayROIC(m.roic)} ${Math.min(m.roic, 1.0) > 0.15 ? "indicates strong capital allocation" : "is moderate"}.`);
  if (m?.grossMargin) parts.push(`Gross margin of ${(m.grossMargin * 100).toFixed(1)}%.`);

  parts.push(`\n## Growth Potential`);
  if (m?.revenueGrowth1y) parts.push(`Revenue growth of ${(m.revenueGrowth1y * 100).toFixed(1)}% YoY.`);
  if (m?.revenueGrowth3y) parts.push(`3-year revenue CAGR of ${(m.revenueGrowth3y * 100).toFixed(1)}%.`);

  parts.push(`\n## Risk Factors`);
  if (signals.length) {
    signals.forEach(sig => parts.push(`- ${sig.description}`));
  } else {
    parts.push("No active risk signals detected.");
  }

  parts.push(`\n## Valuation`);
  if (m?.peRatio) parts.push(`P/E ratio: ${m.peRatio.toFixed(1)}`);
  if (m?.evToEbitda) parts.push(`EV/EBITDA: ${m.evToEbitda.toFixed(1)}`);
  if (m?.fcfYield) parts.push(`FCF Yield: ${(m.fcfYield * 100).toFixed(1)}%`);

  const verdict = determineFallbackVerdict(s, m);
  const classification = determineClassification(s);
  parts.push(`\n## Final Verdict: ${verdict}`);
  parts.push(`## Classification: ${classification}`);

  return parts.join("\n");
}
