import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  portfolioHoldingsTable,
  scoresTable,
  companiesTable,
  financialMetricsTable,
  priceHistoryTable,
} from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

// ─── Recommendation engine ───────────────────────────────────────────────────
type Action = "ADD" | "HOLD" | "TRIM" | "SELL";

interface ActionMeta {
  action: Action;
  rationale: string;
  urgency: "high" | "medium" | "low";
}

function recommend(
  fortress: number | null,
  rocket: number | null,
  wave: number | null,
  timing: number | null,
  marginOfSafety: number | null,
  pnlPct: number | null
): ActionMeta {
  const f = fortress ?? 0;
  const r = rocket ?? 0;
  const w = wave ?? 0;
  const t = timing ?? 0.5;
  const quality = f * 0.4 + r * 0.35 + w * 0.25;

  // SELL — business quality is deteriorating
  if (quality < 0.38) {
    return {
      action: "SELL",
      rationale: "Composite quality score below threshold. Fundamental thesis is weak across Fortress/Rocket/Wave engines.",
      urgency: quality < 0.30 ? "high" : "medium",
    };
  }

  // SELL — you're underwater AND quality is poor
  if ((pnlPct ?? 0) < -0.25 && quality < 0.48) {
    return {
      action: "SELL",
      rationale: "Position is down >25% and quality scores do not support recovery thesis.",
      urgency: "high",
    };
  }

  // TRIM — great gains but technical picture is overbought
  if ((pnlPct ?? 0) > 0.60 && t < 0.38) {
    return {
      action: "TRIM",
      rationale: "Large unrealised gain with weakening entry timing (overbought). Consider locking in partial profits.",
      urgency: "medium",
    };
  }

  // TRIM — quality declining but still has value
  if (quality >= 0.38 && quality < 0.50 && (pnlPct ?? 0) > 0.20) {
    return {
      action: "TRIM",
      rationale: "Quality metrics softening. Reduce exposure while position is still profitable.",
      urgency: "low",
    };
  }

  // ADD — high quality, attractive entry, undervalued
  if (quality >= 0.62 && t >= 0.58 && (marginOfSafety == null || marginOfSafety >= 0)) {
    return {
      action: "ADD",
      rationale: "Strong Fortress/Rocket/Wave scores combined with favourable entry timing. Thesis intact and valuation is reasonable.",
      urgency: quality >= 0.72 ? "high" : "medium",
    };
  }

  // Default HOLD
  return {
    action: "HOLD",
    rationale: "Quality is solid but timing or valuation does not yet support adding. Continue to monitor.",
    urgency: "low",
  };
}

// ─── GET /api/portfolio ──────────────────────────────────────────────────────
router.get("/portfolio", async (_req, res) => {
  try {
    const holdings = await db
      .select()
      .from(portfolioHoldingsTable)
      .orderBy(portfolioHoldingsTable.ticker);

    if (!holdings.length) {
      res.json({ holdings: [], summary: null });
      return;
    }

    const tickers = [...new Set(holdings.map((h) => h.ticker))];

    // Fetch latest scores for each ticker
    const allScores = await db
      .select()
      .from(scoresTable)
      .where(inArray(scoresTable.ticker, tickers))
      .orderBy(desc(scoresTable.date));

    const latestScores: Record<string, typeof allScores[0]> = {};
    for (const row of allScores) {
      if (!latestScores[row.ticker]) latestScores[row.ticker] = row;
    }

    // Fetch company metadata
    const companies = await db
      .select()
      .from(companiesTable)
      .where(inArray(companiesTable.ticker, tickers));

    const companyMap: Record<string, typeof companies[0]> = {};
    for (const c of companies) companyMap[c.ticker] = c;

    // Fetch latest metrics (margin of safety)
    const allMetrics = await db
      .select({
        ticker: financialMetricsTable.ticker,
        date:   financialMetricsTable.date,
        marginOfSafety: financialMetricsTable.marginOfSafety,
        peRatio:        financialMetricsTable.peRatio,
        priceToBook:    financialMetricsTable.priceToBook,
      })
      .from(financialMetricsTable)
      .where(inArray(financialMetricsTable.ticker, tickers))
      .orderBy(desc(financialMetricsTable.date));

    const latestMetrics: Record<string, typeof allMetrics[0]> = {};
    for (const m of allMetrics) {
      if (!latestMetrics[m.ticker]) latestMetrics[m.ticker] = m;
    }

    // Fetch latest price for each ticker
    const allPrices = await db
      .select({
        ticker: priceHistoryTable.ticker,
        date:   priceHistoryTable.date,
        close:  priceHistoryTable.close,
      })
      .from(priceHistoryTable)
      .where(inArray(priceHistoryTable.ticker, tickers))
      .orderBy(desc(priceHistoryTable.date));

    const latestPrice: Record<string, number | null> = {};
    for (const p of allPrices) {
      if (latestPrice[p.ticker] === undefined) latestPrice[p.ticker] = p.close;
    }

    // Build enriched holdings
    let totalCost = 0;
    let totalCurrentValue = 0;

    const enriched = holdings.map((h) => {
      const scores  = latestScores[h.ticker] ?? null;
      const company = companyMap[h.ticker] ?? null;
      const metrics = latestMetrics[h.ticker] ?? null;
      const price   = latestPrice[h.ticker] ?? null;

      const costBasis     = h.shares * h.purchasePrice;
      const currentValue  = price != null ? h.shares * price : null;
      const unrealisedPnl = currentValue != null ? currentValue - costBasis : null;
      const pnlPct        = currentValue != null ? (currentValue - costBasis) / costBasis : null;

      totalCost += costBasis;
      if (currentValue != null) totalCurrentValue += currentValue;

      const { action, rationale, urgency } = recommend(
        scores?.fortressScore ?? null,
        scores?.rocketScore ?? null,
        scores?.waveScore ?? null,
        scores?.entryTimingScore ?? null,
        metrics?.marginOfSafety ?? null,
        pnlPct
      );

      const qualityScore = scores
        ? (scores.fortressScore ?? 0) * 0.4 +
          (scores.rocketScore  ?? 0) * 0.35 +
          (scores.waveScore    ?? 0) * 0.25
        : null;

      return {
        id:            h.id,
        ticker:        h.ticker,
        name:          company?.name ?? h.ticker,
        sector:        company?.sector ?? null,
        shares:        h.shares,
        purchasePrice: h.purchasePrice,
        purchaseDate:  h.purchaseDate,
        notes:         h.notes,
        currentPrice:  price,
        costBasis,
        currentValue,
        unrealisedPnl,
        pnlPct,
        // Scores
        qualityScore,
        fortressScore:  scores?.fortressScore ?? null,
        rocketScore:    scores?.rocketScore  ?? null,
        waveScore:      scores?.waveScore    ?? null,
        entryTimingScore: scores?.entryTimingScore ?? null,
        // Metrics
        marginOfSafety: metrics?.marginOfSafety ?? null,
        peRatio:        metrics?.peRatio ?? null,
        priceToBook:    metrics?.priceToBook ?? null,
        // Recommendation
        action,
        rationale,
        urgency,
      };
    });

    const totalPnl    = totalCurrentValue - totalCost;
    const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : null;

    // Weighted portfolio quality
    const weighted = enriched
      .filter((h) => h.qualityScore != null && h.currentValue != null)
      .map((h) => ({ q: h.qualityScore!, w: h.currentValue! }));
    const totalW = weighted.reduce((s, x) => s + x.w, 0);
    const portfolioQuality = totalW > 0
      ? weighted.reduce((s, x) => s + x.q * x.w, 0) / totalW
      : null;

    const actionCounts = { ADD: 0, HOLD: 0, TRIM: 0, SELL: 0 };
    for (const h of enriched) actionCounts[h.action]++;

    res.json({
      holdings: enriched,
      summary: {
        totalCost,
        totalCurrentValue: totalCurrentValue || null,
        totalPnl:     totalCurrentValue ? totalPnl : null,
        totalPnlPct:  totalCurrentValue ? totalPnlPct : null,
        portfolioQuality,
        actionCounts,
        holdingCount: enriched.length,
      },
    });
  } catch (err) {
    console.error("[Portfolio] GET error", err);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

// ─── POST /api/portfolio/holdings ────────────────────────────────────────────
router.post("/portfolio/holdings", async (req, res) => {
  try {
    const { ticker, shares, purchasePrice, purchaseDate, notes } = req.body;
    if (!ticker || !shares || !purchasePrice) {
      res.status(400).json({ error: "ticker, shares, and purchasePrice are required" });
      return;
    }
    const [row] = await db
      .insert(portfolioHoldingsTable)
      .values({
        ticker:        String(ticker).toUpperCase().trim(),
        shares:        Number(shares),
        purchasePrice: Number(purchasePrice),
        purchaseDate:  purchaseDate ?? null,
        notes:         notes ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[Portfolio] POST error", err);
    res.status(500).json({ error: "Failed to add holding" });
  }
});

// ─── POST /api/portfolio/upload (CSV bulk import) ────────────────────────────
router.post("/portfolio/upload", async (req, res) => {
  try {
    // Expects JSON body: { rows: [{ticker, shares, purchasePrice, purchaseDate?}] }
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "rows array is required" });
      return;
    }
    const inserts = rows.map((r: any) => ({
      ticker:        String(r.ticker ?? "").toUpperCase().trim(),
      shares:        Number(r.shares),
      purchasePrice: Number(r.purchasePrice ?? r.purchase_price ?? r.price),
      purchaseDate:  r.purchaseDate ?? r.purchase_date ?? null,
      notes:         r.notes ?? null,
    })).filter((r) => r.ticker && !isNaN(r.shares) && !isNaN(r.purchasePrice));

    if (!inserts.length) {
      res.status(400).json({ error: "No valid rows found in upload" });
      return;
    }

    // Clear existing portfolio before importing
    await db.delete(portfolioHoldingsTable);
    const inserted = await db.insert(portfolioHoldingsTable).values(inserts).returning();
    res.status(201).json({ imported: inserted.length, holdings: inserted });
  } catch (err) {
    console.error("[Portfolio] Upload error", err);
    res.status(500).json({ error: "Failed to upload portfolio" });
  }
});

// ─── DELETE /api/portfolio/holdings/:id ──────────────────────────────────────
router.delete("/portfolio/holdings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(portfolioHoldingsTable).where(eq(portfolioHoldingsTable.id, id));
    res.status(204).end();
  } catch (err) {
    console.error("[Portfolio] DELETE error", err);
    res.status(500).json({ error: "Failed to delete holding" });
  }
});

// ─── DELETE /api/portfolio (clear all) ───────────────────────────────────────
router.delete("/portfolio", async (_req, res) => {
  try {
    await db.delete(portfolioHoldingsTable);
    res.status(204).end();
  } catch (err) {
    console.error("[Portfolio] Clear error", err);
    res.status(500).json({ error: "Failed to clear portfolio" });
  }
});

export default router;
