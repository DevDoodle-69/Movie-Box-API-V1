import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import docsRouter from "./docs.js";
import trendingRouter from "./trending.js";
import searchRouter from "./search.js";
import detailsRouter from "./details.js";
import proxyRouter from "./proxy.js";
import streamRouter from "./stream.js";
import testLiveRouter from "./test-live.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(statsRouter);
router.use(healthRouter);
router.use(docsRouter);
router.use(trendingRouter);
router.use(searchRouter);
router.use(detailsRouter);
router.use(proxyRouter);
router.use(streamRouter);
router.use(testLiveRouter);

export default router;
