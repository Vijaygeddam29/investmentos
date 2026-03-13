import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scoresTable, companiesTable, aiVerdictsTable, financialMetricsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/scores", async (req, res) => {
  try {
    const engine = (req.query.engine as string) ?? "fortress";
    const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Fetch all score rows ordered by date desc, then deduplicate to latest per ticker in JS.
    // Using DISTINCT ON would need raw SQL; this approach is clean and correct for typical
    // universe sizes (< 5000 tickers).
    const allRows = await db
      .select({
        ticker: scoresTable.ticker,
        name: companiesTable.name,
        sector: companiesTable.sector,
        date: scoresTable.date,
        fortressScore: scoresTable.fortressScore,
        rocketScore: scoresTable.rocketScore,
        waveScore: scoresTable.waveScore,
        entryTimingScore: scoresTable.entryTimingScore,
        profitabilityScore: scoresTable.profitabilityScore,
        growthScore: scoresTable.growthScore,
        capitalEfficiencyScore: scoresTable.capitalEfficiencyScore,
        financialStrengthScore: scoresTable.financialStrengthScore,
        cashFlowQualityScore: scoresTable.cashFlowQualityScore,
        innovationScore: scoresTable.innovationScore,
        sentimentScore: scoresTable.sentimentScore,
        momentumScore: scoresTable.momentumScore,
        valuationScore: scoresTable.valuationScore,
      })
      .from(scoresTable)
      .leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .orderBy(desc(scoresTable.date));

    // ── 1. Deduplicate: keep only the latest score row per ticker ───────────
    const seen = new Set<string>();
    const latestPerTicker = allRows.filter(row => {
      if (seen.has(row.ticker)) return false;
      seen.add(row.ticker);
      return true;
    });

    // ── 2. Apply minimum score filter if requested ──────────────────────────
    const scoreField = (engine === "rocket" ? "rocketScore"
      : engine === "wave" ? "waveScore"
      : "fortressScore") as keyof typeof scoresTable.$inferSelect;
    const afterFilter = minScore != null
      ? latestPerTicker.filter(s => ((s[scoreField] as number | null) ?? 0) >= minScore)
      : latestPerTicker;

    // ── 3. Sort by the selected engine score descending ─────────────────────
    afterFilter.sort((a, b) => ((b[scoreField] as number | null) ?? 0) - ((a[scoreField] as number | null) ?? 0));

    // ── 4. Paginate ─────────────────────────────────────────────────────────
    const paginated = afterFilter.slice(offset, offset + limit);

    // ── 5. Compute rule-based verdicts (AI verdicts are often stale HOLDs) ──
    const verdicts = await db.select().from(aiVerdictsTable);
    const verdictMap = new Map(verdicts.map(v => [v.ticker, v]));

    function computeVerdict(s: {
      fortressScore: number | null; rocketScore: number | null; waveScore: number | null;
      entryTimingScore: number | null;
    }): string {
      const f   = s.fortressScore  ?? 0;
      const r   = s.rocketScore    ?? 0;
      const w   = s.waveScore      ?? 0;
      const ent = s.entryTimingScore ?? 0.5;
      // Use the best engine score (outstanding in ONE engine is enough to qualify)
      const best = Math.max(f, r, w);
      if (best >= 0.80 && ent >= 0.55) return "STRONG BUY";
      if (best >= 0.75 && ent >= 0.45) return "BUY";
      if (best >= 0.65 && ent >= 0.35) return "ADD";
      if (best >= 0.55) return "HOLD";
      if (best >= 0.42) return "TRIM";
      return "SELL";
    }

    // ── 6. Enrich with key fundamental metrics (ROIC, revenue growth) ───────
    const metricsRows = await db
      .select({
        ticker: financialMetricsTable.ticker,
        roic: financialMetricsTable.roic,
        revenueGrowth1y: financialMetricsTable.revenueGrowth1y,
        grossMargin: financialMetricsTable.grossMargin,
        fcfYield: financialMetricsTable.fcfYield,
      })
      .from(financialMetricsTable)
      .orderBy(desc(financialMetricsTable.date));
    const metricsMap = new Map<string, typeof metricsRows[0]>();
    for (const m of metricsRows) {
      if (!metricsMap.has(m.ticker)) metricsMap.set(m.ticker, m);
    }

    const enriched = paginated.map(s => {
      const m = metricsMap.get(s.ticker);
      return {
        ticker: s.ticker,
        name: s.name ?? undefined,
        sector: s.sector ?? undefined,
        date: s.date ?? undefined,
        fortressScore: s.fortressScore ?? 0,
        rocketScore: s.rocketScore ?? 0,
        waveScore: s.waveScore ?? 0,
        entryTimingScore: s.entryTimingScore ?? undefined,
        profitabilityScore: s.profitabilityScore ?? undefined,
        growthScore: s.growthScore ?? undefined,
        capitalEfficiencyScore: s.capitalEfficiencyScore ?? undefined,
        financialStrengthScore: s.financialStrengthScore ?? undefined,
        cashFlowQualityScore: s.cashFlowQualityScore ?? undefined,
        innovationScore: s.innovationScore ?? undefined,
        sentimentScore: s.sentimentScore ?? undefined,
        momentumScore: s.momentumScore ?? undefined,
        valuationScore: s.valuationScore ?? undefined,
        // Key fundamental metrics for dashboard table display
        roic: m?.roic ?? undefined,
        revenueGrowth1y: m?.revenueGrowth1y ?? undefined,
        grossMargin: m?.grossMargin ?? undefined,
        fcfYield: m?.fcfYield ?? undefined,
        verdict: computeVerdict(s),
        classification: verdictMap.get(s.ticker)?.classification ?? undefined,
      };
    });

    res.json({
      engine,
      scores: enriched,
      total: afterFilter.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
