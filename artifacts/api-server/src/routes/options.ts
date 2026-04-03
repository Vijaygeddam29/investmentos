/**
 * Options Engine Routes
 *
 * GET  /api/options/signals               → ranked wheel candidate signals
 * POST /api/options/signals/generate      → trigger signal generation (admin or user)
 * POST /api/options/signals/:id/dismiss   → dismiss a signal
 *
 * GET  /api/options/queue                 → pending trades for user
 * POST /api/options/queue/:id/approve     → approve + place order via IBKR
 * POST /api/options/queue/:id/reject      → reject a pending trade
 *
 * GET  /api/options/trades                → trade history for user
 * GET  /api/options/income                → monthly income summary
 *
 * GET  /api/user/risk-profile             → get user risk profile
 * PUT  /api/user/risk-profile             → update user risk profile
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  optionsSignalsTable,
  tradeReviewQueueTable,
  optionsTradesTable,
  userRiskProfilesTable,
  ibkrConnectionsTable,
  companiesTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, sql, ne } from "drizzle-orm";
import { requireAuth, type AuthPayload } from "../middleware/auth";
import { generateSignals, generateRollRationale } from "../lib/options-engine";
import { ibkrApiCall } from "./ibkr";
import { getTodaysBriefing } from "../lib/premarket-intelligence";

const router: IRouter = Router();

// ─── Risk Profile ─────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = {
  profitTargetPct:       50,
  maxLossMultiple:       2,
  maxLossAmount:         null,
  deltaPreference:       "moderate",
  dteMin:                21,
  dteMax:                35,
  maxPositions:          5,
  maxCapitalPerTradePct: 10,
  marginCapPct:          25,
  ivPercentileMin:       30,
  monthlyIncomeTarget:   null,
};

router.get("/user/risk-profile", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    const rows = await db
      .select()
      .from(userRiskProfilesTable)
      .where(eq(userRiskProfilesTable.userId, user.userId))
      .limit(1);

    res.json(rows.length ? rows[0] : { ...DEFAULT_PROFILE, userId: user.userId });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch risk profile" });
  }
});

router.put("/user/risk-profile", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const body = req.body;

  // Validate bounds
  const profitTargetPct = Math.min(Math.max(body.profitTargetPct ?? 50, 10), 90);
  const maxLossMultiple = Math.min(Math.max(body.maxLossMultiple ?? 2, 1), 5);
  const marginCapPct    = Math.min(Math.max(body.marginCapPct ?? 25, 5), 50);
  const deltaPreference = ["conservative", "moderate", "aggressive"].includes(body.deltaPreference)
    ? body.deltaPreference : "moderate";

  try {
    const updated = await db
      .insert(userRiskProfilesTable)
      .values({
        userId:                user.userId,
        profitTargetPct,
        maxLossMultiple,
        maxLossAmount:         body.maxLossAmount ?? null,
        deltaPreference,
        dteMin:                body.dteMin ?? 21,
        dteMax:                body.dteMax ?? 35,
        maxPositions:          body.maxPositions ?? 5,
        maxCapitalPerTradePct: body.maxCapitalPerTradePct ?? 10,
        marginCapPct,
        ivPercentileMin:       body.ivPercentileMin ?? 30,
        monthlyIncomeTarget:   body.monthlyIncomeTarget ?? null,
        updatedAt:             new Date(),
      })
      .onConflictDoUpdate({
        target: userRiskProfilesTable.userId,
        set: {
          profitTargetPct,
          maxLossMultiple,
          maxLossAmount:         body.maxLossAmount ?? null,
          deltaPreference,
          dteMin:                body.dteMin ?? 21,
          dteMax:                body.dteMax ?? 35,
          maxPositions:          body.maxPositions ?? 5,
          maxCapitalPerTradePct: body.maxCapitalPerTradePct ?? 10,
          marginCapPct,
          ivPercentileMin:       body.ivPercentileMin ?? 30,
          monthlyIncomeTarget:   body.monthlyIncomeTarget ?? null,
          updatedAt:             new Date(),
        },
      })
      .returning();

    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to save risk profile" });
  }
});

// ─── Signals ──────────────────────────────────────────────────────────────────

router.get("/options/signals", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const signals = await db
      .select({
        signal: optionsSignalsTable,
        company: {
          name:   companiesTable.name,
          sector: companiesTable.sector,
        },
      })
      .from(optionsSignalsTable)
      .leftJoin(companiesTable, eq(optionsSignalsTable.ticker, companiesTable.ticker))
      .where(and(
        eq(optionsSignalsTable.status, "active"),
        gte(optionsSignalsTable.generatedAt, since),
      ))
      .orderBy(desc(optionsSignalsTable.premiumYieldPct))
      .limit(50);

    res.json({ signals });
  } catch (err) {
    console.error("[Options] Signals fetch error:", err);
    res.status(500).json({ error: "Failed to fetch signals" });
  }
});

router.post("/options/signals/generate", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    // Get today's macro context for AI reasoning
    const briefing = await getTodaysBriefing();
    const macroContext = briefing?.optionsImplications ?? undefined;

    // Run signal generation async — respond immediately
    res.json({ status: "generating", message: "Signal generation started. Check back in 2–3 minutes." });

    generateSignals(user.userId, macroContext).catch((err) => {
      console.error("[Options] Signal generation failed:", err);
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to start signal generation" });
  }
});

router.post("/options/signals/:id/dismiss", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.update(optionsSignalsTable)
      .set({ status: "dismissed", dismissedAt: new Date() })
      .where(eq(optionsSignalsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss signal" });
  }
});

// ─── Trade Review Queue ───────────────────────────────────────────────────────

router.get("/options/queue", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    const queue = await db
      .select()
      .from(tradeReviewQueueTable)
      .where(and(
        eq(tradeReviewQueueTable.userId, user.userId),
        eq(tradeReviewQueueTable.status, "pending"),
      ))
      .orderBy(desc(tradeReviewQueueTable.createdAt));

    res.json({ queue });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trade queue" });
  }
});

// Add signal to user's review queue
router.post("/options/queue", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const { signalId } = req.body;

  try {
    const signal = await db
      .select()
      .from(optionsSignalsTable)
      .where(eq(optionsSignalsTable.id, signalId))
      .limit(1);

    if (!signal.length) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    const s = signal[0];

    // Risk checks
    const ibkrConn = await db
      .select()
      .from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    const riskProfile = await db
      .select()
      .from(userRiskProfilesTable)
      .where(eq(userRiskProfilesTable.userId, user.userId))
      .limit(1);

    const profile = riskProfile[0];
    const accountNlv = ibkrConn[0]?.netLiquidation ?? null;

    const riskNotes: string[] = [];
    let riskChecksPassed = true;

    if (!ibkrConn.length) {
      riskNotes.push("No IBKR account connected — order cannot be placed");
      riskChecksPassed = false;
    }

    // Collateral required for the position
    const collateral = s.strategy === "SELL_CALL"
      ? (s.strike * 100)
      : (s.strike * 100); // both require ~strike × 100 collateral for 1 contract

    const maxCapPct = profile?.maxCapitalPerTradePct ?? 10;
    if (accountNlv && collateral > accountNlv * (maxCapPct / 100)) {
      riskNotes.push(`Collateral $${collateral.toFixed(0)} exceeds ${maxCapPct}% capital limit`);
    }

    // Check pending position count
    const pendingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tradeReviewQueueTable)
      .where(and(
        eq(tradeReviewQueueTable.userId, user.userId),
        eq(tradeReviewQueueTable.status, "pending"),
      ));

    const maxPos = profile?.maxPositions ?? 5;
    if ((pendingCount[0]?.count ?? 0) >= maxPos) {
      riskNotes.push(`Already at max positions limit (${maxPos})`);
    }

    const queueItem = await db
      .insert(tradeReviewQueueTable)
      .values({
        userId:           user.userId,
        signalId:         s.id,
        ticker:           s.ticker,
        strategy:         s.strategy,
        strike:           s.strike,
        expiry:           s.expiry,
        dte:              s.dte,
        quantity:         1,
        limitPrice:       s.premium,
        estimatedPremium: (s.premium ?? 0) * 100,
        collateralRequired: collateral,
        maxRisk:          (s.premium ?? 0) * 100 * (profile?.maxLossMultiple ?? 2),
        aiRationale:      s.aiRationale,
        riskChecksPassed,
        riskCheckNotes:   riskNotes.join("; ") || null,
        status:           "pending",
        createdAt:        new Date(),
      })
      .returning();

    res.status(201).json({ item: queueItem[0], riskChecksPassed, riskNotes });
  } catch (err) {
    console.error("[Options] Queue add error:", err);
    res.status(500).json({ error: "Failed to add to trade queue" });
  }
});

router.post("/options/queue/:id/approve", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const id = parseInt(req.params.id);

  try {
    const item = await db
      .select()
      .from(tradeReviewQueueTable)
      .where(and(eq(tradeReviewQueueTable.id, id), eq(tradeReviewQueueTable.userId, user.userId)))
      .limit(1);

    if (!item.length) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }

    const t = item[0];
    if (t.status !== "pending") {
      res.status(400).json({ error: `Trade is already ${t.status}` });
      return;
    }

    // Check IBKR connection
    const conn = await db
      .select()
      .from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    if (!conn.length || !conn[0].accessToken) {
      res.status(400).json({ error: "No IBKR account connected. Connect your account first." });
      return;
    }

    let ibkrOrderId: string | null = null;
    let orderStatus = "placed";

    // Attempt IBKR order placement
    try {
      const accountId = conn[0].accountId;
      if (!accountId) throw new Error("No account ID");

      const right = t.strategy === "SELL_CALL" ? "C" : "P";
      const expiryFormatted = t.expiry.replace(/-/g, "").slice(2); // YYMMDD

      const orderReq = {
        acctId: accountId,
        conid:  0, // will be looked up by symbol
        symbol: t.ticker,
        secType: "OPT",
        lastTradeDateOrContractMonth: expiryFormatted,
        strike: t.strike,
        right,
        multiplier: 100,
        orderType: "LMT",
        lmtPrice: t.limitPrice,
        side: "SELL",
        quantity: t.quantity,
        tif: "GTC",
      };

      const orderResult = await ibkrApiCall(user.userId, `/iserver/account/${accountId}/order`, "POST", orderReq);
      ibkrOrderId = orderResult?.order_id ?? orderResult?.orderId ?? null;
    } catch (ibkrErr) {
      console.error("[Options] IBKR order failed:", ibkrErr);
      orderStatus = "ibkr_error";

      await db.update(tradeReviewQueueTable)
        .set({
          status:       "approved",
          reviewedAt:   new Date(),
          riskCheckNotes: `IBKR order failed: ${(ibkrErr as Error).message}. Trade approved but not placed — check IBKR manually.`,
        })
        .where(eq(tradeReviewQueueTable.id, id));

      res.status(207).json({
        status:       "approved_not_placed",
        message:      "Trade approved but IBKR order placement failed. Please place manually in your IBKR account.",
        error:        (ibkrErr as Error).message,
      });
      return;
    }

    // Update queue item
    await db.update(tradeReviewQueueTable)
      .set({ status: "approved", reviewedAt: new Date(), ibkrOrderId })
      .where(eq(tradeReviewQueueTable.id, id));

    // Log the trade
    const today = new Date();
    const monthlyBucket = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    await db.insert(optionsTradesTable).values({
      userId:           user.userId,
      ticker:           t.ticker,
      right:            t.strategy === "SELL_CALL" ? "CALL" : "PUT",
      strike:           t.strike,
      expiry:           t.expiry,
      quantity:         t.quantity,
      premiumCollected: t.estimatedPremium,
      openedAt:         new Date(),
      status:           "open",
      monthlyBucket,
      ibkrOrderId,
    });

    res.json({ status: "approved", orderStatus, ibkrOrderId });
  } catch (err) {
    console.error("[Options] Approve error:", err);
    res.status(500).json({ error: "Failed to approve trade" });
  }
});

router.post("/options/queue/:id/reject", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const id = parseInt(req.params.id);

  try {
    await db.update(tradeReviewQueueTable)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(and(eq(tradeReviewQueueTable.id, id), eq(tradeReviewQueueTable.userId, user.userId)));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject trade" });
  }
});

// ─── Trade History + Income ───────────────────────────────────────────────────

router.get("/options/trades", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    const trades = await db
      .select()
      .from(optionsTradesTable)
      .where(eq(optionsTradesTable.userId, user.userId))
      .orderBy(desc(optionsTradesTable.openedAt))
      .limit(100);

    res.json({ trades });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trades" });
  }
});

router.get("/options/income", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    const monthly = await db
      .select({
        bucket:          optionsTradesTable.monthlyBucket,
        totalPremium:    sql<number>`sum(premium_collected)`,
        realisedPnl:     sql<number>`sum(realised_pnl)`,
        tradeCount:      sql<number>`count(*)`,
        assignments:     sql<number>`sum(case when is_assigned then 1 else 0 end)`,
      })
      .from(optionsTradesTable)
      .where(eq(optionsTradesTable.userId, user.userId))
      .groupBy(optionsTradesTable.monthlyBucket)
      .orderBy(desc(optionsTradesTable.monthlyBucket));

    const openTrades = await db
      .select()
      .from(optionsTradesTable)
      .where(and(
        eq(optionsTradesTable.userId, user.userId),
        eq(optionsTradesTable.status, "open"),
      ))
      .orderBy(desc(optionsTradesTable.openedAt));

    const profile = await db
      .select({ monthlyIncomeTarget: userRiskProfilesTable.monthlyIncomeTarget })
      .from(userRiskProfilesTable)
      .where(eq(userRiskProfilesTable.userId, user.userId))
      .limit(1);

    res.json({
      monthly,
      openTrades,
      monthlyIncomeTarget: profile[0]?.monthlyIncomeTarget ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch income summary" });
  }
});

// ─── Close / Update Trade (for assignments, expiry) ──────────────────────────

router.patch("/options/trades/:id", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const id = parseInt(req.params.id);
  const { status, closingPrice, isAssigned, realisedPnl, notes } = req.body;

  try {
    const updated = await db
      .update(optionsTradesTable)
      .set({
        status:       status ?? undefined,
        closedAt:     status === "closed" || status === "expired" || status === "assigned" ? new Date() : undefined,
        closingPrice: closingPrice ?? undefined,
        isAssigned:   isAssigned ?? undefined,
        realisedPnl:  realisedPnl ?? undefined,
        notes:        notes ?? undefined,
      })
      .where(and(eq(optionsTradesTable.id, id), eq(optionsTradesTable.userId, user.userId)))
      .returning();

    res.json({ trade: updated[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update trade" });
  }
});

export default router;
