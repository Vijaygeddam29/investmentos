/**
 * Admin routes — accessible only to vijay@marketlifes.com
 *
 *  GET  /api/admin/stats    — platform overview: users, pipeline, universe
 *  GET  /api/admin/users    — full user list with join dates
 *  POST /api/admin/pipeline/trigger — fire pipeline run (async)
 */

import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/auth";
import { getApiMetrics } from "../middleware/metrics";
import { runPipeline, getPipelineStatus } from "../lib/pipeline";
import { getNextSundayAt2AM } from "../lib/scheduler-utils";
import { db } from "@workspace/db";
import {
  usersTable,
  companiesTable,
  scoresTable,
  opportunityAlertsTable,
  riskAlertsTable,
  conversations,
} from "@workspace/db/schema";
import { desc, gte, count, eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get("/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const d7  = new Date(now); d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const today = now.toISOString().slice(0, 10);

    const [
      userTotal,
      usersLast7,
      usersLast30,
      totalCompanies,
      scoredToday,
      totalScores,
      totalOpportunities,
      totalRisks,
      totalConversations,
      topScoredToday,
      recentUsers,
    ] = await Promise.all([
      // Users
      db.select({ n: count() }).from(usersTable),
      db.select({ n: count() }).from(usersTable).where(gte(usersTable.createdAt, d7)),
      db.select({ n: count() }).from(usersTable).where(gte(usersTable.createdAt, d30)),

      // Universe
      db.select({ n: count() }).from(companiesTable),
      db.select({ n: count() }).from(scoresTable).where(eq(scoresTable.date, today)),
      db.select({ n: count() }).from(scoresTable),

      // Signals
      db.select({ n: count() }).from(opportunityAlertsTable),
      db.select({ n: count() }).from(riskAlertsTable),

      // Chat usage
      db.select({ n: count() }).from(conversations),

      // Top 10 today by fortress score
      db.select({
        ticker: scoresTable.ticker,
        company: companiesTable.name,
        sector: companiesTable.sector,
        fortressScore: scoresTable.fortressScore,
        rocketScore: scoresTable.rocketScore,
        waveScore: scoresTable.waveScore,
      })
        .from(scoresTable)
        .leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
        .where(eq(scoresTable.date, today))
        .orderBy(desc(scoresTable.fortressScore))
        .limit(10),

      // 10 most recent users
      db.select({
        id: usersTable.id,
        email: usersTable.email,
        phone: usersTable.phone,
        name: usersTable.name,
        verified: usersTable.verified,
        createdAt: usersTable.createdAt,
      })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(10),
    ]);

    const pipeline = getPipelineStatus();

    const apiMetrics = getApiMetrics();

    res.json({
      apiMetrics,
      users: {
        total:    userTotal[0]?.n  ?? 0,
        last7d:   usersLast7[0]?.n  ?? 0,
        last30d:  usersLast30[0]?.n ?? 0,
        recent:   recentUsers,
      },
      universe: {
        totalTickers:   totalCompanies[0]?.n ?? 0,
        scoredToday:    scoredToday[0]?.n    ?? 0,
        totalScoreRows: totalScores[0]?.n    ?? 0,
        topToday:       topScoredToday,
      },
      signals: {
        totalOpportunities: totalOpportunities[0]?.n ?? 0,
        totalRisks:         totalRisks[0]?.n         ?? 0,
      },
      chat: {
        totalConversations: totalConversations[0]?.n ?? 0,
      },
      pipeline: {
        running:         pipeline.running,
        lastRun:         pipeline.lastRun,
        lastRunUpdated:  pipeline.lastRunUpdated,
        lastRunFailed:   pipeline.lastRunFailed,
        tickersProcessed: pipeline.tickersProcessed,
        totalTickers:    pipeline.totalTickers,
        currentTicker:   pipeline.currentTicker,
        currentStep:     pipeline.currentStep,
        stocksScored:    pipeline.stocksScored,
        dataSourceBreakdown: pipeline.dataSourceBreakdown,
        nextScheduledRun: getNextSundayAt2AM().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id:        usersTable.id,
        email:     usersTable.email,
        phone:     usersTable.phone,
        name:      usersTable.name,
        verified:  usersTable.verified,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    res.json({ users, total: users.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/pipeline/trigger ────────────────────────────────────────
router.post("/admin/pipeline/trigger", requireAdmin, async (_req, res) => {
  const status = getPipelineStatus();
  if (status.running) {
    return res.status(409).json({ error: "Pipeline already running", running: true });
  }
  runPipeline().catch(err => console.error("[Admin] Pipeline trigger failed:", err));
  res.json({ started: true, message: "Pipeline started — check /api/pipeline/status for progress" });
});

export default router;
