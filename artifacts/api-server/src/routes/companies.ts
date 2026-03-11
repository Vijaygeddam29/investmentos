import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  scoresTable,
  aiVerdictsTable,
  financialMetricsTable,
  driftSignalsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateAiMemo } from "../lib/ai-memo";

const router: IRouter = Router();

router.get("/companies", async (_req, res) => {
  try {
    const companies = await db.select().from(companiesTable);
    res.json({
      companies: companies.map(({ createdAt, updatedAt, ...rest }) => ({
        ...rest,
        sector: rest.sector ?? undefined,
        industry: rest.industry ?? undefined,
        country: rest.country ?? undefined,
        exchange: rest.exchange ?? undefined,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/companies/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;

    const company = await db.select().from(companiesTable)
      .where(eq(companiesTable.ticker, ticker))
      .limit(1);

    if (!company.length) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const latestScores = await db.select().from(scoresTable)
      .where(eq(scoresTable.ticker, ticker))
      .orderBy(desc(scoresTable.date))
      .limit(1);

    const latestVerdict = await db.select().from(aiVerdictsTable)
      .where(eq(aiVerdictsTable.ticker, ticker))
      .orderBy(desc(aiVerdictsTable.date))
      .limit(1);

    const latestMetrics = await db.select().from(financialMetricsTable)
      .where(eq(financialMetricsTable.ticker, ticker))
      .orderBy(desc(financialMetricsTable.date))
      .limit(1);

    const driftSigs = await db.select().from(driftSignalsTable)
      .where(eq(driftSignalsTable.ticker, ticker))
      .orderBy(desc(driftSignalsTable.date))
      .limit(10);

    const c = company[0];
    const m = latestMetrics[0];
    const s = latestScores[0];
    const v = latestVerdict[0];

    res.json({
      company: {
        ticker: c.ticker,
        name: c.name,
        sector: c.sector,
        industry: c.industry,
        country: c.country,
        exchange: c.exchange,
      },
      latestScores: s ? {
        ticker: s.ticker,
        date: s.date,
        fortressScore: s.fortressScore ?? 0,
        rocketScore: s.rocketScore ?? 0,
        waveScore: s.waveScore ?? 0,
        profitabilityScore: s.profitabilityScore,
        growthScore: s.growthScore,
        capitalEfficiencyScore: s.capitalEfficiencyScore,
        financialStrengthScore: s.financialStrengthScore,
        cashFlowQualityScore: s.cashFlowQualityScore,
        innovationScore: s.innovationScore,
        momentumScore: s.momentumScore,
        valuationScore: s.valuationScore,
      } : undefined,
      latestVerdict: v ? {
        ticker: v.ticker,
        verdict: v.verdict,
        classification: v.classification,
        memo: v.memo,
        date: v.date,
      } : undefined,
      valuation: m ? {
        peRatio: m.peRatio,
        forwardPe: m.forwardPe,
        pegRatio: m.pegRatio,
        evToEbitda: m.evToEbitda,
        evToSales: m.evToSales,
        priceToFcf: m.priceToFcf,
        priceToBook: m.priceToBook,
        fcfYield: m.fcfYield,
        dividendYield: m.dividendYield,
      } : undefined,
      driftSignals: driftSigs.map(({ createdAt, ...rest }) => rest),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/companies/:ticker/metrics", async (req, res) => {
  try {
    const { ticker } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 5, 1), 20);

    const metrics = await db.select().from(financialMetricsTable)
      .where(eq(financialMetricsTable.ticker, ticker))
      .orderBy(desc(financialMetricsTable.date))
      .limit(limit);

    const grouped = metrics.map(m => ({
      date: m.date,
      profitability: {
        roic: m.roic, roe: m.roe, roa: m.roa,
        grossMargin: m.grossMargin, operatingMargin: m.operatingMargin,
        netMargin: m.netMargin, ebitMargin: m.ebitMargin,
        ebitdaMargin: m.ebitdaMargin, fcfMargin: m.fcfMargin,
      },
      growth: {
        revenueGrowth1y: m.revenueGrowth1y,
        epsGrowth1y: m.epsGrowth1y,
        fcfGrowth: m.fcfGrowth, operatingIncomeGrowth: m.operatingIncomeGrowth,
      },
      capitalEfficiency: {
        assetTurnover: m.assetTurnover, inventoryTurnover: m.inventoryTurnover,
        capexToRevenue: m.capexToRevenue, rdToRevenue: m.rdToRevenue,
      },
      financialStrength: {
        debtToEquity: m.debtToEquity, netDebtEbitda: m.netDebtEbitda,
        interestCoverage: m.interestCoverage, currentRatio: m.currentRatio,
        quickRatio: m.quickRatio, cashToDebt: m.cashToDebt,
      },
      cashFlowQuality: {
        fcfToNetIncome: m.fcfToNetIncome, operatingCfToRevenue: m.operatingCfToRevenue,
        fcfYield: m.fcfYield,
      },
      innovation: {
        rdExpense: m.rdExpense, rdToRevenue: m.rdToRevenue,
        insiderOwnership: m.insiderOwnership,
      },
      valuation: {
        peRatio: m.peRatio, forwardPe: m.forwardPe, pegRatio: m.pegRatio,
        evToEbitda: m.evToEbitda, evToSales: m.evToSales,
        priceToFcf: m.priceToFcf, priceToBook: m.priceToBook,
        fcfYield: m.fcfYield, dividendYield: m.dividendYield,
      },
    }));

    res.json({ ticker, metrics: grouped });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/companies/:ticker/verdict", async (req, res) => {
  try {
    const { ticker } = req.params;
    const verdict = await db.select().from(aiVerdictsTable)
      .where(eq(aiVerdictsTable.ticker, ticker))
      .orderBy(desc(aiVerdictsTable.date))
      .limit(1);

    if (!verdict.length) {
      res.status(404).json({ error: "No verdict found" });
      return;
    }

    const v = verdict[0];
    res.json({
      verdict: {
        ticker: v.ticker,
        date: v.date,
        verdict: v.verdict,
        classification: v.classification,
        memo: v.memo,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/companies/:ticker/verdict", async (req, res) => {
  try {
    const { ticker } = req.params;
    const verdict = await generateAiMemo(ticker);
    res.json({ verdict });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
