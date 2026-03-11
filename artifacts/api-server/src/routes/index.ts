import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pipelineRouter from "./pipeline";
import companiesRouter from "./companies";
import scoresRouter from "./scores";
import signalsRouter from "./signals";
import universeRouter from "./universe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pipelineRouter);
router.use(companiesRouter);
router.use(scoresRouter);
router.use(signalsRouter);
router.use(universeRouter);

export default router;
