/**
 * Cross-sectional normalizer (Gap 8).
 *
 * Converts raw factor scores into percentile ranks within the current universe.
 * This ensures scores are relative — a company is scored vs peers, not vs fixed bounds.
 *
 * Run once per pipeline after all tickers are individually scored.
 */

import { db } from "@workspace/db";
import { scoresTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

function percentileRank(value: number, dataset: number[]): number {
  if (!dataset.length) return 0.5;
  const sorted = [...dataset].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v < value) below++;
  }
  return below / sorted.length;
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

type ScoreKey =
  | "fortressScore" | "rocketScore" | "waveScore"
  | "profitabilityScore" | "growthScore" | "capitalEfficiencyScore"
  | "financialStrengthScore" | "cashFlowQualityScore"
  | "innovationScore" | "momentumScore" | "valuationScore";

const SCORE_KEYS: ScoreKey[] = [
  "fortressScore", "rocketScore", "waveScore",
  "profitabilityScore", "growthScore", "capitalEfficiencyScore",
  "financialStrengthScore", "cashFlowQualityScore",
  "innovationScore", "momentumScore", "valuationScore",
];

/**
 * Recalibrates all scores in the universe to cross-sectional percentile ranks.
 * Blends raw score (40%) with percentile rank (60%) to preserve absolute signal
 * while adding relative context.
 */
export async function calibrateUniverseScores() {
  const today = new Date().toISOString().split("T")[0];

  // Get latest score row per ticker
  const allScores = await db.select().from(scoresTable)
    .where(eq(scoresTable.date, today));

  if (allScores.length < 2) {
    // Can't percentile rank a single company — skip calibration
    return { calibrated: 0, skipped: allScores.length };
  }

  // Build universe distribution for each score dimension
  const distributions: Record<ScoreKey, number[]> = {} as any;
  for (const key of SCORE_KEYS) {
    distributions[key] = allScores
      .map(s => s[key])
      .filter((v): v is number => v != null);
  }

  // For each company, blend raw score with percentile rank
  let calibrated = 0;
  for (const row of allScores) {
    const updates: Partial<Record<ScoreKey, number>> = {};
    for (const key of SCORE_KEYS) {
      const raw = row[key];
      if (raw == null) continue;
      const pctRank = percentileRank(raw, distributions[key]);
      // Blend: 40% absolute quality, 60% relative rank
      updates[key] = clamp(raw * 0.4 + pctRank * 0.6);
    }

    await db.update(scoresTable)
      .set(updates)
      .where(eq(scoresTable.id, row.id));
    calibrated++;
  }

  return { calibrated, universe: allScores.length };
}
