import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { perIpLimiter, globalLimiter } from "./middlewares/rate-limit.js";
import { requestTimeout } from "./middlewares/timeout.js";
import { incRequests, incErrors } from "./routes/stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();

// ── Trust proxy (Replit / load balancer sits in front) ──────────────────────
app.set("trust proxy", 1);

// ── Compression (gzip/brotli for all JSON + text responses) ─────────────────
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// ── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
    exposedHeaders: ["X-Request-Id", "X-Response-Time", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  }),
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Request counter ──────────────────────────────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  incRequests();
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use("/api", globalLimiter);
app.use("/api", perIpLimiter);

// ── Request timeout (30 s hard cap) ──────────────────────────────────────────
app.use("/api", requestTimeout(30_000));

// ── Docs static site ─────────────────────────────────────────────────────────
const docsPath = path.resolve(__dirname, "../../docs/dist");
const indexPath = path.join(docsPath, "index.html");

if (fs.existsSync(docsPath)) {
  logger.info(`Docs path found at ${docsPath}`);
  app.use("/docs", express.static(docsPath, { maxAge: "1h" }));

  app.get("/docs", (_req: Request, res: Response, next: NextFunction) => {
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else next();
  });

  app.get(/^\/docs\/.*/, (_req: Request, res: Response, next: NextFunction) => {
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else next();
  });
} else {
  logger.warn(`Docs build not found at ${docsPath}. /docs routes will not be available.`);
}

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Health check (no rate limit) ─────────────────────────────────────────────
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: Date.now() });
});

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "MovieBox API Server",
    version: "2.0.0",
    endpoints: {
      docs:     "GET /docs/",
      api:      "GET /api/",
      health:   "GET /healthz",
      stats:    "GET /api/stats",
      search:   "GET /api/search?q=<query>",
      trending: "GET /api/trending",
      hot:      "GET /api/hot",
      homepage: "GET /api/homepage",
      testLive: "GET /api/test-live?q=<query>",
      item:     "GET /api/test-live/item?id=<subjectId>",
      multi:    "GET /api/test-live/multi-search?q=<query>",
      suggest:  "GET /api/test-live/suggest?q=<query>",
      movie:    "GET /api/movie/details?id=<subjectId>",
      series:   "GET /api/series/details?id=<subjectId>&season=1",
      resource: "GET /api/episode/resource?id=<subjectId>",
      play:     "GET /api/episode/play?id=<subjectId>",
    },
    rateLimit: {
      perIp:  "600 requests / minute",
      global: "6000 requests / minute",
    },
    features: ["gzip compression", "in-flight dedup", "retry + backoff", "host failover", "TTL cache"],
  });
});

// ── 404 for /api/* ────────────────────────────────────────────────────────────
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Endpoint not found. GET / for endpoint list." });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  incErrors();
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default app;
