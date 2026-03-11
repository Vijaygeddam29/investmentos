import { db } from "@workspace/db";
import { financialMetricsTable, priceHistoryTable, scoresTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";

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
    normalize(latest.revenueGrowth1y, 0, 0.40),
    normalize(latest.revenueGrowth1y, 0, 0.50),
    normalize(latest.revenueGrowth1y, 0, 0.30),
    normalize(latest.revenueGrowth1y, 0, 0.35),
    normalize(latest.operatingMargin, 0, 0.40),
    normalize(latest.rdToRevenue, 0, 0.30),
    normalize(latest.revenueGrowth1y, 0, 0.40),
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
    normalize(latest.workingCapitalEfficiency, 0, 1),
    normalize(latest.capexToRevenue, 0.01, 0.15),
    normalize(latest.capexToRevenue, 0, 0.20),
    normalize(latest.operatingLeverage, 0, 2),
    normalize(latest.shareholderYield, 0, 0.10),
    normalize(latest.dividendGrowth, 0, 0.20),
    normalize(latest.reinvestmentRate, 0, 0.50),
    normalize(latest.rdToRevenue, 0, 0.25),
    0.5,
    normalize(latest.employeeProductivity, 0, 500000),
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
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    normalize(latest.liquidityRatio, 0.5, 3),
    0.5,
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
    normalize(latest.accrualRatio, 0.5, -0.5),
    normalize(latest.receivablesGrowthVsRevenue, 0.5, -0.5),
    normalize(latest.inventoryGrowthVsRevenue, 0.5, -0.5),
    0.5,
    normalize(latest.deferredRevenueGrowth, 0, 0.30),
    normalize(latest.stockBasedCompPct, 0.15, 0),
    normalize(latest.workingCapitalDrift, 0.2, -0.2),
    normalize(latest.cashConversionCycle, 100, 0),
    normalize(latest.earningsSurprises, -0.05, 0.10),
    stability(metrics.map(m => m.freeCashFlow)),
    normalize(latest.taxEfficiency, 0, 0.30),
    normalize(latest.capitalAllocationDiscipline, 0, 1),
  ];
  return avg(scores);
}

export function scoreInnovation(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.insiderOwnership, 0, 0.20),
    normalize(latest.insiderOwnership, 0, 0.15),
    normalize(latest.insiderBuying, 0, 1),
    normalize(latest.rdToRevenue, 0, 0.25),
    0.5,
    0.5,
    normalize(latest.rdProductivity, 0, 1),
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
  ];
  return avg(scores);
}

export function scoreMomentum(prices: any[]): number {
  if (prices.length < 50) return 0.5;

  const closes = prices.map(p => p.close).reverse();

  const ma50 = avg(closes.slice(-50));
  const ma200 = closes.length >= 200 ? avg(closes.slice(-200)) : ma50;

  const goldenCross = ma50 > ma200 ? 1 : 0;

  const rsiVal = calculateRSI(closes);
  const rsiScore = rsiVal < 30 ? 0.9 : rsiVal < 50 ? 0.7 : rsiVal < 70 ? 0.5 : 0.2;

  const recentVolumes = prices.slice(0, 20).map(p => p.volume || 0);
  const olderVolumes = prices.slice(20, 40).map(p => p.volume || 0);
  const volumeTrend = avg(recentVolumes) > avg(olderVolumes) ? 0.7 : 0.4;

  const currentPrice = closes[closes.length - 1];
  const relStrength = ma200 > 0 ? currentPrice / ma200 : 1;
  const relStrengthScore = normalize(relStrength, 0.8, 1.3);

  const scores = [
    rsiScore,
    goldenCross ? 0.8 : 0.3,
    normalize(ma50, ma200 * 0.9, ma200 * 1.1),
    normalize(ma200, ma200 * 0.95, ma200 * 1.05),
    goldenCross,
    volumeTrend,
    relStrengthScore,
    relStrengthScore,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
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
    normalize(latest.dcfDiscount, -0.3, 0.4),
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

const WAVE_WEIGHTS = {
  momentum: 0.40,
  valuation: 0.30,
  growth: 0.20,
  innovation: 0.10,
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

  const waveScore = clamp(
    momentum * WAVE_WEIGHTS.momentum +
    valuation * WAVE_WEIGHTS.valuation +
    growth * WAVE_WEIGHTS.growth +
    innovation * WAVE_WEIGHTS.innovation
  );

  const today = new Date().toISOString().split("T")[0];

  await db.delete(scoresTable).where(eq(scoresTable.ticker, ticker));

  await db.insert(scoresTable).values({
    ticker,
    date: today,
    fortressScore: Math.round(fortressScore * 100) / 100,
    rocketScore: Math.round(rocketScore * 100) / 100,
    waveScore: Math.round(waveScore * 100) / 100,
    profitabilityScore: Math.round(profitability * 100) / 100,
    growthScore: Math.round(growth * 100) / 100,
    capitalEfficiencyScore: Math.round(capitalEfficiency * 100) / 100,
    financialStrengthScore: Math.round(financialStrength * 100) / 100,
    cashFlowQualityScore: Math.round(cashFlowQuality * 100) / 100,
    innovationScore: Math.round(innovation * 100) / 100,
    momentumScore: Math.round(momentum * 100) / 100,
    valuationScore: Math.round(valuation * 100) / 100,
  });

  return {
    fortressScore: Math.round(fortressScore * 100) / 100,
    rocketScore: Math.round(rocketScore * 100) / 100,
    waveScore: Math.round(waveScore * 100) / 100,
    profitabilityScore: Math.round(profitability * 100) / 100,
    growthScore: Math.round(growth * 100) / 100,
    capitalEfficiencyScore: Math.round(capitalEfficiency * 100) / 100,
    financialStrengthScore: Math.round(financialStrength * 100) / 100,
    cashFlowQualityScore: Math.round(cashFlowQuality * 100) / 100,
    innovationScore: Math.round(innovation * 100) / 100,
    momentumScore: Math.round(momentum * 100) / 100,
    valuationScore: Math.round(valuation * 100) / 100,
  };
}
