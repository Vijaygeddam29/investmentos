import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scoresTable, companiesTable, aiVerdictsTable, financialMetricsTable, factorSnapshotsTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";

import { detectMarketRegime, computeCompositeScore } from "../lib/market-regime";
import { compounderRating } from "../lib/scoring-engines";
import { computeVerdict } from "../lib/verdict-engine";

const EUROPEAN_COUNTRIES = new Set([
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania",
  "Luxembourg", "Malta", "Netherlands", "Norway", "Poland", "Portugal",
  "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland",
]);

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

// Cap tier boundaries — stored in billions (e.g. 10 = $10B, 2 = $2B)
const CAP_LARGE_MIN = 10;
const CAP_MID_MIN   =  2;

type CapTier = "all" | "large" | "mid" | "small" | "top50";

// ─── GET /api/scores ─────────────────────────────────────────────────────────
router.get("/scores", async (req, res) => {
  try {
    const engine        = (req.query.engine as string) ?? "fortress";
    const minScore      = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
    const limit         = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
    const offset        = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const countryFilter = req.query.country as string | undefined;
    const capTier       = (req.query.cap_tier as CapTier) ?? "all";

    const allRows = await db
      .select({
        ticker:                 scoresTable.ticker,
        name:                   companiesTable.name,
        sector:                 companiesTable.sector,
        country:                companiesTable.country,
        marketCap:              companiesTable.marketCap,
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
        companyQualityScore:    scoresTable.companyQualityScore,
        stockOpportunityScore:  scoresTable.stockOpportunityScore,
      })
      .from(scoresTable)
      .leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .orderBy(desc(scoresTable.date));

    const seen = new Set<string>();
    let latestPerTicker = allRows.filter(row => {
      if (seen.has(row.ticker)) return false;
      seen.add(row.ticker);
      return true;
    });

    if (countryFilter === "Europe") {
      latestPerTicker = latestPerTicker.filter(r => EUROPEAN_COUNTRIES.has(r.country ?? ""));
    } else if (countryFilter) {
      const cf = countryFilter.toLowerCase();
      latestPerTicker = latestPerTicker.filter(r => (r.country ?? "").toLowerCase().includes(cf));
    }

    // Cap tier filtering
    if (capTier === "large") {
      latestPerTicker = latestPerTicker.filter(r => (r.marketCap ?? 0) >= CAP_LARGE_MIN);
    } else if (capTier === "mid") {
      latestPerTicker = latestPerTicker.filter(r => {
        const mc = r.marketCap ?? 0;
        return mc >= CAP_MID_MIN && mc < CAP_LARGE_MIN;
      });
    } else if (capTier === "small") {
      latestPerTicker = latestPerTicker.filter(r => (r.marketCap ?? 0) < CAP_MID_MIN && (r.marketCap ?? 0) > 0);
    }

    const scoreField = (engine === "rocket" ? "rocketScore"
      : engine === "wave" ? "waveScore"
      : "fortressScore") as keyof typeof scoresTable.$inferSelect;
    const afterFilter = minScore != null
      ? latestPerTicker.filter(s => ((s[scoreField] as number | null) ?? 0) >= minScore)
      : latestPerTicker;

    afterFilter.sort((a, b) => ((b[scoreField] as number | null) ?? 0) - ((a[scoreField] as number | null) ?? 0));

    // "top50" means return top 50 by score (no cap filter, just a hard limit)
    const effectiveLimit = capTier === "top50" ? 50 : limit;
    const paginated = afterFilter.slice(offset, offset + effectiveLimit);

    const regimeResult = await detectMarketRegime();
    const { regime, weights: regimeWeights } = regimeResult;

    const verdicts = await db.select().from(aiVerdictsTable);
    const verdictMap = new Map(verdicts.map(v => [v.ticker, v]));

    const metricsRows = await db
      .select({
        ticker:          financialMetricsTable.ticker,
        roic:            financialMetricsTable.roic,
        revenueGrowth1y: financialMetricsTable.revenueGrowth1y,
        grossMargin:     financialMetricsTable.grossMargin,
        fcfYield:        financialMetricsTable.fcfYield,
        altmanZScore:    financialMetricsTable.altmanZScore,
        interestCoverage: financialMetricsTable.interestCoverage,
        netDebtEbitda:   financialMetricsTable.netDebtEbitda,
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

      const qualityScore     = s.companyQualityScore    ?? null;
      const opportunityScore = s.stockOpportunityScore  ?? null;

      let verdict: string;
      let riskFlags: string[] = [];

      if (qualityScore != null && opportunityScore != null) {
        const vResult = computeVerdict({
          qualityScore,
          opportunityScore,
          altmanZScore:    m?.altmanZScore,
          interestCoverage: m?.interestCoverage,
          netDebtEbitda:   m?.netDebtEbitda,
        });
        verdict = vResult.verdict;
        riskFlags = vResult.riskFlags;
      } else {
        const f   = s.fortressScore ?? 0;
        const r   = s.rocketScore   ?? 0;
        const w   = s.waveScore     ?? 0;
        const composite = computeCompositeScore(f, r, w, regimeWeights);
        if (composite >= 0.70) verdict = "BUY";
        else if (composite >= 0.60) verdict = "ADD";
        else if (composite >= 0.50) verdict = "HOLD";
        else if (composite >= 0.40) verdict = "TRIM";
        else verdict = "SELL";
      }

      return {
        ticker:                 s.ticker,
        name:                   s.name ?? undefined,
        sector:                 s.sector ?? undefined,
        country:                s.country ?? undefined,
        marketCap:              s.marketCap ?? undefined,
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
        companyQualityScore:    qualityScore ?? undefined,
        stockOpportunityScore:  opportunityScore ?? undefined,
        roic:                   m?.roic ?? undefined,
        revenueGrowth1y:        m?.revenueGrowth1y ?? undefined,
        grossMargin:            m?.grossMargin ?? undefined,
        fcfYield:               m?.fcfYield ?? undefined,
        verdict,
        riskFlags,
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

// ─── GET /api/scores/:ticker/history ─────────────────────────────────────────
// Returns the last N snapshots for a ticker in chronological order.
// Includes fortress/rocket/wave scores plus the 5-layer Model 2 scores.
router.get("/scores/:ticker/history", async (req, res) => {
  try {
    const { ticker } = req.params;
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit as string) || 30));

    const rows = await db
      .select({
        date:                   factorSnapshotsTable.date,
        fortressScore:          factorSnapshotsTable.fortressScore,
        rocketScore:            factorSnapshotsTable.rocketScore,
        waveScore:              factorSnapshotsTable.waveScore,
        companyQualityScore:    factorSnapshotsTable.companyQualityScore,
        stockOpportunityScore:  factorSnapshotsTable.stockOpportunityScore,
        mispricingScore:        factorSnapshotsTable.mispricingScore,
        expectationScore:       factorSnapshotsTable.expectationScore,
        fragilityScore:         factorSnapshotsTable.fragilityScore,
        portfolioNetScore:      factorSnapshotsTable.portfolioNetScore,
        marginOfSafety:         factorSnapshotsTable.marginOfSafety,
        momentumScore:          factorSnapshotsTable.momentumScore,
        rsi:                    factorSnapshotsTable.rsi,
      })
      .from(factorSnapshotsTable)
      .where(eq(factorSnapshotsTable.ticker, ticker.toUpperCase()))
      .orderBy(desc(factorSnapshotsTable.date))
      .limit(limit);

    // Return in chronological order (oldest first) for charting
    const history = rows.reverse().map(r => ({
      date:               r.date,
      fortressScore:      r.fortressScore != null ? Math.round(r.fortressScore * 100) : null,
      rocketScore:        r.rocketScore   != null ? Math.round(r.rocketScore   * 100) : null,
      waveScore:          r.waveScore     != null ? Math.round(r.waveScore     * 100) : null,
      qualityScore:       r.companyQualityScore   != null ? Math.round(r.companyQualityScore   * 100) : null,
      opportunityScore:   r.stockOpportunityScore != null ? Math.round(r.stockOpportunityScore * 100) : null,
      mispricingScore:    r.mispricingScore       != null ? Math.round(r.mispricingScore       * 100) : null,
      expectationScore:   r.expectationScore      != null ? Math.round(r.expectationScore      * 100) : null,
      fragilityScore:     r.fragilityScore        != null ? Math.round(r.fragilityScore        * 100) : null,
      netScore:           r.portfolioNetScore      != null ? Math.round(r.portfolioNetScore      * 100) : null,
      marginOfSafety:     r.marginOfSafety,
      momentumScore:      r.momentumScore,
      rsi:                r.rsi,
    }));

    res.json({ ticker: ticker.toUpperCase(), history, count: history.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
