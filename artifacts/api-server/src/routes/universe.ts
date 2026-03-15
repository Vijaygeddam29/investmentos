import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companiesTable, scoresTable } from "@workspace/db/schema";
import { eq, ilike, and, inArray, sql } from "drizzle-orm";
import { SEED_TICKERS } from "../data/seed-tickers";
import { runPipeline } from "../lib/pipeline";
import yahooFinance from "yahoo-finance2";

const router: IRouter = Router();

function stripTimestamps(company: any) {
  const { createdAt, updatedAt, ...rest } = company;
  return {
    ...rest,
    sector: rest.sector ?? undefined,
    industry: rest.industry ?? undefined,
    country: rest.country ?? undefined,
    exchange: rest.exchange ?? undefined,
    source: rest.source ?? "seed",
  };
}

router.get("/universe", async (req, res) => {
  try {
    const { sector, country } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (sector) conditions.push(ilike(companiesTable.sector, `%${sector}%`));
    if (country) conditions.push(ilike(companiesTable.country, `%${country}%`));

    const companies = conditions.length
      ? await db.select().from(companiesTable).where(and(...conditions))
      : await db.select().from(companiesTable);

    const tickers = companies.map(c => c.ticker);

    const scoredRows = tickers.length
      ? await db
          .selectDistinct({ ticker: scoresTable.ticker })
          .from(scoresTable)
          .where(inArray(scoresTable.ticker, tickers))
      : [];

    const scoredSet = new Set(scoredRows.map(r => r.ticker));

    res.json({
      companies: companies.map(c => ({
        ...stripTimestamps(c),
        scored: scoredSet.has(c.ticker),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/universe/quick-add", async (req, res) => {
  try {
    const rawTicker = (req.body.ticker || "").trim().toUpperCase();
    if (!rawTicker) {
      res.status(400).json({ error: "ticker is required" });
      return;
    }

    const existing = await db.select().from(companiesTable)
      .where(eq(companiesTable.ticker, rawTicker))
      .limit(1);

    if (existing.length) {
      const scored = (await db
        .selectDistinct({ ticker: scoresTable.ticker })
        .from(scoresTable)
        .where(eq(scoresTable.ticker, rawTicker))).length > 0;
      res.json({ company: { ...stripTimestamps(existing[0]), scored }, alreadyExists: true });
      return;
    }

    let yfData: { name: string; sector?: string; industry?: string; exchange?: string; country?: string } | null = null;
    try {
      const quote = await yahooFinance.quote(rawTicker, {}, { validateResult: false }) as any;
      if (!quote || !quote.longName && !quote.shortName) {
        res.status(404).json({ error: `Ticker "${rawTicker}" not found on Yahoo Finance` });
        return;
      }
      yfData = {
        name: quote.longName || quote.shortName || rawTicker,
        sector: quote.sector || null,
        industry: quote.industry || null,
        exchange: quote.exchange || null,
        country: quote.country || "United States",
      };
    } catch {
      res.status(404).json({ error: `Ticker "${rawTicker}" could not be validated. Please check the symbol.` });
      return;
    }

    const [company] = await db.insert(companiesTable).values({
      ticker: rawTicker,
      name: yfData.name,
      sector: yfData.sector || null,
      industry: yfData.industry || null,
      country: yfData.country || "United States",
      exchange: yfData.exchange || null,
      currency: "USD",
      source: "user_added",
    }).returning();

    runPipeline([rawTicker]).catch(err => {
      console.warn(`[Universe] Background pipeline for ${rawTicker} failed: ${err.message}`);
    });

    res.json({ company: { ...stripTimestamps(company), scored: false }, alreadyExists: false, scoringStarted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/universe", async (req, res) => {
  try {
    const { ticker, name, sector, industry, country, exchange } = req.body;

    if (!ticker || !name) {
      res.status(400).json({ error: "ticker and name are required" });
      return;
    }

    const existing = await db.select().from(companiesTable)
      .where(eq(companiesTable.ticker, ticker))
      .limit(1);

    if (existing.length) {
      res.json({ ...stripTimestamps(existing[0]), scored: false });
      return;
    }

    const [company] = await db.insert(companiesTable).values({
      ticker,
      name,
      sector: sector || null,
      industry: industry || null,
      country: country || null,
      exchange: exchange || null,
      source: "user_added",
    }).returning();

    res.json({ ...stripTimestamps(company), scored: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/universe/seed", async (req, res) => {
  try {
    let added = 0;
    let skipped = 0;
    for (const t of SEED_TICKERS) {
      const existing = await db.select({ ticker: companiesTable.ticker })
        .from(companiesTable)
        .where(eq(companiesTable.ticker, t.ticker))
        .limit(1);
      if (existing.length) { skipped++; continue; }
      await db.insert(companiesTable).values({
        ticker: t.ticker,
        name: t.name,
        sector: t.sector,
        industry: t.industry,
        country: t.country,
        exchange: t.exchange,
        currency: t.currency,
        source: "seed",
      });
      added++;
    }
    res.json({ success: true, added, skipped, total: SEED_TICKERS.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/universe/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    await db.delete(companiesTable).where(eq(companiesTable.ticker, ticker));
    res.json({ success: true, message: `${ticker} removed from universe` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
