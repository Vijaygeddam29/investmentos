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
import { eq, desc, and, gte, sql, inArray } from "drizzle-orm";
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
