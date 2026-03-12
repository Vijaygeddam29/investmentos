/**
 * FMP Data Harvester
 *
 * Pipeline:
 *   FMP raw financials → derived-metrics computation → DB upsert
 *
 * Covers gaps:
 * - Gap 1: Explicit derived-metrics layer (ROIC, FCF yield, CCC, etc.)
 * - Gap 3: All calls routed through rate-limited fmpFetch client
 * - Gap 5: 10 annual periods + 3 years of daily prices
 * - Gap 7: Insider, institutional, and analyst data fetched
 */

import { db } from "@workspace/db";
import { companiesTable, financialMetricsTable, priceHistoryTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { fmpFetch } from "./fmp-client";

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

function nullIfZero(v: number | null | undefined): number | null {
  if (v == null || v === 0) return null;
  return v;
}

// ─── Company Profile ────────────────────────────────────────────────────────

export async function fetchAndStoreCompany(ticker: string) {
  const data = await fmpFetch("profile", { symbol: ticker });
  if (!data?.length) throw new Error(`No profile found for ${ticker}`);
  const p = data[0];

  const profile = {
    ticker: p.symbol,
    name: p.companyName,
    sector: p.sector || null,
    industry: p.industry || null,
    country: p.country || null,
    exchange: p.exchange || null,
  };

  await db.insert(companiesTable).values(profile).onConflictDoUpdate({
    target: companiesTable.ticker,
    set: { ...profile, updatedAt: new Date() },
  });

  return profile;
}

// ─── Derived Metrics ─────────────────────────────────────────────────────────
/**
 * Explicit derived-metrics layer (Gap 1).
 * Accepts raw FMP slices and produces the full set of derived factors.
 * All computations are documented so financial correctness can be audited.
 */
function computeDerivedMetrics(
  km: any, rt: any, inc: any, bs: any, cf: any, gr: any,
  prevInc: any, prevBs: any,
  ticker: string,
) {
  const revenue = inc.revenue ?? 0;
  const prevRevenue = prevInc.revenue ?? 0;

  // ── Free Cash Flow ────────────────────────────────────────────────────────
  // FCF = Operating CF − CapEx
  // FMP capex is typically negative (cash outflow); add to opCF.
  const opCF = cf.netCashProvidedByOperatingActivities ?? 0;
  const capex = cf.investmentsInPropertyPlantAndEquipment ?? 0;
  const fcf = opCF + capex; // capex is negative in FMP

  // ── Margins ───────────────────────────────────────────────────────────────
  const grossMargin = rt.grossProfitMargin ?? safeDiv(inc.grossProfit, revenue);
  const operatingMargin = rt.operatingProfitMargin ?? safeDiv(inc.operatingIncome, revenue);
  const netMargin = rt.netProfitMargin ?? safeDiv(inc.netIncome, revenue);
  const ebitMargin = rt.ebitMargin ?? safeDiv(inc.ebit, revenue);
  const ebitdaMargin = rt.ebitdaMargin ?? safeDiv(inc.ebitda, revenue);
  const fcfMargin = safeDiv(fcf, revenue);

  // Margin trends (YoY delta in percentage points)
  const grossMarginPrev = prevRevenue ? safeDiv(prevInc.grossProfit, prevRevenue) : null;
  const grossMarginTrend = grossMargin != null && grossMarginPrev != null
    ? grossMargin - grossMarginPrev : null;
  const opMarginPrev = prevRevenue ? safeDiv(prevInc.operatingIncome, prevRevenue) : null;
  const operatingMarginTrend = operatingMargin != null && opMarginPrev != null
    ? operatingMargin - opMarginPrev : null;

  // Incremental margin = ΔOperatingIncome / ΔRevenue
  const incrementalMargin = (revenue && prevRevenue && revenue !== prevRevenue)
    ? safeDiv((inc.operatingIncome ?? 0) - (prevInc.operatingIncome ?? 0), revenue - prevRevenue)
    : null;

  // ── Returns ───────────────────────────────────────────────────────────────
  // Use FMP pre-computed; these are GAAP-based and reliable.
  const roic = km.returnOnInvestedCapital ?? null;
  const roe = km.returnOnEquity ?? null;
  const roa = km.returnOnAssets ?? null;

  // ── Leverage & Liquidity ──────────────────────────────────────────────────
  const totalAssets = bs.totalAssets ?? 0;
  const totalLiabilities = bs.totalLiabilities ?? 0;
  const currentAssets = bs.totalCurrentAssets ?? 0;
  const currentLiabilities = bs.totalCurrentLiabilities ?? 0;
  const cash = bs.cashAndCashEquivalents ?? 0;
  const totalDebt = bs.totalDebt ?? 0;
  const mktCap = km.marketCap ?? 0;
  const netIncome = inc.netIncome ?? 0;

  // Altman Z-Score (public companies):
  //   Z = 1.2*(WC/TA) + 1.4*(RE/TA) + 3.3*(EBIT/TA) + 0.6*(MktCap/TL) + 1.0*(Rev/TA)
  const altmanZScore = totalAssets > 0
    ? 1.2 * (currentAssets - currentLiabilities) / totalAssets
    + 1.4 * (bs.retainedEarnings ?? 0) / totalAssets
    + 3.3 * (inc.ebit ?? 0) / totalAssets
    + 0.6 * (mktCap / (totalLiabilities || 1))
    + 1.0 * (revenue / totalAssets)
    : null;

  // Cash Conversion Cycle = DIO + DSO − DPO
  const cashConversionCycle = km.cashConversionCycle ?? null;

  // ── Cash Flow Quality ─────────────────────────────────────────────────────
  // Accrual ratio = (Net Income − FCF) / Total Assets
  // High accruals = lower earnings quality
  const accrualRatio = totalAssets > 0 ? (netIncome - fcf) / totalAssets : null;
  const fcfToNetIncome = safeDiv(fcf, netIncome);
  const operatingCfToRevenue = rt.operatingCashFlowSalesRatio ?? safeDiv(opCF, revenue);

  // Working capital drift = ΔWC / Revenue
  const wc = currentAssets - currentLiabilities;
  const prevWc = (prevBs.totalCurrentAssets ?? 0) - (prevBs.totalCurrentLiabilities ?? 0);
  const workingCapitalDrift = revenue ? (wc - prevWc) / revenue : null;

  // Receivables/Inventory growth vs revenue growth
  const recCur = bs.netReceivables ?? 0;
  const recPrev = prevBs.netReceivables ?? 0;
  const receivablesGrowthVsRevenue = recPrev
    ? safeDiv(recCur - recPrev, recPrev)! - (gr.revenueGrowth ?? 0)
    : null;
  const invCur = bs.inventory ?? 0;
  const invPrev = prevBs.inventory ?? 0;
  const inventoryGrowthVsRevenue = invPrev
    ? safeDiv(invCur - invPrev, invPrev)! - (gr.revenueGrowth ?? 0)
    : null;

  // SBC as % revenue — measures dilution pressure
  const sbc = cf.stockBasedCompensation ?? 0;
  const stockBasedCompPct = revenue ? sbc / revenue : null;

  // Tax efficiency = 1 − effective tax rate
  const taxEfficiency = (inc.incomeBeforeTax && inc.incomeTaxExpense != null)
    ? 1 - (inc.incomeTaxExpense / inc.incomeBeforeTax)
    : null;

  // Deferred revenue growth = (current deferred revenue − prior) / |prior|
  // Positive growth = accelerating prepaid commitments from customers (bullish SaaS signal)
  const deferredRevCur = bs.deferredRevenue ?? 0;
  const deferredRevPrev = prevBs.deferredRevenue ?? 0;
  const deferredRevenueGrowth = deferredRevPrev !== 0
    ? (deferredRevCur - deferredRevPrev) / Math.abs(deferredRevPrev)
    : (deferredRevCur > 0 ? 1 : null);

  // ── Capital Allocation ────────────────────────────────────────────────────
  // Reinvestment rate = 1 − (dividends / net income)
  const dividendsPaid = Math.abs(cf.commonDividendsPaid ?? 0);
  const reinvestmentRate = netIncome > 0 ? 1 - (dividendsPaid / netIncome) : null;

  // Shareholder yield = dividend yield + buyback yield
  const dividendYield = rt.dividendYield ?? null;
  const buybackYield = safeDiv(cf.commonStockRepurchased, mktCap);
  const shareholderYield = dividendYield != null || buybackYield != null
    ? (dividendYield ?? 0) + Math.abs(buybackYield ?? 0)
    : null;

  // Capital Allocation Discipline — composite 0..1 metric measuring quality of
  // how management deploys capital:
  //   - ROIC vs WACC (10%): value creation above cost of capital
  //   - Buyback yield quality: returning cash to shareholders
  //   - Dividend coverage: safety of dividend payout
  //   - SBC penalty: avoiding excessive dilution
  const roicVsWacc = roic != null ? Math.min(1, Math.max(0, (roic - 0.05) / 0.20)) : 0.5;
  const buybackAbs = Math.abs(cf.commonStockRepurchased ?? 0);
  const buybackScore = mktCap > 0 ? Math.min(1, (buybackAbs / mktCap) / 0.03) : 0.5;
  const dividendCoverage = netIncome > 0 && dividendsPaid > 0
    ? Math.min(1, netIncome / (dividendsPaid * 3))
    : (dividendsPaid === 0 ? 0.6 : 0.3);
  const sbcPenalty = stockBasedCompPct != null ? Math.max(0, 1 - stockBasedCompPct * 6) : 0.5;
  const capitalAllocationDiscipline = (roicVsWacc + buybackScore + dividendCoverage + sbcPenalty) / 4;

  // ── Capital Efficiency ────────────────────────────────────────────────────
  const assetTurnover = rt.assetTurnover ?? safeDiv(revenue, totalAssets);
  const inventoryTurnover = rt.inventoryTurnover ?? null;
  const capexToRevenue = km.capexToRevenue ?? (revenue ? Math.abs(capex) / revenue : null);
  const wcEfficiency = safeDiv(revenue, Math.abs(wc) || 1);

  // Operating leverage = % change operating income / % change revenue
  const revenueGrowth1y = gr.revenueGrowth ?? null;
  const operatingLeverage = revenueGrowth1y && gr.operatingIncomeGrowth
    ? gr.operatingIncomeGrowth / revenueGrowth1y
    : null;

  // Employee productivity = Revenue per employee
  const employees = km.fullTimeEmployees ?? null;
  const employeeProductivity = employees ? revenue / employees : null;

  // ── R&D ───────────────────────────────────────────────────────────────────
  const rdExpense = inc.researchAndDevelopmentExpenses ?? null;
  const rdToRevenue = km.researchAndDevelopementToRevenue
    ?? (rdExpense && revenue ? rdExpense / revenue : null);
  // R&D productivity = (Revenue growth in $) / R&D spend
  const rdProductivity = rdExpense && revenueGrowth1y != null
    ? (revenueGrowth1y * revenue) / rdExpense
    : null;

  // ── Valuation ─────────────────────────────────────────────────────────────
  const fcfYield = km.freeCashFlowYield ?? null;
  const earningsYield = km.earningsYield ?? null;

  // DCF discount = Earnings yield − WACC (10% standard)
  const wacc = 0.10;
  const dcfDiscount = earningsYield != null ? earningsYield - wacc : null;

  // Margin of Safety: uses FMP's priceToFairValue (Morningstar-style fair value)
  // MoS = 1 − (1 / P/FV) = discount to fair value
  const marginOfSafety = rt.priceToFairValue != null
    ? 1 - (1 / rt.priceToFairValue)
    : null;
  const intrinsicValueGap = marginOfSafety;

  // Rule of 40 = Revenue Growth% + Operating Margin%
  const ruleOf40 = revenueGrowth1y != null && operatingMargin != null
    ? (revenueGrowth1y * 100) + (operatingMargin * 100)
    : null;

  // Revenue multiple vs growth (PEG-equivalent for revenue)
  const priceToSales = rt.priceToSalesRatio ?? null;
  const revenueMultipleVsGrowth = priceToSales != null && revenueGrowth1y && revenueGrowth1y > 0
    ? priceToSales / (revenueGrowth1y * 100)
    : null;

  return {
    revenue: inc.revenue ?? null,
    grossMargin,
    grossMarginTrend,
    operatingMargin,
    operatingMarginTrend,
    netMargin,
    ebitMargin,
    ebitdaMargin,
    fcfMargin,
    incrementalMargin,
    roic,
    roic5yrAvg: null, // computed in multi-period step
    roicStability: null,
    roe,
    roa,
    freeCashFlow: fcf,
    fcfYield,
    fcfStability: null,    // computed post-loop across periods
    fcfToNetIncome,
    operatingCfToRevenue,
    accrualRatio,
    cashConversionCycle,
    cashFlowVolatility: null,  // computed post-loop across periods
    stockBasedCompPct,
    capitalAllocationDiscipline,
    debtToEquity: rt.debtToEquityRatio ?? null,
    netDebtEbitda: km.netDebtToEBITDA ?? null,
    interestCoverage: rt.interestCoverageRatio ?? null,
    currentRatio: rt.currentRatio ?? null,
    quickRatio: rt.quickRatio ?? null,
    cashToDebt: safeDiv(cash, nullIfZero(totalDebt)),
    altmanZScore,
    liquidityRatio: rt.cashRatio ?? null,
    workingCapitalDrift,
    revenueGrowth1y,
    revenueGrowth3y: gr.threeYRevenueGrowthPerShare ?? null,
    revenueGrowth5y: gr.fiveYRevenueGrowthPerShare ?? null,
    epsGrowth1y: gr.epsgrowth ?? null,
    epsGrowth3y: gr.threeYNetIncomeGrowthPerShare ?? null,
    epsGrowth5y: gr.fiveYNetIncomeGrowthPerShare ?? null,
    fcfGrowth: gr.freeCashFlowGrowth ?? null,
    operatingIncomeGrowth: gr.operatingIncomeGrowth ?? null,
    assetTurnover,
    inventoryTurnover,
    workingCapitalEfficiency: wcEfficiency,
    capexToRevenue,
    operatingLeverage,
    reinvestmentRate,
    dividendGrowth: gr.dividendsPerShareGrowth ?? null,
    shareholderYield,
    employeeProductivity,
    rdExpense,
    rdToRevenue,
    rdProductivity,
    insiderOwnership: null, // filled below from insider endpoint
    institutionalOwnership: null,
    insiderBuying: null,
    daysOutstanding: km.daysOfSalesOutstanding ?? null,
    receivablesGrowthVsRevenue,
    inventoryGrowthVsRevenue,
    deferredRevenueGrowth,
    taxEfficiency,
    earningsSurprises: null, // filled from analyst estimates
    dividendYield,
    payoutRatio: rt.dividendPayoutRatio ?? null,
    peRatio: rt.priceToEarningsRatio ?? null,
    forwardPe: null, // filled from analyst estimates
    pegRatio: rt.priceToEarningsGrowthRatio ?? null,
    evToEbitda: km.evToEBITDA ?? null,
    evToSales: km.evToSales ?? null,
    priceToFcf: rt.priceToFreeCashFlowRatio ?? null,
    priceToBook: rt.priceToBookRatio ?? null,
    ruleOf40,
    revenueMultipleVsGrowth,
    intrinsicValueGap,
    marginOfSafety,
    dcfDiscount,
    currency: inc.reportedCurrency ?? "USD",
  };
}

// ─── Insider & Institutional Data (Gap 7) ────────────────────────────────────

async function fetchInsiderData(ticker: string): Promise<{
  insiderOwnership: number | null;
  insiderBuying: number | null;
}> {
  try {
    const [insiderTrades, insiderStats] = await Promise.all([
      fmpFetch("insider-trading", { symbol: ticker }).catch(() => []),
      fmpFetch("insider-roaster-statistic", { symbol: ticker }).catch(() => []),
    ]);

    // Insider ownership from statistics
    let insiderOwnership: number | null = null;
    if (insiderStats?.length) {
      insiderOwnership = insiderStats[0].totalOwned != null
        ? insiderStats[0].totalOwned
        : null;
    }

    // Insider buying score: ratio of buy transactions to total in last 12 months
    const recent = Array.isArray(insiderTrades)
      ? insiderTrades.filter((t: any) => {
          const d = new Date(t.filingDate || t.transactionDate || "");
          return Date.now() - d.getTime() < 365 * 24 * 60 * 60 * 1000;
        })
      : [];
    const buys = recent.filter((t: any) => (t.transactionType || "").toLowerCase().includes("p-purchase")).length;
    const total = recent.length;
    const insiderBuying = total > 0 ? buys / total : null;

    return { insiderOwnership, insiderBuying };
  } catch {
    return { insiderOwnership: null, insiderBuying: null };
  }
}

async function fetchInstitutionalOwnership(ticker: string): Promise<number | null> {
  try {
    const data = await fmpFetch("institutional-holder", { symbol: ticker }).catch(() => []);
    if (!data?.length) return null;
    // Sum of all holders' positions as % of shares outstanding (FMP gives absolute shares)
    // Alternatively use the ownership percentage directly if available
    const totalPct = data.reduce((sum: number, h: any) => sum + (h.weightInPortfolio ?? 0), 0);
    // FMP institutional-holder doesn't always have shares outstanding; use change in ownership as proxy
    // Return first holder's percentage if direct ownership % not available
    if (data[0]?.sharesPercent != null) return data[0].sharesPercent;
    return totalPct > 0 ? Math.min(totalPct, 1) : null;
  } catch {
    return null;
  }
}

async function fetchAnalystData(ticker: string, currentPrice: number | null): Promise<{
  forwardPe: number | null;
  earningsSurprises: number | null;
  analystUpside: number | null;
}> {
  try {
    const [estimates, surprises, pricetarget] = await Promise.all([
      fmpFetch("analyst-estimates", { symbol: ticker, period: "annual" }).catch(() => []),
      fmpFetch("earnings-surprises", { symbol: ticker }).catch(() => []),
      fmpFetch("price-target-consensus", { symbol: ticker }).catch(() => null),
    ]);

    // Forward P/E: analyst consensus EPS estimate for next year / current stock price
    let forwardPe: number | null = null;
    if (estimates?.length && currentPrice != null && currentPrice > 0) {
      const nextYr = estimates.find((e: any) => {
        const yr = new Date(e.date).getFullYear();
        return yr >= new Date().getFullYear();
      });
      if (nextYr?.estimatedEpsAvg && nextYr.estimatedEpsAvg > 0) {
        forwardPe = +(currentPrice / nextYr.estimatedEpsAvg).toFixed(2);
      }
    }

    // Earnings surprise: average of last 4 quarters' surprise %
    let earningsSurprises: number | null = null;
    if (surprises?.length) {
      const recent = surprises.slice(0, 4);
      const pcts = recent
        .map((s: any) => s.actualEarningResult != null && s.estimatedEarning
          ? (s.actualEarningResult - s.estimatedEarning) / Math.abs(s.estimatedEarning)
          : null)
        .filter((v: any): v is number => v != null);
      earningsSurprises = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    }

    // Analyst upside: (median consensus price target - current price) / current price
    let analystUpside: number | null = null;
    if (pricetarget && currentPrice != null && currentPrice > 0) {
      const pt = Array.isArray(pricetarget) ? pricetarget[0] : pricetarget;
      const targetPrice = pt?.targetMedianPrice ?? pt?.targetMeanPrice ?? pt?.targetConsensus ?? null;
      if (targetPrice != null && targetPrice > 0) {
        analystUpside = (targetPrice - currentPrice) / currentPrice;
      }
    }

    return { forwardPe, earningsSurprises, analystUpside };
  } catch {
    return { forwardPe: null, earningsSurprises: null, analystUpside: null };
  }
}

// ─── Peer Benchmarks (Gap 2) ──────────────────────────────────────────────────

export async function fetchPeerBenchmarks(ticker: string): Promise<{
  pePeerMedian: number | null;
  evEbitdaPeerMedian: number | null;
  revenueGrowthPeerMedian: number | null;
  grossMarginPeerMedian: number | null;
}> {
  try {
    const peers = await fmpFetch("peers", { symbol: ticker }).catch(() => []);
    const peerTickers: string[] = Array.isArray(peers)
      ? (peers[0]?.peersList ?? peers).slice(0, 6)
      : [];

    if (!peerTickers.length) return {
      pePeerMedian: null, evEbitdaPeerMedian: null,
      revenueGrowthPeerMedian: null, grossMarginPeerMedian: null,
    };

    const peerMetrics = await Promise.all(
      peerTickers.map(p =>
        fmpFetch("key-metrics", { symbol: p, period: "annual" })
          .then(d => d?.[0] ?? null)
          .catch(() => null)
      )
    );

    const valid = peerMetrics.filter(Boolean);

    function median(arr: (number | null)[]): number | null {
      const nums = arr.filter((v): v is number => v != null).sort((a, b) => a - b);
      if (!nums.length) return null;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    }

    return {
      pePeerMedian: median(valid.map(m => m.peRatio ?? null)),
      evEbitdaPeerMedian: median(valid.map(m => m.evToEBITDA ?? null)),
      revenueGrowthPeerMedian: null, // requires income statement growth data
      grossMarginPeerMedian: null,
    };
  } catch {
    return {
      pePeerMedian: null, evEbitdaPeerMedian: null,
      revenueGrowthPeerMedian: null, grossMarginPeerMedian: null,
    };
  }
}

// ─── Main Financial Metrics Harvester ────────────────────────────────────────

export async function fetchAndStoreMetrics(ticker: string) {
  // Fetch up to 10 annual periods (covers 10yr history, 5yr ROIC avg, 3yr CAGR)
  const limit10 = { limit: "10" };
  const [keyMetrics, ratios, incomeStmt, balanceSheet, cashFlow, growth] = await Promise.all([
    fmpFetch("key-metrics", { symbol: ticker, period: "annual", ...limit10 }).catch(() => []),
    fmpFetch("ratios", { symbol: ticker, period: "annual", ...limit10 }).catch(() => []),
    fmpFetch("income-statement", { symbol: ticker, period: "annual", ...limit10 }).catch(() => []),
    fmpFetch("balance-sheet-statement", { symbol: ticker, period: "annual", ...limit10 }).catch(() => []),
    fmpFetch("cash-flow-statement", { symbol: ticker, period: "annual", ...limit10 }).catch(() => []),
    fmpFetch("financial-growth", { symbol: ticker, period: "annual", ...limit10 }).catch(() => []),
  ]);

  if (!keyMetrics.length && !incomeStmt.length) {
    throw new Error(`No financial data found for ${ticker}`);
  }

  // Current stock price for forward P/E computation (from key-metrics latest row)
  const currentStockPrice: number | null = keyMetrics[0]?.stockPrice ?? keyMetrics[0]?.price ?? null;

  // Insider, institutional, analyst (with forward P/E + upside), and peer benchmark data
  const [insiderData, institutionalOwnership, analystData, peerBenchmarks] = await Promise.all([
    fetchInsiderData(ticker),
    fetchInstitutionalOwnership(ticker),
    fetchAnalystData(ticker, currentStockPrice),
    fetchPeerBenchmarks(ticker),
  ]);

  const count = Math.min(10, Math.max(keyMetrics.length, incomeStmt.length, 1));
  let inserted = 0;
  let latestRowId: number | null = null;

  // ── Cross-period aggregates (computed before the per-period loop) ──────────
  const roicValues = keyMetrics.map((km: any) => km.returnOnInvestedCapital).filter((v: any) => v != null);
  const roic5yrAvg = roicValues.length
    ? roicValues.slice(0, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(roicValues.length, 5)
    : null;
  const roicStability = roicValues.length >= 2 ? computeStability(roicValues.slice(0, 5)) : null;

  // FCF and operating CF across all available periods for stability/volatility
  const fcfValues: number[] = cashFlow
    .map((cf: any) => {
      const opCF = cf.netCashProvidedByOperatingActivities ?? 0;
      const capex = cf.investmentsInPropertyPlantAndEquipment ?? 0;
      return opCF + capex;
    })
    .filter((v: number) => v !== 0);
  const opCfValues: number[] = cashFlow
    .map((cf: any) => cf.netCashProvidedByOperatingActivities)
    .filter((v: any) => v != null && v !== 0) as number[];

  // FCF Stability = 1 − (stddev / |mean|) capped to [0,1], null if < 2 periods
  const fcfStabilityGlobal = fcfValues.length >= 2 ? computeStability(fcfValues.slice(0, 5)) : null;
  // Cash Flow Volatility = coefficient of variation of operating CF (lower = better, inverted)
  const cashFlowVolatilityGlobal = opCfValues.length >= 2
    ? computeCoV(opCfValues.slice(0, 5))
    : null;

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

    const derived = computeDerivedMetrics(km, rt, inc, bs, cf, gr, prevInc, prevBs, ticker);

    // Only the most recent period gets insider/analyst/peer/cross-period data
    const isLatest = i === 0;
    const row = {
      ...derived,
      ticker,
      date,
      roic5yrAvg: isLatest ? roic5yrAvg : null,
      roicStability: isLatest ? roicStability : null,
      fcfStability: isLatest ? fcfStabilityGlobal : null,
      cashFlowVolatility: isLatest ? cashFlowVolatilityGlobal : null,
      insiderOwnership: isLatest ? insiderData.insiderOwnership : null,
      insiderBuying: isLatest ? insiderData.insiderBuying : null,
      institutionalOwnership: isLatest ? institutionalOwnership : null,
      earningsSurprises: isLatest ? analystData.earningsSurprises : null,
      forwardPe: isLatest ? analystData.forwardPe : null,
      analystUpside: isLatest ? analystData.analystUpside : null,
      // Peer-relative valuation
      pePeerMedian: isLatest ? peerBenchmarks.pePeerMedian : null,
      evEbitdaPeerMedian: isLatest ? peerBenchmarks.evEbitdaPeerMedian : null,
      peVsPeerMedian: isLatest && peerBenchmarks.pePeerMedian && derived.peRatio
        ? +(derived.peRatio / peerBenchmarks.pePeerMedian).toFixed(4)
        : null,
    };

    const existing = await db.select({ id: financialMetricsTable.id })
      .from(financialMetricsTable)
      .where(and(eq(financialMetricsTable.ticker, ticker), eq(financialMetricsTable.date, date)))
      .limit(1);

    if (existing.length) {
      await db.update(financialMetricsTable).set(row).where(eq(financialMetricsTable.id, existing[0].id));
      if (isLatest) latestRowId = existing[0].id;
    } else {
      const result = await db.insert(financialMetricsTable).values(row).returning({ id: financialMetricsTable.id });
      if (isLatest && result.length) latestRowId = result[0].id;
    }
    inserted++;
  }

  return inserted;
}

// ── Helpers for cross-period volatility ──────────────────────────────────────

/** Coefficient of variation = stddev / |mean|. Lower = more stable cash flows. */
function computeCoV(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

// ─── Price History (Gap 5: 3 years of daily prices) ─────────────────────────

export async function fetchAndStorePrices(ticker: string) {
  // 3 years = ~750 trading days
  const data = await fmpFetch("historical-price-eod/full", { symbol: ticker }).catch(() => []);
  const prices = Array.isArray(data) ? data : (data?.historical ?? []);

  if (!prices.length) return 0;

  const threeyears = prices.slice(0, 756); // ~3 years
  let stored = 0;

  for (const p of threeyears) {
    if (!p.date || p.close == null) continue;
    const existing = await db.select({ id: priceHistoryTable.id })
      .from(priceHistoryTable)
      .where(and(eq(priceHistoryTable.ticker, ticker), eq(priceHistoryTable.date, p.date)))
      .limit(1);

    if (!existing.length) {
      await db.insert(priceHistoryTable).values({
        ticker, date: p.date,
        open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume,
      });
      stored++;
    }
  }

  return stored;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function computeStability(values: number[]): number {
  if (values.length < 2) return 0.5;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0.5;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return Math.max(0, Math.min(1, 1 - cv));
}
