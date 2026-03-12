/**
 * Entry Timing Score.
 *
 * Answers: "Is NOW a good time to enter this position?"
 *
 * Combines:
 *   - Valuation attractiveness (40%) — is the stock cheap vs history/peers?
 *   - Momentum confirmation (35%)   — is price trend supporting entry?
 *   - Earnings revision (25%)       — are analysts surprised to the upside?
 *
 * Output: entryTimingScore 0–1 (higher = better entry point)
 * Interpretation:
 *   > 0.7 = Strong entry signal
 *   0.5–0.7 = Moderate — wait for better valuation or momentum
 *   < 0.5 = Poor timing — expensive or declining momentum
 */

import { db } from "@workspace/db";
import {
  financialMetricsTable,
  scoresTable,
  priceHistoryTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function normalize(value: number | null | undefined, low: number, high: number): number {
  if (value == null || isNaN(value)) return 0.5;
  return clamp((value - low) / (high - low || 1));
}

export async function computeEntryTimingScore(ticker: string): Promise<number> {
  const [metrics, scores, prices] = await Promise.all([
    db.select().from(financialMetricsTable)
      .where(eq(financialMetricsTable.ticker, ticker))
      .orderBy(desc(financialMetricsTable.date))
      .limit(1),
    db.select().from(scoresTable)
      .where(eq(scoresTable.ticker, ticker))
      .orderBy(desc(scoresTable.date))
      .limit(1),
    db.select().from(priceHistoryTable)
      .where(eq(priceHistoryTable.ticker, ticker))
      .orderBy(desc(priceHistoryTable.date))
      .limit(252),
  ]);

  const m = metrics[0];
  const s = scores[0];

  // ── 1. Valuation Attractiveness (40%) ─────────────────────────────────────
  // Higher FCF yield = cheaper entry. Lower P/E vs peers = better.
  const valuationComponents = [
    normalize(m?.fcfYield, 0, 0.08),           // High FCF yield = cheap
    normalize(m?.marginOfSafety, -0.2, 0.4),   // Positive MoS = below intrinsic value
    normalize(m?.dcfDiscount, -0.05, 0.08),     // Positive = earnings yield > WACC
    normalize(m?.pegRatio, 3, 0.5),             // Low PEG = growth at fair price
    normalize(m?.evToEbitda, 30, 6),            // Low EV/EBITDA = cheaper
    s?.valuationScore ?? 0.5,
  ];
  const valuationScore = valuationComponents.reduce((a, b) => a + b, 0) / valuationComponents.length;

  // ── 2. Momentum Confirmation (35%) ────────────────────────────────────────
  // Use price data to confirm technical entry timing
  let momentumScore = s?.momentumScore ?? 0.5;

  if (prices.length >= 50) {
    const closes = prices.map(p => p.close).reverse();
    const len = closes.length;
    const current = closes[len - 1];

    // RSI: best entry when 40–60 (trending without overbought)
    const rsi = computeRSI(closes);
    const rsiEntry = rsi >= 40 && rsi <= 65 ? 0.8 :
                     rsi < 40 ? 0.7 :        // oversold can be good entry
                     0.3;                      // overbought = poor timing

    // Price above MA50 but not extended (within 15% above)
    const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const priceMa50Ratio = current / ma50;
    const ma50Entry = priceMa50Ratio > 1 && priceMa50Ratio < 1.15 ? 0.8 :
                      priceMa50Ratio <= 1 ? 0.6 :
                      0.3; // >15% extended = late entry

    // 52-week range position: 40–80% = good entry zone (not at bottom, not at top)
    const high52 = Math.max(...closes.slice(-Math.min(252, len)));
    const low52 = Math.min(...closes.slice(-Math.min(252, len)));
    const rangePos = high52 !== low52 ? (current - low52) / (high52 - low52) : 0.5;
    const rangeEntry = rangePos >= 0.4 && rangePos <= 0.85 ? 0.8 :
                       rangePos < 0.4 ? 0.6 :
                       0.3; // near 52w high = stretched

    momentumScore = (rsiEntry * 0.35 + ma50Entry * 0.35 + rangeEntry * 0.30);
  }

  // ── 3. Earnings Revision Signal (25%) ────────────────────────────────────
  // Positive earnings surprises = analysts underestimated growth = tailwind
  const surpriseScore = normalize(m?.earningsSurprises, -0.05, 0.10);

  // ── Composite Entry Timing Score ──────────────────────────────────────────
  const entryTimingScore = clamp(
    valuationScore * 0.40 +
    momentumScore * 0.35 +
    surpriseScore * 0.25,
  );

  // Store in scores table
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.select({ id: scoresTable.id })
    .from(scoresTable)
    .where(and(eq(scoresTable.ticker, ticker), eq(scoresTable.date, today)))
    .limit(1);

  if (existing.length) {
    await db.update(scoresTable)
      .set({ entryTimingScore: Math.round(entryTimingScore * 100) / 100 })
      .where(eq(scoresTable.id, existing[0].id));
  }

  return entryTimingScore;
}

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
