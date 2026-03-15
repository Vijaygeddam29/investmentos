/**
 * Factor Warehouse
 *
 * Writes a pre-computed daily snapshot per ticker into factor_snapshots.
 * The pipeline calls this once per ticker after scoring — heavy compute
 * happens exactly once, dashboards read from pre-computed rows at near-zero
 * cost regardless of universe size.
 *
 * Also computes score_delta vs. previous snapshot to power the Top Movers feed.
 */

import { db } from "@workspace/db";
import {
  factorSnapshotsTable,
  priceHistoryTable,
  financialMetricsTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { computeMACD } from "./scoring-engines";

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
}

// ── Score payload type (mirrors calculateAllScores return) ────────────────────

export interface ScorePayload {
  fortressScore: number | null;
  rocketScore: number | null;
  waveScore: number | null;
  profitabilityScore: number | null;
  growthScore: number | null;
  capitalEfficiencyScore: number | null;
  financialStrengthScore: number | null;
  cashFlowQualityScore: number | null;
  momentumScore: number | null;
  valuationScore: number | null;
  sentimentScore: number | null;
  companyQualityScore: number | null;
  stockOpportunityScore: number | null;
  expectationScore: number | null;
  mispricingScore: number | null;
  fragilityScore: number | null;
  portfolioNetScore: number | null;
}

// ── Main writer ───────────────────────────────────────────────────────────────

export async function writeFactorSnapshot(
  ticker: string,
  scores: ScorePayload,
  entryScore: number | null,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // ── Fetch supporting data for denormalized indicators ───────────────────
  const [priceRows, metricsRows] = await Promise.all([
    db.select({ close: priceHistoryTable.close, volume: priceHistoryTable.volume })
      .from(priceHistoryTable)
      .where(eq(priceHistoryTable.ticker, ticker))
      .orderBy(desc(priceHistoryTable.date))
      .limit(756),
    db.select({
      marginOfSafety: financialMetricsTable.marginOfSafety,
      marketCap: financialMetricsTable.revenue, // use revenue as proxy if mktcap missing
    })
      .from(financialMetricsTable)
      .where(eq(financialMetricsTable.ticker, ticker))
      .orderBy(desc(financialMetricsTable.date))
      .limit(1),
  ]);

  // ── Technical indicators from price history ─────────────────────────────
  const closes = priceRows.map(p => p.close).reverse();
  const len = closes.length;
  const rsi = computeRSI(closes) ?? null;
  const macdResult = computeMACD(closes);
  const macdHistogram = macdResult ? +macdResult.histogram.toFixed(4) : null;
  const ret3m = len >= 63
    ? +((closes[len - 1] - closes[len - 63]) / closes[len - 63]).toFixed(4)
    : null;

  // ── Fundamental indicators ──────────────────────────────────────────────
  const latestMetrics = metricsRows[0] ?? null;

  // ── Score deltas vs previous snapshot ──────────────────────────────────
  const prev = await db.select({
    fortressScore: factorSnapshotsTable.fortressScore,
    rocketScore: factorSnapshotsTable.rocketScore,
    waveScore: factorSnapshotsTable.waveScore,
    entryScore: factorSnapshotsTable.entryScore,
  })
    .from(factorSnapshotsTable)
    .where(and(
      eq(factorSnapshotsTable.ticker, ticker),
    ))
    .orderBy(desc(factorSnapshotsTable.createdAt))
    .limit(2);

  // previous = snapshot from a different date (not today's own row)
  const prevSnapshot = prev.find(s => true) ?? null;
  const delta = (cur: number | null, old: number | null): number | null => {
    if (cur == null || old == null) return null;
    return +( cur - old).toFixed(4);
  };

  const row = {
    ticker,
    date: today,

    // Engine scores
    fortressScore: scores.fortressScore,
    rocketScore: scores.rocketScore,
    waveScore: scores.waveScore,
    entryScore,

    // Family scores
    profitabilityScore: scores.profitabilityScore,
    growthScore: scores.growthScore,
    capitalEfficiencyScore: scores.capitalEfficiencyScore,
    financialStrengthScore: scores.financialStrengthScore,
    cashFlowQualityScore: scores.cashFlowQualityScore,
    momentumScore: scores.momentumScore,
    valuationScore: scores.valuationScore,
    sentimentScore: scores.sentimentScore,

    // Technical indicators
    rsi,
    macdHistogram,
    ret3m,
    marginOfSafety: latestMetrics?.marginOfSafety ?? null,
    marketCap: null as number | null, // populated from company data when available

    // Deltas (today vs prior snapshot)
    fortressDelta: delta(scores.fortressScore, prevSnapshot?.fortressScore ?? null),
    rocketDelta: delta(scores.rocketScore, prevSnapshot?.rocketScore ?? null),
    waveDelta: delta(scores.waveScore, prevSnapshot?.waveScore ?? null),
    entryDelta: delta(entryScore, prevSnapshot?.entryScore ?? null),

    // Two-score architecture
    companyQualityScore: scores.companyQualityScore,
    stockOpportunityScore: scores.stockOpportunityScore,

    // Four-layer investment intelligence
    expectationScore: scores.expectationScore,
    mispricingScore: scores.mispricingScore,
    fragilityScore: scores.fragilityScore,
    portfolioNetScore: scores.portfolioNetScore,
  };

  // Upsert: one row per ticker per date
  const existing = await db.select({ id: factorSnapshotsTable.id })
    .from(factorSnapshotsTable)
    .where(and(
      eq(factorSnapshotsTable.ticker, ticker),
      eq(factorSnapshotsTable.date, today),
    ))
    .limit(1);

  if (existing.length) {
    await db.update(factorSnapshotsTable)
      .set(row)
      .where(eq(factorSnapshotsTable.id, existing[0].id));
  } else {
    await db.insert(factorSnapshotsTable).values(row);
  }
}
