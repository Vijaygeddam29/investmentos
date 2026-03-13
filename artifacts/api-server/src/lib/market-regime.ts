/**
 * Market Regime Detection
 *
 * Detects the current macro environment using SPY MA50 vs MA200
 * from the price history table. Regime weighting is applied at
 * read time only — stored engine scores are never mutated.
 *
 * Regimes and engine weights:
 *   Bull     (MA50 > MA200)                       : Fortress 0.25 · Rocket 0.45 · Wave 0.30
 *   Bear     (MA50 < MA200, MA50 falling)         : Fortress 0.50 · Rocket 0.20 · Wave 0.30
 *   Recovery (MA50 < MA200, but MA50 rising)      : Fortress 0.30 · Rocket 0.40 · Wave 0.30
 *   Neutral  (insufficient data or flat)          : Fortress 0.33 · Rocket 0.33 · Wave 0.33
 */

import { db } from "@workspace/db";
import { priceHistoryTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

export type MarketRegime = "BULL" | "BEAR" | "RECOVERY" | "NEUTRAL";

export interface RegimeWeights {
  fortress: number;
  rocket: number;
  wave: number;
}

export interface RegimeResult {
  regime: MarketRegime;
  ma50: number | null;
  ma200: number | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  weights: RegimeWeights;
}

const REGIME_WEIGHTS: Record<MarketRegime, RegimeWeights> = {
  BULL:     { fortress: 0.25, rocket: 0.45, wave: 0.30 },
  BEAR:     { fortress: 0.50, rocket: 0.20, wave: 0.30 },
  RECOVERY: { fortress: 0.30, rocket: 0.40, wave: 0.30 },
  NEUTRAL:  { fortress: 0.33, rocket: 0.33, wave: 0.33 },
};

export function getRegimeWeights(regime: MarketRegime): RegimeWeights {
  return REGIME_WEIGHTS[regime];
}

/** Simple average of an array */
function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Cache to avoid hitting DB on every request */
let cachedRegime: RegimeResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function detectMarketRegime(): Promise<RegimeResult> {
  const now = Date.now();
  if (cachedRegime && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRegime;
  }

  const NEUTRAL_RESULT: RegimeResult = {
    regime: "NEUTRAL",
    ma50: null,
    ma200: null,
    confidence: "LOW",
    weights: REGIME_WEIGHTS.NEUTRAL,
  };

  try {
    // Fetch last 210 trading days of SPY prices (need 200 for MA200)
    const prices = await db
      .select({ date: priceHistoryTable.date, close: priceHistoryTable.close })
      .from(priceHistoryTable)
      .where(eq(priceHistoryTable.ticker, "SPY"))
      .orderBy(desc(priceHistoryTable.date))
      .limit(210);

    if (prices.length < 50) {
      cachedRegime = NEUTRAL_RESULT;
      cacheTimestamp = now;
      return NEUTRAL_RESULT;
    }

    const closes = prices.map(p => p.close).filter((c): c is number => c != null);

    if (closes.length < 50) {
      cachedRegime = NEUTRAL_RESULT;
      cacheTimestamp = now;
      return NEUTRAL_RESULT;
    }

    // MAs are computed on ascending order (oldest first)
    const ascending = [...closes].reverse();
    const len = ascending.length;

    const ma50 = avg(ascending.slice(-50));
    const ma200 = len >= 200 ? avg(ascending.slice(-200)) : null;

    // For Recovery detection: compare MA50 now vs 20 days ago
    const ma50_20dAgo = len >= 70 ? avg(ascending.slice(-70, -20)) : null;
    const ma50Rising = ma50_20dAgo != null ? ma50 > ma50_20dAgo : false;

    const confidence: "HIGH" | "MEDIUM" | "LOW" =
      len >= 200 ? "HIGH" : len >= 100 ? "MEDIUM" : "LOW";

    let regime: MarketRegime;

    if (ma200 == null) {
      regime = "NEUTRAL";
    } else if (ma50 > ma200) {
      regime = "BULL";
    } else if (ma50Rising) {
      regime = "RECOVERY";
    } else {
      regime = "BEAR";
    }

    const result: RegimeResult = {
      regime,
      ma50: Math.round(ma50 * 100) / 100,
      ma200: ma200 != null ? Math.round(ma200 * 100) / 100 : null,
      confidence,
      weights: REGIME_WEIGHTS[regime],
    };

    cachedRegime = result;
    cacheTimestamp = now;
    return result;
  } catch (err) {
    console.warn("[MarketRegime] Detection failed:", (err as Error).message);
    return NEUTRAL_RESULT;
  }
}

/** Compute regime-weighted composite score from the three engine scores */
export function computeCompositeScore(
  fortressScore: number,
  rocketScore: number,
  waveScore: number,
  weights: RegimeWeights,
): number {
  return (
    fortressScore * weights.fortress +
    rocketScore   * weights.rocket   +
    waveScore     * weights.wave
  );
}
