import { db } from "@workspace/db";
import { companiesTable, financialMetricsTable, priceHistoryTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const FMP_API_KEY = process.env.FMP_API_KEY || "";
const BASE_URL = "https://financialmodelingprep.com/stable";

async function fmpFetch(endpoint: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...params, apikey: FMP_API_KEY });
  const url = `${BASE_URL}/${endpoint}?${query}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP API error: ${res.status} ${res.statusText} for ${endpoint}`);
  return res.json();
}

export async function fetchCompanyProfile(ticker: string) {
  const data = await fmpFetch("profile", { symbol: ticker });
  if (!data || !data.length) return null;
  const p = data[0];
  return {
    ticker: p.symbol,
    name: p.companyName,
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    exchange: p.exchange,
  };
}

export async function fetchAndStoreCompany(ticker: string) {
  const profile = await fetchCompanyProfile(ticker);
  if (!profile) throw new Error(`No profile found for ${ticker}`);

  await db.insert(companiesTable).values(profile).onConflictDoUpdate({
    target: companiesTable.ticker,
    set: {
      name: profile.name,
      sector: profile.sector,
      industry: profile.industry,
      country: profile.country,
      exchange: profile.exchange,
      updatedAt: new Date(),
    },
  });

  return profile;
}

function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

export async function fetchAndStoreMetrics(ticker: string) {
  const [keyMetrics, ratios, incomeStmt, balanceSheet, cashFlow, growth] = await Promise.all([
    fmpFetch("key-metrics", { symbol: ticker, period: "annual" }).catch(() => []),
    fmpFetch("ratios", { symbol: ticker, period: "annual" }).catch(() => []),
    fmpFetch("income-statement", { symbol: ticker, period: "annual" }).catch(() => []),
    fmpFetch("balance-sheet-statement", { symbol: ticker, period: "annual" }).catch(() => []),
    fmpFetch("cash-flow-statement", { symbol: ticker, period: "annual" }).catch(() => []),
    fmpFetch("financial-growth", { symbol: ticker, period: "annual" }).catch(() => []),
  ]);

  if (!keyMetrics.length && !incomeStmt.length) {
    throw new Error(`No financial data found for ${ticker}`);
  }

  const count = Math.min(5, Math.max(keyMetrics.length, incomeStmt.length, 1));
  let inserted = 0;

  for (let i = 0; i < count; i++) {
    const km = keyMetrics[i] || {};
    const rt = ratios[i] || {};
    const inc = incomeStmt[i] || {};
    const bs = balanceSheet[i] || {};
    const cf = cashFlow[i] || {};
    const gr = growth[i] || {};
    const prevInc = incomeStmt[i + 1] || {};
    const prevBs = balanceSheet[i + 1] || {};

    const date = km.date || inc.date || rt.date || new Date().toISOString().split("T")[0];
    const revenue = inc.revenue || 0;
    const prevRevenue = prevInc.revenue || 0;
    const opCf = cf.netCashProvidedByOperatingActivities || 0;
    const capex = cf.investmentsInPropertyPlantAndEquipment || 0;
    const fcf = opCf + capex;
    const ebitda = inc.ebitda || 0;
    const netIncome = inc.netIncome || 0;
    const sbc = cf.stockBasedCompensation || 0;
    const employees = km.fullTimeEmployees || null;

    const grossMargin = rt.grossProfitMargin;
    const operatingMargin = rt.operatingProfitMargin;
    const revenueGrowth1y = gr.revenueGrowth;

    const ruleOf40Val = (revenueGrowth1y != null && operatingMargin != null)
      ? (revenueGrowth1y * 100) + (operatingMargin * 100)
      : null;

    const buybackYield = (prevBs.totalStockholdersEquity && bs.totalStockholdersEquity)
      ? safeDiv(cf.commonStockRepurchased, km.marketCap)
      : null;
    const dividendYieldVal = rt.dividendYield;
    const shareholderYieldVal = (dividendYieldVal != null || buybackYield != null)
      ? (dividendYieldVal || 0) + Math.abs(buybackYield || 0)
      : null;

    const revenuePerShare = rt.revenuePerShare;
    const priceToSales = rt.priceToSalesRatio;
    const revMultVsGrowth = (priceToSales != null && revenueGrowth1y != null && revenueGrowth1y > 0)
      ? priceToSales / (revenueGrowth1y * 100)
      : null;

    const fcfYieldVal = km.freeCashFlowYield;
    const earningsYieldVal = km.earningsYield;
    const wacc = 0.10;
    const dcfDiscountVal = earningsYieldVal != null ? earningsYieldVal - wacc : null;
    const marginOfSafetyVal = (rt.priceToFairValue != null)
      ? 1 - (1 / rt.priceToFairValue)
      : null;
    const intrinsicValueGapVal = marginOfSafetyVal;

    const grossMarginPrev = prevInc.grossProfit && prevRevenue
      ? prevInc.grossProfit / prevRevenue
      : null;
    const grossMarginTrend = (grossMargin != null && grossMarginPrev != null)
      ? grossMargin - grossMarginPrev
      : null;
    const opMarginPrev = prevInc.operatingIncome && prevRevenue
      ? prevInc.operatingIncome / prevRevenue
      : null;
    const opMarginTrend = (operatingMargin != null && opMarginPrev != null)
      ? operatingMargin - opMarginPrev
      : null;

    const incrementalMargin = (revenue && prevRevenue && revenue !== prevRevenue)
      ? ((inc.operatingIncome || 0) - (prevInc.operatingIncome || 0)) / (revenue - prevRevenue)
      : null;

    const accrualRatio = (netIncome && bs.totalAssets)
      ? (netIncome - fcf) / bs.totalAssets
      : null;

    const receivablesCur = bs.netReceivables || 0;
    const receivablesPrev = prevBs.netReceivables || 0;
    const receivablesGrowthVsRevenue = (prevRevenue && receivablesPrev)
      ? safeDiv(receivablesCur - receivablesPrev, receivablesPrev)! - (revenueGrowth1y || 0)
      : null;
    const invCur = bs.inventory || 0;
    const invPrev = prevBs.inventory || 0;
    const inventoryGrowthVsRevenue = (prevRevenue && invPrev)
      ? safeDiv(invCur - invPrev, invPrev)! - (revenueGrowth1y || 0)
      : null;

    const sbcPct = revenue ? sbc / revenue : null;
    const wcCur = (bs.totalCurrentAssets || 0) - (bs.totalCurrentLiabilities || 0);
    const wcPrev = (prevBs.totalCurrentAssets || 0) - (prevBs.totalCurrentLiabilities || 0);
    const workingCapitalDrift = (wcPrev && revenue) ? (wcCur - wcPrev) / revenue : null;

    const taxEff = (inc.incomeBeforeTax && inc.incomeTaxExpense != null)
      ? 1 - (inc.incomeTaxExpense / inc.incomeBeforeTax)
      : null;

    const totalAssets = bs.totalAssets || 0;
    const totalLiabilities = bs.totalLiabilities || 0;
    const mktCap = km.marketCap || 0;
    const altmanZ = totalAssets
      ? (1.2 * ((bs.totalCurrentAssets || 0) - (bs.totalCurrentLiabilities || 0)) / totalAssets) +
        (1.4 * ((bs.retainedEarnings || 0) / totalAssets)) +
        (3.3 * ((inc.ebit || 0) / totalAssets)) +
        (0.6 * (mktCap / (totalLiabilities || 1))) +
        (1.0 * (revenue / totalAssets))
      : null;

    const reinvestmentRate = (netIncome && netIncome > 0)
      ? 1 - ((cf.commonDividendsPaid ? Math.abs(cf.commonDividendsPaid) : 0) / netIncome)
      : null;

    const employeeProd = (employees && revenue) ? revenue / employees : null;

    const rdProd = (inc.researchAndDevelopmentExpenses && revenueGrowth1y != null)
      ? (revenueGrowth1y * revenue) / inc.researchAndDevelopmentExpenses
      : null;

    const wcEfficiency = revenue ? revenue / Math.abs(wcCur || 1) : null;
    const opLeverage = (revenueGrowth1y != null && gr.operatingIncomeGrowth != null && revenueGrowth1y !== 0)
      ? gr.operatingIncomeGrowth / revenueGrowth1y
      : null;

    const row = {
      ticker,
      date,
      revenue: inc.revenue,
      grossMargin,
      grossMarginTrend,
      operatingMargin,
      operatingMarginTrend: opMarginTrend,
      netMargin: rt.netProfitMargin,
      ebitMargin: rt.ebitMargin,
      ebitdaMargin: rt.ebitdaMargin,
      fcfMargin: revenue ? fcf / revenue : null,
      incrementalMargin,

      roic: km.returnOnInvestedCapital,
      roic5yrAvg: null,
      roicStability: null,
      roe: km.returnOnEquity,
      roa: km.returnOnAssets,

      freeCashFlow: fcf,
      fcfYield: fcfYieldVal,
      fcfStability: null,
      fcfToNetIncome: safeDiv(fcf, netIncome),
      operatingCfToRevenue: rt.operatingCashFlowSalesRatio,
      accrualRatio,
      cashConversionCycle: km.cashConversionCycle,
      cashFlowVolatility: null,
      stockBasedCompPct: sbcPct,
      capitalAllocationDiscipline: null,

      debtToEquity: rt.debtToEquityRatio,
      netDebtEbitda: km.netDebtToEBITDA,
      interestCoverage: rt.interestCoverageRatio,
      currentRatio: rt.currentRatio,
      quickRatio: rt.quickRatio,
      cashToDebt: bs.totalDebt ? (bs.cashAndCashEquivalents || 0) / bs.totalDebt : null,
      altmanZScore: altmanZ,
      liquidityRatio: rt.cashRatio,

      revenueGrowth1y: gr.revenueGrowth,
      revenueGrowth3y: gr.threeYRevenueGrowthPerShare,
      revenueGrowth5y: gr.fiveYRevenueGrowthPerShare,
      epsGrowth1y: gr.epsgrowth,
      epsGrowth3y: gr.threeYNetIncomeGrowthPerShare,
      epsGrowth5y: gr.fiveYNetIncomeGrowthPerShare,
      fcfGrowth: gr.freeCashFlowGrowth,
      operatingIncomeGrowth: gr.operatingIncomeGrowth,

      assetTurnover: rt.assetTurnover,
      inventoryTurnover: rt.inventoryTurnover,
      workingCapitalEfficiency: wcEfficiency,
      capexToRevenue: km.capexToRevenue,
      operatingLeverage: opLeverage,
      reinvestmentRate,
      employeeProductivity: employeeProd,

      rdExpense: inc.researchAndDevelopmentExpenses,
      rdToRevenue: km.researchAndDevelopementToRevenue,
      rdProductivity: rdProd,

      insiderOwnership: null,
      institutionalOwnership: null,
      insiderBuying: null,

      daysOutstanding: km.daysOfSalesOutstanding,
      receivablesGrowthVsRevenue,
      inventoryGrowthVsRevenue,
      deferredRevenueGrowth: null,
      workingCapitalDrift,
      taxEfficiency: taxEff,
      earningsSurprises: null,

      dividendYield: dividendYieldVal,
      dividendGrowth: gr.dividendsPerShareGrowth,
      shareholderYield: shareholderYieldVal,
      payoutRatio: rt.dividendPayoutRatio,

      peRatio: rt.priceToEarningsRatio,
      forwardPe: rt.forwardPriceToEarningsGrowthRatio ? rt.priceToEarningsRatio : null,
      pegRatio: rt.priceToEarningsGrowthRatio,
      evToEbitda: km.evToEBITDA,
      evToSales: km.evToSales,
      priceToFcf: rt.priceToFreeCashFlowRatio,
      priceToBook: rt.priceToBookRatio,
      ruleOf40: ruleOf40Val,
      revenueMultipleVsGrowth: revMultVsGrowth,
      intrinsicValueGap: intrinsicValueGapVal,
      marginOfSafety: marginOfSafetyVal,
      dcfDiscount: dcfDiscountVal,

      currency: inc.reportedCurrency || "USD",
    };

    const existing = await db.select({ id: financialMetricsTable.id })
      .from(financialMetricsTable)
      .where(and(eq(financialMetricsTable.ticker, ticker), eq(financialMetricsTable.date, date)))
      .limit(1);

    if (existing.length) {
      await db.update(financialMetricsTable)
        .set(row)
        .where(eq(financialMetricsTable.id, existing[0].id));
    } else {
      await db.insert(financialMetricsTable).values(row);
    }
    inserted++;
  }

  return inserted;
}

export async function fetchAndStorePrices(ticker: string) {
  const data = await fmpFetch("historical-price-eod/full", { symbol: ticker }).catch(() => []);
  const prices = Array.isArray(data) ? data : [];

  if (!prices.length) return 0;

  const recentPrices = prices.slice(0, 365);

  for (const p of recentPrices) {
    const existing = await db.select({ id: priceHistoryTable.id })
      .from(priceHistoryTable)
      .where(and(eq(priceHistoryTable.ticker, ticker), eq(priceHistoryTable.date, p.date)))
      .limit(1);

    if (!existing.length) {
      await db.insert(priceHistoryTable).values({
        ticker,
        date: p.date,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        volume: p.volume,
      });
    }
  }

  return recentPrices.length;
}
