import { Router, type IRouter } from "express";
import { runPipeline, getPipelineStatus } from "../lib/pipeline";

const router: IRouter = Router();

router.post("/pipeline/run", async (req, res) => {
  try {
    const tickers = req.body?.tickers;
    const result = await runPipeline(tickers);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/pipeline/status", (_req, res) => {
  const status = getPipelineStatus();
  res.json({
    running: status.running,
    lastRun: status.lastRun ?? undefined,
    tickersProcessed: status.tickersProcessed ?? undefined,
    currentTicker: status.currentTicker ?? undefined,
    currentStep: status.currentStep ?? undefined,
    totalTickers: status.totalTickers ?? undefined,
    stocksScored: status.stocksScored ?? undefined,
    yfPatchStats: status.yfPatchStats ?? undefined,
    dataSourceBreakdown: status.dataSourceBreakdown ?? undefined,
    results: status.results ?? undefined,
  });
});

export default router;
