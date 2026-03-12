/**
 * Pipeline Orchestrator
 *
 * Order per ticker:
 *   1. FMP harvest (rate-limited, 10yr history, insider/analyst data)
 *   2. Score (8-family factor model)
 *   3. Entry timing score
 *   4. Drift + opportunity detectors
 *   5. AI memo
 *
 * Post-all-tickers:
 *   6. Cross-sectional universe calibration
 */

import { fetchAndStoreCompany, fetchAndStoreMetrics, fetchAndStorePrices } from "./fmp-harvester";
import { yfFetchAndStoreCompany, yfFetchAndStoreMetrics, yfFetchAndStorePrices } from "./yf-harvester";
import { fmpQuotaExhausted } from "./fmp-client";
import { calculateAllScores } from "./scoring-engines";
import { computeEntryTimingScore } from "./entry-timing";
import { detectDrift, detectOpportunities, detectRisks } from "./detectors";
import { generateAiMemo } from "./ai-memo";
import { calibrateUniverseScores } from "./normalizer";
import { writeFactorSnapshot } from "./factor-warehouse";
import { db } from "@workspace/db";
import { companiesTable, financialMetricsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours — refresh once per day

async function needsFmpFetch(ticker: string): Promise<boolean> {
  const rows = await db
    .select({ createdAt: financialMetricsTable.createdAt })
    .from(financialMetricsTable)
    .where(eq(financialMetricsTable.ticker, ticker))
    .orderBy(desc(financialMetricsTable.createdAt))
    .limit(1);

  if (!rows.length) return true;
  const age = Date.now() - new Date(rows[0].createdAt).getTime();
  return age > CACHE_TTL_MS;
}

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

// AI memos are generated for every ticker on each pipeline run.
// Errors are caught and logged — they never abort the per-ticker loop.

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
        if (await needsFmpFetch(ticker)) {
          if (!fmpQuotaExhausted()) {
            try {
              await fetchAndStoreCompany(ticker);
              await fetchAndStoreMetrics(ticker);
              await fetchAndStorePrices(ticker);
              console.log(`[Pipeline] ${ticker} — harvested via FMP`);
            } catch (fmpErr: any) {
              console.warn(`[Pipeline] ${ticker} — FMP failed (${fmpErr.message}), trying Yahoo Finance...`);
              await yfFetchAndStoreCompany(ticker);
              await yfFetchAndStoreMetrics(ticker);
              await yfFetchAndStorePrices(ticker);
              console.log(`[Pipeline] ${ticker} — harvested via Yahoo Finance`);
            }
          } else {
            console.log(`[Pipeline] ${ticker} — FMP quota exhausted, using Yahoo Finance...`);
            await yfFetchAndStoreCompany(ticker);
            await yfFetchAndStoreMetrics(ticker);
            await yfFetchAndStorePrices(ticker);
            console.log(`[Pipeline] ${ticker} — harvested via Yahoo Finance`);
          }
        } else {
          console.log(`[Pipeline] ${ticker} — data fresh, skipping fetch`);
        }

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
        try {
          await generateAiMemo(ticker);
        } catch (aiErr: any) {
          console.warn(`[Pipeline] AI memo failed for ${ticker}: ${aiErr.message}`);
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

    // Cross-sectional universe calibration — runs once after all tickers
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
