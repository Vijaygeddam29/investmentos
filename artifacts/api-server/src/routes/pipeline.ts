import { Router, type IRouter } from "express";
import { runPipeline, getPipelineStatus } from "../lib/pipeline";
import { sendPipelineReport } from "../lib/mailer";
import { getNextSundayAt2AM } from "../lib/scheduler-utils";
import { db } from "@workspace/db";
import { settingsTable, scoresTable, companiesTable, opportunityAlertsTable, riskAlertsTable } from "@workspace/db/schema";
import { eq, desc, gte } from "drizzle-orm";

const router: IRouter = Router();

router.post("/pipeline/run", async (req, res) => {
  try {
    const tickers = req.body?.tickers;
    const result = await runPipeline(tickers);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/pipeline/status", async (_req, res) => {
  const status = getPipelineStatus();

  let lastAutoRun: string | undefined;
  try {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "last_auto_run")).limit(1);
    lastAutoRun = rows[0]?.value ?? undefined;
  } catch {}

  res.json({
    running: status.running,
    lastRun: status.lastRun ?? undefined,
    lastRunUpdated: status.lastRunUpdated,
    lastRunFailed: status.lastRunFailed,
    tickersProcessed: status.tickersProcessed ?? undefined,
    currentTicker: status.currentTicker ?? undefined,
    currentStep: status.currentStep ?? undefined,
    totalTickers: status.totalTickers ?? undefined,
    stocksScored: status.stocksScored ?? undefined,
    yfPatchStats: status.yfPatchStats ?? undefined,
    dataSourceBreakdown: status.dataSourceBreakdown ?? undefined,
    results: status.results ?? undefined,
    nextScheduledRun: getNextSundayAt2AM().toISOString(),
    lastAutoRun,
  });
});

router.post("/pipeline/test-email", async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const topFortress = await db
      .select({ ticker: scoresTable.ticker, company: companiesTable.name, fortressScore: scoresTable.fortressScore, rocketScore: scoresTable.rocketScore, waveScore: scoresTable.waveScore })
      .from(scoresTable).leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .where(eq(scoresTable.date, today)).orderBy(desc(scoresTable.fortressScore)).limit(8);

    const topRocket = await db
      .select({ ticker: scoresTable.ticker, company: companiesTable.name, fortressScore: scoresTable.fortressScore, rocketScore: scoresTable.rocketScore, waveScore: scoresTable.waveScore })
      .from(scoresTable).leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .where(eq(scoresTable.date, today)).orderBy(desc(scoresTable.rocketScore)).limit(8);

    const opportunities = await db
      .select({ ticker: opportunityAlertsTable.ticker, alertType: opportunityAlertsTable.alertType, score: opportunityAlertsTable.score })
      .from(opportunityAlertsTable).where(gte(opportunityAlertsTable.date, cutoffStr))
      .orderBy(desc(opportunityAlertsTable.score)).limit(10);

    const riskSignals = await db
      .select({ ticker: riskAlertsTable.ticker, riskLevel: riskAlertsTable.riskLevel, description: riskAlertsTable.description })
      .from(riskAlertsTable).where(gte(riskAlertsTable.date, cutoffStr))
      .orderBy(desc(riskAlertsTable.createdAt)).limit(10);

    const status = getPipelineStatus();
    const nextDate = getNextSundayAt2AM();
    const nextStr = new Date(nextDate).toUTCString().replace(" GMT", " UTC");

    await sendPipelineReport({
      processed: status.tickersProcessed ?? 0,
      failed: status.lastRunFailed,
      updated: status.lastRunUpdated,
      fmpCount: status.dataSourceBreakdown?.fmp ?? 0,
      yahooCount: status.dataSourceBreakdown?.yahoo ?? 0,
      nextRunDate: nextStr,
      topFortress: topFortress.map(r => ({ ticker: r.ticker, company: r.company ?? undefined, fortressScore: r.fortressScore, rocketScore: r.rocketScore, waveScore: r.waveScore })),
      topRocket: topRocket.map(r => ({ ticker: r.ticker, company: r.company ?? undefined, fortressScore: r.fortressScore, rocketScore: r.rocketScore, waveScore: r.waveScore })),
      newOpportunities: opportunities.map(o => ({ ticker: o.ticker, alertType: o.alertType, score: o.score ?? 0 })),
      highRisk: riskSignals.map(r => ({ ticker: r.ticker, signalType: r.riskLevel.toUpperCase(), severity: r.riskLevel, description: r.description })),
    });

    res.json({ ok: true, message: "Test email sent to vijay@marketlifes.com" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
