import { fetchAndStoreCompany, fetchAndStoreMetrics, fetchAndStorePrices } from "./fmp-harvester";
import { calculateAllScores } from "./scoring-engines";
import { detectDrift, detectOpportunities } from "./detectors";
import { generateAiMemo } from "./ai-memo";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";

let pipelineRunning = false;
let lastRunDate: string | null = null;
let tickersProcessed = 0;
let currentTicker: string | null = null;
let totalTickers = 0;
let pipelineResults: Array<{
  ticker: string;
  success: boolean;
  error?: string;
  fortressScore?: number;
  rocketScore?: number;
  waveScore?: number;
}> = [];

export function getPipelineStatus() {
  return {
    running: pipelineRunning,
    lastRun: lastRunDate,
    tickersProcessed,
    currentTicker,
    totalTickers,
    results: pipelineResults,
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
  currentTicker = null;
  pipelineResults = [];

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

  totalTickers = tickerList.length;

  let processed = 0;
  let failed = 0;

  try {
    for (const ticker of tickerList) {
      currentTicker = ticker;
      try {
        console.log(`[Pipeline] Processing ${ticker} (${processed + 1}/${tickerList.length})...`);

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

        const result = {
          ticker,
          success: true,
          fortressScore: scores.fortressScore,
          rocketScore: scores.rocketScore,
          waveScore: scores.waveScore,
        };
        pipelineResults.push(result);

        processed++;
        tickersProcessed = processed;
        console.log(`[Pipeline] ${ticker} done — F:${scores.fortressScore} R:${scores.rocketScore} W:${scores.waveScore}`);
      } catch (error: any) {
        console.error(`[Pipeline] Failed ${ticker}:`, error.message);
        pipelineResults.push({ ticker, success: false, error: error.message });
        failed++;
      }
    }
  } finally {
    pipelineRunning = false;
    currentTicker = null;
    lastRunDate = new Date().toISOString();
  }

  return {
    status: "completed",
    processed,
    failed,
    results: pipelineResults,
  };
}
