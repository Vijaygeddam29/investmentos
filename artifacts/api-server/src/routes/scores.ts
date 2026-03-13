import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scoresTable, companiesTable, aiVerdictsTable, financialMetricsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { detectMarketRegime, computeCompositeScore } from "../lib/market-regime";
import { compounderRating } from "../lib/scoring-engines";

const router: IRouter = Router();

// ─── GET /api/market/regime ──────────────────────────────────────────────────
router.get("/market/regime", async (_req, res) => {
  try {
    const regime = await detectMarketRegime();
    res.json(regime);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/scores ─────────────────────────────────────────────────────────
router.get("/scores", async (req, res) => {
  try {
    const engine   = (req.query.engine as string) ?? "fortress";
    const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
    const limit    = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
    const offset   = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const allRows = await db
      .select({
        ticker:                 scoresTable.ticker,
        name:                   companiesTable.name,
        sector:                 companiesTable.sector,
        date:                   scoresTable.date,
        fortressScore:          scoresTable.fortressScore,
        rocketScore:            scoresTable.rocketScore,
        waveScore:              scoresTable.waveScore,
        entryTimingScore:       scoresTable.entryTimingScore,
        profitabilityScore:     scoresTable.profitabilityScore,
        growthScore:            scoresTable.growthScore,
        capitalEfficiencyScore: scoresTable.capitalEfficiencyScore,
        financialStrengthScore: scoresTable.financialStrengthScore,
        cashFlowQualityScore:   scoresTable.cashFlowQualityScore,
        innovationScore:        scoresTable.innovationScore,
        sentimentScore:         scoresTable.sentimentScore,
        momentumScore:          scoresTable.momentumScore,
        valuationScore:         scoresTable.valuationScore,
        compounderScore:        scoresTable.compounderScore,
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

    // ── 5. Detect current market regime (cached, lightweight) ───────────────
    const regimeResult = await detectMarketRegime();
    const { regime, weights: regimeWeights } = regimeResult;

    // ── 6. Compute verdicts with regime-aware composite score ───────────────
    const verdicts = await db.select().from(aiVerdictsTable);
    const verdictMap = new Map(verdicts.map(v => [v.ticker, v]));

    function computeVerdict(s: {
      fortressScore: number | null; rocketScore: number | null; waveScore: number | null;
      entryTimingScore: number | null;
    }): string {
      const f   = s.fortressScore   ?? 0;
      const r   = s.rocketScore     ?? 0;
      const w   = s.waveScore       ?? 0;
      const ent = s.entryTimingScore ?? 0.5;
      // Regime-weighted composite score
      const composite = computeCompositeScore(f, r, w, regimeWeights);
      // Best engine score (strong in one engine still qualifies)
      const best = Math.max(f, r, w);
      const primary = (composite * 0.6) + (best * 0.4);
      if (primary >= 0.78 && ent >= 0.55) return "STRONG BUY";
      if (primary >= 0.72 && ent >= 0.45) return "BUY";
      if (primary >= 0.62 && ent >= 0.35) return "ADD";
      if (primary >= 0.52) return "HOLD";
      if (primary >= 0.40) return "TRIM";
      return "SELL";
    }

    // ── 7. Enrich with key fundamental metrics ───────────────────────────────
    const metricsRows = await db
      .select({
        ticker:         financialMetricsTable.ticker,
        roic:           financialMetricsTable.roic,
        revenueGrowth1y: financialMetricsTable.revenueGrowth1y,
        grossMargin:    financialMetricsTable.grossMargin,
        fcfYield:       financialMetricsTable.fcfYield,
      })
      .from(financialMetricsTable)
      .orderBy(desc(financialMetricsTable.date));
    const metricsMap = new Map<string, typeof metricsRows[0]>();
    for (const m of metricsRows) {
      if (!metricsMap.has(m.ticker)) metricsMap.set(m.ticker, m);
    }

    const enriched = paginated.map(s => {
      const m = metricsMap.get(s.ticker);
      const cs = s.compounderScore ?? null;
      return {
        ticker:                 s.ticker,
        name:                   s.name ?? undefined,
        sector:                 s.sector ?? undefined,
        date:                   s.date ?? undefined,
        fortressScore:          s.fortressScore ?? 0,
        rocketScore:            s.rocketScore ?? 0,
        waveScore:              s.waveScore ?? 0,
        entryTimingScore:       s.entryTimingScore ?? undefined,
        profitabilityScore:     s.profitabilityScore ?? undefined,
        growthScore:            s.growthScore ?? undefined,
        capitalEfficiencyScore: s.capitalEfficiencyScore ?? undefined,
        financialStrengthScore: s.financialStrengthScore ?? undefined,
        cashFlowQualityScore:   s.cashFlowQualityScore ?? undefined,
        innovationScore:        s.innovationScore ?? undefined,
        sentimentScore:         s.sentimentScore ?? undefined,
        momentumScore:          s.momentumScore ?? undefined,
        valuationScore:         s.valuationScore ?? undefined,
        compounderScore:        cs,
        compounderRating:       cs != null ? compounderRating(cs) : undefined,
        roic:                   m?.roic ?? undefined,
        revenueGrowth1y:        m?.revenueGrowth1y ?? undefined,
        grossMargin:            m?.grossMargin ?? undefined,
        fcfYield:               m?.fcfYield ?? undefined,
        verdict:                computeVerdict(s),
        classification:         verdictMap.get(s.ticker)?.classification ?? undefined,
        compositeScore:         computeCompositeScore(
          s.fortressScore ?? 0, s.rocketScore ?? 0, s.waveScore ?? 0, regimeWeights
        ),
        regime,
        regimeWeights,
      };
    });

    res.json({
      engine,
      regime,
      regimeWeights,
      scores: enriched,
      total: afterFilter.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
