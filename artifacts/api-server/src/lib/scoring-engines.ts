import { db } from "@workspace/db";
import { financialMetricsTable, priceHistoryTable, scoresTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeLeadershipSignalScore } from "./leadership-signals";
import {
  computeCompanyQualityScore,
  computeStockOpportunityScore,
  computeDataCoverage,
} from "./verdict-engine";

// ─── Utility functions ─────────────────────────────────────────────────────────

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

function computeEMA(values: number[], period: number): number[] {
  if (values.length < period) return values.map(() => NaN);
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length).fill(NaN);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function computeMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine: number[] = closes.map((_, i) =>
    isNaN(ema12[i]) || isNaN(ema26[i]) ? NaN : ema12[i] - ema26[i]
  );
  const validMacd = macdLine.filter(v => !isNaN(v));
  if (validMacd.length < 9) return null;
  const signalEma = computeEMA(validMacd, 9);
  const lastMacd = validMacd[validMacd.length - 1];
  const lastSignal = signalEma[signalEma.length - 1];
  if (isNaN(lastSignal)) return null;
  return { macd: lastMacd, signal: lastSignal, histogram: lastMacd - lastSignal };
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

/** Cap ROIC at 1.0 (100%) for scoring. Raw value preserved in DB. */
function capROIC(v: number | null | undefined): number | null | undefined {
  if (v == null || isNaN(v)) return v;
  return Math.min(v, 1.0);
}

/** Export MACD calculator for use in indicator endpoints */
export { computeMACD };

// ─── BUCKET 1: PROFITABILITY (Company Quality) ─────────────────────────────────
// Single home for: roic, roe, roa, all margins (gross/op/net/ebit/ebitda/fcf)
// Removed from here: employeeProductivity, incrementalMargin → Capital Efficiency

export function scoreProfitability(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const roic = capROIC(latest.roic);
  const scores = [
    normalize(roic, 0, 0.30),
    normalize(capROIC(avg(metrics.map(m => m.roic))), 0, 0.25),
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
  ];
  return avg(scores);
}

// ─── BUCKET 2: GROWTH (Company Quality) ───────────────────────────────────────
// Single home for: revenue/EPS/FCF growth across horizons, margin trends
// Removed from here: operatingMargin → Profitability; rdToRevenue → Innovation;
//                    reinvestmentRate → Capital Efficiency

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
  ];
  return avg(scores);
}

// ─── BUCKET 3: BALANCE SHEET / FINANCIAL STRENGTH (Company Quality) ───────────
// Single home for: leverage, liquidity, solvency ratios, Altman Z
// Removed from here: operatingCfToRevenue, fcfToNetIncome, taxEfficiency, accrualRatio
//                    → Cash Flow Quality (their true home)
// BUG FIX: workingCapitalDrift direction corrected — negative drift = good (more efficient)

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
    // FIXED: negative drift (shrinking WC relative to revenue) = better efficiency
    normalize(latest.workingCapitalDrift, 0.1, -0.1),
  ];
  return avg(scores);
}

// ─── BUCKET 4: CASH FLOW QUALITY (Company Quality) ────────────────────────────
// Single home for: FCF conversion, accruals, earnings quality, SBC, deferred revenue
// Brought home from Financial Strength: fcfToNetIncome, operatingCfToRevenue, taxEfficiency, accrualRatio
// Brought home from Sentiment: stockBasedCompPct, deferredRevenueGrowth
// Removed: fcfYield → Valuation (its true home)

export function scoreCashFlowQuality(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.fcfToNetIncome, 0.5, 1.5),
    normalize(latest.operatingCfToRevenue, 0, 0.30),
    normalize(latest.accrualRatio, 0.1, -0.1),
    normalize(latest.taxEfficiency, 0.5, 0.85),
    normalize(latest.receivablesGrowthVsRevenue, 0.2, -0.2),
    normalize(latest.inventoryGrowthVsRevenue, 0.2, -0.2),
    stability(metrics.map(m => m.freeCashFlow)),
    trend(metrics.map(m => m.freeCashFlow)),
    normalize(latest.deferredRevenueGrowth, 0, 0.30),
    normalize(latest.stockBasedCompPct, 0.15, 0),
    // CORRECT direction: negative drift = good (more efficient)
    normalize(latest.workingCapitalDrift, 0.1, -0.1),
    normalize(latest.cashConversionCycle, 120, 0),
    normalize(latest.earningsSurprises, -0.05, 0.10),
    normalize(latest.capitalAllocationDiscipline, 0, 1),
  ];
  return avg(scores);
}

// ─── BUCKET 5: CAPITAL EFFICIENCY (Company Quality) ───────────────────────────
// Single home for: asset turnover, CapEx discipline, shareholder returns, leverage quality
// Added here: employeeProductivity, incrementalMargin (moved from Profitability)
//             reinvestmentRate (moved from Growth)
//             shareholderYield (moved from Sentiment + Valuation)
// Removed: roic, roe, roa → Profitability; rdToRevenue → Innovation

export function scoreCapitalEfficiency(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.assetTurnover, 0, 2.0),
    normalize(latest.inventoryTurnover, 0, 15),
    normalize(latest.workingCapitalEfficiency, 0, 5),
    normalize(latest.capexToRevenue, 0.30, 0.02),
    normalize(latest.operatingLeverage, 0, 3),
    normalize(latest.shareholderYield, 0, 0.10),
    normalize(latest.dividendGrowth, 0, 0.20),
    normalize(latest.reinvestmentRate, 0, 0.50),
    normalize(latest.employeeProductivity, 0, 500000),
    normalize(latest.incrementalMargin, -0.2, 0.5),
    stability(metrics.map(m => m.capexToRevenue)),
  ];
  return avg(scores);
}

// ─── BUCKET 6: R&D & INNOVATION (Company Quality) ─────────────────────────────
// Single home for: R&D intensity, R&D productivity, reinvestment quality
// Formerly "Innovation & Founder Signals" — insider signals moved to Sentiment
// Removed from here: insiderOwnership, institutionalOwnership, insiderBuying → Sentiment
//                    revenueGrowth1y, fcfGrowth, operatingIncomeGrowth → Growth
//                    operatingLeverage, reinvestmentRate → CapEfficiency
//                    employeeProductivity, incrementalMargin → CapEfficiency

export function scoreInnovation(metrics: any[]): number {
  if (!metrics.length) return 0;
  const latest = metrics[0];
  const scores = [
    normalize(latest.rdToRevenue, 0, 0.25),
    normalize(latest.rdProductivity, 0, 3),
    trend(metrics.map(m => m.rdToRevenue)),
    normalize(latest.grossMarginTrend, -0.02, 0.05),
    stability(metrics.map(m => m.rdToRevenue)),
    normalize(latest.revenueGrowth3y, -0.05, 0.35),
  ];
  return avg(scores);
}

// ─── BUCKET 7: MARKET SIGNALS / SENTIMENT (Stock Opportunity) ─────────────────
// Single home for: insider conviction, institutional ownership, analyst signals
// Renamed from "Sentiment" to "Market Signals"
// Removed from here: shareholderYield → CapEfficiency
//                    stockBasedCompPct, deferredRevenueGrowth, accrualRatio → CashFlowQuality
//                    operatingLeverage, revenueGrowth trend → their buckets
//
// PHANTOM DETECTION: if primary sentiment inputs are all null, returns null
// to trigger Opportunity reweighting (Valuation 55% / Momentum 45%)

export function scoreSentiment(metrics: any[]): number | null {
  if (!metrics.length) return null;
  const latest = metrics[0];

  const primaryInputs = [
    latest.insiderBuying,
    latest.insiderOwnership,
    latest.institutionalOwnership,
    latest.earningsSurprises,
    latest.analystUpside,
    latest.peVsPeerMedian,
  ];
  const nonNullPrimary = primaryInputs.filter(v => v != null).length;
  const coveragePct = nonNullPrimary / primaryInputs.length;

  if (coveragePct < 0.5) {
    return null;
  }

  const scores = [
    normalize(latest.insiderBuying, 0, 1),
    normalize(latest.insiderOwnership, 0, 0.20),
    normalize(latest.institutionalOwnership, 0.30, 0.90),
    normalize(latest.earningsSurprises, -0.05, 0.10),
    normalize(latest.analystUpside, 0, 0.30),
    normalize(latest.peVsPeerMedian, 1.5, 0.6),
    normalize(latest.evEbitdaPeerMedian != null && latest.evToEbitda != null
      ? latest.evToEbitda / (latest.evEbitdaPeerMedian || 1)
      : null, 1.5, 0.5),
  ];
  return avg(scores);
}

// ─── BUCKET 8: VALUATION (Stock Opportunity) ──────────────────────────────────
// Single home for: all price/value multiples, FCF yield, Rule of 40, Margin of Safety
// Added here: fcfYield (moved from CashFlowQuality where it was double-counted)
// Removed: shareholderYield → CapEfficiency; dividendYield → display only

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
    normalize(latest.fcfYield, 0, 0.10),
    normalize(latest.ruleOf40, 0, 60),
    normalize(latest.revenueMultipleVsGrowth, 3, 0.5),
    normalize(latest.intrinsicValueGap, -0.3, 0.3),
    normalize(latest.marginOfSafety, -0.2, 0.4),
    normalize(latest.dcfDiscount, -0.05, 0.05),
  ];
  return avg(scores);
}

// ─── BUCKET 9: MOMENTUM (Stock Opportunity) ───────────────────────────────────

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

  const ret1m = len >= 21 ? (currentPrice - closes[len - 21]) / closes[len - 21] : 0;
  const ret3m = len >= 63 ? (currentPrice - closes[len - 63]) / closes[len - 63] : 0;
  const ret6m = len >= 126 ? (currentPrice - closes[len - 126]) / closes[len - 126] : 0;

  const macd = computeMACD(closes);
  const macdScore = macd != null
    ? (macd.histogram > 0 && macd.macd > macd.signal
        ? 0.8
        : macd.histogram > 0
          ? 0.65
          : macd.histogram < 0 && macd.macd < macd.signal
            ? 0.2
            : 0.35)
    : 0.5;

  const scores = [
    rsiScore,
    goldenCross ? 0.8 : 0.3,
    priceAboveMa50,
    priceAboveMa200,
    trendAlignment,
    volumeTrend,
    relStrengthScore,
    normalize(rangePos, 0.2, 0.9),
    normalize(ret1m, -0.1, 0.15),
    normalize(ret3m, -0.15, 0.25),
    normalize(ret6m, -0.2, 0.4),
    normalize(currentPrice / ma50, 0.9, 1.15),
    normalize(currentPrice / ma200, 0.85, 1.25),
    normalize(ma50 / ma200, 0.95, 1.1),
    macdScore,
  ];
  return avg(scores);
}

// ─── Compounder Score ──────────────────────────────────────────────────────────
// 8-factor composite for long-term compounding quality. Output: 0–100.

export function computeCompounderScore(subScores: {
  growth: number;
  profitability: number;
  capitalEfficiency: number;
  cashFlowQuality: number;
  financialStrength: number;
  sentiment: number | null;
  momentum: number;
  leadership: number;
}): number {
  const sentimentVal = subScores.sentiment ?? 0.5;
  const raw =
    0.17 * subScores.growth            +
    0.13 * subScores.profitability     +
    0.13 * subScores.capitalEfficiency +
    0.13 * subScores.cashFlowQuality   +
    0.12 * subScores.financialStrength +
    0.12 * sentimentVal                +
    0.13 * subScores.momentum          +
    0.07 * subScores.leadership;
  return Math.round(clamp(raw) * 100);
}

export function compounderRating(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export function scoreLeadershipConviction(ticker: string, metrics: any[]): number {
  const latest = metrics[0] ?? {};
  return computeLeadershipSignalScore(
    ticker,
    latest.insiderOwnership ?? null,
    latest.insiderBuying    ?? null,
    trend(metrics.map(m => m.insiderOwnership)),
  );
}

// ─── Engine weights ────────────────────────────────────────────────────────────

const FORTRESS_WEIGHTS = {
  profitability:    0.30,
  capitalEfficiency: 0.20,
  cashFlowQuality:  0.20,
  financialStrength: 0.20,
  valuation:        0.10,
};

const ROCKET_WEIGHTS = {
  growth:           0.30,
  innovation:       0.30,
  capitalEfficiency: 0.15,
  momentum:         0.15,
  financialStrength: 0.10,
};

const WAVE_WEIGHTS = {
  momentum:  0.40,
  valuation: 0.30,
  growth:    0.20,
  sentiment: 0.10,
};

// ─── Main scoring pipeline ─────────────────────────────────────────────────────

export async function calculateAllScores(ticker: string) {
  const metrics = await db.select().from(financialMetricsTable)
    .where(eq(financialMetricsTable.ticker, ticker))
    .orderBy(desc(financialMetricsTable.date))
    .limit(5);

  const prices = await db.select().from(priceHistoryTable)
    .where(eq(priceHistoryTable.ticker, ticker))
    .orderBy(desc(priceHistoryTable.date))
    .limit(365);

  const profitability     = scoreProfitability(metrics);
  const growth            = scoreGrowth(metrics);
  const capitalEfficiency = scoreCapitalEfficiency(metrics);
  const financialStrength = scoreFinancialStrength(metrics);
  const cashFlowQuality   = scoreCashFlowQuality(metrics);
  const innovation        = scoreInnovation(metrics);
  const sentimentRaw      = scoreSentiment(metrics);
  const momentum          = scoreMomentum(prices);
  const valuation         = scoreValuation(metrics);
  const leadership        = scoreLeadershipConviction(ticker, metrics);

  const sentimentForWave  = sentimentRaw ?? 0.5;

  const fortressScore = clamp(
    profitability     * FORTRESS_WEIGHTS.profitability     +
    capitalEfficiency * FORTRESS_WEIGHTS.capitalEfficiency +
    cashFlowQuality   * FORTRESS_WEIGHTS.cashFlowQuality   +
    financialStrength * FORTRESS_WEIGHTS.financialStrength +
    valuation         * FORTRESS_WEIGHTS.valuation
  );

  const rocketScore = clamp(
    growth            * ROCKET_WEIGHTS.growth            +
    innovation        * ROCKET_WEIGHTS.innovation        +
    capitalEfficiency * ROCKET_WEIGHTS.capitalEfficiency +
    momentum          * ROCKET_WEIGHTS.momentum          +
    financialStrength * ROCKET_WEIGHTS.financialStrength
  );

  const waveScore = clamp(
    momentum         * WAVE_WEIGHTS.momentum  +
    valuation        * WAVE_WEIGHTS.valuation +
    growth           * WAVE_WEIGHTS.growth    +
    sentimentForWave * WAVE_WEIGHTS.sentiment
  );

  const compounderScore = computeCompounderScore({
    growth,
    profitability,
    capitalEfficiency,
    cashFlowQuality,
    financialStrength,
    sentiment: sentimentRaw,
    momentum,
    leadership,
  });

  const companyQualityScore = computeCompanyQualityScore({
    profitability,
    growth,
    financialStrength,
    cashFlowQuality,
    capitalEfficiency,
  });

  const stockOpportunityScore = computeStockOpportunityScore({
    valuation,
    momentum,
    sentiment: sentimentRaw,
  });

  const today = new Date().toISOString().split("T")[0];
  const r = (v: number) => Math.round(v * 100) / 100;

  const scoreRow = {
    ticker,
    date: today,
    fortressScore:          r(fortressScore),
    rocketScore:            r(rocketScore),
    waveScore:              r(waveScore),
    profitabilityScore:     r(profitability),
    growthScore:            r(growth),
    capitalEfficiencyScore: r(capitalEfficiency),
    financialStrengthScore: r(financialStrength),
    cashFlowQualityScore:   r(cashFlowQuality),
    innovationScore:        r(innovation),
    sentimentScore:         sentimentRaw != null ? r(sentimentRaw) : null,
    momentumScore:          r(momentum),
    valuationScore:         r(valuation),
    compounderScore,
    companyQualityScore:    r(companyQualityScore),
    stockOpportunityScore:  r(stockOpportunityScore),
  };

  const existing = await db.select({ id: scoresTable.id, date: scoresTable.date })
    .from(scoresTable)
    .where(eq(scoresTable.ticker, ticker))
    .orderBy(desc(scoresTable.date))
    .limit(1);

  const latestExisting = existing[0];

  if (latestExisting?.date === today) {
    await db.update(scoresTable).set(scoreRow).where(eq(scoresTable.id, latestExisting.id));
  } else {
    await db.insert(scoresTable).values(scoreRow);
  }

  return scoreRow;
}

/**
 * Compute family-level coverage metadata.
 * Returns per-family { total, available, pct } for UI display.
 */
export function computeFamilyCoverage(m: any): Record<string, { total: number; available: number; pct: number }> {
  const families: Record<string, (keyof typeof m)[]> = {
    profitability: ["roic", "roe", "roa", "grossMargin", "operatingMargin", "netMargin", "fcfMargin", "ebitMargin", "ebitdaMargin"],
    growth: ["revenueGrowth1y", "revenueGrowth3y", "revenueGrowth5y", "epsGrowth1y", "epsGrowth3y", "epsGrowth5y", "fcfGrowth", "operatingIncomeGrowth", "grossMarginTrend", "operatingMarginTrend"],
    capitalEfficiency: ["assetTurnover", "inventoryTurnover", "workingCapitalEfficiency", "capexToRevenue", "operatingLeverage", "shareholderYield", "reinvestmentRate", "employeeProductivity", "incrementalMargin"],
    financialStrength: ["debtToEquity", "netDebtEbitda", "interestCoverage", "currentRatio", "quickRatio", "cashToDebt", "altmanZScore", "workingCapitalDrift"],
    cashFlowQuality: ["fcfToNetIncome", "operatingCfToRevenue", "accrualRatio", "taxEfficiency", "receivablesGrowthVsRevenue", "inventoryGrowthVsRevenue", "deferredRevenueGrowth", "stockBasedCompPct", "cashConversionCycle", "earningsSurprises", "capitalAllocationDiscipline"],
    innovation: ["rdToRevenue", "rdProductivity", "rdExpense"],
    sentiment: ["insiderBuying", "insiderOwnership", "institutionalOwnership", "earningsSurprises", "analystUpside", "peVsPeerMedian"],
    momentum: ["rsi14", "ma50", "ma200", "rangePosition"],
    valuation: ["peRatio", "forwardPe", "pegRatio", "evToEbitda", "evToSales", "priceToFcf", "priceToBook", "fcfYield", "ruleOf40", "marginOfSafety"],
  };

  const result: Record<string, { total: number; available: number; pct: number }> = {};
  for (const [family, keys] of Object.entries(families)) {
    const total = keys.length;
    const available = keys.filter(k => m[k] != null).length;
    result[family] = { total, available, pct: Math.round((available / total) * 100) };
  }
  return result;
}
