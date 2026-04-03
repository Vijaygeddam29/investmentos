import app from "./app";
import cron from "node-cron";
import { runPipeline, isPipelineRunning, getPipelineStatus } from "./lib/pipeline";
import { sendPipelineReport, sendSignalAlert, sendPremarketBriefingEmail } from "./lib/mailer";
import { runPremarketPipeline } from "./lib/premarket-intelligence";
import { syncAllUsers } from "./lib/ibkr-sync";
import { getNextSundayAt2AM } from "./lib/scheduler-utils";
import { db } from "@workspace/db";
import { settingsTable, scoresTable, companiesTable, opportunityAlertsTable, riskAlertsTable } from "@workspace/db/schema";
import { eq, desc, gte } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

async function sendWeeklyEmails(): Promise<void> {
  try {
    const status = getPipelineStatus();
    const today = new Date().toISOString().slice(0, 10);

    const topFortress = await db
      .select({
        ticker: scoresTable.ticker,
        company: companiesTable.name,
        fortressScore: scoresTable.fortressScore,
        rocketScore: scoresTable.rocketScore,
        waveScore: scoresTable.waveScore,
      })
      .from(scoresTable)
      .leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .where(eq(scoresTable.date, today))
      .orderBy(desc(scoresTable.fortressScore))
      .limit(8);

    const topRocket = await db
      .select({
        ticker: scoresTable.ticker,
        company: companiesTable.name,
        fortressScore: scoresTable.fortressScore,
        rocketScore: scoresTable.rocketScore,
        waveScore: scoresTable.waveScore,
      })
      .from(scoresTable)
      .leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
      .where(eq(scoresTable.date, today))
      .orderBy(desc(scoresTable.rocketScore))
      .limit(8);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const opportunities = await db
      .select({
        ticker: opportunityAlertsTable.ticker,
        alertType: opportunityAlertsTable.alertType,
        score: opportunityAlertsTable.score,
      })
      .from(opportunityAlertsTable)
      .where(gte(opportunityAlertsTable.date, cutoffStr))
      .orderBy(desc(opportunityAlertsTable.score))
      .limit(10);

    const riskSignals = await db
      .select({
        ticker: riskAlertsTable.ticker,
        riskLevel: riskAlertsTable.riskLevel,
        description: riskAlertsTable.description,
        activeSignalCount: riskAlertsTable.activeSignalCount,
      })
      .from(riskAlertsTable)
      .where(gte(riskAlertsTable.date, cutoffStr))
      .orderBy(desc(riskAlertsTable.createdAt))
      .limit(10);

    const nextDate = getNextSundayAt2AM().toUTCString().replace(" GMT", " UTC");

    await sendPipelineReport({
      processed: status.tickersProcessed ?? 0,
      failed: status.lastRunFailed,
      updated: status.lastRunUpdated,
      fmpCount: status.dataSourceBreakdown?.fmp ?? 0,
      yahooCount: status.dataSourceBreakdown?.yahoo ?? 0,
      nextRunDate: nextDate,
      topFortress: topFortress.map(r => ({
        ticker: r.ticker,
        company: r.company ?? undefined,
        fortressScore: r.fortressScore,
        rocketScore: r.rocketScore,
        waveScore: r.waveScore,
      })),
      topRocket: topRocket.map(r => ({
        ticker: r.ticker,
        company: r.company ?? undefined,
        fortressScore: r.fortressScore,
        rocketScore: r.rocketScore,
        waveScore: r.waveScore,
      })),
      newOpportunities: opportunities.map(o => ({
        ticker: o.ticker,
        alertType: o.alertType,
        score: o.score ?? 0,
      })),
      highRisk: riskSignals.map(r => ({
        ticker: r.ticker,
        signalType: r.riskLevel.toUpperCase(),
        severity: r.riskLevel,
        description: r.description,
      })),
    });

    const signalAlerts: Parameters<typeof sendSignalAlert>[0] = [
      ...opportunities.slice(0, 5).map(o => ({
        ticker: o.ticker,
        type: "opportunity" as const,
        title: o.alertType,
        detail: `Score crossed threshold`,
        score: o.score ?? undefined,
      })),
      ...riskSignals.slice(0, 5).map(r => ({
        ticker: r.ticker,
        type: "risk" as const,
        title: r.riskLevel.toUpperCase(),
        detail: r.description,
      })),
    ];

    if (signalAlerts.length > 0) {
      await sendSignalAlert(signalAlerts);
    }
  } catch (err) {
    console.error("[Mailer] Failed to send weekly emails:", err);
  }
}

async function scheduledPipelineRun() {
  if (isPipelineRunning()) {
    console.log("[Scheduler] Pipeline already running, skipping scheduled run");
    return;
  }
  console.log("[Scheduler] Weekly auto-run starting...");
  try {
    await runPipeline();
    await setSetting("last_auto_run", new Date().toISOString());
    console.log("[Scheduler] Weekly auto-run complete — sending email report...");
    await sendWeeklyEmails();
  } catch (err) {
    console.error("[Scheduler] Weekly auto-run failed:", err);
  }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  cron.schedule("0 2 * * 0", () => {
    scheduledPipelineRun().catch(console.error);
  }, { timezone: "UTC" });
  console.log(`[Scheduler] Weekly pipeline cron registered — next run: ${getNextSundayAt2AM().toISOString()}`);

  // Pre-market intelligence: run Mon–Fri at 06:00 UK time (UTC+1 BST / UTC+0 GMT)
  // Using 05:00 UTC which covers both BST and GMT
  cron.schedule("0 5 * * 1-5", () => {
    console.log("[Scheduler] Pre-market intelligence pipeline starting...");
    runPremarketPipeline()
      .then(async (briefing) => {
        console.log("[Scheduler] Pre-market pipeline complete. Sending email...");
        await sendPremarketBriefingEmail(briefing).catch(console.error);
        await setSetting("last_premarket_run", new Date().toISOString());
      })
      .catch((err) => console.error("[Scheduler] Pre-market pipeline failed:", err));
  }, { timezone: "UTC" });
  console.log("[Scheduler] Pre-market cron registered — Mon–Fri 06:00 UK time");

  // IBKR position sync: Mon–Fri at 08:00 UTC (market open)
  // Reconciles our DB with live IBKR positions so any manual trades or
  // external changes are automatically picked up
  cron.schedule("0 8 * * 1-5", () => {
    console.log("[Scheduler] IBKR position sync starting...");
    syncAllUsers()
      .then(() => console.log("[Scheduler] IBKR position sync complete"))
      .catch((err) => console.error("[Scheduler] IBKR position sync failed:", err));
  }, { timezone: "UTC" });
  console.log("[Scheduler] IBKR position sync cron registered — Mon–Fri 08:00 UTC (market open)");

  setTimeout(async () => {
    try {
      const lastRun = await getSetting("last_auto_run");
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

      if (!lastRun) {
        console.log("[Scheduler] No previous auto-run found — triggering initial pipeline run...");
        scheduledPipelineRun().catch(console.error);
        return;
      }

      const age = Date.now() - new Date(lastRun).getTime();
      if (age > SEVEN_DAYS) {
        console.log(`[Scheduler] Last auto-run was ${Math.round(age / 3600000)}h ago (>7 days) — triggering pipeline...`);
        scheduledPipelineRun().catch(console.error);
      } else {
        console.log(`[Scheduler] Last auto-run was ${Math.round(age / 3600000)}h ago — next scheduled: ${getNextSundayAt2AM().toISOString()}`);
      }
    } catch (err) {
      console.error("[Scheduler] Failed to check last auto-run:", err);
    }
  }, 5000);
});
