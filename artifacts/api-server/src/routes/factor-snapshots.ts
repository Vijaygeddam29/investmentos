/**
 * Factor Warehouse Routes
 *
 * GET /api/factor-snapshots   — screener: filter the warehouse by score thresholds
 * GET /api/top-movers         — tickers with largest score improvement vs prior snapshot
 *
 * All queries are instant reads from pre-computed factor_snapshots rows.
 * No live scoring happens at request time.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { factorSnapshotsTable, companiesTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /api/factor-snapshots
 *
 * Query parameters (all optional, default to no filter):
 *   min_fortress, min_rocket, min_wave, min_entry  — minimum score thresholds (0–1)
 *   date            — snapshot date YYYY-MM-DD (defaults to latest per ticker)
 *   limit           — max rows returned (default 100)
 */
router.get("/factor-snapshots", async (req, res) => {
  try {
    const minFortress = req.query.min_fortress ? Number(req.query.min_fortress) : null;
    const minRocket = req.query.min_rocket ? Number(req.query.min_rocket) : null;
    const minWave = req.query.min_wave ? Number(req.query.min_wave) : null;
    const minEntry = req.query.min_entry ? Number(req.query.min_entry) : null;
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const dateFilter = req.query.date as string | undefined;

    // Fetch latest snapshot per ticker using a lateral join approach:
    // since Drizzle doesn't support DISTINCT ON easily, fetch all and deduplicate in JS
    const rows = await db
      .select({
        id: factorSnapshotsTable.id,
        ticker: factorSnapshotsTable.ticker,
        date: factorSnapshotsTable.date,
        fortressScore: factorSnapshotsTable.fortressScore,
        rocketScore: factorSnapshotsTable.rocketScore,
        waveScore: factorSnapshotsTable.waveScore,
        entryScore: factorSnapshotsTable.entryScore,
        profitabilityScore: factorSnapshotsTable.profitabilityScore,
        growthScore: factorSnapshotsTable.growthScore,
        capitalEfficiencyScore: factorSnapshotsTable.capitalEfficiencyScore,
        financialStrengthScore: factorSnapshotsTable.financialStrengthScore,
        cashFlowQualityScore: factorSnapshotsTable.cashFlowQualityScore,
        momentumScore: factorSnapshotsTable.momentumScore,
        valuationScore: factorSnapshotsTable.valuationScore,
        sentimentScore: factorSnapshotsTable.sentimentScore,
        rsi: factorSnapshotsTable.rsi,
        macdHistogram: factorSnapshotsTable.macdHistogram,
        ret3m: factorSnapshotsTable.ret3m,
        marginOfSafety: factorSnapshotsTable.marginOfSafety,
        marketCap: factorSnapshotsTable.marketCap,
        fortressDelta: factorSnapshotsTable.fortressDelta,
        rocketDelta: factorSnapshotsTable.rocketDelta,
        waveDelta: factorSnapshotsTable.waveDelta,
        entryDelta: factorSnapshotsTable.entryDelta,
        createdAt: factorSnapshotsTable.createdAt,
      })
      .from(factorSnapshotsTable)
      .orderBy(desc(factorSnapshotsTable.createdAt))
      .limit(5000); // fetch all recent rows, deduplicate in JS

    // Deduplicate: keep only latest snapshot per ticker
    const seen = new Set<string>();
    const latest = rows.filter(row => {
      if (seen.has(row.ticker)) return false;
      seen.add(row.ticker);
      return true;
    });

    // Apply date filter if provided
    const dated = dateFilter
      ? latest.filter(r => r.date === dateFilter)
      : latest;

    // Apply score filters
    const filtered = dated.filter(r => {
      if (minFortress != null && (r.fortressScore ?? 0) < minFortress) return false;
      if (minRocket != null && (r.rocketScore ?? 0) < minRocket) return false;
      if (minWave != null && (r.waveScore ?? 0) < minWave) return false;
      if (minEntry != null && (r.entryScore ?? 0) < minEntry) return false;
      return true;
    });

    // Sort by fortress + rocket + wave combined descending
    filtered.sort((a, b) => {
      const scoreA = (a.fortressScore ?? 0) + (a.rocketScore ?? 0) + (a.waveScore ?? 0);
      const scoreB = (b.fortressScore ?? 0) + (b.rocketScore ?? 0) + (b.waveScore ?? 0);
      return scoreB - scoreA;
    });

    res.json({
      count: Math.min(filtered.length, limit),
      snapshots: filtered.slice(0, limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/top-movers
 *
 * Returns tickers with the largest positive score improvement vs their prior snapshot.
 * Query parameters:
 *   engine  — "fortress" | "rocket" | "wave" | "entry" (default: "fortress")
 *   limit   — number of results (default 10, max 50)
 *   min_delta — minimum score improvement to qualify (default 0.01)
 */
router.get("/top-movers", async (req, res) => {
  try {
    const engine = (req.query.engine as string) ?? "fortress";
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const minDelta = Number(req.query.min_delta ?? 0.01);

    const rows = await db
      .select({
        ticker: factorSnapshotsTable.ticker,
        date: factorSnapshotsTable.date,
        fortressScore: factorSnapshotsTable.fortressScore,
        rocketScore: factorSnapshotsTable.rocketScore,
        waveScore: factorSnapshotsTable.waveScore,
        entryScore: factorSnapshotsTable.entryScore,
        fortressDelta: factorSnapshotsTable.fortressDelta,
        rocketDelta: factorSnapshotsTable.rocketDelta,
        waveDelta: factorSnapshotsTable.waveDelta,
        entryDelta: factorSnapshotsTable.entryDelta,
        momentumScore: factorSnapshotsTable.momentumScore,
        rsi: factorSnapshotsTable.rsi,
        macdHistogram: factorSnapshotsTable.macdHistogram,
        createdAt: factorSnapshotsTable.createdAt,
      })
      .from(factorSnapshotsTable)
      .orderBy(desc(factorSnapshotsTable.createdAt))
      .limit(5000);

    // Deduplicate: latest per ticker
    const seen = new Set<string>();
    const latest = rows.filter(row => {
      if (seen.has(row.ticker)) return false;
      seen.add(row.ticker);
      return true;
    });

    // Pick delta field based on requested engine
    const deltaField = (r: typeof latest[0]) => {
      switch (engine) {
        case "rocket": return r.rocketDelta;
        case "wave": return r.waveDelta;
        case "entry": return r.entryDelta;
        default: return r.fortressDelta;
      }
    };

    // Filter by min_delta and sort descending
    const movers = latest
      .filter(r => (deltaField(r) ?? 0) >= minDelta)
      .sort((a, b) => (deltaField(b) ?? 0) - (deltaField(a) ?? 0))
      .slice(0, limit)
      .map(r => ({
        ...r,
        delta: deltaField(r),
        engine,
      }));

    res.json({ engine, count: movers.length, movers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
