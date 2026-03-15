import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  driftSignalsTable,
  opportunityAlertsTable,
  riskAlertsTable,
  companiesTable,
  factorSnapshotsTable,
} from "@workspace/db/schema";
import { desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

/** Fetch company metadata + latest factor scores for a set of tickers */
async function enrichTickers(tickers: string[]) {
  if (!tickers.length) return {} as Record<string, any>;

  const [companies, snapshots] = await Promise.all([
    db.select().from(companiesTable).where(inArray(companiesTable.ticker, tickers)),
    db
      .select()
      .from(factorSnapshotsTable)
      .where(inArray(factorSnapshotsTable.ticker, tickers))
      .orderBy(desc(factorSnapshotsTable.date)),
  ]);

  const companyMap: Record<string, typeof companies[0]> = {};
  for (const c of companies) companyMap[c.ticker] = c;

  const snapshotMap: Record<string, typeof snapshots[0]> = {};
  for (const s of snapshots) {
    if (!snapshotMap[s.ticker]) snapshotMap[s.ticker] = s;
  }

  const result: Record<string, {
    name: string; sector: string; industry: string; country: string; currency: string;
    fortressScore: number | null; rocketScore: number | null; waveScore: number | null;
    entryScore: number | null; marketCap: number | null;
    companyQualityScore: number | null; stockOpportunityScore: number | null;
    expectationScore: number | null; mispricingScore: number | null;
    fragilityScore: number | null; portfolioNetScore: number | null;
    valuationScore: number | null;
  }> = {};

  for (const ticker of tickers) {
    const co = companyMap[ticker];
    const sn = snapshotMap[ticker];
    result[ticker] = {
      name:                  co?.name     ?? ticker,
      sector:                co?.sector   ?? sn?.sector   ?? "Unknown",
      industry:              co?.industry ?? "Unknown",
      country:               co?.country  ?? "Unknown",
      currency:              co?.currency ?? "USD",
      fortressScore:         sn?.fortressScore         ?? null,
      rocketScore:           sn?.rocketScore           ?? null,
      waveScore:             sn?.waveScore             ?? null,
      entryScore:            sn?.entryScore            ?? null,
      marketCap:             sn?.marketCap             ?? null,
      companyQualityScore:   (sn as any)?.companyQualityScore   ?? null,
      stockOpportunityScore: (sn as any)?.stockOpportunityScore ?? null,
      expectationScore:      (sn as any)?.expectationScore      ?? null,
      mispricingScore:       (sn as any)?.mispricingScore       ?? null,
      fragilityScore:        (sn as any)?.fragilityScore        ?? null,
      portfolioNetScore:     (sn as any)?.portfolioNetScore     ?? null,
      valuationScore:        sn?.valuationScore        ?? null,
    };
  }
  return result;
}

// ─── Drift Signals ────────────────────────────────────────────────────────────
router.get("/drift-signals", async (req, res) => {
  try {
    const filterTicker   = req.query.ticker   as string | undefined;
    const filterSeverity = req.query.severity as string | undefined;

    const rows = await db.select().from(driftSignalsTable).orderBy(desc(driftSignalsTable.date));

    let filtered = rows;
    if (filterTicker)   filtered = filtered.filter(s => s.ticker === filterTicker);
    if (filterSeverity) filtered = filtered.filter(s => s.severity === filterSeverity);

    const tickers = [...new Set(filtered.map(s => s.ticker))];
    const meta    = await enrichTickers(tickers);

    const signals = filtered.map(s => ({
      id:            s.id,
      ticker:        s.ticker,
      date:          s.date,
      signalType:    s.signalType,
      description:   s.description,
      severity:      s.severity,
      factorName:    s.factorName    ?? undefined,
      currentValue:  s.currentValue  ?? undefined,
      historicalAvg: s.historicalAvg ?? undefined,
      company:       meta[s.ticker] ?? null,
    }));

    res.json({ signals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Opportunity Alerts ───────────────────────────────────────────────────────
router.get("/opportunity-alerts", async (req, res) => {
  try {
    const filterEngine = req.query.engineType as string | undefined;

    const rows = await db.select().from(opportunityAlertsTable).orderBy(desc(opportunityAlertsTable.date));

    let filtered = rows;
    if (filterEngine) filtered = filtered.filter(a => a.engineType === filterEngine);

    const tickers = [...new Set(filtered.map(a => a.ticker))];
    const meta    = await enrichTickers(tickers);

    const alerts = filtered.map(a => ({
      id:          a.id,
      ticker:      a.ticker,
      date:        a.date,
      alertType:   a.alertType,
      engineType:  a.engineType,
      score:       a.score  ?? undefined,
      description: a.description,
      company:     meta[a.ticker] ?? null,
    }));

    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Risk Alerts ──────────────────────────────────────────────────────────────
router.get("/risk-alerts", async (req, res) => {
  try {
    const filterTicker = req.query.ticker as string | undefined;

    const rows = await db.select().from(riskAlertsTable).orderBy(desc(riskAlertsTable.date));

    let filtered = rows;
    if (filterTicker) filtered = filtered.filter(r => r.ticker === filterTicker);

    const tickers = [...new Set(filtered.map(r => r.ticker))];
    const meta    = await enrichTickers(tickers);

    const alerts = filtered.map(r => ({
      id:               r.id,
      ticker:           r.ticker,
      date:             r.date,
      riskLevel:        r.riskLevel,
      activeSignalCount: r.activeSignalCount,
      highSeverityCount: r.highSeverityCount,
      description:      r.description,
      signals:          r.signalSummary ? (JSON.parse(r.signalSummary) as string[]) : [],
      company:          meta[r.ticker] ?? null,
    }));

    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
