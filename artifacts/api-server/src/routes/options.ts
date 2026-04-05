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
  scoresTable,
} from "@workspace/db/schema";
import { eq, desc, and, gte, sql, ne } from "drizzle-orm";
import { requireAuth, type AuthPayload } from "../middleware/auth";
import {
  generateSignals,
  generateRollRationale,
  getAvailableExpiries,
  fetchOptionsChainData,
  checkEarningsProximity,
} from "../lib/options-engine";
import { ibkrApiCall } from "./ibkr";
import { getTodaysBriefing } from "../lib/premarket-intelligence";
import { syncIbkrPositions } from "../lib/ibkr-sync";

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

    // ── Earnings proximity check (shared risk policy with from-chain path) ────
    // Any queue creation that lands within 7 days of earnings is hard-flagged
    // so the approval endpoint can block it (unless the user passes override:true).
    try {
      const earningsInfo = await checkEarningsProximity(s.ticker);
      if (earningsInfo.earningsWithin7Days) {
        riskChecksPassed = false;
        const days = earningsInfo.daysToEarnings ?? 0;
        riskNotes.push(
          `EARNINGS RISK: ${s.ticker} reports in ${days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`} ` +
          `(${earningsInfo.nextEarningsDate}). ` +
          "IV is elevated but the stock can gap significantly after the announcement. " +
          "Review carefully — you can override this block at approval time."
        );
      } else if (earningsInfo.earningsWithin14Days) {
        const days = earningsInfo.daysToEarnings ?? 0;
        riskNotes.push(
          `Note: ${s.ticker} reports in ${days} days (${earningsInfo.nextEarningsDate}). ` +
          "Earnings fall within the option DTE window — plan your exit accordingly."
        );
      }
    } catch {
      // Non-fatal — earnings check failure should not block queueing
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

    // ── Earnings hard block at approval time ──────────────────────────────────
    // If riskChecksPassed=false AND the risk note is an earnings-within-7-days flag,
    // we refuse to place the order unless the caller explicitly passes override=true.
    // This prevents the approval path from silently executing earnings-risk trades.
    if (!t.riskChecksPassed) {
      const isEarningsBlock = t.riskCheckNotes?.includes("EARNINGS RISK:");
      const override = req.body?.override === true;

      if (isEarningsBlock && !override) {
        res.status(409).json({
          error:           "earnings_risk_block",
          message:         `This trade cannot be approved automatically: ${t.ticker} has earnings within 7 days. ` +
                           "Trading through earnings dramatically increases risk due to IV crush or large price gaps. " +
                           "If you understand and accept this risk, resend your approval with { override: true }.",
          riskCheckNotes:  t.riskCheckNotes,
          canOverride:     true,
        });
        return;
      }
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
    const trade = await db.select().from(optionsTradesTable)
      .where(and(eq(optionsTradesTable.id, id), eq(optionsTradesTable.userId, user.userId)))
      .limit(1);
    if (!trade.length) { res.status(404).json({ error: "Trade not found" }); return; }

    const t = trade[0];
    const premium = t.premiumCollected ?? 0;
    // Auto-calculate realised P&L if closing price provided
    const finalPnl = realisedPnl ?? (
      closingPrice != null
        ? (premium - closingPrice * 100)  // bought back for less = profit
        : (status === "expired" ? premium : null)
    );

    const updated = await db
      .update(optionsTradesTable)
      .set({
        status:       status ?? undefined,
        closedAt:     ["closed","expired","assigned"].includes(status) ? new Date() : undefined,
        closingPrice: closingPrice ?? undefined,
        isAssigned:   isAssigned ?? undefined,
        realisedPnl:  finalPnl ?? undefined,
        notes:        notes ?? undefined,
      })
      .where(and(eq(optionsTradesTable.id, id), eq(optionsTradesTable.userId, user.userId)))
      .returning();

    res.json({ trade: updated[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to update trade" });
  }
});

// ─── Close Position via IBKR ──────────────────────────────────────────────────

router.post("/options/trades/:id/close", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const id = parseInt(req.params.id);
  const { limitPrice } = req.body; // user-specified buy-back price, or null for market

  try {
    const trade = await db.select().from(optionsTradesTable)
      .where(and(eq(optionsTradesTable.id, id), eq(optionsTradesTable.userId, user.userId)))
      .limit(1);
    if (!trade.length) { res.status(404).json({ error: "Trade not found" }); return; }

    const t = trade[0];
    if (t.status !== "open") { res.status(400).json({ error: "Trade is not open" }); return; }

    const conn = await db.select().from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    if (!conn.length || !conn[0].accessToken) {
      // No IBKR — just mark as closed manually
      await db.update(optionsTradesTable)
        .set({ status: "closed", closedAt: new Date(), notes: "Manually closed (no IBKR)" })
        .where(eq(optionsTradesTable.id, id));
      res.json({ status: "closed", method: "manual" });
      return;
    }

    // Place buy-to-close order via IBKR
    const accountId = conn[0].accountId;
    const right = t.right === "CALL" ? "C" : "P";
    const expiryFmt = t.expiry.replace(/-/g, "").slice(2);
    const buyBackPrice = limitPrice ?? parseFloat(((t.premiumCollected ?? 0) / 100 * 0.5).toFixed(2));

    try {
      const orderReq = {
        acctId: accountId,
        symbol: t.ticker,
        secType: "OPT",
        lastTradeDateOrContractMonth: expiryFmt,
        strike: t.strike,
        right,
        multiplier: 100,
        orderType: limitPrice ? "LMT" : "MKT",
        lmtPrice: limitPrice ?? undefined,
        side: "BUY",
        quantity: t.quantity ?? 1,
        tif: "GTC",
      };

      const result = await ibkrApiCall(user.userId, `/iserver/account/${accountId}/order`, "POST", orderReq);
      const ibkrCloseId = result?.order_id ?? result?.orderId ?? null;

      await db.update(optionsTradesTable)
        .set({
          status: "closed", closedAt: new Date(),
          closingPrice: buyBackPrice,
          realisedPnl: (t.premiumCollected ?? 0) - buyBackPrice * 100,
          notes: `Closed via IBKR order ${ibkrCloseId}`,
        })
        .where(eq(optionsTradesTable.id, id));

      res.json({ status: "closed", method: "ibkr", ibkrOrderId: ibkrCloseId, buyBackPrice });
    } catch (ibkrErr) {
      res.status(207).json({
        status: "ibkr_error",
        message: "Could not place IBKR order. Close the position manually in IBKR then mark it closed here.",
        error: (ibkrErr as Error).message,
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to close position" });
  }
});

// ─── Roll Position Forward ────────────────────────────────────────────────────

router.post("/options/trades/:id/roll", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const id = parseInt(req.params.id);

  try {
    const trade = await db.select().from(optionsTradesTable)
      .where(and(eq(optionsTradesTable.id, id), eq(optionsTradesTable.userId, user.userId)))
      .limit(1);
    if (!trade.length) { res.status(404).json({ error: "Trade not found" }); return; }

    const t = trade[0];
    // Generate next-month expiry (~30 days out, third Friday)
    const nextExpiry = new Date();
    nextExpiry.setDate(nextExpiry.getDate() + 30);
    const month = nextExpiry.getMonth();
    const year = nextExpiry.getFullYear();
    let thirdFriday = new Date(year, month, 1);
    let fridays = 0;
    while (fridays < 3) {
      if (thirdFriday.getDay() === 5) fridays++;
      if (fridays < 3) thirdFriday.setDate(thirdFriday.getDate() + 1);
    }
    const newExpiry = thirdFriday.toISOString().slice(0, 10);
    const currentDte = Math.max(0, Math.round((new Date(t.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    // Get AI rationale for the roll
    const rationale = await generateRollRationale({
      ticker: t.ticker,
      right: t.right as "PUT" | "CALL",
      currentStrike: t.strike,
      currentExpiry: t.expiry,
      dte: currentDte,
      currentPnlPct: 0, // unknown without live price
      suggestedStrike: t.strike,
      suggestedExpiry: newExpiry,
    }).catch(() => null);

    res.json({
      action: "roll",
      currentTrade: { id: t.id, ticker: t.ticker, strike: t.strike, expiry: t.expiry },
      proposedRoll: {
        ticker: t.ticker,
        right: t.right,
        strike: t.strike,
        newExpiry,
        daysAdded: 30,
      },
      rationale: rationale ?? `Rolling ${t.ticker} ${t.right} $${t.strike} from ${t.expiry} to ${newExpiry} extends the trade by ~30 days, giving the position more time to work in your favour and collecting additional premium.`,
      instruction: `In IBKR: use the "Roll" feature on this position, or place two orders simultaneously — Buy-to-Close the ${t.expiry} contract and Sell-to-Open the ${newExpiry} contract at the same strike $${t.strike}.`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate roll recommendation" });
  }
});

// ─── Covered Calls from IBKR Stock Holdings ───────────────────────────────────

router.get("/options/covered-calls", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;

  try {
    const conn = await db.select().from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    if (!conn.length || !conn[0].accessToken || !conn[0].accountId) {
      res.json({ connected: false, positions: [], message: "Connect your IBKR account to see covered call opportunities on your existing shares." });
      return;
    }

    // Fetch IBKR stock positions
    let ibkrPositions: Array<{ ticker: string; qty: number; avgCost: number; marketValue: number }> = [];
    try {
      const rawPositions = await ibkrApiCall(user.userId, `/iserver/portfolio/${conn[0].accountId}/positions/0`, "GET");
      ibkrPositions = (rawPositions ?? [])
        .filter((p: any) => p.assetClass === "STK" && (p.position ?? p.size ?? 0) >= 100)
        .map((p: any) => ({
          ticker:      p.ticker ?? p.contractDesc ?? "",
          qty:         p.position ?? p.size ?? 0,
          avgCost:     p.avgCost ?? 0,
          marketValue: p.mktValue ?? p.marketValue ?? 0,
        }));
    } catch (ibkrErr) {
      console.error("[CoveredCalls] IBKR positions fetch failed:", ibkrErr);
      res.json({ connected: true, positions: [], message: "Could not fetch positions from IBKR. Your session may have expired." });
      return;
    }

    if (!ibkrPositions.length) {
      res.json({ connected: true, positions: [], message: "No stock positions with 100+ shares found in IBKR. You need to own at least 100 shares of a stock to sell covered calls." });
      return;
    }

    // For each qualifying holding, generate a covered call suggestion
    const profile = await db.select().from(userRiskProfilesTable)
      .where(eq(userRiskProfilesTable.userId, user.userId))
      .limit(1);
    const { dteMax = 35 } = profile[0] ?? {};

    const suggestions = ibkrPositions.map((pos) => {
      const contracts = Math.floor(pos.qty / 100);
      // Suggest strike 5-8% above current price
      const currentPrice = pos.avgCost; // use avg cost as proxy; real price from IBKR
      const callStrike = Math.ceil(currentPrice * 1.06 / 5) * 5; // round up to nearest $5
      // Estimate premium (rough: 0.5-1.5% of strike for 30 DTE)
      const estPremium = (callStrike * 0.008).toFixed(2);
      const estIncome = (parseFloat(estPremium) * 100 * contracts).toFixed(0);

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + dteMax);
      const expiryStr = expiry.toISOString().slice(0, 10);

      return {
        ticker: pos.ticker,
        sharesOwned: pos.qty,
        contracts,
        avgCost: pos.avgCost,
        suggestedStrike: callStrike,
        suggestedExpiry: expiryStr,
        dte: dteMax,
        estPremiumPerContract: parseFloat(estPremium),
        estTotalIncome: parseFloat(estIncome),
        note: `You own ${pos.qty} shares (avg cost $${pos.avgCost.toFixed(2)}). Selling ${contracts} call${contracts > 1 ? "s" : ""} at $${callStrike} collects ~$${estIncome}. You keep the premium if the stock stays below $${callStrike} — and if it rises above, you sell your shares at a profit.`,
      };
    });

    res.json({ connected: true, positions: suggestions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch covered call opportunities" });
  }
});

// ─── Options Screener ─────────────────────────────────────────────────────────
// Enriches all active signals with return-on-capital, capital required,
// confidence score, and tier (holdings / safe / high_confidence)

router.get("/options/screener", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  const {
    strategy  = "all",
    tier      = "all",
    minROC    = "0",
    maxCapital = "999999",
    minConf   = "0",
    minIVP    = "0",
    sector    = "all",
    sortBy    = "roc",
  } = req.query as Record<string, string>;

  try {
    // 1. Fetch active signals joined with company name/sector/marketCap and latest score
    const rows = await db
      .selectDistinctOn([optionsSignalsTable.ticker], {
        signal:  optionsSignalsTable,
        company: {
          name:      companiesTable.name,
          sector:    companiesTable.sector,
          marketCap: companiesTable.marketCap,
        },
        score: {
          fortressScore: scoresTable.fortressScore,
        },
      })
      .from(optionsSignalsTable)
      .leftJoin(companiesTable, eq(optionsSignalsTable.ticker, companiesTable.ticker))
      .leftJoin(scoresTable, eq(optionsSignalsTable.ticker, scoresTable.ticker))
      .where(eq(optionsSignalsTable.status, "active"))
      .orderBy(optionsSignalsTable.ticker, desc(optionsSignalsTable.generatedAt));

    // 2. Check IBKR holdings to classify "holdings" tier
    const holdingTickers = new Set<string>();
    const ibkrConn = await db
      .select()
      .from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    if (ibkrConn.length && ibkrConn[0].accessToken) {
      try {
        const positions = await ibkrApiCall(
          ibkrConn[0] as any,
          "GET",
          `/portfolio/${ibkrConn[0].accountId}/positions/0`,
        );
        for (const pos of (positions ?? []) as any[]) {
          if (pos.assetClass === "STK" && pos.position >= 100) {
            holdingTickers.add(pos.conid?.toString() ?? pos.ticker ?? "");
          }
        }
      } catch (_) { /* IBKR not reachable — continue without holdings tier */ }
    }

    // 3. Enrich each signal
    const enriched = rows.map(({ signal, company, score }) => {
      const fortress = score?.fortressScore ?? signal.fortressScore ?? 0.5;
      const isHolding = holdingTickers.has(signal.ticker) && signal.strategy === "SELL_CALL";

      // Capital required: put = cash-secured (strike × 100); call = 0 (already own shares)
      const capitalRequired = isHolding
        ? 0
        : signal.strategy === "SELL_CALL"
          ? signal.strike * 100 // margin-secured call — approximate
          : signal.strike * 100; // cash-secured put

      // Annualised ROC — the most important metric
      // (premium per share × 365 / DTE) / (capital per share) × 100
      const baseCapital = isHolding ? signal.strike : signal.strike;
      const annualizedROC = baseCapital > 0
        ? (signal.premium / baseCapital) * (365 / Math.max(signal.dte, 1)) * 100
        : 0;

      // Composite confidence: 40% fortress, 30% IV percentile, 30% probability of profit
      const ivNorm   = Math.min((signal.ivPercentile ?? 0) / 100, 1);
      const probProf = signal.probabilityProfit ?? 0.65;
      const confidenceScore = Math.round((fortress * 0.4 + ivNorm * 0.3 + probProf * 0.3) * 100);

      // Tier: holdings first, then safe (high fortress), then high_confidence
      let assignedTier: "holdings" | "safe" | "high_confidence" = "high_confidence";
      if (isHolding) {
        assignedTier = "holdings";
      } else if (fortress >= 0.65) {
        assignedTier = "safe";
      }

      return {
        id:                signal.id,
        ticker:            signal.ticker,
        companyName:       company?.name ?? signal.ticker,
        sector:            company?.sector ?? null,
        marketCap:         company?.marketCap ?? null,
        strategy:          signal.strategy,
        regime:            signal.regime,
        strike:            signal.strike,
        expiry:            signal.expiry,
        dte:               signal.dte,
        premium:           signal.premium,
        premiumYieldPct:   signal.premiumYieldPct,
        probabilityProfit: signal.probabilityProfit,
        ivPercentile:      signal.ivPercentile,
        iv:                signal.iv,
        fortressScore:     fortress,
        aiRationale:       signal.aiRationale,
        generatedAt:       signal.generatedAt,
        // Computed
        capitalRequired,
        annualizedROC:     Math.round(annualizedROC * 10) / 10,
        confidenceScore,
        tier:              assignedTier,
        maxProfit:         Math.round(signal.premium * 100),
        // Max loss: put = (strike - premium) × 100; call covered = 0 (already own)
        maxLoss: isHolding
          ? null
          : signal.strategy === "SELL_PUT"
            ? Math.round((signal.strike - signal.premium) * 100)
            : null,
      };
    });

    // 4. Apply filters
    const minROCN    = parseFloat(minROC);
    const maxCapN    = parseFloat(maxCapital);
    const minConfN   = parseFloat(minConf);
    const minIVPN    = parseFloat(minIVP);

    let filtered = enriched.filter((s) => {
      if (strategy !== "all" && s.strategy !== strategy) return false;
      if (tier     !== "all" && s.tier     !== tier)     return false;
      if (s.annualizedROC < minROCN)                     return false;
      if (maxCapN < 999999 && s.capitalRequired > maxCapN && s.capitalRequired > 0) return false;
      if (s.confidenceScore < minConfN)                  return false;
      if ((s.ivPercentile ?? 0) < minIVPN)               return false;
      if (sector !== "all" && s.sector !== sector)       return false;
      return true;
    });

    // 5. Sort
    if (sortBy === "roc")        filtered.sort((a, b) => b.annualizedROC - a.annualizedROC);
    else if (sortBy === "confidence") filtered.sort((a, b) => b.confidenceScore - a.confidenceScore);
    else if (sortBy === "ivp")   filtered.sort((a, b) => (b.ivPercentile ?? 0) - (a.ivPercentile ?? 0));
    else if (sortBy === "capital") filtered.sort((a, b) => a.capitalRequired - b.capitalRequired);

    // 6. Collect distinct sectors for filter dropdowns
    const sectors = [...new Set(enriched.map((s) => s.sector).filter(Boolean))].sort();

    res.json({ signals: filtered, total: filtered.length, sectors });
  } catch (err) {
    console.error("[Options] Screener error:", err);
    res.status(500).json({ error: "Failed to run options screener" });
  }
});

// ─── Manual IBKR Position Sync ───────────────────────────────────────────────

router.post("/options/positions/sync", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;
  try {
    const result = await syncIbkrPositions(user.userId);
    res.json({
      success: true,
      summary: `Sync complete: ${result.matched} positions matched, ${result.autoClosed} auto-closed (not in IBKR), ${result.added} new positions added from IBKR.`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: "Sync failed", detail: (err as Error).message });
  }
});

// ─── Feedback Loop: Performance Stats ────────────────────────────────────────

router.get("/options/performance", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;

  try {
    const trades = await db.select().from(optionsTradesTable)
      .where(eq(optionsTradesTable.userId, user.userId));

    const closed = trades.filter((t) => t.status !== "open" && t.realisedPnl != null);
    const open = trades.filter((t) => t.status === "open");

    const wins = closed.filter((t) => (t.realisedPnl ?? 0) > 0);
    const losses = closed.filter((t) => (t.realisedPnl ?? 0) <= 0);

    const totalPremium = trades.reduce((s, t) => s + (t.premiumCollected ?? 0), 0);
    const realisedPnl  = closed.reduce((s, t) => s + (t.realisedPnl ?? 0), 0);
    const avgWin   = wins.length   ? wins.reduce((s, t) => s + (t.realisedPnl ?? 0), 0) / wins.length : 0;
    const avgLoss  = losses.length ? losses.reduce((s, t) => s + (t.realisedPnl ?? 0), 0) / losses.length : 0;
    const winRate  = closed.length ? wins.length / closed.length : null;

    // Income efficiency: did we actually collect what the signal promised?
    const avgRetentionPct = wins.length
      ? wins.reduce((s, t) => s + (t.realisedPnl ?? 0) / (t.premiumCollected ?? 1), 0) / wins.length * 100
      : null;

    // Strategy breakdown
    const byStrategy = ["PUT", "CALL"].map((right) => {
      const group = closed.filter((t) => t.right === right);
      const groupWins = group.filter((t) => (t.realisedPnl ?? 0) > 0);
      return {
        right,
        trades: group.length,
        winRate: group.length ? groupWins.length / group.length : null,
        totalPnl: group.reduce((s, t) => s + (t.realisedPnl ?? 0), 0),
      };
    });

    res.json({
      summary: {
        totalTrades: trades.length,
        openTrades: open.length,
        closedTrades: closed.length,
        wins: wins.length,
        losses: losses.length,
        winRate,
        totalPremiumCollected: totalPremium,
        realisedPnl,
        avgWin,
        avgLoss,
        avgRetentionPct,
        expectancy: winRate != null ? (winRate * avgWin + (1 - winRate) * avgLoss) : null,
      },
      byStrategy,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch performance" });
  }
});

// ─── Chain View — queue from raw contract ─────────────────────────────────────

// POST /api/options/queue/from-chain
// Creates a trade review queue entry directly from a chain contract (no pre-existing signal).
// Performs a server-side 7-day earnings proximity check and appends a risk note.
router.post("/options/queue/from-chain", requireAuth, async (req, res) => {
  const payload = (req as any).user as AuthPayload;
  const userId = payload.userId;

  const {
    ticker,
    side,         // "call" | "put"
    strike,
    expiry,
    dte,
    mid,          // per-share mid-price (market convention — 1 contract = mid × 100)
    currentPrice, // underlying stock price; required for call collateral calculation
    iv,
    delta,
    theta,
    openInterest,
  } = req.body ?? {};

  if (!ticker || !side || !strike || !expiry || !dte || mid == null) {
    res.status(400).json({ error: "Missing required fields: ticker, side, strike, expiry, dte, mid" });
    return;
  }

  const strategy = side === "put" ? "SELL_PUT" : "SELL_CALL";

  // estimatedPremium stored in per-contract units (mid × 100) to match the
  // standard signal path and the premiumCollected field in options_trades.
  const estimatedPremium = Number(mid) * 100;

  // Collateral model:
  //   SELL_PUT  → cash-secured: strike × 100 (worst case: you buy 100 shares at strike)
  //   SELL_CALL → covered or naked: underlying price × 100 (cost to acquire if exercised)
  //               If currentPrice isn't sent, fall back to strike × 100.
  const underlyingPrice = currentPrice != null ? Number(currentPrice) : Number(strike);
  const collateral = side === "put"
    ? Number(strike) * 100
    : underlyingPrice * 100;

  // ── Server-side 7-day earnings guard ──────────────────────────────────────
  const riskNotes: string[] = [];
  let riskChecksPassed = true;

  try {
    const earnings = await checkEarningsProximity(ticker.toUpperCase());

    if (earnings.earningsWithin7Days) {
      riskChecksPassed = false;
      const days = earnings.daysToEarnings ?? 0;
      riskNotes.push(
        `EARNINGS RISK: ${ticker} reports in ${days === 0 ? "today" : days === 1 ? "1 day" : days + " days"} (${earnings.nextEarningsDate}). ` +
        "IV is elevated, increasing premium collected, but the stock can gap significantly after the announcement. " +
        "This trade is queued with a risk flag — review carefully before placing."
      );
    } else if (earnings.earningsWithin14Days) {
      const days = earnings.daysToEarnings ?? 0;
      riskNotes.push(
        `Note: ${ticker} reports in ${days} days (${earnings.nextEarningsDate}). ` +
        "Earnings fall within your option's DTE window — consider this when planning your exit."
      );
    }
  } catch {
    // Non-fatal — earnings check failure should not block queueing
  }

  const midPerShare = Number(mid);
  const aiRationale = `Chain View selection: ${side.toUpperCase()} $${strike} expiring ${expiry} (${dte} DTE). ` +
    `Mid-price: $${midPerShare.toFixed(2)}/share ($${estimatedPremium.toFixed(0)}/contract). ` +
    (iv != null ? `Implied volatility: ${iv}%. ` : "") +
    (delta != null ? `Delta: ${delta}. ` : "") +
    (theta != null ? `Theta (daily decay): $${(theta * 100).toFixed(2)}/contract. ` : "") +
    (openInterest != null ? `Open interest: ${openInterest.toLocaleString()} contracts.` : "");

  const [queueItem] = await db
    .insert(tradeReviewQueueTable)
    .values({
      userId,
      signalId:          null,
      ticker:            ticker.toUpperCase(),
      strategy,
      strike:            Number(strike),
      expiry,
      dte:               Number(dte),
      quantity:          1,
      limitPrice:        midPerShare,      // per-share (IBKR order price convention)
      estimatedPremium,                   // per-contract (mid × 100), matches signal path
      collateralRequired: collateral,
      maxRisk:           collateral,
      aiRationale,
      riskChecksPassed,
      riskCheckNotes:    riskNotes.length > 0 ? riskNotes.join(" | ") : null,
      status:            "pending",
    })
    .returning();

  res.json({
    success:          true,
    queueId:          queueItem.id,
    riskChecksPassed,
    riskNotes,
    message:          riskChecksPassed
      ? `${ticker} ${strategy} added to your review queue.`
      : `${ticker} ${strategy} queued with an earnings risk flag — please review before placing.`,
  });
});

// ─── Options Chain View ───────────────────────────────────────────────────────

// GET /api/options/chain/:ticker/expiries
// Returns all available expiry dates labelled for the chain view expiry selector
router.get("/options/chain/:ticker/expiries", requireAuth, async (req, res) => {
  const { ticker } = req.params;
  try {
    const expiries = await getAvailableExpiries(ticker.toUpperCase());
    res.json({ expiries });
  } catch (err) {
    console.error("[Options] Chain expiries error:", err);
    res.status(500).json({ error: "Failed to fetch expiries" });
  }
});

// GET /api/options/chain/:ticker?expiry=YYYY-MM-DD
// Returns full call + put chain for a ticker at a given expiry (or nearest if omitted)
router.get("/options/chain/:ticker", requireAuth, async (req, res) => {
  const { ticker } = req.params;
  const expiry = (req.query.expiry as string) || undefined;
  const user = (req as any).user as AuthPayload;

  try {
    const chain = await fetchOptionsChainData(ticker.toUpperCase(), expiry, user.userId);
    if (!chain) {
      res.status(404).json({ error: "No options chain data available for this ticker. It may not have listed options or there was a data issue." });
      return;
    }
    res.json(chain);
  } catch (err) {
    console.error("[Options] Chain fetch error:", err);
    res.status(500).json({ error: "Failed to fetch options chain" });
  }
});

// GET /api/options/chain/:ticker/earnings
// Quick earnings check — used by signals page to show earnings warnings
router.get("/options/chain/:ticker/earnings", requireAuth, async (req, res) => {
  const { ticker } = req.params;
  try {
    const info = await checkEarningsProximity(ticker.toUpperCase());
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: "Failed to check earnings" });
  }
});

export default router;
