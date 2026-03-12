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
import YahooFinanceClass from "yahoo-finance2";

const yf = new (YahooFinanceClass as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

/** Fetch live current prices for tickers missing from the DB price cache. */
async function fetchLivePrices(tickers: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const q = await yf.quote(ticker, {}, { validateResult: false });
        const price = q?.regularMarketPrice ?? q?.postMarketPrice ?? null;
        if (price != null && price > 0) result[ticker] = price;
      } catch {
        // best-effort — ignore failures
      }
    })
  );
  return result;
}

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

    // For tickers with no price in DB, fetch live quotes from Yahoo Finance
    const tickersNeedingLivePrice = tickers.filter((t) => latestPrice[t] == null);
    if (tickersNeedingLivePrice.length > 0) {
      const livePrices = await fetchLivePrices(tickersNeedingLivePrice);
      for (const [ticker, price] of Object.entries(livePrices)) {
        latestPrice[ticker] = price;
      }
    }

    // Track which tickers got live prices vs DB cache
    const livePriceSet = new Set(tickersNeedingLivePrice.filter((t) => latestPrice[t] != null));

    // Build enriched holdings
    let totalCost = 0;
    let totalCurrentValue = 0;

    const enriched = holdings.map((h) => {
      const scores  = latestScores[h.ticker] ?? null;
      const company = companyMap[h.ticker] ?? null;
      const metrics = latestMetrics[h.ticker] ?? null;
      const price   = latestPrice[h.ticker] ?? null;
      const priceSource: "live" | "cache" | "none" = price == null ? "none" : livePriceSet.has(h.ticker) ? "live" : "cache";

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
        currency:      h.currency ?? "USD",
        notes:         h.notes,
        currentPrice:  price,
        priceSource,
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
    const { ticker, shares, purchasePrice, purchaseDate, currency, notes } = req.body;
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
        currency:      currency ? String(currency).toUpperCase().trim() : "USD",
        notes:         notes ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[Portfolio] POST error", err);
    res.status(500).json({ error: "Failed to add holding" });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip exchange/currency suffixes: "QYLD/USD" → "QYLD", "SAP.DE" → "SAP" */
function cleanTicker(raw: string): string {
  return raw
    .toUpperCase()
    .trim()
    .replace(/[/:](USD|GBP|EUR|AUD|CAD|CHF|JPY|HKD|SGD|NZD|INR|CNY|MXN|BRL|ZAR|NOK|SEK|DKK|PLN|CZK|HUF)$/i, "")
    .replace(/\.(L|AS|PA|DE|MI|MC|HK|AX|TO|SI|KS|T|HM|NS|BO|SW|VI|BR|LS|OL|ST|CO|HE|IC|AT|CL|LM|SN|SA|MX|BA|AM|WA)$/i, "")
    .trim();
}

/** Normalize any date string to YYYY-MM-DD.
 *  Always assumes European day-first ordering (DD/MM or DD-MM) for ambiguous dates,
 *  since this platform is used by UK-based investors.
 *  Returns null if it can't parse. */
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Already ISO YYYY-MM-DD (or ISO datetime)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS (slashes, 4-digit year)
  const slashFull = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashFull) {
    const [, d, m, y] = slashFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD/MM/YY (slashes, 2-digit year)
  const slashShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    const [, d, m, y] = slashShort;
    const year = parseInt(y) < 50 ? `20${y}` : `19${y}`;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD-MM-YYYY (dashes, 4-digit year) — must come before native Date parse
  // because new Date("04-03-2026") gives April 3 (American), not March 4
  const dashFull = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dashFull) {
    const [, d, m, y] = dashFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD-MM-YY (dashes, 2-digit year)
  const dashShort = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (dashShort) {
    const [, d, m, y] = dashShort;
    const year = parseInt(y) < 50 ? `20${y}` : `19${y}`;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // M/D/YYYY or D/M/YYYY with single-digit components — last resort slash fallback
  const slashLoose = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashLoose) {
    const [, d, m, y] = slashLoose;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Avoid native Date parse — it treats "MM-DD-YYYY" as American and
  // "DD Mon YYYY" strings inconsistently. Return null for unrecognised formats.
  return null;
}

// ─── POST /api/portfolio/upload (CSV / Excel bulk import) ─────────────────────
router.post("/portfolio/upload", async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "rows array is required" });
      return;
    }

    // Parse and clean each raw row
    const parsed = rows
      .map((r: any) => ({
        ticker:        cleanTicker(String(r.ticker ?? "")),
        shares:        Number(r.shares),
        purchasePrice: Number(r.purchasePrice ?? r.purchase_price ?? r.price),
        purchaseDate:  normalizeDate(r.purchaseDate ?? r.purchase_date ?? null),
        currency:      r.currency ? String(r.currency).toUpperCase().trim() : "USD",
        notes:         r.notes ?? null,
      }))
      .filter((r) => r.ticker && r.shares > 0 && r.purchasePrice > 0 && isFinite(r.shares) && isFinite(r.purchasePrice));

    if (!parsed.length) {
      res.status(400).json({ error: "No valid rows found in upload" });
      return;
    }

    // Consolidate multiple transactions per ticker → one holding with WACP
    const grouped = new Map<string, { totalShares: number; totalCost: number; earliestDate: string | null; currency: string; notes: string | null }>();
    for (const r of parsed) {
      const existing = grouped.get(r.ticker);
      if (!existing) {
        grouped.set(r.ticker, {
          totalShares:  r.shares,
          totalCost:    r.shares * r.purchasePrice,
          earliestDate: r.purchaseDate,
          currency:     r.currency,
          notes:        r.notes,
        });
      } else {
        existing.totalShares += r.shares;
        existing.totalCost   += r.shares * r.purchasePrice;
        // Keep earliest date
        if (r.purchaseDate && (!existing.earliestDate || r.purchaseDate < existing.earliestDate)) {
          existing.earliestDate = r.purchaseDate;
        }
      }
    }

    const inserts = Array.from(grouped.entries()).map(([ticker, g]) => ({
      ticker,
      shares:        +g.totalShares.toFixed(6),
      purchasePrice: +(g.totalCost / g.totalShares).toFixed(6),  // weighted avg
      purchaseDate:  g.earliestDate,
      currency:      g.currency,
      notes:         g.notes,
    }));

    // Clear existing portfolio before importing
    await db.delete(portfolioHoldingsTable);
    const inserted = await db.insert(portfolioHoldingsTable).values(inserts).returning();
    res.status(201).json({ imported: inserted.length, consolidated: grouped.size, rawRows: parsed.length, holdings: inserted });
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
