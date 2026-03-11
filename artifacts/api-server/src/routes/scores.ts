import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scoresTable, companiesTable, aiVerdictsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/scores", async (req, res) => {
  try {
    const engine = req.query.engine as string | undefined;
    const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const allScores = await db
      .select({
        ticker: scoresTable.ticker,
        name: companiesTable.name,
        sector: companiesTable.sector,
        date: scoresTable.date,
        fortressScore: scoresTable.fortressScore,
        rocketScore: scoresTable.rocketScore,
        waveScore: scoresTable.waveScore,
        profitabilityScore: scoresTable.profitabilityScore,
        growthScore: scoresTable.growthScore,
        capitalEfficiencyScore: scoresTable.capitalEfficiencyScore,
        financialStrengthScore: scoresTable.financialStrengthScore,
        cashFlowQualityScore: scoresTable.cashFlowQualityScore,
        innovationScore: scoresTable.innovationScore,
        momentumScore: scoresTable.momentumScore,
        valuationScore: scoresTable.valuationScore,
      })
      .from(scoresTable)
      .leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .orderBy(desc(scoresTable.date))
      .limit(limit)
      .offset(offset);

    let filtered = allScores;
    if (engine && minScore != null) {
      const scoreField = engine === "fortress" ? "fortressScore"
        : engine === "rocket" ? "rocketScore"
        : "waveScore";
      filtered = allScores.filter(s => (s[scoreField] ?? 0) >= minScore);
    }

    const verdicts = await db.select().from(aiVerdictsTable);
    const verdictMap = new Map(verdicts.map(v => [v.ticker, v]));

    const enriched = filtered.map(s => ({
      ticker: s.ticker,
      name: s.name ?? undefined,
      sector: s.sector ?? undefined,
      date: s.date ?? undefined,
      fortressScore: s.fortressScore ?? 0,
      rocketScore: s.rocketScore ?? 0,
      waveScore: s.waveScore ?? 0,
      profitabilityScore: s.profitabilityScore ?? undefined,
      growthScore: s.growthScore ?? undefined,
      capitalEfficiencyScore: s.capitalEfficiencyScore ?? undefined,
      financialStrengthScore: s.financialStrengthScore ?? undefined,
      cashFlowQualityScore: s.cashFlowQualityScore ?? undefined,
      innovationScore: s.innovationScore ?? undefined,
      momentumScore: s.momentumScore ?? undefined,
      valuationScore: s.valuationScore ?? undefined,
      verdict: verdictMap.get(s.ticker)?.verdict ?? undefined,
      classification: verdictMap.get(s.ticker)?.classification ?? undefined,
    }));

    res.json({
      scores: enriched,
      total: enriched.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
