/**
 * Pre-Market Intelligence Routes
 *
 * GET  /api/intelligence/premarket/today    → today's briefing
 * GET  /api/intelligence/premarket/history  → past 30 briefings
 * POST /api/intelligence/premarket/run      → trigger pipeline manually (admin)
 * GET  /api/intelligence/premarket/macro    → latest macro snapshots
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { premarketBriefingsTable, macroSnapshotsTable } from "@workspace/db/schema";
import { eq, desc, gte, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import {
  runPremarketPipeline,
  getTodaysBriefing,
  fetchMacroSnapshots,
} from "../lib/premarket-intelligence";

const router: IRouter = Router();

// ─── GET /api/intelligence/premarket/today ────────────────────────────────────

router.get("/intelligence/premarket/today", requireAuth, async (_req, res) => {
  try {
    const briefing = await getTodaysBriefing();

    if (!briefing) {
      // Return macro data even if full briefing not ready
      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const snapshots = await db
        .select()
        .from(macroSnapshotsTable)
        .where(gte(macroSnapshotsTable.snapshotAt, since))
        .orderBy(desc(macroSnapshotsTable.snapshotAt));

      res.json({ briefing: null, hasMacroData: snapshots.length > 0, snapshots: snapshots.slice(0, 14) });
      return;
    }

    res.json({ briefing });
  } catch (err) {
    console.error("[Premarket] Today fetch error:", err);
    res.status(500).json({ error: "Failed to fetch today's briefing" });
  }
});

// ─── GET /api/intelligence/premarket/history ──────────────────────────────────

router.get("/intelligence/premarket/history", requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(premarketBriefingsTable)
      .orderBy(desc(premarketBriefingsTable.date))
      .limit(30);

    res.json({ briefings: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch briefing history" });
  }
});

// ─── POST /api/intelligence/premarket/run ─────────────────────────────────────

router.post("/intelligence/premarket/run", requireAdmin, async (_req, res) => {
  try {
    res.json({ status: "running", message: "Pre-market pipeline started. Results available in ~60 seconds." });

    runPremarketPipeline().catch((err) => {
      console.error("[Premarket] Pipeline failed:", err);
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger pipeline" });
  }
});

// ─── GET /api/intelligence/premarket/macro ────────────────────────────────────

router.get("/intelligence/premarket/macro", requireAuth, async (_req, res) => {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    // Get latest reading per instrument today
    const snaps = await db
      .select()
      .from(macroSnapshotsTable)
      .where(gte(macroSnapshotsTable.snapshotAt, since))
      .orderBy(desc(macroSnapshotsTable.snapshotAt));

    // De-dupe to latest per instrument
    const seen = new Set<string>();
    const latest = snaps.filter((s) => {
      if (seen.has(s.instrument)) return false;
      seen.add(s.instrument);
      return true;
    });

    res.json({ snapshots: latest });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch macro data" });
  }
});

// ─── POST /api/intelligence/premarket/macro/refresh ───────────────────────────

router.post("/intelligence/premarket/macro/refresh", requireAuth, async (_req, res) => {
  try {
    res.json({ status: "refreshing" });
    fetchMacroSnapshots().catch(console.error);
  } catch (err) {
    res.status(500).json({ error: "Failed to refresh macro data" });
  }
});

export default router;
