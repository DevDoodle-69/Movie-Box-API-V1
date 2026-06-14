import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import docsRouter from "./docs.js";
import trendingRouter from "./trending.js";
import searchRouter from "./search.js";
import detailsRouter from "./details.js";
import proxyRouter from "./proxy.js";
import testLiveRouter from "./test-live.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(docsRouter);
router.use(trendingRouter);
router.use(searchRouter);
router.use(detailsRouter);
router.use(proxyRouter);
router.use(testLiveRouter);

export default router;
