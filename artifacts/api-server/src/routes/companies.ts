import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  scoresTable,
  aiVerdictsTable,
  financialMetricsTable,
  driftSignalsTable,
  priceHistoryTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateAiMemo } from "../lib/ai-memo";

const router: IRouter = Router();

function avg(arr: (number | null | undefined)[]): number | null {
  const valid = arr.filter((v): v is number => v != null && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
}

function computeMomentumIndicators(prices: any[]) {
  if (!prices.length) return null;
  const closes = prices.map(p => p.close).reverse();
  const len = closes.length;
  const current = closes[len - 1];

  const ma10 = len >= 10 ? avg(closes.slice(-10)) : null;
  const ma20 = len >= 20 ? avg(closes.slice(-20)) : null;
  const ma50 = len >= 50 ? avg(closes.slice(-50)) : null;
  const ma200 = len >= 200 ? avg(closes.slice(-200)) : null;
  const rsi14 = computeRSI(closes);
  const high52w = Math.max(...closes.slice(-Math.min(252, len)));
  const low52w = Math.min(...closes.slice(-Math.min(252, len)));
  const pctFrom52wHigh = high52w ? +((current - high52w) / high52w).toFixed(4) : null;
  const rangePosition = high52w !== low52w ? +((current - low52w) / (high52w - low52w)).toFixed(4) : null;
  const ret1m = len >= 21 ? +((current - closes[len - 21]) / closes[len - 21]).toFixed(4) : null;
  const ret3m = len >= 63 ? +((current - closes[len - 63]) / closes[len - 63]).toFixed(4) : null;
  const ret6m = len >= 126 ? +((current - closes[len - 126]) / closes[len - 126]).toFixed(4) : null;
  const ret1y = len >= 252 ? +((current - closes[len - 252]) / closes[len - 252]).toFixed(4) : null;
  const goldenCross = ma50 && ma200 ? ma50 > ma200 : null;
  const priceAboveMa50 = ma50 ? current > ma50 : null;
  const priceAboveMa200 = ma200 ? current > ma200 : null;
  const recentVol = avg(prices.slice(0, 20).map(p => p.volume));
  const olderVol = avg(prices.slice(20, 40).map(p => p.volume));
  const relativeVolume = recentVol && olderVol ? +(recentVol / olderVol).toFixed(2) : null;

  return {
    currentPrice: +current.toFixed(2),
    rsi14,
    ma10: ma10 ? +ma10.toFixed(2) : null,
    ma20: ma20 ? +ma20.toFixed(2) : null,
    ma50: ma50 ? +ma50.toFixed(2) : null,
    ma200: ma200 ? +ma200.toFixed(2) : null,
    goldenCross,
    priceAboveMa50,
    priceAboveMa200,
    high52w: +high52w.toFixed(2),
    low52w: +low52w.toFixed(2),
    pctFrom52wHigh,
    rangePosition,
    ret1m,
    ret3m,
    ret6m,
    ret1y,
    relativeVolume,
  };
}

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

    const [latestScores, latestVerdict, latestMetrics, driftSigs, prices] = await Promise.all([
      db.select().from(scoresTable).where(eq(scoresTable.ticker, ticker)).orderBy(desc(scoresTable.date)).limit(1),
      db.select().from(aiVerdictsTable).where(eq(aiVerdictsTable.ticker, ticker)).orderBy(desc(aiVerdictsTable.date)).limit(1),
      db.select().from(financialMetricsTable).where(eq(financialMetricsTable.ticker, ticker)).orderBy(desc(financialMetricsTable.date)).limit(1),
      db.select().from(driftSignalsTable).where(eq(driftSignalsTable.ticker, ticker)).orderBy(desc(driftSignalsTable.date)).limit(10),
      db.select().from(priceHistoryTable).where(eq(priceHistoryTable.ticker, ticker)).orderBy(desc(priceHistoryTable.date)).limit(252),
    ]);

    const c = company[0];
    const m = latestMetrics[0];
    const s = latestScores[0];
    const v = latestVerdict[0];
    const momentumIndicators = computeMomentumIndicators(prices);

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
        sentimentScore: s.sentimentScore,
        momentumScore: s.momentumScore,
        valuationScore: s.valuationScore,
        entryTimingScore: s.entryTimingScore,
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
        shareholderYield: m.shareholderYield,
        ruleOf40: m.ruleOf40,
        marginOfSafety: m.marginOfSafety,
        dcfDiscount: m.dcfDiscount,
        intrinsicValueGap: m.intrinsicValueGap,
        revenueMultipleVsGrowth: m.revenueMultipleVsGrowth,
        // Peer-relative valuation (Fix 2: P/E vs peers)
        pePeerMedian: m.pePeerMedian,
        evEbitdaPeerMedian: m.evEbitdaPeerMedian,
        peVsPeerMedian: m.peVsPeerMedian,
      } : undefined,
      momentumIndicators,
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

    const [metrics, prices] = await Promise.all([
      db.select().from(financialMetricsTable)
        .where(eq(financialMetricsTable.ticker, ticker))
        .orderBy(desc(financialMetricsTable.date))
        .limit(limit),
      db.select().from(priceHistoryTable)
        .where(eq(priceHistoryTable.ticker, ticker))
        .orderBy(desc(priceHistoryTable.date))
        .limit(252),
    ]);

    const momentumIndicators = computeMomentumIndicators(prices);

    const grouped = metrics.map(m => ({
      date: m.date,
      profitability: {
        roic: m.roic,
        roe: m.roe,
        roa: m.roa,
        grossMargin: m.grossMargin,
        operatingMargin: m.operatingMargin,
        netMargin: m.netMargin,
        ebitMargin: m.ebitMargin,
        ebitdaMargin: m.ebitdaMargin,
        fcfMargin: m.fcfMargin,
        employeeProductivity: m.employeeProductivity,
        incrementalMargin: m.incrementalMargin,
      },
      growth: {
        revenueGrowth1y: m.revenueGrowth1y,
        revenueGrowth3y: m.revenueGrowth3y,
        revenueGrowth5y: m.revenueGrowth5y,
        epsGrowth1y: m.epsGrowth1y,
        epsGrowth3y: m.epsGrowth3y,
        epsGrowth5y: m.epsGrowth5y,
        fcfGrowth: m.fcfGrowth,
        operatingIncomeGrowth: m.operatingIncomeGrowth,
        grossMarginTrend: m.grossMarginTrend,
        operatingMarginTrend: m.operatingMarginTrend,
        rdToRevenue: m.rdToRevenue,
        reinvestmentRate: m.reinvestmentRate,
      },
      capitalEfficiency: {
        assetTurnover: m.assetTurnover,
        inventoryTurnover: m.inventoryTurnover,
        workingCapitalEfficiency: m.workingCapitalEfficiency,
        capexToRevenue: m.capexToRevenue,
        operatingLeverage: m.operatingLeverage,
        shareholderYield: m.shareholderYield,
        dividendGrowth: m.dividendGrowth,
        reinvestmentRate: m.reinvestmentRate,
        rdToRevenue: m.rdToRevenue,
        employeeProductivity: m.employeeProductivity,
        incrementalMargin: m.incrementalMargin,
      },
      financialStrength: {
        debtToEquity: m.debtToEquity,
        netDebtEbitda: m.netDebtEbitda,
        interestCoverage: m.interestCoverage,
        currentRatio: m.currentRatio,
        quickRatio: m.quickRatio,
        cashToDebt: m.cashToDebt,
        altmanZScore: m.altmanZScore,
        liquidityRatio: m.liquidityRatio,
        operatingCfToRevenue: m.operatingCfToRevenue,
        fcfToNetIncome: m.fcfToNetIncome,
        taxEfficiency: m.taxEfficiency,
        accrualRatio: m.accrualRatio,
      },
      cashFlowQuality: {
        fcfToNetIncome: m.fcfToNetIncome,
        operatingCfToRevenue: m.operatingCfToRevenue,
        fcfYield: m.fcfYield,
        accrualRatio: m.accrualRatio,
        receivablesGrowthVsRevenue: m.receivablesGrowthVsRevenue,
        inventoryGrowthVsRevenue: m.inventoryGrowthVsRevenue,
        freeCashFlow: m.freeCashFlow,
        deferredRevenueGrowth: m.deferredRevenueGrowth,
        stockBasedCompPct: m.stockBasedCompPct,
        workingCapitalDrift: m.workingCapitalDrift,
        cashConversionCycle: m.cashConversionCycle,
        earningsSurprises: m.earningsSurprises,
        capitalAllocationDiscipline: m.capitalAllocationDiscipline,
      },
      innovation: {
        rdExpense: m.rdExpense,
        rdToRevenue: m.rdToRevenue,
        rdProductivity: m.rdProductivity,
        insiderOwnership: m.insiderOwnership,
        institutionalOwnership: m.institutionalOwnership,
        insiderBuying: m.insiderBuying,
        revenueGrowth1y: m.revenueGrowth1y,
        operatingLeverage: m.operatingLeverage,
        reinvestmentRate: m.reinvestmentRate,
        fcfGrowth: m.fcfGrowth,
        incrementalMargin: m.incrementalMargin,
        operatingIncomeGrowth: m.operatingIncomeGrowth,
      },
      // Sentiment family: insider conviction, analyst revisions, peer-relative value, SBC dilution
      sentiment: {
        insiderBuying: m.insiderBuying,
        insiderOwnership: m.insiderOwnership,
        institutionalOwnership: m.institutionalOwnership,
        earningsSurprises: m.earningsSurprises,
        shareholderYield: m.shareholderYield,
        stockBasedCompPct: m.stockBasedCompPct,
        accrualRatio: m.accrualRatio,
        deferredRevenueGrowth: m.deferredRevenueGrowth,
        operatingLeverage: m.operatingLeverage,
        peVsPeerMedian: m.peVsPeerMedian,
        pePeerMedian: m.pePeerMedian,
        evEbitdaPeerMedian: m.evEbitdaPeerMedian,
        forwardPe: m.forwardPe,
        sentimentScore: m.sentimentScore,
      },
      momentum: momentumIndicators,
      valuation: {
        peRatio: m.peRatio,
        forwardPe: m.forwardPe,
        pegRatio: m.pegRatio,
        evToEbitda: m.evToEbitda,
        evToSales: m.evToSales,
        priceToFcf: m.priceToFcf,
        priceToBook: m.priceToBook,
        fcfYield: m.fcfYield,
        dividendYield: m.dividendYield,
        shareholderYield: m.shareholderYield,
        ruleOf40: m.ruleOf40,
        marginOfSafety: m.marginOfSafety,
        dcfDiscount: m.dcfDiscount,
        intrinsicValueGap: m.intrinsicValueGap,
        revenueMultipleVsGrowth: m.revenueMultipleVsGrowth,
        // Peer-relative valuation
        pePeerMedian: m.pePeerMedian,
        evEbitdaPeerMedian: m.evEbitdaPeerMedian,
        peVsPeerMedian: m.peVsPeerMedian,
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
