/**
 * Factor Warehouse Routes
 *
 * GET /api/factor-snapshots   — screener: filter the warehouse by score thresholds + company attributes
 * GET /api/top-movers         — tickers with largest score improvement vs prior snapshot
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { factorSnapshotsTable, companiesTable } from "@workspace/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /api/factor-snapshots
 *
 * Query parameters (all optional):
 *   min_fortress, min_rocket, min_wave, min_entry  — score thresholds (0–1)
 *   sector, industry, country                      — company attribute filters
 *   market_cap_min, market_cap_max                 — market cap in USD
 *   date   — snapshot date YYYY-MM-DD
 *   limit  — max rows (default 100, max 500)
 */
router.get("/factor-snapshots", async (req, res) => {
  try {
    const minFortress   = req.query.min_fortress   ? Number(req.query.min_fortress)   : null;
    const minRocket     = req.query.min_rocket     ? Number(req.query.min_rocket)     : null;
    const minWave       = req.query.min_wave       ? Number(req.query.min_wave)       : null;
    const minEntry      = req.query.min_entry      ? Number(req.query.min_entry)      : null;
    const sectorFilter  = req.query.sector   as string | undefined;
    const industryFilter = req.query.industry as string | undefined;
    const countryFilter = req.query.country  as string | undefined;
    const marketCapMin  = req.query.market_cap_min ? Number(req.query.market_cap_min) : null;
    const marketCapMax  = req.query.market_cap_max ? Number(req.query.market_cap_max) : null;
    const limit         = Math.min(Number(req.query.limit ?? 100), 500);
    const dateFilter    = req.query.date as string | undefined;

    const companyConditions: ReturnType<typeof ilike>[] = [];
    if (sectorFilter)   companyConditions.push(ilike(companiesTable.sector,   `%${sectorFilter}%`));
    if (industryFilter) companyConditions.push(ilike(companiesTable.industry, `%${industryFilter}%`));
    if (countryFilter)  companyConditions.push(ilike(companiesTable.country,  `%${countryFilter}%`));

    const rows = await db
      .select({
        id:                     factorSnapshotsTable.id,
        ticker:                 factorSnapshotsTable.ticker,
        date:                   factorSnapshotsTable.date,
        fortressScore:          factorSnapshotsTable.fortressScore,
        rocketScore:            factorSnapshotsTable.rocketScore,
        waveScore:              factorSnapshotsTable.waveScore,
        entryScore:             factorSnapshotsTable.entryScore,
        profitabilityScore:     factorSnapshotsTable.profitabilityScore,
        growthScore:            factorSnapshotsTable.growthScore,
        capitalEfficiencyScore: factorSnapshotsTable.capitalEfficiencyScore,
        financialStrengthScore: factorSnapshotsTable.financialStrengthScore,
        cashFlowQualityScore:   factorSnapshotsTable.cashFlowQualityScore,
        momentumScore:          factorSnapshotsTable.momentumScore,
        valuationScore:         factorSnapshotsTable.valuationScore,
        sentimentScore:         factorSnapshotsTable.sentimentScore,
        rsi:                    factorSnapshotsTable.rsi,
        macdHistogram:          factorSnapshotsTable.macdHistogram,
        ret3m:                  factorSnapshotsTable.ret3m,
        marginOfSafety:         factorSnapshotsTable.marginOfSafety,
        snapshotMarketCap:      factorSnapshotsTable.marketCap,
        fortressDelta:          factorSnapshotsTable.fortressDelta,
        rocketDelta:            factorSnapshotsTable.rocketDelta,
        waveDelta:              factorSnapshotsTable.waveDelta,
        entryDelta:             factorSnapshotsTable.entryDelta,
        createdAt:              factorSnapshotsTable.createdAt,
        // 6-Layer intelligence scores
        companyQualityScore:    factorSnapshotsTable.companyQualityScore,
        stockOpportunityScore:  factorSnapshotsTable.stockOpportunityScore,
        expectationScore:       factorSnapshotsTable.expectationScore,
        mispricingScore:        factorSnapshotsTable.mispricingScore,
        fragilityScore:         factorSnapshotsTable.fragilityScore,
        portfolioNetScore:      factorSnapshotsTable.portfolioNetScore,
        countryContext:         factorSnapshotsTable.countryContext,
        // Company fields
        name:                   companiesTable.name,
        sector:                 companiesTable.sector,
        industry:               companiesTable.industry,
        country:                companiesTable.country,
        currency:               companiesTable.currency,
        companyMarketCap:       companiesTable.marketCap,
      })
      .from(factorSnapshotsTable)
      .leftJoin(companiesTable, eq(factorSnapshotsTable.ticker, companiesTable.ticker))
      .where(companyConditions.length ? and(...companyConditions) : undefined)
      .orderBy(desc(factorSnapshotsTable.createdAt))
      .limit(5000);

    // Deduplicate: keep only latest snapshot per ticker
    const seen = new Set<string>();
    const latest = rows.filter(row => {
      if (seen.has(row.ticker)) return false;
      seen.add(row.ticker);
      return true;
    });

    const dated = dateFilter ? latest.filter(r => r.date === dateFilter) : latest;

    const filtered = dated.filter(r => {
      if (minFortress != null && (r.fortressScore ?? 0) < minFortress) return false;
      if (minRocket   != null && (r.rocketScore   ?? 0) < minRocket)   return false;
      if (minWave     != null && (r.waveScore     ?? 0) < minWave)     return false;
      if (minEntry    != null && (r.entryScore    ?? 0) < minEntry)    return false;
      const cap = r.snapshotMarketCap ?? r.companyMarketCap ?? null;
      if (marketCapMin != null && (cap ?? 0) < marketCapMin) return false;
      if (marketCapMax != null && cap != null && cap > marketCapMax) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const sA = (a.fortressScore ?? 0) + (a.rocketScore ?? 0) + (a.waveScore ?? 0);
      const sB = (b.fortressScore ?? 0) + (b.rocketScore ?? 0) + (b.waveScore ?? 0);
      return sB - sA;
    });

    const snapshots = filtered.slice(0, limit).map(({ snapshotMarketCap, companyMarketCap, ...r }) => ({
      ...r,
      marketCap: snapshotMarketCap ?? companyMarketCap ?? null,
    }));

    res.json({ count: snapshots.length, snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/top-movers
 *
 * Query parameters:
 *   engine    — "fortress" | "rocket" | "wave" | "entry" (default: "fortress")
 *   limit     — max results (default 10, max 50)
 *   min_delta — minimum improvement (default 0.01)
 */
router.get("/top-movers", async (req, res) => {
  try {
    const engine   = (req.query.engine as string) ?? "fortress";
    const limit    = Math.min(Number(req.query.limit ?? 10), 50);
    const minDelta = Number(req.query.min_delta ?? 0.01);

    const rows = await db
      .select({
        ticker:        factorSnapshotsTable.ticker,
        date:          factorSnapshotsTable.date,
        fortressScore: factorSnapshotsTable.fortressScore,
        rocketScore:   factorSnapshotsTable.rocketScore,
        waveScore:     factorSnapshotsTable.waveScore,
        entryScore:    factorSnapshotsTable.entryScore,
        fortressDelta: factorSnapshotsTable.fortressDelta,
        rocketDelta:   factorSnapshotsTable.rocketDelta,
        waveDelta:     factorSnapshotsTable.waveDelta,
        entryDelta:    factorSnapshotsTable.entryDelta,
        momentumScore: factorSnapshotsTable.momentumScore,
        rsi:           factorSnapshotsTable.rsi,
        macdHistogram: factorSnapshotsTable.macdHistogram,
        createdAt:     factorSnapshotsTable.createdAt,
        name:          companiesTable.name,
        sector:        companiesTable.sector,
        country:       companiesTable.country,
      })
      .from(factorSnapshotsTable)
      .leftJoin(companiesTable, eq(factorSnapshotsTable.ticker, companiesTable.ticker))
      .orderBy(desc(factorSnapshotsTable.createdAt))
      .limit(5000);

    const seen = new Set<string>();
    const latest = rows.filter(row => {
      if (seen.has(row.ticker)) return false;
      seen.add(row.ticker);
      return true;
    });

    const deltaField = (r: typeof latest[0]) => {
      switch (engine) {
        case "rocket": return r.rocketDelta;
        case "wave":   return r.waveDelta;
        case "entry":  return r.entryDelta;
        default:       return r.fortressDelta;
      }
    };

    const movers = latest
      .filter(r => (deltaField(r) ?? 0) >= minDelta)
      .sort((a, b) => (deltaField(b) ?? 0) - (deltaField(a) ?? 0))
      .slice(0, limit)
      .map(r => ({ ...r, delta: deltaField(r), engine }));

    res.json({ engine, count: movers.length, movers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
