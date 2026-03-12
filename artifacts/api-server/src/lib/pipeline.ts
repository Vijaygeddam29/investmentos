/**
 * Pipeline Orchestrator
 *
 * Order per ticker:
 *   1. FMP harvest (rate-limited, 10yr history, insider/analyst data)
 *   2. Score (8-family factor model)
 *   3. Entry timing score
 *   4. Drift + opportunity detectors
 *   5. AI memo (only if score > threshold — Gap 9: cost control)
 *
 * Post-all-tickers:
 *   6. Cross-sectional universe calibration (Gap 8)
 */

import { fetchAndStoreCompany, fetchAndStoreMetrics, fetchAndStorePrices } from "./fmp-harvester";
import { calculateAllScores } from "./scoring-engines";
import { computeEntryTimingScore } from "./entry-timing";
import { detectDrift, detectOpportunities, detectRisks } from "./detectors";
import { generateAiMemo } from "./ai-memo";
import { calibrateUniverseScores } from "./normalizer";
import { writeFactorSnapshot } from "./factor-warehouse";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";

// ─── State ────────────────────────────────────────────────────────────────────

let pipelineRunning = false;
let lastRunDate: string | null = null;
let tickersProcessed = 0;
let currentTicker: string | null = null;
let totalTickers = 0;
let currentStep: string | null = null;
let pipelineResults: PipelineTickerResult[] = [];

interface PipelineTickerResult {
  ticker: string;
  success: boolean;
  error?: string;
  fortressScore?: number;
  rocketScore?: number;
  waveScore?: number;
  entryTimingScore?: number;
}

export function getPipelineStatus() {
  return {
    running: pipelineRunning,
    lastRun: lastRunDate,
    tickersProcessed,
    currentTicker,
    currentStep,
    totalTickers,
    results: pipelineResults,
  };
}

// ─── AI Memo Threshold (Gap 9: cost control) ────────────────────────────────
// Only generate AI memos for tickers with meaningful signal
const AI_MEMO_MIN_SCORE = 0.45;

function shouldGenerateMemo(scores: {
  fortressScore: number;
  rocketScore: number;
  waveScore: number;
}): boolean {
  return (
    scores.fortressScore >= AI_MEMO_MIN_SCORE ||
    scores.rocketScore >= AI_MEMO_MIN_SCORE ||
    scores.waveScore >= AI_MEMO_MIN_SCORE
  );
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function runPipeline(tickers?: string[]) {
  if (pipelineRunning) {
    return { status: "already_running", processed: 0, failed: 0, results: [] };
  }

  pipelineRunning = true;
  tickersProcessed = 0;
  currentTicker = null;
  currentStep = null;
  pipelineResults = [];

  const tickerList = tickers?.length
    ? tickers.map(t => t.toUpperCase().trim()).filter(Boolean)
    : (await db.select({ ticker: companiesTable.ticker }).from(companiesTable)).map(c => c.ticker);

  if (!tickerList.length) {
    pipelineRunning = false;
    return { status: "no_tickers", processed: 0, failed: 0, results: [] };
  }

  totalTickers = tickerList.length;
  let processed = 0;
  let failed = 0;

  try {
    for (const ticker of tickerList) {
      currentTicker = ticker;
      try {
        console.log(`[Pipeline] ── ${ticker} (${processed + 1}/${tickerList.length}) ──`);

        currentStep = "harvesting";
        await fetchAndStoreCompany(ticker);
        await fetchAndStoreMetrics(ticker);
        await fetchAndStorePrices(ticker);

        currentStep = "scoring";
        const scores = await calculateAllScores(ticker);

        currentStep = "entry-timing";
        const entryTimingScore = await computeEntryTimingScore(ticker);

        // ── Factor Warehouse snapshot (additive, never blocks pipeline) ──────
        currentStep = "warehouse";
        try {
          await writeFactorSnapshot(ticker, scores, entryTimingScore);
        } catch (whErr: any) {
          console.warn(`[Pipeline] Warehouse snapshot skipped for ${ticker}: ${whErr.message}`);
        }

        currentStep = "detecting";
        await detectDrift(ticker);
        await detectOpportunities(ticker);
        await detectRisks(ticker);  // aggregates signals → risk_alerts table

        currentStep = "ai-memo";
        if (shouldGenerateMemo(scores)) {
          try {
            await generateAiMemo(ticker);
          } catch (aiErr: any) {
            console.warn(`[Pipeline] AI memo skipped for ${ticker}: ${aiErr.message}`);
          }
        } else {
          console.log(`[Pipeline] Skipping AI memo for ${ticker} (scores below threshold)`);
        }

        pipelineResults.push({
          ticker,
          success: true,
          fortressScore: scores.fortressScore,
          rocketScore: scores.rocketScore,
          waveScore: scores.waveScore,
          entryTimingScore: Math.round(entryTimingScore * 100) / 100,
        });

        processed++;
        tickersProcessed = processed;
        console.log(`[Pipeline] ${ticker} done — F:${scores.fortressScore} R:${scores.rocketScore} W:${scores.waveScore} Entry:${entryTimingScore.toFixed(2)}`);
      } catch (error: any) {
        console.error(`[Pipeline] Failed ${ticker}:`, error.message);
        pipelineResults.push({ ticker, success: false, error: error.message });
        failed++;
      }
    }

    // Cross-sectional universe calibration — runs once after all tickers (Gap 8)
    if (processed >= 2) {
      currentStep = "calibrating";
      console.log(`[Pipeline] Running cross-sectional calibration across ${processed} tickers...`);
      try {
        const cal = await calibrateUniverseScores();
        console.log(`[Pipeline] Calibration complete — ${cal.calibrated} tickers recalibrated`);
      } catch (calErr: any) {
        console.warn(`[Pipeline] Calibration failed: ${calErr.message}`);
      }
    }
  } finally {
    pipelineRunning = false;
    currentTicker = null;
    currentStep = null;
    lastRunDate = new Date().toISOString();
  }

  return { status: "completed", processed, failed, results: pipelineResults };
}
