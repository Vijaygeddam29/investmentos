import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scoreAlertsTable } from "@workspace/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { runDailyAlerts } from "../lib/alert-engine";
import { calculateAllScores } from "../lib/scoring-engines";

const router: IRouter = Router();

// ─── GET /api/alerts ─────────────────────────────────────────────────────────
router.get("/alerts", async (req, res) => {
  try {
    const ticker  = req.query.ticker as string | undefined;
    const days    = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30));
    const limit   = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    let query = db
      .select()
      .from(scoreAlertsTable)
      .orderBy(desc(scoreAlertsTable.createdAt))
      .limit(limit)
      .$dynamic();

    if (ticker) {
      query = query.where(
        and(
          eq(scoreAlertsTable.ticker, ticker),
          gte(scoreAlertsTable.date, cutoffStr)
        )
      );
    } else {
      query = query.where(gte(scoreAlertsTable.date, cutoffStr));
    }

    const alerts = await query;
    res.json({ alerts, count: alerts.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/pipeline/run-daily ────────────────────────────────────────────
// Recalculates scores for all tickers with recent financial data and emits alerts.
router.post("/pipeline/run-daily", async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Import companiesTable to get list of tracked tickers
    const { companiesTable } = await import("@workspace/db/schema");
    const companies = await db.select({ ticker: companiesTable.ticker }).from(companiesTable);

    const results: { ticker: string; status: string; alerts?: number }[] = [];

    for (const { ticker } of companies) {
      try {
        const scoreRow = await calculateAllScores(ticker);
        const alertCount = await import("../lib/alert-engine").then(m =>
          m.generateAlertsForTicker(ticker, {
            date:            today,
            fortressScore:   scoreRow.fortressScore ?? 0,
            rocketScore:     scoreRow.rocketScore   ?? 0,
            waveScore:       scoreRow.waveScore     ?? 0,
            compounderScore: scoreRow.compounderScore ?? null,
          })
        );
        results.push({ ticker, status: "ok", alerts: alertCount });
      } catch (err: any) {
        results.push({ ticker, status: "error" });
      }
    }

    const totalAlerts = results.reduce((s, r) => s + (r.alerts ?? 0), 0);
    res.json({
      date: today,
      tickers: results.length,
      totalAlerts,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
