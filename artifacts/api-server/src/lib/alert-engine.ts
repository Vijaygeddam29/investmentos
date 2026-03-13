/**
 * Alert Engine
 *
 * Compares freshly computed scores against the prior day's scores and emits
 * alerts for meaningful changes. Alerts are written to the score_alerts table.
 *
 * Alert types:
 *   VERDICT_CHANGE    : computed verdict changed (e.g. BUY → HOLD)
 *   SCORE_DROP        : any engine score dropped ≥ 0.10 vs prior day
 *   SCORE_RISE        : any engine score rose   ≥ 0.10 vs prior day
 *   COMPOUNDER_CHANGE : compounder score crossed a rating tier boundary
 */

import { db } from "@workspace/db";
import { scoresTable, scoreAlertsTable } from "@workspace/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";

const SCORE_THRESHOLD = 0.10;

type VerdictFn = (fortressScore: number, rocketScore: number, waveScore: number) => string;

/** Simplified verdict — for alert comparison only */
function simpleVerdict(f: number, r: number, w: number): string {
  const composite = f * 0.33 + r * 0.33 + w * 0.33;
  if (composite >= 0.78) return "STRONG BUY";
  if (composite >= 0.72) return "BUY";
  if (composite >= 0.62) return "ADD";
  if (composite >= 0.52) return "HOLD";
  if (composite >= 0.40) return "TRIM";
  return "SELL";
}

function compounderRatingTier(score: number | null): string {
  if (score == null) return "UNKNOWN";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export async function generateAlertsForTicker(
  ticker: string,
  current: {
    date: string;
    fortressScore: number;
    rocketScore: number;
    waveScore: number;
    compounderScore: number | null;
  }
): Promise<number> {
  // Fetch the most recent prior-day record (not today)
  const prior = await db
    .select()
    .from(scoresTable)
    .where(
      and(
        eq(scoresTable.ticker, ticker),
        ne(scoresTable.date, current.date)
      )
    )
    .orderBy(desc(scoresTable.date))
    .limit(1);

  if (!prior.length) return 0;
  const p = prior[0];

  const alerts: Array<typeof scoreAlertsTable.$inferInsert> = [];

  // ── VERDICT_CHANGE ──────────────────────────────────────────────────────────
  const prevVerdict = simpleVerdict(
    p.fortressScore ?? 0,
    p.rocketScore   ?? 0,
    p.waveScore     ?? 0
  );
  const currVerdict = simpleVerdict(
    current.fortressScore,
    current.rocketScore,
    current.waveScore
  );
  if (prevVerdict !== currVerdict) {
    alerts.push({
      ticker,
      date: current.date,
      alertType: "VERDICT_CHANGE",
      scoreFamily: "composite",
      previousValue: null,
      currentValue: null,
      message: `Verdict changed from ${prevVerdict} → ${currVerdict}`,
    });
  }

  // ── SCORE_DROP / SCORE_RISE ────────────────────────────────────────────────
  const engines = [
    { name: "fortress", prev: p.fortressScore, curr: current.fortressScore },
    { name: "rocket",   prev: p.rocketScore,   curr: current.rocketScore   },
    { name: "wave",     prev: p.waveScore,     curr: current.waveScore     },
  ] as const;

  for (const { name, prev, curr } of engines) {
    if (prev == null || curr == null) continue;
    const delta = curr - prev;
    if (Math.abs(delta) < SCORE_THRESHOLD) continue;
    alerts.push({
      ticker,
      date: current.date,
      alertType: delta < 0 ? "SCORE_DROP" : "SCORE_RISE",
      scoreFamily: name,
      previousValue: Math.round(prev * 100) / 100,
      currentValue:  Math.round(curr * 100) / 100,
      message: `${name.charAt(0).toUpperCase() + name.slice(1)} score ${delta < 0 ? "dropped" : "rose"} by ${Math.abs(Math.round(delta * 100))} pts (${Math.round(prev * 100)} → ${Math.round(curr * 100)})`,
    });
  }

  // ── COMPOUNDER_CHANGE ──────────────────────────────────────────────────────
  const prevTier = compounderRatingTier(p.compounderScore);
  const currTier = compounderRatingTier(current.compounderScore);
  if (
    prevTier !== "UNKNOWN" && currTier !== "UNKNOWN" &&
    prevTier !== currTier
  ) {
    alerts.push({
      ticker,
      date: current.date,
      alertType: "COMPOUNDER_CHANGE",
      scoreFamily: "compounder",
      previousValue: p.compounderScore,
      currentValue:  current.compounderScore,
      message: `Compounder rating changed from ${prevTier} → ${currTier} (${p.compounderScore ?? "?"} → ${current.compounderScore ?? "?"})`,
    });
  }

  if (!alerts.length) return 0;

  await db.insert(scoreAlertsTable).values(alerts);
  return alerts.length;
}

/** Run alert detection for all tickers that have scores today */
export async function runDailyAlerts(today: string): Promise<{
  tickers: number;
  alerts: number;
}> {
  const todayScores = await db
    .select({
      ticker:         scoresTable.ticker,
      date:           scoresTable.date,
      fortressScore:  scoresTable.fortressScore,
      rocketScore:    scoresTable.rocketScore,
      waveScore:      scoresTable.waveScore,
      compounderScore: scoresTable.compounderScore,
    })
    .from(scoresTable)
    .where(eq(scoresTable.date, today));

  let totalAlerts = 0;
  for (const s of todayScores) {
    const count = await generateAlertsForTicker(s.ticker, {
      date:           s.date!,
      fortressScore:  s.fortressScore ?? 0,
      rocketScore:    s.rocketScore   ?? 0,
      waveScore:      s.waveScore     ?? 0,
      compounderScore: s.compounderScore,
    });
    totalAlerts += count;
  }

  return { tickers: todayScores.length, alerts: totalAlerts };
}
