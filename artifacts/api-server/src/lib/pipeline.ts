import { fetchAndStoreCompany, fetchAndStoreMetrics, fetchAndStorePrices } from "./fmp-harvester";
import { calculateAllScores } from "./scoring-engines";
import { detectDrift, detectOpportunities } from "./detectors";
import { generateAiMemo } from "./ai-memo";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";

let pipelineRunning = false;
let lastRunDate: string | null = null;
let tickersProcessed = 0;

export function getPipelineStatus() {
  return {
    running: pipelineRunning,
    lastRun: lastRunDate,
    tickersProcessed,
  };
}

export async function runPipeline(tickers?: string[]) {
  if (pipelineRunning) {
    return {
      status: "already_running",
      processed: 0,
      failed: 0,
      results: [],
    };
  }

  pipelineRunning = true;
  tickersProcessed = 0;

  const tickerList = tickers?.length
    ? tickers
    : (await db.select({ ticker: companiesTable.ticker }).from(companiesTable)).map(c => c.ticker);

  if (!tickerList.length) {
    pipelineRunning = false;
    return {
      status: "no_tickers",
      processed: 0,
      failed: 0,
      results: [],
    };
  }

  const results: Array<{
    ticker: string;
    success: boolean;
    error?: string;
    fortressScore?: number;
    rocketScore?: number;
    waveScore?: number;
  }> = [];

  let processed = 0;
  let failed = 0;

  try {
    for (const ticker of tickerList) {
      try {
        console.log(`[Pipeline] Processing ${ticker}...`);

        await fetchAndStoreCompany(ticker);
        await fetchAndStoreMetrics(ticker);
        await fetchAndStorePrices(ticker);

        const scores = await calculateAllScores(ticker);

        await detectDrift(ticker);
        await detectOpportunities(ticker);

        try {
          await generateAiMemo(ticker);
        } catch (aiErr: any) {
          console.warn(`[Pipeline] AI memo failed for ${ticker}: ${aiErr.message}`);
        }

        results.push({
          ticker,
          success: true,
          fortressScore: scores.fortressScore,
          rocketScore: scores.rocketScore,
          waveScore: scores.waveScore,
        });

        processed++;
        tickersProcessed = processed;
        console.log(`[Pipeline] ${ticker} done - F:${scores.fortressScore} R:${scores.rocketScore} W:${scores.waveScore}`);
      } catch (error: any) {
        console.error(`[Pipeline] Failed ${ticker}:`, error.message);
        results.push({
          ticker,
          success: false,
          error: error.message,
        });
        failed++;
      }
    }
  } finally {
    pipelineRunning = false;
    lastRunDate = new Date().toISOString();
  }

  return {
    status: "completed",
    processed,
    failed,
    results,
  };
}
