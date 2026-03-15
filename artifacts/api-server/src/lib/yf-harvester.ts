/**
 * Yahoo Finance Harvester (fallback for FMP quota exhaustion)
 *
 * Uses yahoo-finance2 (no API key, unlimited) to fetch:
 *  - Company profile  (assetProfile, price, summaryDetail)
 *  - Latest-period financials from financialData (margins, FCF, ratios, returns)
 *  - Historical revenue + net-income trends from incomeStatementHistory
 *  - 3 years of daily price history via chart()
 *
 * Data availability reality (Yahoo Finance v3, post-Nov 2024):
 *   - financialData: full richness for current period  ✓
 *   - incomeStatementHistory: only revenue + netIncome work  ✓ (rest = 0/null)
 *   - balanceSheetHistory / cashflowStatementHistory: completely empty  ✗
 *
 * Strategy: store 1 high-quality "latest" row + up to 3 revenue-only historical rows.
 */

import YahooFinanceClass from "yahoo-finance2";
import { db } from "@workspace/db";
import { companiesTable, financialMetricsTable, priceHistoryTable } from "@workspace/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { normaliseCountryName } from "./country-benchmarks";

const yahooFinance = new (YahooFinanceClass as any)({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

function n(v: any): number | null {
  if (v == null) return null;
  const num = typeof v === "number" ? v : Number(v);
  return isFinite(num) ? num : null;
}

async function upsertMetrics(row: Record<string, any>) {
  const { ticker, date } = row;
  const existing = await db
    .select({ id: financialMetricsTable.id })
    .from(financialMetricsTable)
    .where(and(eq(financialMetricsTable.ticker, ticker), eq(financialMetricsTable.date, date)))
    .limit(1);

  if (existing.length) {
    await db.update(financialMetricsTable).set(row).where(eq(financialMetricsTable.id, existing[0].id));
  } else {
    await db.insert(financialMetricsTable).values(row);
  }
}

// ─── Company Profile ──────────────────────────────────────────────────────────

export async function yfFetchAndStoreCompany(ticker: string) {
  const summary = await yahooFinance.quoteSummary(ticker, {
    modules: ["assetProfile", "price", "summaryDetail"],
  });

  const ap = summary.assetProfile ?? {};
  const pr = summary.price ?? {};

  const profile = {
    ticker,
    name:     String(pr.longName ?? pr.shortName ?? ticker),
    sector:   (ap.sector   ?? null) as string | null,
    industry: (ap.industry ?? null) as string | null,
    country:  (ap.country  ?? null) as string | null,
    exchange: ((pr.exchangeName ?? pr.exchange) ?? null) as string | null,
    currency: String(pr.currency ?? "USD"),
    marketCap: pr.marketCap != null ? pr.marketCap / 1e9 : null,
  };

  await db.insert(companiesTable).values(profile).onConflictDoUpdate({
    target: companiesTable.ticker,
    set: { ...profile, updatedAt: new Date() },
  });

  return profile;
}

// ─── Financial Metrics ────────────────────────────────────────────────────────

export async function yfFetchAndStoreMetrics(ticker: string) {
  const summary = await yahooFinance.quoteSummary(ticker, {
    modules: [
      "financialData",        // current-period: margins, FCF, ratios, returns — RICH
      "defaultKeyStatistics", // P/B, P/E, beta, shares, ROIC proxy
      "summaryDetail",        // dividend, PE, market cap
      "incomeStatementHistory", // revenue + netIncome for up to 4 years
      "assetProfile",           // employees (for productivity calc)
      "earningsTrend",          // analyst forward estimates
      "price",                  // mktCap, currency
    ],
  });

  const fd = summary.financialData          ?? {};
  const ks = summary.defaultKeyStatistics    ?? {};
  const sd = summary.summaryDetail           ?? {};
  const ap = summary.assetProfile            ?? {};
  const pr = summary.price                   ?? {};
  const et = summary.earningsTrend           ?? {};
  const incList = (summary.incomeStatementHistory?.incomeStatementHistory ?? []) as any[];

  // ── Current-period fundamentals from financialData (authoritative) ──────────
  const revenue     = n(fd.totalRevenue)     ?? null;
  const grossMargin = n(fd.grossMargins);
  const opMargin    = n(fd.operatingMargins);
  const netMargin   = n(fd.profitMargins);
  const opCF        = n(fd.operatingCashflow) ?? null;
  const fcf         = n(fd.freeCashflow)      ?? null;
  const totalDebt   = n(fd.totalDebt)         ?? null;
  const currentRatio = n(fd.currentRatio);
  const quickRatio   = n(fd.quickRatio);
  const debtToEquity = n(fd.debtToEquity);
  const roe          = n(fd.returnOnEquity);
  const roa          = n(fd.returnOnAssets);
  const revenueGrowth1y = n(fd.revenueGrowth);
  const earningsGrowth  = n(fd.earningsGrowth);

  // Derived from current-period (approx from margins + revenue)
  const grossProfit   = grossMargin != null && revenue != null ? grossMargin * revenue : null;
  const opIncome      = opMargin    != null && revenue != null ? opMargin    * revenue : null;
  const netIncome     = netMargin   != null && revenue != null ? netMargin   * revenue : null;
  const ebit          = opIncome;
  // ebitda proxy removed — D&A not available from yfinance; leave null for data integrity
  const ebitda: number | null = null;

  // Valuation
  const mktCap      = n(pr.marketCap) ?? n(sd.marketCap) ?? null;
  const dividendYield  = n(sd.dividendYield) ?? n(sd.trailingAnnualDividendYield);
  const payoutRatio    = n(sd.payoutRatio);
  const peRatio        = n(sd.trailingPE);
  const priceToBook    = n(ks.priceToBook);
  const pegRatio       = n(ks.pegRatio);
  const priceToSales   = n(sd.priceToSalesTrailing12Months);
  const evToEbitda     = n(ks.enterpriseToEbitda);
  const evToSales      = n(ks.enterpriseToRevenue);
  const fcfYield       = mktCap != null && mktCap > 0 ? safeDiv(fcf, mktCap) : null;
  const earningsYield  = peRatio ? 1 / peRatio : null;

  // Analyst forward PE
  const trendItems: any[] = et.trend ?? [];
  const nextYrTrend = trendItems.find((t: any) => t.period === "+1y") ?? {};
  const forwardPe = n(sd.forwardPE)
    ?? (nextYrTrend.earningsEstimate?.avg != null && n(fd.currentPrice)
      ? safeDiv(n(fd.currentPrice)!, n(nextYrTrend.earningsEstimate.avg))
      : null);

  // FCF quality
  const fcfMargin      = revenue ? safeDiv(fcf, revenue) : null;
  const opCfToRevenue  = revenue ? safeDiv(opCF, revenue) : null;
  const fcfToNetIncome = netIncome ? safeDiv(fcf, netIncome) : null;
  const accrualRatio   = null; // need balance sheet; not available
  const netDebtEbitda  = ebitda && ebitda > 0 ? safeDiv(totalDebt, ebitda) : null;

  // Approximate capital allocation
  const employees = n((ap as any).fullTimeEmployees);
  const employeeProductivity = employees && revenue ? revenue / employees : null;
  const sharePrice = n(fd.currentPrice) ?? n(sd.previousClose) ?? 0;
  const buybacks = 0; // not available from YF without cashflow history
  const sbc = 0;      // not available from YF without cashflow history
  const buybackYield = 0;
  const shareholderYield = dividendYield ?? null;
  const roicProxy = roe; // ROIC not directly in YF; use ROE as proxy
  const roicVsWacc = roicProxy != null ? Math.min(1, Math.max(0, (roicProxy - 0.05) / 0.20)) : 0.5;
  const capitalAllocationDiscipline = (roicVsWacc + (dividendYield != null ? Math.min(1, dividendYield / 0.03) : 0.5)) / 2;

  // Other factors
  const ruleOf40 = revenueGrowth1y != null && opMargin != null
    ? revenueGrowth1y * 100 + opMargin * 100 : null;
  const revenueMultipleVsGrowth = priceToSales != null && revenueGrowth1y && revenueGrowth1y > 0
    ? priceToSales / (revenueGrowth1y * 100) : null;
  const marginOfSafety = fcfYield != null ? Math.min(0.5, Math.max(-0.5, fcfYield - 0.08)) : null;

  const today = new Date().toISOString().split("T")[0];
  const currency = String(pr.currency ?? "USD");

  // ── Latest-period row (full quality) ────────────────────────────────────────
  await upsertMetrics({
    ticker, date: today, currency,
    revenue:               revenue    || null,
    grossMargin,
    grossMarginTrend:      null,
    operatingMargin:       opMargin,
    operatingMarginTrend:  null,
    netMargin,
    ebitMargin:            opMargin,
    ebitdaMargin:          ebitda && revenue ? ebitda / revenue : null,
    fcfMargin,
    incrementalMargin:     null,
    roic:                  roicProxy,
    roic5yrAvg:            roicProxy,
    roicStability:         null,
    roe,
    roa,
    freeCashFlow:          fcf  || null,
    fcfYield,
    fcfStability:          null,
    fcfToNetIncome,
    operatingCfToRevenue:  opCfToRevenue,
    accrualRatio,
    cashConversionCycle:   null,
    cashFlowVolatility:    null,
    stockBasedCompPct:     null,
    capitalAllocationDiscipline,
    debtToEquity,
    netDebtEbitda,
    interestCoverage:      null,
    currentRatio,
    quickRatio,
    cashToDebt:            totalDebt != null && totalDebt > 0 ? safeDiv(n(fd.cash), totalDebt) : null,
    altmanZScore:          null,
    liquidityRatio:        null,
    workingCapitalDrift:   null,
    revenueGrowth1y,
    revenueGrowth3y:       null,
    revenueGrowth5y:       null,
    epsGrowth1y:           earningsGrowth,
    epsGrowth3y:           null,
    epsGrowth5y:           null,
    fcfGrowth:             null,
    operatingIncomeGrowth: null,
    assetTurnover:         null,
    inventoryTurnover:     null,
    workingCapitalEfficiency: null,
    capexToRevenue:        null,
    operatingLeverage:     null,
    reinvestmentRate:      null,
    dividendGrowth:        null,
    shareholderYield:      shareholderYield || null,
    employeeProductivity,
    rdExpense:             null,
    rdToRevenue:           null,
    rdProductivity:        null,
    insiderOwnership:      null,
    institutionalOwnership: null,
    insiderBuying:         null,
    daysOutstanding:       null,
    receivablesGrowthVsRevenue: null,
    inventoryGrowthVsRevenue:   null,
    deferredRevenueGrowth:      null,
    taxEfficiency:         null,
    earningsSurprises:     null,
    dividendYield,
    payoutRatio,
    peRatio,
    forwardPe,
    pegRatio,
    evToEbitda,
    evToSales,
    priceToFcf:            mktCap != null && fcf != null && fcf !== 0 ? mktCap / fcf : null,
    priceToBook,
    ruleOf40,
    revenueMultipleVsGrowth,
    intrinsicValueGap:     marginOfSafety,
    marginOfSafety,
    dcfDiscount:           earningsYield != null ? earningsYield - 0.10 : null,
    analystUpside:         null,
    pePeerMedian:          null,
    evEbitdaPeerMedian:    null,
    peVsPeerMedian:        null,
  });

  // ── Historical periods (revenue + net income for trend scoring) ─────────────
  let historicalInserted = 0;
  for (let i = 0; i < Math.min(incList.length, 4); i++) {
    const inc = incList[i] ?? {};
    const prevInc = incList[i + 1] ?? {};
    const histRevenue = n(inc.totalRevenue) ?? null;
    const histNetIncome = n(inc.netIncome) ?? null;
    const prevRevenue  = n(prevInc.totalRevenue) ?? null;

    if (!histRevenue || !inc.endDate) continue;

    const histDate = new Date(inc.endDate).toISOString().split("T")[0];
    if (histDate === today) continue; // skip if same as today's row

    const histNetMargin = histRevenue ? safeDiv(histNetIncome, histRevenue) : null;
    const histRevGrowth = prevRevenue ? safeDiv(histRevenue - prevRevenue, prevRevenue) : null;

    await upsertMetrics({
      ticker, date: histDate, currency,
      revenue:       histRevenue || null,
      grossMargin:   null,
      operatingMargin: null,
      netMargin:     histNetMargin,
      fcfMargin:     null,
      revenueGrowth1y: histRevGrowth,
      // everything else null — partial historical record
      grossMarginTrend: null, operatingMarginTrend: null, ebitMargin: null,
      ebitdaMargin: null, incrementalMargin: null, roic: null, roic5yrAvg: null,
      roicStability: null, roe: null, roa: null, freeCashFlow: null,
      fcfYield: null, fcfStability: null, fcfToNetIncome: null,
      operatingCfToRevenue: null, accrualRatio: null, cashConversionCycle: null,
      cashFlowVolatility: null, stockBasedCompPct: null, capitalAllocationDiscipline: null,
      debtToEquity: null, netDebtEbitda: null, interestCoverage: null,
      currentRatio: null, quickRatio: null, cashToDebt: null, altmanZScore: null,
      liquidityRatio: null, workingCapitalDrift: null, revenueGrowth3y: null,
      revenueGrowth5y: null, epsGrowth1y: null, epsGrowth3y: null, epsGrowth5y: null,
      fcfGrowth: null, operatingIncomeGrowth: null, assetTurnover: null,
      inventoryTurnover: null, workingCapitalEfficiency: null, capexToRevenue: null,
      operatingLeverage: null, reinvestmentRate: null, dividendGrowth: null,
      shareholderYield: null, employeeProductivity: null, rdExpense: null,
      rdToRevenue: null, rdProductivity: null, insiderOwnership: null,
      institutionalOwnership: null, insiderBuying: null, daysOutstanding: null,
      receivablesGrowthVsRevenue: null, inventoryGrowthVsRevenue: null,
      deferredRevenueGrowth: null, taxEfficiency: null, earningsSurprises: null,
      dividendYield: null, payoutRatio: null, peRatio: null, forwardPe: null,
      pegRatio: null, evToEbitda: null, evToSales: null, priceToFcf: null,
      priceToBook: null, ruleOf40: null, revenueMultipleVsGrowth: null,
      intrinsicValueGap: null, marginOfSafety: null, dcfDiscount: null,
      analystUpside: null, pePeerMedian: null, evEbitdaPeerMedian: null,
      peVsPeerMedian: null, currency,
    });
    historicalInserted++;
  }

  console.log(`[YF] ${ticker} — stored 1 latest + ${historicalInserted} historical period(s)`);
  return 1 + historicalInserted;
}

// ─── Null Field Patcher ───────────────────────────────────────────────────────
/**
 * yfPatchNullFields() — fills null/missing fields in the MOST RECENT financial_metrics
 * record for a ticker using Yahoo Finance data.
 *
 * Called PROACTIVELY at pipeline start AND after each FMP harvest — not on query.
 * Only writes fields currently null in the DB — never overwrites existing FMP values.
 * Also patches the company's country if it is null or needs normalisation.
 */
export async function yfPatchNullFields(ticker: string): Promise<void> {
  try {
    // Comprehensive summary fetch — more modules = more fields backfilled
    const quoteSummary = await yahooFinance.quoteSummary(ticker, {
      modules: [
        "financialData",          // margins, FCF, ratios, current liquidity — very rich
        "defaultKeyStatistics",   // P/B, PEG, EV/EBITDA, short interest, beta
        "summaryDetail",          // trailing PE, forward PE, dividend, P/S
        "earningsTrend",          // analyst forward estimates + revenue revision
        "recommendationTrend",    // analyst buy/sell/hold consensus
        "assetProfile",           // country, sector, industry (for company table)
        "price",                  // current price, market cap, currency
      ],
    }).catch(() => null);

    if (!quoteSummary) return;

    const fd = quoteSummary.financialData          ?? {};
    const ks = quoteSummary.defaultKeyStatistics    ?? {};
    const sd = quoteSummary.summaryDetail           ?? {};
    const ap = quoteSummary.assetProfile            ?? {};
    const pr = quoteSummary.price                   ?? {};
    const et = quoteSummary.earningsTrend           ?? {};

    // Derive analyst consensus upside from forward earnings estimate
    const trendList: any[] = et.trend ?? [];
    const nextYr = trendList.find((t: any) => t.period === "+1y") ?? {};
    const tgtPrice = n(nextYr?.earningsEstimate?.avg) ?? null;
    const currPrice = n(fd.currentPrice) ?? n(sd.previousClose) ?? null;
    const analystUpside = tgtPrice != null && currPrice != null && currPrice > 0
      ? (tgtPrice - currPrice) / currPrice : null;

    // Revenue + op CF for FCF-derived fields
    const revenue    = n(fd.totalRevenue);
    const opCF       = n(fd.operatingCashflow);
    const fcf        = n(fd.freeCashflow);
    const mktCap     = n(pr.marketCap) ?? n(sd.marketCap);
    const netMargin  = n(fd.profitMargins);
    const netIncome  = revenue != null && netMargin != null ? revenue * netMargin : null;
    const fcfYield   = fcf != null && mktCap != null && mktCap > 0 ? fcf / mktCap : null;
    const fcfMargin  = fcf != null && revenue != null && revenue > 0 ? fcf / revenue : null;
    const opCfToRev  = opCF != null && revenue != null && revenue > 0 ? opCF / revenue : null;
    const fcfToNI    = fcf != null && netIncome != null && netIncome !== 0 ? fcf / netIncome : null;

    // Build comprehensive patch record
    const patch: Record<string, number | null> = {
      // Margins — most reliable from Yahoo Finance
      grossMargin:            n(fd.grossMargins),
      operatingMargin:        n(fd.operatingMargins),
      netMargin:              netMargin,
      fcfMargin:              fcfMargin,
      operatingCfToRevenue:   opCfToRev,
      fcfToNetIncome:         fcfToNI,

      // Growth
      revenueGrowth1y:        n(fd.revenueGrowth),
      epsGrowth1y:            n(fd.earningsGrowth),

      // Liquidity / leverage
      currentRatio:           n(fd.currentRatio),
      quickRatio:             n(fd.quickRatio),
      debtToEquity:           n(fd.debtToEquity),

      // Returns
      roe:                    n(fd.returnOnEquity),
      roa:                    n(fd.returnOnAssets),

      // Valuation
      peRatio:                n(sd.trailingPE),
      forwardPe:              n(sd.forwardPE),
      priceToBook:            n(ks.priceToBook),
      pegRatio:               n(ks.pegRatio),
      priceToSales:           n(sd.priceToSalesTrailing12Months),
      evToEbitda:             n(ks.enterpriseToEbitda),
      evToSales:              n(ks.enterpriseToRevenue),
      fcfYield:               fcfYield,

      // Income / cash flow
      revenue:                revenue,
      freeCashFlow:           fcf,
      earningsYield:          n(sd.trailingPE) ? 1 / n(sd.trailingPE)! : null,

      // Dividend
      dividendYield:          n(sd.dividendYield) ?? n(sd.trailingAnnualDividendYield),
      payoutRatio:            n(sd.payoutRatio),

      // Analyst signals
      analystUpside:          analystUpside,

      // Market cap
      marketCap:              mktCap != null ? mktCap / 1e9 : null, // store in billions
    };

    // ── Patch financial_metrics row (most recent, not just today) ────────────
    const existingRows = await db
      .select()
      .from(financialMetricsTable)
      .where(eq(financialMetricsTable.ticker, ticker))
      .orderBy(desc(financialMetricsTable.date))
      .limit(1);

    if (existingRows.length > 0) {
      const row = existingRows[0] as Record<string, any>;
      const metricsUpdates: Record<string, number | null> = {};
      for (const [field, value] of Object.entries(patch)) {
        if (value != null && row[field] == null) {
          metricsUpdates[field] = value;
        }
      }
      if (Object.keys(metricsUpdates).length > 0) {
        await db
          .update(financialMetricsTable)
          .set(metricsUpdates)
          .where(eq(financialMetricsTable.id, row.id));
        console.log(`[YF Patch] ${ticker} — backfilled ${Object.keys(metricsUpdates).length} fields from Yahoo Finance`);
      }
    }

    // ── Also patch company country/sector if null ────────────────────────────
    const companyRows = await db
      .select({ country: companiesTable.country, sector: companiesTable.sector })
      .from(companiesTable)
      .where(eq(companiesTable.ticker, ticker))
      .limit(1);

    if (companyRows.length > 0) {
      const co = companyRows[0];
      const companyUpdates: Record<string, string | null> = {};

      const yfCountry = normaliseCountryName((ap as any).country as string | undefined);
      const yfSector  = (ap as any).sector as string | undefined;

      if (yfCountry && !co.country) companyUpdates.country = yfCountry;
      // Normalise existing country values even if non-null (fixes US/GB/IL etc.)
      else if (co.country) {
        const normalised = normaliseCountryName(co.country);
        if (normalised && normalised !== co.country) companyUpdates.country = normalised;
      }
      if (yfSector && !co.sector) companyUpdates.sector = yfSector;

      if (Object.keys(companyUpdates).length > 0) {
        await db.update(companiesTable).set(companyUpdates).where(eq(companiesTable.ticker, ticker));
      }
    }

  } catch (err: any) {
    console.warn(`[YF Patch] ${ticker} — patch failed: ${err.message}`);
  }
}

// ─── Universe-wide Proactive YF Patch ────────────────────────────────────────
/**
 * runYfPatchUniverse() — called at pipeline start BEFORE per-ticker processing.
 * Loops all companies and proactively backfills null fields from Yahoo Finance.
 * This ensures scoring runs with the richest possible data without waiting for
 * a user query to trigger the patch.
 *
 * Rate-limited: 300ms delay between each ticker to stay under YF limits.
 */
export async function runYfPatchUniverse(onProgress?: (done: number, total: number, ticker: string) => void): Promise<{ patched: number; failed: number }> {
  const companies = await db
    .select({ ticker: companiesTable.ticker })
    .from(companiesTable)
    .orderBy(companiesTable.ticker);

  let patched = 0;
  let failed  = 0;
  const total = companies.length;

  console.log(`[YF Universe Patch] Starting proactive patch for ${total} companies...`);

  for (const { ticker } of companies) {
    try {
      await yfPatchNullFields(ticker);
      patched++;
    } catch {
      failed++;
    }
    onProgress?.(patched + failed, total, ticker);
    // Polite delay to avoid hitting YF rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[YF Universe Patch] Complete — ${patched} companies patched, ${failed} failed`);
  return { patched, failed };
}

// ─── Price History ────────────────────────────────────────────────────────────

export async function yfFetchAndStorePrices(ticker: string) {
  const threeYearsAgo = new Date(Date.now() - 756 * 24 * 60 * 60 * 1000);

  const result = await yahooFinance.chart(ticker, {
    period1: threeYearsAgo,
    period2: new Date(),
    interval: "1d",
  });

  const prices: any[] = result.quotes ?? [];
  if (!prices.length) return 0;

  let stored = 0;
  for (const p of prices) {
    if (!p.date || p.close == null) continue;
    const date = new Date(p.date).toISOString().split("T")[0];
    const existing = await db
      .select({ id: priceHistoryTable.id })
      .from(priceHistoryTable)
      .where(and(eq(priceHistoryTable.ticker, ticker), eq(priceHistoryTable.date, date)))
      .limit(1);

    if (!existing.length) {
      await db.insert(priceHistoryTable).values({
        ticker, date,
        open:   p.open   ?? null,
        high:   p.high   ?? null,
        low:    p.low    ?? null,
        close:  p.close,
        volume: p.volume ?? null,
      });
      stored++;
    }
  }
  return stored;
}
