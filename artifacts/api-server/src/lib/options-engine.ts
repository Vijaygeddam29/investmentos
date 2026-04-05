/**
 * Options Engine — Core Logic
 *
 * Handles:
 *  - Per-ticker regime detection (extends market-regime.ts)
 *  - IV data fetching via Yahoo Finance + IV percentile calculation
 *  - Wheel candidate screening from MIOS universe
 *  - Strike + expiry selection based on user risk profile
 *  - AI reasoning via Claude
 *  - Exit/roll signal generation for open positions
 */

import YahooFinanceClass from "yahoo-finance2";
import { db } from "@workspace/db";
import {
  scoresTable,
  companiesTable,
  priceHistoryTable,
  optionsIvHistoryTable,
  optionsSignalsTable,
  userRiskProfilesTable,
  financialMetricsTable,
  type UserRiskProfile,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { detectMarketRegime, type MarketRegime } from "./market-regime";

const yf = new (YahooFinanceClass as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

// ─── Per-ticker Regime Detection ──────────────────────────────────────────────

export type TickerRegime = "BULL" | "BEAR" | "SIDEWAYS" | "RECOVERY" | "UNKNOWN";

export interface TickerRegimeResult {
  regime: TickerRegime;
  ma50: number | null;
  ma200: number | null;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function detectTickerRegime(ticker: string): Promise<TickerRegimeResult> {
  try {
    const prices = await db
      .select({ close: priceHistoryTable.close })
      .from(priceHistoryTable)
      .where(eq(priceHistoryTable.ticker, ticker))
      .orderBy(desc(priceHistoryTable.date))
      .limit(210);

    const closes = prices.map((p) => p.close).filter((c): c is number => c != null);
    if (closes.length < 50) return { regime: "UNKNOWN", ma50: null, ma200: null };

    const ascending = [...closes].reverse();
    const len = ascending.length;
    const ma50 = avg(ascending.slice(-50));
    const ma200 = len >= 200 ? avg(ascending.slice(-200)) : null;
    const ma50_20dAgo = len >= 70 ? avg(ascending.slice(-70, -20)) : null;
    const ma50Rising = ma50_20dAgo != null ? ma50 > ma50_20dAgo : false;
    const currentPrice = ascending[len - 1];

    let regime: TickerRegime;
    if (ma200 == null) {
      regime = currentPrice > ma50 ? "BULL" : "BEAR";
    } else if (ma50 > ma200) {
      regime = "BULL";
    } else if (ma50Rising) {
      regime = "RECOVERY";
    } else {
      // If within 3% of MA200, call it sideways — best for wheel
      const diff = Math.abs(ma50 - ma200) / ma200;
      regime = diff < 0.03 ? "SIDEWAYS" : "BEAR";
    }

    return { regime, ma50: Math.round(ma50 * 100) / 100, ma200: ma200 != null ? Math.round(ma200 * 100) / 100 : null };
  } catch {
    return { regime: "UNKNOWN", ma50: null, ma200: null };
  }
}

// ─── IV Data Fetching via Yahoo Finance ────────────────────────────────────────

export interface IvData {
  iv: number | null;
  ivPercentile30d: number | null;
  ivPercentile90d: number | null;
  openInterest: number | null;
  bidAskSpread: number | null;
  source: string;
}

async function fetchCurrentIv(ticker: string): Promise<{ iv: number | null; oi: number | null; spread: number | null }> {
  try {
    const chain = await yf.options(ticker, {}, { validateResult: false });
    if (!chain?.options?.length) return { iv: null, oi: null, spread: null };

    // Pick the nearest expiry
    const nearestExpiry = chain.options[0];
    const allOptions = [
      ...(nearestExpiry.calls ?? []),
      ...(nearestExpiry.puts ?? []),
    ];

    if (!allOptions.length) return { iv: null, oi: null, spread: null };

    // Get ATM options by finding closest to current price
    const price = chain.quote?.regularMarketPrice ?? null;
    if (!price) return { iv: null, oi: null, spread: null };

    const byDist = allOptions.sort((a: any, b: any) =>
      Math.abs((a.strike ?? 0) - price) - Math.abs((b.strike ?? 0) - price)
    );

    const atm = byDist.slice(0, 4);
    const ivValues = atm.map((o: any) => o.impliedVolatility).filter((v: any) => v != null && v > 0);
    const oiValues = atm.map((o: any) => o.openInterest ?? 0);
    const spreadValues = atm
      .map((o: any) => {
        const bid = o.bid ?? 0;
        const ask = o.ask ?? 0;
        const mid = (bid + ask) / 2;
        return mid > 0 ? (ask - bid) / mid : null;
      })
      .filter((v: any) => v != null);

    const iv = ivValues.length ? ivValues.reduce((a: number, b: number) => a + b, 0) / ivValues.length : null;
    const oi = oiValues.reduce((a: number, b: number) => a + b, 0);
    const spread = spreadValues.length ? spreadValues.reduce((a: number, b: number) => a + b, 0) / spreadValues.length : null;

    return { iv, oi, spread };
  } catch {
    return { iv: null, oi: null, spread: null };
  }
}

async function computeIvPercentile(ticker: string, currentIv: number, days: number): Promise<number | null> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const history = await db
      .select({ iv: optionsIvHistoryTable.iv })
      .from(optionsIvHistoryTable)
      .where(and(
        eq(optionsIvHistoryTable.ticker, ticker),
        gte(optionsIvHistoryTable.timestamp, since),
      ))
      .orderBy(optionsIvHistoryTable.timestamp);

    const ivValues = history.map((r) => r.iv).filter((v): v is number => v != null);
    if (ivValues.length < 5) return null;

    const below = ivValues.filter((v) => v <= currentIv).length;
    return Math.round((below / ivValues.length) * 100);
  } catch {
    return null;
  }
}

export async function fetchAndStoreIv(ticker: string): Promise<IvData> {
  const { iv, oi, spread } = await fetchCurrentIv(ticker);
  const ivPercentile30d = iv != null ? await computeIvPercentile(ticker, iv, 30) : null;
  const ivPercentile90d = iv != null ? await computeIvPercentile(ticker, iv, 90) : null;

  const record = {
    ticker,
    iv,
    ivPercentile30d,
    ivPercentile90d,
    openInterest: oi,
    bidAskSpread: spread,
    source: "yahoo",
    timestamp: new Date(),
  };

  await db.insert(optionsIvHistoryTable).values(record).catch(() => {});

  return { ...record };
}

export async function getLatestIv(ticker: string): Promise<IvData | null> {
  const rows = await db
    .select()
    .from(optionsIvHistoryTable)
    .where(eq(optionsIvHistoryTable.ticker, ticker))
    .orderBy(desc(optionsIvHistoryTable.timestamp))
    .limit(1);

  if (!rows.length) return null;
  const r = rows[0];
  return {
    iv: r.iv,
    ivPercentile30d: r.ivPercentile30d,
    ivPercentile90d: r.ivPercentile90d,
    openInterest: r.openInterest,
    bidAskSpread: r.bidAskSpread,
    source: r.source,
  };
}

// ─── Strategy Selection ────────────────────────────────────────────────────────

export type OptionsStrategy = "SELL_PUT" | "SELL_CALL" | "WHEEL";

export function selectStrategy(
  regime: TickerRegime,
  hasShares: boolean,
): OptionsStrategy {
  if (regime === "BULL") return hasShares ? "SELL_CALL" : "SELL_PUT";
  if (regime === "BEAR") return "SELL_PUT";
  if (regime === "RECOVERY") return hasShares ? "SELL_CALL" : "SELL_PUT";
  return "WHEEL"; // SIDEWAYS or UNKNOWN → full wheel
}

// ─── Strike Selection ──────────────────────────────────────────────────────────

export interface StrikeSelection {
  strike: number;
  expiry: string;
  dte: number;
  premium: number;
  premiumYieldPct: number;
  probabilityProfit: number;
}

export async function selectStrikeAndExpiry(
  ticker: string,
  strategy: OptionsStrategy,
  currentPrice: number,
  profile: UserRiskProfile,
): Promise<StrikeSelection | null> {
  try {
    const deltaTarget =
      profile.deltaPreference === "conservative" ? 0.20
      : profile.deltaPreference === "aggressive" ? 0.40
      : 0.30;

    const chain = await yf.options(ticker, {}, { validateResult: false });
    if (!chain?.options?.length) return null;

    const today = new Date();
    const dteMin = profile.dteMin ?? 21;
    const dteMax = profile.dteMax ?? 35;

    // Find best expiry within DTE window
    const suitableExpiries = chain.expirationDates?.filter((d: Date) => {
      const dte = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return dte >= dteMin && dte <= dteMax;
    }) ?? [];

    if (!suitableExpiries.length) {
      // Fallback: use nearest expiry
      const fallback = chain.expirationDates?.[0];
      if (!fallback) return null;
      suitableExpiries.push(fallback);
    }

    const expiryDate = suitableExpiries[0] as Date;
    const dte = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const expiryStr = expiryDate.toISOString().split("T")[0];

    // Get chain for chosen expiry
    const expiryChain = await yf.options(ticker, { date: expiryDate }, { validateResult: false });
    const contracts = strategy === "SELL_CALL"
      ? (expiryChain?.options?.[0]?.calls ?? [])
      : (expiryChain?.options?.[0]?.puts ?? []);

    if (!contracts.length) return null;

    // Select strike closest to delta target
    // Using OTM % as proxy for delta (delta ≈ 0.30 corresponds to ~8% OTM for puts, ~3% OTM for calls)
    const targetPricePut  = currentPrice * (1 - deltaTarget * 0.27); // approx: delta 0.30 → 8% OTM
    const targetPriceCall = currentPrice * (1 + deltaTarget * 0.10); // approx: delta 0.30 → 3% OTM
    const targetStrike = strategy === "SELL_CALL" ? targetPriceCall : targetPricePut;

    const sorted = [...contracts].sort((a: any, b: any) =>
      Math.abs((a.strike ?? 0) - targetStrike) - Math.abs((b.strike ?? 0) - targetStrike)
    );

    const best = sorted[0] as any;
    if (!best?.strike) return null;

    const bid = best.bid ?? 0;
    const ask = best.ask ?? 0;
    const premium = (bid + ask) / 2;
    if (premium <= 0) return null;

    const collateral = strategy === "SELL_CALL" ? currentPrice * 100 : best.strike * 100;
    const premiumYieldPct = (premium * 100 / collateral) * 100;

    // Probability of profit ≈ 1 - delta for puts, delta for calls (rough)
    const delta = best.delta ?? (strategy === "SELL_PUT" ? -(1 - deltaTarget) : deltaTarget);
    const probabilityProfit = strategy === "SELL_PUT"
      ? Math.round((1 - Math.abs(delta)) * 100)
      : Math.round((1 - Math.abs(delta)) * 100);

    return {
      strike:          Math.round(best.strike * 100) / 100,
      expiry:          expiryStr,
      dte,
      premium:         Math.round(premium * 100) / 100,
      premiumYieldPct: Math.round(premiumYieldPct * 100) / 100,
      probabilityProfit,
    };
  } catch {
    return null;
  }
}

// ─── AI Reasoning ─────────────────────────────────────────────────────────────

export async function generateAiRationale(opts: {
  ticker: string;
  companyName: string;
  strategy: OptionsStrategy;
  regime: TickerRegime;
  macroRegime: string;
  strike: number;
  expiry: string;
  dte: number;
  premium: number;
  premiumYieldPct: number;
  probabilityProfit: number;
  ivPercentile: number | null;
  fortressScore: number | null;
  rocketScore: number | null;
  macroContext?: string;
}): Promise<string> {
  const stratLabel = opts.strategy === "SELL_PUT" ? "cash-secured put" : opts.strategy === "SELL_CALL" ? "covered call" : "wheel";
  const prompt = `You are an expert options analyst. Write a 2–3 sentence plain-English rationale for this options trade signal. Be specific, professional, and concise. No markdown, no bullet points.

Trade: Sell ${stratLabel} on ${opts.ticker} (${opts.companyName})
Strike: $${opts.strike} | Expiry: ${opts.expiry} (${opts.dte} DTE) | Premium: $${opts.premium}/contract (${opts.premiumYieldPct.toFixed(1)}% yield)
Probability of profit: ${opts.probabilityProfit}%
Ticker regime: ${opts.regime} | Market regime: ${opts.macroRegime}
IV percentile: ${opts.ivPercentile != null ? `${opts.ivPercentile}th percentile (${opts.ivPercentile > 50 ? "elevated — good time to sell" : "moderate"})` : "unknown"}
MIOS Fortress score: ${opts.fortressScore != null ? (opts.fortressScore * 100).toFixed(0) : "N/A"}/100
${opts.macroContext ? `Today's macro context: ${opts.macroContext}` : ""}

Write the rationale now:`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any).text?.trim() ?? "";
  } catch {
    return `${opts.ticker} is in a ${opts.regime.toLowerCase()} regime. Selling the $${opts.strike} ${opts.strategy === "SELL_PUT" ? "put" : "call"} at ${opts.premiumYieldPct.toFixed(1)}% yield for ${opts.dte} days offers a ${opts.probabilityProfit}% probability of profit.`;
  }
}

export async function generateRollRationale(opts: {
  ticker: string;
  currentStrike: number;
  currentExpiry: string;
  dte: number;
  currentPnlPct: number;
  right: "PUT" | "CALL";
  suggestedStrike?: number;
  suggestedExpiry?: string;
}): Promise<string> {
  const isItm = opts.right === "PUT" ? opts.currentPnlPct < -50 : opts.currentPnlPct < -50;
  const prompt = `You are an expert options trader. Write a 2-sentence recommendation for managing this open ${opts.right} position on ${opts.ticker}.

Position: Short $${opts.currentStrike} ${opts.right} expiring ${opts.currentExpiry} (${opts.dte} DTE)
Current P&L: ${opts.currentPnlPct.toFixed(0)}% ${opts.currentPnlPct >= 0 ? "gain" : "loss"}
${isItm ? "⚠️ Position appears to be ITM or heavily tested." : ""}
${opts.suggestedStrike ? `Suggested roll: to $${opts.suggestedStrike} ${opts.right} expiring ${opts.suggestedExpiry}` : ""}

Provide your recommendation (close / roll / hold) and why:`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    return (msg.content[0] as any).text?.trim() ?? "";
  } catch {
    if (opts.dte <= 7) return `Position has ${opts.dte} DTE remaining. Consider closing to lock in gains or avoid gamma risk near expiry.`;
    return `Position at ${opts.currentPnlPct.toFixed(0)}% P&L with ${opts.dte} DTE. Monitor closely.`;
  }
}

// ─── Wheel Candidate Screener ──────────────────────────────────────────────────

const MIN_FORTRESS_SCORE = 0.55;
const MIN_IV_PERCENTILE = 30;
const EARNINGS_BUFFER_DAYS = 14;
const MIN_OPEN_INTEREST = 200;
const MAX_SPREAD_PCT = 0.10;

export interface WheelCandidate {
  ticker:         string;
  companyName:    string;
  fortressScore:  number;
  rocketScore:    number;
  regime:         TickerRegime;
  currentPrice:   number | null;
  ivData:         IvData;
  strategy:       OptionsStrategy;
  hasShares:      boolean;
}

export async function runWheelScreener(
  userHoldingTickers: string[] = [],
  macroRegime?: string,
): Promise<WheelCandidate[]> {
  console.log("[OptionsEngine] Running wheel screener...");

  // 1. Get all MIOS tickers with Fortress score >= threshold
  const rows = await db
    .select({
      ticker:        scoresTable.ticker,
      fortressScore: scoresTable.fortressScore,
      rocketScore:   scoresTable.rocketScore,
    })
    .from(scoresTable)
    .where(gte(scoresTable.fortressScore, MIN_FORTRESS_SCORE))
    .orderBy(desc(scoresTable.fortressScore));

  // De-dupe to latest score per ticker
  const seen = new Set<string>();
  const qualified: typeof rows = [];
  for (const row of rows) {
    if (!seen.has(row.ticker)) {
      seen.add(row.ticker);
      qualified.push(row);
    }
  }

  const tickers = qualified.map((r) => r.ticker);
  const companies = await db
    .select({ ticker: companiesTable.ticker, name: companiesTable.name })
    .from(companiesTable)
    .where(inArray(companiesTable.ticker, tickers));
  const nameMap = Object.fromEntries(companies.map((c) => [c.ticker, c.name]));

  const candidates: WheelCandidate[] = [];

  // Process in batches to avoid overwhelming Yahoo Finance
  const BATCH = 5;
  for (let i = 0; i < qualified.length; i += BATCH) {
    const batch = qualified.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (row) => {
        try {
          // Fetch IV data
          const ivData = await fetchAndStoreIv(row.ticker);

          // Filter: options must exist and have liquidity
          if (ivData.openInterest != null && ivData.openInterest < MIN_OPEN_INTEREST) return;
          if (ivData.bidAskSpread != null && ivData.bidAskSpread > MAX_SPREAD_PCT) return;

          // Filter: IV percentile must be high enough to sell premium
          const ivPct = ivData.ivPercentile90d ?? ivData.ivPercentile30d;
          if (ivPct != null && ivPct < MIN_IV_PERCENTILE) return;

          // Detect regime
          const { regime } = await detectTickerRegime(row.ticker);

          // Get current price
          const prices = await db
            .select({ close: priceHistoryTable.close })
            .from(priceHistoryTable)
            .where(eq(priceHistoryTable.ticker, row.ticker))
            .orderBy(desc(priceHistoryTable.date))
            .limit(1);
          const currentPrice = prices[0]?.close ?? null;

          const hasShares = userHoldingTickers.includes(row.ticker);
          const strategy = selectStrategy(regime, hasShares);

          candidates.push({
            ticker:        row.ticker,
            companyName:   nameMap[row.ticker] ?? row.ticker,
            fortressScore: row.fortressScore ?? 0,
            rocketScore:   row.rocketScore ?? 0,
            regime,
            currentPrice,
            ivData,
            strategy,
            hasShares,
          });
        } catch (err) {
          console.warn(`[OptionsEngine] Screener skip ${row.ticker}:`, (err as Error).message);
        }
      })
    );

    // Small delay between batches
    if (i + BATCH < qualified.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Sort by (IV percentile × Fortress score) descending
  candidates.sort((a, b) => {
    const scoreA = (a.ivData.ivPercentile90d ?? 50) * (a.fortressScore ?? 0.5);
    const scoreB = (b.ivData.ivPercentile90d ?? 50) * (b.fortressScore ?? 0.5);
    return scoreB - scoreA;
  });

  console.log(`[OptionsEngine] Screener found ${candidates.length} wheel candidates`);
  return candidates;
}

// ─── Generate Signals ──────────────────────────────────────────────────────────

export async function generateSignals(
  userId: number,
  macroContext?: string,
): Promise<void> {
  console.log("[OptionsEngine] Generating signals for user", userId);

  const macroResult = await detectMarketRegime();
  const macroRegime = macroResult.regime;

  const profile = await db
    .select()
    .from(userRiskProfilesTable)
    .where(eq(userRiskProfilesTable.userId, userId))
    .limit(1);

  const riskProfile = profile[0] ?? {
    profitTargetPct: 50,
    maxLossMultiple: 2,
    deltaPreference: "moderate",
    dteMin: 21,
    dteMax: 35,
    maxPositions: 5,
    maxCapitalPerTradePct: 10,
    marginCapPct: 25,
    ivPercentileMin: 30,
  } as any;

  const candidates = await runWheelScreener([], macroContext);
  const topCandidates = candidates.slice(0, 20);

  for (const c of topCandidates) {
    try {
      if (!c.currentPrice) continue;

      const strikeData = await selectStrikeAndExpiry(
        c.ticker,
        c.strategy,
        c.currentPrice,
        riskProfile,
      );
      if (!strikeData) continue;

      const ivPct = c.ivData.ivPercentile90d ?? c.ivData.ivPercentile30d;

      const rationale = await generateAiRationale({
        ticker:           c.ticker,
        companyName:      c.companyName,
        strategy:         c.strategy,
        regime:           c.regime,
        macroRegime:      macroRegime,
        strike:           strikeData.strike,
        expiry:           strikeData.expiry,
        dte:              strikeData.dte,
        premium:          strikeData.premium,
        premiumYieldPct:  strikeData.premiumYieldPct,
        probabilityProfit: strikeData.probabilityProfit,
        ivPercentile:     ivPct ?? null,
        fortressScore:    c.fortressScore,
        rocketScore:      c.rocketScore,
        macroContext,
      });

      await db.insert(optionsSignalsTable).values({
        ticker:            c.ticker,
        strategy:          c.strategy,
        regime:            c.regime,
        strike:            strikeData.strike,
        expiry:            strikeData.expiry,
        dte:               strikeData.dte,
        premium:           strikeData.premium,
        premiumYieldPct:   strikeData.premiumYieldPct,
        probabilityProfit: strikeData.probabilityProfit,
        ivPercentile:      ivPct ?? null,
        iv:                c.ivData.iv,
        fortressScore:     c.fortressScore,
        rocketScore:       c.rocketScore,
        aiRationale:       rationale,
        macroContext:      macroContext ?? null,
        status:            "active",
        generatedAt:       new Date(),
      });
    } catch (err) {
      console.warn(`[OptionsEngine] Signal gen failed ${c.ticker}:`, (err as Error).message);
    }
  }

  console.log("[OptionsEngine] Signal generation complete");
}

// ─── IV Rank (52-week) ────────────────────────────────────────────────────────

async function computeIv52wBounds(ticker: string): Promise<{ high: number | null; low: number | null }> {
  try {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const rows = await db
      .select({ iv: optionsIvHistoryTable.iv })
      .from(optionsIvHistoryTable)
      .where(and(
        eq(optionsIvHistoryTable.ticker, ticker),
        gte(optionsIvHistoryTable.timestamp, since),
      ));

    const vals = rows.map((r) => r.iv).filter((v): v is number => v != null && v > 0);
    if (vals.length < 10) return { high: null, low: null };

    return {
      high: Math.max(...vals),
      low:  Math.min(...vals),
    };
  } catch {
    return { high: null, low: null };
  }
}

export function computeIvRankFromBounds(currentIv: number, high: number | null, low: number | null): number | null {
  if (high == null || low == null || high === low) return null;
  return Math.round(((currentIv - low) / (high - low)) * 100);
}

// ─── Earnings Calendar ────────────────────────────────────────────────────────

export interface EarningsInfo {
  nextEarningsDate: string | null;
  daysToEarnings: number | null;
  earningsWithin7Days: boolean;
  earningsWithin14Days: boolean;
}

export async function checkEarningsProximity(ticker: string): Promise<EarningsInfo> {
  try {
    // Check DB first (cached)
    const row = await db
      .select({ nextEarningsDate: companiesTable.nextEarningsDate })
      .from(companiesTable)
      .where(eq(companiesTable.ticker, ticker))
      .limit(1);

    const cached = row[0]?.nextEarningsDate;

    let earningsDateStr: string | null = null;

    if (cached) {
      // If cached date is still in the future, use it
      const cachedDate = new Date(cached);
      const now = new Date();
      if (cachedDate >= now) {
        earningsDateStr = cached;
      }
    }

    // Fetch fresh from Yahoo Finance if not cached or stale
    if (!earningsDateStr) {
      try {
        const summary = await yf.quoteSummary(ticker, { modules: ["calendarEvents"] }, { validateResult: false });
        const earnings = (summary as any)?.calendarEvents?.earnings;
        const dates: Date[] = (earnings?.earningsDate ?? []).filter((d: any) => d instanceof Date);
        const futureDate = dates.find((d) => d >= new Date());
        if (futureDate) {
          earningsDateStr = futureDate.toISOString().split("T")[0];
          // Store in DB
          await db.update(companiesTable)
            .set({ nextEarningsDate: earningsDateStr })
            .where(eq(companiesTable.ticker, ticker));
        }
      } catch {
        // YF quoteSummary can fail — use cached even if stale
        earningsDateStr = cached ?? null;
      }
    }

    if (!earningsDateStr) {
      return { nextEarningsDate: null, daysToEarnings: null, earningsWithin7Days: false, earningsWithin14Days: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earningsDate = new Date(earningsDateStr);
    const daysToEarnings = Math.ceil((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      nextEarningsDate:    earningsDateStr,
      daysToEarnings,
      earningsWithin7Days:  daysToEarnings >= 0 && daysToEarnings <= 7,
      earningsWithin14Days: daysToEarnings >= 0 && daysToEarnings <= 14,
    };
  } catch {
    return { nextEarningsDate: null, daysToEarnings: null, earningsWithin7Days: false, earningsWithin14Days: false };
  }
}

// ─── Available Expiries ───────────────────────────────────────────────────────

export interface ExpiryInfo {
  date: string;
  dte: number;
  label: string;
  premiumQuality: "high" | "moderate" | "low" | null;
}

function labelExpiry(dte: number): string {
  if (dte <= 7)  return "Weekly";
  if (dte <= 15) return "Bi-Weekly";
  if (dte <= 35) return "Monthly";
  if (dte <= 50) return "45-Day";
  return "LEAPS";
}

export async function getAvailableExpiries(ticker: string): Promise<ExpiryInfo[]> {
  try {
    const chain = await yf.options(ticker, {}, { validateResult: false });
    if (!chain?.expirationDates?.length) return [];

    const today = new Date();
    const ivData = await getLatestIv(ticker);
    const ivPct = ivData?.ivPercentile90d ?? ivData?.ivPercentile30d;

    const expiries: ExpiryInfo[] = (chain.expirationDates as Date[])
      .map((d) => {
        const dte = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          date:           d.toISOString().split("T")[0],
          dte,
          label:          labelExpiry(dte),
          premiumQuality: ivPct == null ? null : ivPct >= 60 ? "high" : ivPct >= 35 ? "moderate" : "low",
        };
      })
      .filter((e) => e.dte >= 0 && e.dte <= 180)
      .sort((a, b) => a.dte - b.dte);

    return expiries;
  } catch {
    return [];
  }
}

// ─── Full Options Chain ───────────────────────────────────────────────────────

export interface ChainContract {
  strike:             number;
  bid:                number | null;
  ask:                number | null;
  last:               number | null;
  mid:                number | null;
  iv:                 number | null;
  delta:              number | null;
  openInterest:       number | null;
  volume:             number | null;
  inTheMoney:         boolean;
  annualizedROC:      number | null;
  probabilityProfit:  number | null;
  capitalRequired:    number;
  premiumQuality:     "high" | "moderate" | "low" | null;
}

export interface OptionsChainResult {
  ticker:           string;
  companyName:      string | null;
  currentPrice:     number | null;
  expiry:           string;
  dte:              number;
  calls:            ChainContract[];
  puts:             ChainContract[];
  ivRank:           number | null;
  ivPercentile:     number | null;
  iv:               number | null;
  earnings:         EarningsInfo;
  cachedAt:         string;
}

function enrichContract(
  raw: any,
  currentPrice: number,
  dte: number,
  side: "call" | "put",
): ChainContract {
  const strike = raw.strike ?? 0;
  const bid    = raw.bid    ?? null;
  const ask    = raw.ask    ?? null;
  const last   = raw.lastPrice ?? null;
  const iv     = raw.impliedVolatility ?? null;
  const delta  = raw.delta ?? null;
  const oi     = raw.openInterest ?? null;
  const vol    = raw.volume ?? null;
  const mid    = bid != null && ask != null ? (bid + ask) / 2 : (last ?? null);
  const itm    = side === "call" ? (currentPrice > strike) : (currentPrice < strike);

  let annualizedROC: number | null = null;
  let probabilityProfit: number | null = null;
  let capitalRequired = 0;

  if (mid != null && mid > 0 && dte > 0) {
    if (side === "put") {
      capitalRequired = strike * 100;
      const yield_pct = (mid / strike) * 100;
      annualizedROC = Math.round((yield_pct * (365 / dte)) * 100) / 100;
    } else {
      capitalRequired = currentPrice * 100;
      const yield_pct = (mid / currentPrice) * 100;
      annualizedROC = Math.round((yield_pct * (365 / dte)) * 100) / 100;
    }
  }

  if (delta != null) {
    probabilityProfit = side === "put"
      ? Math.round((1 - Math.abs(delta)) * 100)
      : Math.round((1 - Math.abs(delta)) * 100);
  }

  const ivPct = iv != null ? Math.round(iv * 100) : null;
  const premiumQuality = ivPct == null ? null : ivPct >= 40 ? "high" : ivPct >= 25 ? "moderate" : "low";

  return {
    strike, bid, ask, last, mid, iv: ivPct, delta, openInterest: oi, volume: vol,
    inTheMoney: itm, annualizedROC, probabilityProfit, capitalRequired, premiumQuality,
  };
}

// Simple 15-minute in-memory cache
const chainCache = new Map<string, { data: OptionsChainResult; expiresAt: number }>();

export async function fetchOptionsChainData(
  ticker: string,
  expiry?: string,
): Promise<OptionsChainResult | null> {
  const cacheKey = `${ticker}::${expiry ?? "nearest"}`;
  const cached = chainCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    // Get company name
    const companyRow = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.ticker, ticker))
      .limit(1);
    const companyName = companyRow[0]?.name ?? null;

    // Get current price
    let currentPrice: number | null = null;
    try {
      const quote = await yf.quote(ticker, { validateResult: false } as any);
      currentPrice = (quote as any)?.regularMarketPrice ?? null;
    } catch { /* fall back to DB */ }

    if (currentPrice == null) {
      const priceRow = await db
        .select({ close: priceHistoryTable.close })
        .from(priceHistoryTable)
        .where(eq(priceHistoryTable.ticker, ticker))
        .orderBy(desc(priceHistoryTable.date))
        .limit(1);
      currentPrice = priceRow[0]?.close ?? null;
    }

    if (currentPrice == null) return null;

    // Fetch chain
    let expiryDate: Date | undefined;
    const chain = await yf.options(ticker, {}, { validateResult: false });
    if (!chain?.expirationDates?.length) return null;

    const today = new Date();

    if (expiry) {
      expiryDate = new Date(expiry + "T00:00:00");
    } else {
      // Pick nearest expiry ≥ 7 DTE
      const minDate = new Date(today.getTime() + 6 * 86400000);
      expiryDate = (chain.expirationDates as Date[]).find((d) => d >= minDate) ?? chain.expirationDates[0];
    }

    const dte = Math.round(((expiryDate as Date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const expiryStr = (expiryDate as Date).toISOString().split("T")[0];

    // Fetch chain for the specific expiry
    const expiryChain = await yf.options(ticker, { date: expiryDate }, { validateResult: false });
    const rawCalls: any[] = expiryChain?.options?.[0]?.calls ?? [];
    const rawPuts: any[]  = expiryChain?.options?.[0]?.puts  ?? [];

    // IV data for rank
    const ivData = await getLatestIv(ticker);
    const { high: iv52wHigh, low: iv52wLow } = await computeIv52wBounds(ticker);
    const currentIv = ivData?.iv ?? null;
    const ivRank = currentIv != null ? computeIvRankFromBounds(currentIv, iv52wHigh, iv52wLow) : null;
    const ivPercentile = ivData?.ivPercentile90d ?? ivData?.ivPercentile30d ?? null;

    // Earnings check
    const earnings = await checkEarningsProximity(ticker);

    const calls = rawCalls.map((r) => enrichContract(r, currentPrice!, dte, "call"));
    const puts  = rawPuts.map((r)  => enrichContract(r, currentPrice!, dte, "put"));

    // Filter to reasonable range: ±30% from ATM
    const filterRange = (contracts: ChainContract[]) =>
      contracts.filter((c) => c.strike >= currentPrice! * 0.70 && c.strike <= currentPrice! * 1.30);

    const result: OptionsChainResult = {
      ticker,
      companyName,
      currentPrice,
      expiry:     expiryStr,
      dte,
      calls:      filterRange(calls),
      puts:       filterRange(puts),
      ivRank,
      ivPercentile,
      iv:         currentIv,
      earnings,
      cachedAt:   new Date().toISOString(),
    };

    chainCache.set(cacheKey, { data: result, expiresAt: Date.now() + 15 * 60 * 1000 });
    return result;
  } catch (err) {
    console.error("[OptionsEngine] Chain fetch error:", (err as Error).message);
    return null;
  }
}

// ─── Nightly IV + Earnings refresh ───────────────────────────────────────────

export async function refreshIvAndEarningsForAllTickers(): Promise<void> {
  try {
    const tickers = await db
      .selectDistinct({ ticker: optionsIvHistoryTable.ticker })
      .from(optionsIvHistoryTable);

    console.log(`[OptionsEngine] Refreshing IV + earnings for ${tickers.length} tickers`);

    const BATCH = 3;
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async ({ ticker }) => {
        try {
          const { iv } = await fetchCurrentIv(ticker);
          if (iv == null) return;

          const ivPercentile30d = await computeIvPercentile(ticker, iv, 30);
          const ivPercentile90d = await computeIvPercentile(ticker, iv, 90);
          const { high: iv52wHigh, low: iv52wLow } = await computeIv52wBounds(ticker);
          const ivRank = computeIvRankFromBounds(iv, iv52wHigh, iv52wLow);

          await db.insert(optionsIvHistoryTable).values({
            ticker, iv, ivPercentile30d, ivPercentile90d,
            iv52wHigh, iv52wLow, ivRank,
            source: "yahoo", timestamp: new Date(),
          }).catch(() => {});

          // Also refresh earnings
          await checkEarningsProximity(ticker);
        } catch { /* skip failed tickers */ }
      }));

      if (i + BATCH < tickers.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log("[OptionsEngine] IV + earnings refresh complete");
  } catch (err) {
    console.error("[OptionsEngine] Refresh error:", (err as Error).message);
  }
}
