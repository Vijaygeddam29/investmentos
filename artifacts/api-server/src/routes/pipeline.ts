import { Router, type IRouter } from "express";
import { runPipeline, getPipelineStatus } from "../lib/pipeline";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getNextSundayAt2AM(): string {
  const now = new Date();
  const d = new Date(now);
  d.setUTCHours(2, 0, 0, 0);
  const daysUntilSunday = (7 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

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
    nextScheduledRun: getNextSundayAt2AM(),
    lastAutoRun,
  });
});

export default router;
