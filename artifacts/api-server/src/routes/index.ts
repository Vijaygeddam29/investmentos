import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pipelineRouter from "./pipeline";
import companiesRouter from "./companies";
import scoresRouter from "./scores";
import signalsRouter from "./signals";
import universeRouter from "./universe";
import factorSnapshotsRouter from "./factor-snapshots";
import portfolioRouter from "./portfolio";
import portfolioBuilderRouter from "./portfolio-builder";
import anthropicRouter from "./anthropic";
import alertsRouter from "./alerts";
import authRouter from "./auth";
import intelligenceRouter from "./intelligence";
import adminRouter from "./admin";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(analyticsRouter);
router.use(healthRouter);
router.use(pipelineRouter);
router.use(companiesRouter);
router.use(scoresRouter);
router.use(signalsRouter);
router.use(universeRouter);
router.use(factorSnapshotsRouter);
router.use(portfolioRouter);
router.use(portfolioBuilderRouter);
router.use(anthropicRouter);
router.use(alertsRouter);
router.use(intelligenceRouter);

export default router;
