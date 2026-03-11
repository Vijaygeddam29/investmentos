import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function stripTimestamps(company: any) {
  const { createdAt, updatedAt, ...rest } = company;
  return {
    ...rest,
    sector: rest.sector ?? undefined,
    industry: rest.industry ?? undefined,
    country: rest.country ?? undefined,
    exchange: rest.exchange ?? undefined,
  };
}

router.get("/universe", async (_req, res) => {
  try {
    const companies = await db.select().from(companiesTable);
    res.json({ companies: companies.map(stripTimestamps) });
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
      res.json(stripTimestamps(existing[0]));
      return;
    }

    const [company] = await db.insert(companiesTable).values({
      ticker,
      name,
      sector: sector || null,
      industry: industry || null,
      country: country || null,
      exchange: exchange || null,
    }).returning();

    res.json(stripTimestamps(company));
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
