/**
 * Pipeline Orchestrator
 *
 * Order per ticker:
 *   1. Yahoo Finance harvest (primary — free, no quota)
 *      → FMP fallback if Yahoo fails (rate-limited, richer history)
 *   2. Score (8-family factor model)
 *   3. Entry timing score
 *   4. Drift + opportunity detectors
 *   5. AI memo
 *
 * Post-all-tickers:
 *   6. Cross-sectional universe calibration
 */

import { fetchAndStoreCompany, fetchAndStoreMetrics, fetchAndStorePrices } from "./fmp-harvester";
import { yfFetchAndStoreCompany, yfFetchAndStoreMetrics, yfFetchAndStorePrices, yfPatchNullFields } from "./yf-harvester";
import { fmpQuotaExhausted } from "./fmp-client";
import { calculateAllScores } from "./scoring-engines";
import { computeEntryTimingScore } from "./entry-timing";
import { detectDrift, detectOpportunities, detectRisks } from "./detectors";
import { generateAiMemo } from "./ai-memo";
import { calibrateUniverseScores } from "./normalizer";
import { writeFactorSnapshot } from "./factor-warehouse";
import { normaliseCountryName } from "./country-benchmarks";
import { sendPipelineReport } from "./mailer";
import { getNextSundayAt2AM } from "./scheduler-utils";
import { db } from "@workspace/db";
import { companiesTable, financialMetricsTable, scoresTable, opportunityAlertsTable, riskAlertsTable } from "@workspace/db/schema";
import { eq, desc, gte } from "drizzle-orm";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — weekly refresh

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
let lastRunUpdated = 0;
let lastRunFailed = 0;
let tickersProcessed = 0;
let currentTicker: string | null = null;
let totalTickers = 0;
let currentStep: string | null = null;
let pipelineResults: PipelineTickerResult[] = [];
let yfPatchStats: { patched: number; failed: number } | null = null;
let stocksScored = 0;
let fmpCount = 0;
let yfCount = 0;

interface PipelineTickerResult {
  ticker: string;
  success: boolean;
  dataSource?: "fmp" | "yahoo" | "both" | "none";
  error?: string;
  fortressScore?: number;
  rocketScore?: number;
  waveScore?: number;
  entryTimingScore?: number;
}

export function isPipelineRunning() {
  return pipelineRunning;
}

export function getPipelineStatus() {
  return {
    running: pipelineRunning,
    lastRun: lastRunDate,
    lastRunUpdated,
    lastRunFailed,
    tickersProcessed,
    currentTicker,
    currentStep,
    totalTickers,
    stocksScored,
    yfPatchStats,
    dataSourceBreakdown: { fmp: fmpCount, yahoo: yfCount },
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
  yfPatchStats = null;
  stocksScored = 0;
  fmpCount = 0;
  yfCount = 0;

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
    // ── Pre-flight: Country normalisation ────────────────────────────────────
    currentStep = "country-normalisation";
    console.log("[Pipeline] Pre-flight: normalising country names in companies table...");
    const allCos = await db.select({ ticker: companiesTable.ticker, country: companiesTable.country }).from(companiesTable);
    for (const co of allCos) {
      if (!co.country) continue;
      const normalised = normaliseCountryName(co.country);
      if (normalised && normalised !== co.country) {
        await db.update(companiesTable).set({ country: normalised }).where(eq(companiesTable.ticker, co.ticker));
      }
    }
    console.log("[Pipeline] Country normalisation complete.");

    for (const ticker of tickerList) {
      currentTicker = ticker;
      try {
        console.log(`[Pipeline] ── ${ticker} (${processed + 1}/${tickerList.length}) ──`);

        currentStep = "harvesting";
        let usedSource: "fmp" | "yahoo" | "both" | "none" = "none";
        if (await needsFmpFetch(ticker)) {
          let yfOk = false;
          let fmpOk = false;

          // ── Step 1: Yahoo Finance (free, fast, rich current-period data) ─
          try {
            await yfFetchAndStoreCompany(ticker);
            await yfFetchAndStoreMetrics(ticker);
            await yfFetchAndStorePrices(ticker);
            yfOk = true;
            yfCount++;
            console.log(`[Pipeline] ${ticker} — Yahoo Finance OK`);
          } catch (yfErr: any) {
            console.warn(`[Pipeline] ${ticker} — Yahoo Finance failed: ${yfErr.message}`);
          }

          // ── Step 2: FMP (paid, richer history + insider/analyst data) ────
          // Runs regardless of Yahoo result — enriches with deeper data
          if (!fmpQuotaExhausted()) {
            try {
              await fetchAndStoreCompany(ticker);
              await fetchAndStoreMetrics(ticker);
              await fetchAndStorePrices(ticker);
              fmpOk = true;
              fmpCount++;
              console.log(`[Pipeline] ${ticker} — FMP OK`);
            } catch (fmpErr: any) {
              console.warn(`[Pipeline] ${ticker} — FMP failed: ${fmpErr.message}`);
            }
          }

          // ── Step 3: Yahoo Finance null-fill pass ─────────────────────────
          // After FMP, patch any fields FMP left null using Yahoo Finance values
          if (fmpOk) {
            await yfPatchNullFields(ticker).catch(() => {});
          }

          // ── Determine source tag and fail if nothing worked ───────────────
          if (yfOk && fmpOk)       usedSource = "both";
          else if (yfOk)           usedSource = "yahoo";
          else if (fmpOk)          usedSource = "fmp";
          else throw new Error(`Both Yahoo Finance and FMP failed for ${ticker}`);

          console.log(`[Pipeline] ${ticker} — data source: ${usedSource}`);
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
          dataSource: usedSource,
          fortressScore: scores.fortressScore,
          rocketScore: scores.rocketScore,
          waveScore: scores.waveScore,
          entryTimingScore: Math.round(entryTimingScore * 100) / 100,
        });

        processed++;
        stocksScored = processed;
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
    lastRunUpdated = processed;
    lastRunFailed = failed;

    // ── Completion email ─────────────────────────────────────────────────────
    try {
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const [topFortress, topRocket, opportunities, riskSignals] = await Promise.all([
        db.select({ ticker: scoresTable.ticker, company: companiesTable.name, fortressScore: scoresTable.fortressScore, rocketScore: scoresTable.rocketScore, waveScore: scoresTable.waveScore })
          .from(scoresTable).leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
          .where(eq(scoresTable.date, today)).orderBy(desc(scoresTable.fortressScore)).limit(8),
        db.select({ ticker: scoresTable.ticker, company: companiesTable.name, fortressScore: scoresTable.fortressScore, rocketScore: scoresTable.rocketScore, waveScore: scoresTable.waveScore })
          .from(scoresTable).leftJoin(companiesTable, eq(scoresTable.ticker, companiesTable.ticker))
          .where(eq(scoresTable.date, today)).orderBy(desc(scoresTable.rocketScore)).limit(8),
        db.select({ ticker: opportunityAlertsTable.ticker, alertType: opportunityAlertsTable.alertType, score: opportunityAlertsTable.score })
          .from(opportunityAlertsTable).where(gte(opportunityAlertsTable.date, cutoffStr))
          .orderBy(desc(opportunityAlertsTable.score)).limit(10),
        db.select({ ticker: riskAlertsTable.ticker, riskLevel: riskAlertsTable.riskLevel, description: riskAlertsTable.description })
          .from(riskAlertsTable).where(gte(riskAlertsTable.date, cutoffStr))
          .orderBy(desc(riskAlertsTable.createdAt)).limit(10),
      ]);

      const nextRunDate = getNextSundayAt2AM().toUTCString().replace(" GMT", " UTC");
      await sendPipelineReport({
        processed,
        failed,
        updated: processed,
        fmpCount,
        yahooCount: yfCount,
        nextRunDate,
        topFortress: topFortress.map(r => ({ ticker: r.ticker, company: r.company ?? undefined, fortressScore: r.fortressScore, rocketScore: r.rocketScore, waveScore: r.waveScore })),
        topRocket:   topRocket.map(r => ({ ticker: r.ticker, company: r.company ?? undefined, fortressScore: r.fortressScore, rocketScore: r.rocketScore, waveScore: r.waveScore })),
        newOpportunities: opportunities.map(o => ({ ticker: o.ticker, alertType: o.alertType, score: o.score ?? 0 })),
        highRisk: riskSignals.map(r => ({ ticker: r.ticker, signalType: r.riskLevel.toUpperCase(), severity: r.riskLevel, description: r.description })),
      });
      console.log("[Pipeline] Completion email sent.");
    } catch (emailErr: any) {
      console.warn("[Pipeline] Completion email failed:", emailErr.message);
    }
  }

  return { status: "completed", processed, failed, results: pipelineResults };
}
