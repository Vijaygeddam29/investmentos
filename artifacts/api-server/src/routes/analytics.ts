import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { analyticsEvents } from "@workspace/db/schema";
import { requireAdmin } from "../middleware/auth";
import { desc, gte, count, sql, eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── POST /api/analytics/event ───────────────────────────────────────────────
// Public — no auth required. Called by frontend on page view / click / leave.
router.post("/analytics/event", async (req, res) => {
  try {
    const { sessionId, userId, eventType, page, referrer, durationMs, properties } = req.body;
    if (!sessionId || !eventType || !page) {
      res.status(400).json({ error: "sessionId, eventType and page are required" });
      return;
    }
    await db.insert(analyticsEvents).values({
      sessionId,
      userId: userId ?? null,
      eventType,
      page,
      referrer: referrer ?? null,
      durationMs: durationMs ?? null,
      properties: properties ? JSON.stringify(properties) : null,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
router.get("/admin/analytics", requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const d1  = new Date(now); d1.setDate(d1.getDate() - 1);
    const d7  = new Date(now); d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const m5  = new Date(now); m5.setMinutes(m5.getMinutes() - 5);

    const [
      activeNow,
      sessionsToday,
      sessionsWeek,
      sessionsMonth,
      topPages,
      avgDurationRows,
      eventBreakdown,
      recentActivity,
      dailyTrend,
    ] = await Promise.all([

      // Sessions active in last 5 minutes
      db.selectDistinct({ sessionId: analyticsEvents.sessionId })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, m5)),

      // Unique sessions today
      db.selectDistinct({ sessionId: analyticsEvents.sessionId })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, d1)),

      // Unique sessions this week
      db.selectDistinct({ sessionId: analyticsEvents.sessionId })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, d7)),

      // Unique sessions this month
      db.selectDistinct({ sessionId: analyticsEvents.sessionId })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, d30)),

      // Top pages by view count (last 30 days)
      db.select({
        page: analyticsEvents.page,
        views: count(),
      })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, d30))
        .groupBy(analyticsEvents.page)
        .orderBy(desc(count()))
        .limit(10),

      // Average time on page per page (from page_leave events with durationMs)
      db.select({
        page: analyticsEvents.page,
        avgMs: sql<number>`AVG(${analyticsEvents.durationMs})`,
        samples: count(),
      })
        .from(analyticsEvents)
        .where(
          sql`${analyticsEvents.eventType} = 'page_leave' AND ${analyticsEvents.durationMs} IS NOT NULL AND ${analyticsEvents.createdAt} >= ${d30}`
        )
        .groupBy(analyticsEvents.page)
        .orderBy(sql`AVG(${analyticsEvents.durationMs}) DESC`)
        .limit(10),

      // Event type breakdown (last 7 days)
      db.select({
        eventType: analyticsEvents.eventType,
        n: count(),
      })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, d7))
        .groupBy(analyticsEvents.eventType)
        .orderBy(desc(count())),

      // Last 20 page_view events with page + time
      db.select({
        sessionId: analyticsEvents.sessionId,
        page: analyticsEvents.page,
        createdAt: analyticsEvents.createdAt,
      })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventType, "page_view"))
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(20),

      // Daily sessions for last 14 days (for sparkline)
      db.select({
        day: sql<string>`DATE(${analyticsEvents.createdAt})`,
        sessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
      })
        .from(analyticsEvents)
        .where(gte(analyticsEvents.createdAt, new Date(now.getTime() - 14 * 86400000)))
        .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
        .orderBy(sql`DATE(${analyticsEvents.createdAt})`),
    ]);

    res.json({
      activeNow: activeNow.length,
      sessions: {
        today:  sessionsToday.length,
        week:   sessionsWeek.length,
        month:  sessionsMonth.length,
      },
      topPages: topPages.map(r => ({ page: r.page, views: r.views })),
      avgDuration: avgDurationRows.map(r => ({
        page: r.page,
        avgMs: Math.round(Number(r.avgMs)),
        samples: r.samples,
      })),
      eventBreakdown,
      recentActivity,
      dailyTrend,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
