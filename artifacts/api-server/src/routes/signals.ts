import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { driftSignalsTable, opportunityAlertsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function stripCreatedAt(rows: any[]) {
  return rows.map(({ createdAt, ...rest }) => ({
    ...rest,
    factorName: rest.factorName ?? undefined,
    currentValue: rest.currentValue ?? undefined,
    historicalAvg: rest.historicalAvg ?? undefined,
  }));
}

router.get("/drift-signals", async (req, res) => {
  try {
    const ticker = req.query.ticker as string | undefined;
    const severity = req.query.severity as string | undefined;

    const signals = await db.select().from(driftSignalsTable).orderBy(desc(driftSignalsTable.date));

    let filtered = signals;
    if (ticker) filtered = filtered.filter(s => s.ticker === ticker);
    if (severity) filtered = filtered.filter(s => s.severity === severity);

    res.json({ signals: stripCreatedAt(filtered) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/opportunity-alerts", async (req, res) => {
  try {
    const engineType = req.query.engineType as string | undefined;

    const alerts = await db.select().from(opportunityAlertsTable)
      .orderBy(desc(opportunityAlertsTable.date));

    let filtered = alerts;
    if (engineType) filtered = filtered.filter(a => a.engineType === engineType);

    res.json({
      alerts: filtered.map(({ createdAt, ...rest }) => ({
        ...rest,
        score: rest.score ?? undefined,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/risk-alerts", async (_req, res) => {
  try {
    const signals = await db.select().from(driftSignalsTable)
      .where(eq(driftSignalsTable.severity, "high"))
      .orderBy(desc(driftSignalsTable.date));

    res.json({ alerts: stripCreatedAt(signals) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
