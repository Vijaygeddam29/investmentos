import { db } from "@workspace/db";
import { financialMetricsTable, priceHistoryTable, scoresTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number | null | undefined, low: number, high: number): number {
  if (value == null || isNaN(value)) return 0.5;
  return clamp((value - low) / (high - low || 1));
}

function avg(arr: (number | null | undefined)[]): number {
  const valid = arr.filter((v): v is number => v != null && !isNaN(v));
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function stability(arr: (number | null | undefined)[]): number {
  const valid = arr.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length < 2) return 0.5;
  const mean = avg(valid);
  if (mean === 0) return 0.5;
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return clamp(1 - cv);
}

function trend(arr: (number | null | undefined)[]): number {
  const valid = arr.filter((v): v is number => v != null && !isNaN(v));
  if (valid.length < 2) return 0.5;
  let improving = 0;
  for (let i = 1; i < valid.length; i++) {
    if (valid[i - 1] >= valid[i]) improving++;
  }
  return improving / (valid.length - 1);
}

export function scoreProfitability(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.roic, 0, 0.30),
    normalize(avg(metrics.map(m => m.roic)), 0, 0.25),
    stability(metrics.map(m => m.roic)),
    normalize(latest.roe, 0, 0.30),
    normalize(latest.roa, 0, 0.15),
    normalize(latest.grossMargin, 0, 0.70),
    stability(metrics.map(m => m.grossMargin)),
    normalize(latest.operatingMargin, 0, 0.40),
    stability(metrics.map(m => m.operatingMargin)),
    normalize(latest.netMargin, 0, 0.30),
    normalize(latest.fcfMargin, 0, 0.30),
    normalize(latest.ebitMargin, 0, 0.35),
    normalize(latest.ebitdaMargin, 0, 0.45),
    normalize(latest.employeeProductivity, 0, 500000),
    normalize(latest.incrementalMargin, 0, 0.50),
  ];
  return avg(scores);
}

export function scoreGrowth(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.revenueGrowth1y, -0.10, 0.50),
    normalize(latest.revenueGrowth3y, -0.05, 0.35),
    normalize(latest.revenueGrowth5y, -0.05, 0.30),
    normalize(latest.epsGrowth1y, -0.20, 0.50),
    normalize(latest.epsGrowth3y, -0.10, 0.35),
    normalize(latest.epsGrowth5y, -0.10, 0.30),
    normalize(latest.fcfGrowth, -0.20, 0.50),
    normalize(latest.operatingIncomeGrowth, -0.20, 0.50),
    trend(metrics.map(m => m.revenueGrowth1y)),
    trend(metrics.map(m => m.epsGrowth1y)),
    normalize(latest.grossMarginTrend, -0.05, 0.05),
    normalize(latest.operatingMarginTrend, -0.05, 0.05),
    normalize(latest.operatingMargin, 0, 0.40),
    normalize(latest.rdToRevenue, 0, 0.30),
    normalize(latest.reinvestmentRate, 0, 0.80),
  ];
  return avg(scores);
}

export function scoreCapitalEfficiency(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.roic, 0, 0.30),
    normalize(latest.roe, 0, 0.30),
    normalize(latest.roa, 0, 0.15),
    normalize(latest.assetTurnover, 0, 2.0),
    normalize(latest.inventoryTurnover, 0, 15),
    normalize(latest.workingCapitalEfficiency, 0, 5),
    normalize(latest.capexToRevenue, 0.30, 0.02),
    normalize(latest.operatingLeverage, 0, 3),
    normalize(latest.shareholderYield, 0, 0.10),
    normalize(latest.dividendGrowth, 0, 0.20),
    normalize(latest.reinvestmentRate, 0, 0.50),
    normalize(latest.rdToRevenue, 0, 0.25),
    normalize(latest.employeeProductivity, 0, 500000),
    normalize(latest.incrementalMargin, -0.2, 0.5),
    stability(metrics.map(m => m.roic)),
  ];
  return avg(scores);
}

export function scoreFinancialStrength(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.debtToEquity, 3, 0),
    normalize(latest.netDebtEbitda, 5, 0),
    normalize(latest.interestCoverage, 0, 20),
    normalize(latest.currentRatio, 0.5, 3),
    normalize(latest.quickRatio, 0.5, 2.5),
    normalize(latest.cashToDebt, 0, 2),
    normalize(latest.altmanZScore, 1.8, 5),
    normalize(latest.liquidityRatio, 0, 1.5),
    stability(metrics.map(m => m.debtToEquity)),
    trend(metrics.map(m => m.interestCoverage)),
    normalize(latest.operatingCfToRevenue, 0, 0.3),
    normalize(latest.fcfToNetIncome, 0.5, 1.5),
    normalize(latest.taxEfficiency, 0.5, 0.85),
    normalize(latest.workingCapitalDrift, -0.1, 0.1),
    normalize(latest.accrualRatio, 0.1, -0.1),
  ];
  return avg(scores);
}

export function scoreCashFlowQuality(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.fcfToNetIncome, 0.5, 1.5),
    normalize(latest.operatingCfToRevenue, 0, 0.30),
    stability(metrics.map(m => m.fcfYield)),
    normalize(latest.accrualRatio, 0.1, -0.1),
    normalize(latest.receivablesGrowthVsRevenue, 0.2, -0.2),
    normalize(latest.inventoryGrowthVsRevenue, 0.2, -0.2),
    stability(metrics.map(m => m.freeCashFlow)),
    normalize(latest.deferredRevenueGrowth, 0, 0.30),
    normalize(latest.stockBasedCompPct, 0.15, 0),
    normalize(latest.workingCapitalDrift, 0.1, -0.1),
    normalize(latest.cashConversionCycle, 120, 0),
    normalize(latest.earningsSurprises, -0.05, 0.10),
    trend(metrics.map(m => m.freeCashFlow)),
    normalize(latest.taxEfficiency, 0.5, 0.85),
    normalize(latest.capitalAllocationDiscipline, 0, 1),
  ];
  return avg(scores);
}

export function scoreInnovation(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.insiderOwnership, 0, 0.20),
    normalize(latest.institutionalOwnership, 0.3, 0.90),
    normalize(latest.insiderBuying, 0, 1),
    normalize(latest.rdToRevenue, 0, 0.25),
    normalize(latest.rdProductivity, 0, 3),
    trend(metrics.map(m => m.rdToRevenue)),
    normalize(latest.revenueGrowth1y, 0, 0.50),
    normalize(latest.grossMarginTrend, -0.02, 0.05),
    normalize(latest.operatingLeverage, 0, 3),
    normalize(latest.reinvestmentRate, 0, 0.8),
    normalize(latest.employeeProductivity, 0, 500000),
    normalize(latest.fcfGrowth, -0.1, 0.5),
    normalize(latest.incrementalMargin, 0, 0.5),
    stability(metrics.map(m => m.revenueGrowth1y)),
    normalize(latest.operatingIncomeGrowth, -0.1, 0.5),
  ];
  return avg(scores);
}

export function scoreMomentum(prices: any[]): number {
  if (prices.length < 50) return 0.5;

  const closes = prices.map(p => p.close).reverse();
  const len = closes.length;

  const ma10 = avg(closes.slice(-10));
  const ma20 = avg(closes.slice(-20));
  const ma50 = avg(closes.slice(-50));
  const ma200 = len >= 200 ? avg(closes.slice(-200)) : ma50;

  const currentPrice = closes[len - 1];
  const goldenCross = ma50 > ma200 ? 1 : 0;

  const rsiVal = calculateRSI(closes);
  const rsiScore = rsiVal < 30 ? 0.9 : rsiVal < 40 ? 0.75 : rsiVal < 60 ? 0.5 : rsiVal < 70 ? 0.35 : 0.2;

  const recentVolumes = prices.slice(0, 20).map(p => p.volume || 0);
  const olderVolumes = prices.slice(20, 40).map(p => p.volume || 0);
  const volumeTrend = avg(recentVolumes) > avg(olderVolumes) ? 0.7 : 0.4;

  const relStrength = ma200 > 0 ? currentPrice / ma200 : 1;
  const relStrengthScore = normalize(relStrength, 0.8, 1.3);

  const priceAboveMa50 = currentPrice > ma50 ? 0.8 : 0.3;
  const priceAboveMa200 = currentPrice > ma200 ? 0.8 : 0.3;
  const trendAlignment = (ma10 > ma20 && ma20 > ma50) ? 0.9 : (ma10 > ma50 ? 0.6 : 0.3);

  const high52w = Math.max(...closes.slice(-Math.min(252, len)));
  const low52w = Math.min(...closes.slice(-Math.min(252, len)));
  const rangePos = high52w !== low52w ? (currentPrice - low52w) / (high52w - low52w) : 0.5;
  const nearHigh = normalize(rangePos, 0, 1);

  const ret1m = len >= 21 ? (currentPrice - closes[len - 21]) / closes[len - 21] : 0;
  const ret3m = len >= 63 ? (currentPrice - closes[len - 63]) / closes[len - 63] : 0;
  const ret6m = len >= 126 ? (currentPrice - closes[len - 126]) / closes[len - 126] : 0;

  const scores = [
    rsiScore,
    goldenCross ? 0.8 : 0.3,
    priceAboveMa50,
    priceAboveMa200,
    trendAlignment,
    volumeTrend,
    relStrengthScore,
    nearHigh,
    normalize(ret1m, -0.1, 0.15),
    normalize(ret3m, -0.15, 0.25),
    normalize(ret6m, -0.2, 0.4),
    normalize(currentPrice / ma50, 0.9, 1.15),
    normalize(currentPrice / ma200, 0.85, 1.25),
    normalize(ma50 / ma200, 0.95, 1.1),
    normalize(rangePos, 0.2, 0.9),
  ];
  return avg(scores);
}

export function scoreValuation(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.peRatio, 50, 5),
    normalize(latest.forwardPe, 40, 5),
    normalize(latest.pegRatio, 3, 0.5),
    normalize(latest.evToEbitda, 30, 5),
    normalize(latest.evToSales, 15, 1),
    normalize(latest.priceToFcf, 40, 5),
    normalize(latest.priceToBook, 10, 1),
    normalize(latest.dividendYield, 0, 0.05),
    normalize(latest.shareholderYield, 0, 0.08),
    normalize(latest.fcfYield, 0, 0.10),
    normalize(latest.ruleOf40, 0, 60),
    normalize(latest.revenueMultipleVsGrowth, 3, 0.5),
    normalize(latest.intrinsicValueGap, -0.3, 0.3),
    normalize(latest.marginOfSafety, -0.2, 0.4),
    normalize(latest.dcfDiscount, -0.05, 0.05),
  ];
  return avg(scores);
}

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

const FORTRESS_WEIGHTS = {
  profitability: 0.30,
  capitalEfficiency: 0.20,
  cashFlowQuality: 0.20,
  financialStrength: 0.20,
  valuation: 0.10,
};

const ROCKET_WEIGHTS = {
  growth: 0.30,
  innovation: 0.30,
  capitalEfficiency: 0.15,
  momentum: 0.15,
  financialStrength: 0.10,
};

/**
 * Sentiment family scorer.
 * Captures market-facing signals: insider conviction, institutional support,
 * earnings surprises, and analyst revision direction.
 * Used in Wave engine (10% weight per spec).
 */
export function scoreSentiment(metrics: any[]): number {
  if (!metrics.length) return 0.5;
  const latest = metrics[0];
  const scores = [
    // Insider conviction: buying > holding > selling
    normalize(latest.insiderBuying, 0, 1),
    // Insider ownership: skin-in-the-game premium
    normalize(latest.insiderOwnership, 0, 0.20),
    // Institutional ownership: quality of shareholder base
    normalize(latest.institutionalOwnership, 0.30, 0.90),
    // Earnings surprises: positive = analyst upgrades ahead
    normalize(latest.earningsSurprises, -0.05, 0.10),
    // Analyst estimate revision: positive = upward revision cycle
    normalize(latest.analystUpside, 0, 0.30),
    // Shareholder yield: buybacks + dividends (capital returned = management confidence)
    normalize(latest.shareholderYield, 0, 0.08),
    // SBC dilution as negative sentiment (dilution erodes trust)
    normalize(latest.stockBasedCompPct, 0.20, 0),
    // FCF trend as proxy for recurring beats
    trend(metrics.map(m => m.freeCashFlow)),
    // Accrual ratio inversed: low accruals = high earnings quality = better sentiment
    normalize(latest.accrualRatio, 0.15, -0.05),
    // Operating leverage trend: positive inflection = margin beat setup
    normalize(latest.operatingLeverage, -0.5, 2.0),
    // Deferred revenue growth: forward commitment = demand strength signal
    normalize(latest.deferredRevenueGrowth, 0, 0.25),
    // Revenue surprise proxy: actual growth vs historical avg
    trend(metrics.map(m => m.revenueGrowth1y)),
    // PE vs peer: trading at discount = re-rating potential
    normalize(latest.peVsPeerMedian, 1.5, 0.6),
    // EV/EBITDA vs peer: relative attractiveness
    normalize(latest.evEbitdaPeerMedian != null && latest.evToEbitda != null
      ? latest.evToEbitda / (latest.evEbitdaPeerMedian || 1)
      : null, 1.5, 0.5),
    // Consistency of earnings beats
    stability(metrics.map(m => m.earningsSurprises)),
  ];
  return avg(scores);
}

const WAVE_WEIGHTS = {
  momentum: 0.40,
  valuation: 0.30,
  growth: 0.20,
  sentiment: 0.10,   // replaces innovation per spec
};

export async function calculateAllScores(ticker: string) {
  const metrics = await db.select().from(financialMetricsTable)
    .where(eq(financialMetricsTable.ticker, ticker))
    .orderBy(desc(financialMetricsTable.date))
    .limit(5);

  const prices = await db.select().from(priceHistoryTable)
    .where(eq(priceHistoryTable.ticker, ticker))
    .orderBy(desc(priceHistoryTable.date))
    .limit(365);

  const profitability = scoreProfitability(metrics);
  const growth = scoreGrowth(metrics);
  const capitalEfficiency = scoreCapitalEfficiency(metrics);
  const financialStrength = scoreFinancialStrength(metrics);
  const cashFlowQuality = scoreCashFlowQuality(metrics);
  const innovation = scoreInnovation(metrics);
  const sentiment = scoreSentiment(metrics);
  const momentum = scoreMomentum(prices);
  const valuation = scoreValuation(metrics);

  const fortressScore = clamp(
    profitability * FORTRESS_WEIGHTS.profitability +
    capitalEfficiency * FORTRESS_WEIGHTS.capitalEfficiency +
    cashFlowQuality * FORTRESS_WEIGHTS.cashFlowQuality +
    financialStrength * FORTRESS_WEIGHTS.financialStrength +
    valuation * FORTRESS_WEIGHTS.valuation
  );

  const rocketScore = clamp(
    growth * ROCKET_WEIGHTS.growth +
    innovation * ROCKET_WEIGHTS.innovation +
    capitalEfficiency * ROCKET_WEIGHTS.capitalEfficiency +
    momentum * ROCKET_WEIGHTS.momentum +
    financialStrength * ROCKET_WEIGHTS.financialStrength
  );

  // Wave engine per spec: Momentum(40%) + Valuation(30%) + Growth(20%) + Sentiment(10%)
  const waveScore = clamp(
    momentum * WAVE_WEIGHTS.momentum +
    valuation * WAVE_WEIGHTS.valuation +
    growth * WAVE_WEIGHTS.growth +
    sentiment * WAVE_WEIGHTS.sentiment
  );

  const today = new Date().toISOString().split("T")[0];

  const r = (v: number) => Math.round(v * 100) / 100;

  const scoreRow = {
    ticker,
    date: today,
    fortressScore: r(fortressScore),
    rocketScore: r(rocketScore),
    waveScore: r(waveScore),
    profitabilityScore: r(profitability),
    growthScore: r(growth),
    capitalEfficiencyScore: r(capitalEfficiency),
    financialStrengthScore: r(financialStrength),
    cashFlowQualityScore: r(cashFlowQuality),
    innovationScore: r(innovation),
    sentimentScore: r(sentiment),
    momentumScore: r(momentum),
    valuationScore: r(valuation),
  };

  const existing = await db.select({ id: scoresTable.id })
    .from(scoresTable)
    .where(and(eq(scoresTable.ticker, ticker), eq(scoresTable.date, today)))
    .limit(1);

  if (existing.length) {
    await db.update(scoresTable).set(scoreRow).where(eq(scoresTable.id, existing[0].id));
  } else {
    await db.insert(scoresTable).values(scoreRow);
  }

  return scoreRow;
}
