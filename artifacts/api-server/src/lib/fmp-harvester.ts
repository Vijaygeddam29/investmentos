import { db } from "@workspace/db";
import { companiesTable, financialMetricsTable, priceHistoryTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

  await db.delete(financialMetricsTable).where(eq(financialMetricsTable.ticker, ticker));

  const count = Math.min(5, Math.max(keyMetrics.length, incomeStmt.length, 1));

  for (let i = 0; i < count; i++) {
    const km = keyMetrics[i] || {};
    const rt = ratios[i] || {};
    const inc = incomeStmt[i] || {};
    const bs = balanceSheet[i] || {};
    const cf = cashFlow[i] || {};
    const gr = growth[i] || {};

    const date = km.date || inc.date || rt.date || new Date().toISOString().split("T")[0];
    const revenue = inc.revenue || 0;
    const fcf = (cf.netCashProvidedByOperatingActivities || 0) + (cf.investmentsInPropertyPlantAndEquipment || 0);

    await db.insert(financialMetricsTable).values({
      ticker,
      date,
      revenue: inc.revenue,
      grossMargin: rt.grossProfitMargin,
      operatingMargin: rt.operatingProfitMargin,
      netMargin: rt.netProfitMargin,
      ebitMargin: rt.ebitMargin,
      ebitdaMargin: rt.ebitdaMargin,
      fcfMargin: revenue ? fcf / revenue : null,

      roic: km.returnOnInvestedCapital,
      roe: km.returnOnEquity,
      roa: km.returnOnAssets,

      freeCashFlow: fcf,
      fcfYield: km.freeCashFlowYield,
      fcfToNetIncome: inc.netIncome ? fcf / inc.netIncome : null,
      operatingCfToRevenue: rt.operatingCashFlowSalesRatio,

      debtToEquity: rt.debtToEquityRatio,
      netDebtEbitda: km.netDebtToEBITDA,
      interestCoverage: rt.interestCoverageRatio,
      currentRatio: rt.currentRatio,
      quickRatio: rt.quickRatio,
      cashToDebt: bs.totalDebt ? (bs.cashAndCashEquivalents || 0) / bs.totalDebt : null,

      revenueGrowth1y: gr.revenueGrowth,
      epsGrowth1y: gr.epsgrowth,
      fcfGrowth: gr.freeCashFlowGrowth,
      operatingIncomeGrowth: gr.operatingIncomeGrowth,

      assetTurnover: rt.assetTurnover,
      inventoryTurnover: rt.inventoryTurnover,
      capexToRevenue: km.capexToRevenue,

      rdExpense: inc.researchAndDevelopmentExpenses,
      rdToRevenue: km.researchAndDevelopementToRevenue,

      insiderOwnership: null,
      institutionalOwnership: null,

      daysOutstanding: km.daysOfSalesOutstanding,

      dividendYield: rt.dividendYield,
      dividendGrowth: gr.dividendsPerShareGrowth,
      shareholderYield: null,
      payoutRatio: rt.dividendPayoutRatio,

      peRatio: rt.priceToEarningsRatio,
      forwardPe: null,
      pegRatio: rt.priceToEarningsGrowthRatio,
      evToEbitda: km.evToEBITDA,
      evToSales: km.evToSales,
      priceToFcf: rt.priceToFreeCashFlowRatio,
      priceToBook: rt.priceToBookRatio,

      currency: inc.reportedCurrency || "USD",
    });
  }

  return count;
}

export async function fetchAndStorePrices(ticker: string) {
  const data = await fmpFetch("historical-price-eod/full", { symbol: ticker }).catch(() => []);
  const prices = Array.isArray(data) ? data : [];

  if (!prices.length) return 0;

  await db.delete(priceHistoryTable).where(eq(priceHistoryTable.ticker, ticker));

  const recentPrices = prices.slice(0, 365);

  const rows = recentPrices.map((p: any) => ({
    ticker,
    date: p.date,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    volume: p.volume,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(priceHistoryTable).values(rows.slice(i, i + 100));
  }

  return recentPrices.length;
}
