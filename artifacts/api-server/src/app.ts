import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();

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

app.use(
  cors({
    origin: "*",
    methods: ["GET", "HEAD", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
    exposedHeaders: ["X-Request-Id", "X-Response-Time"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Serve Docs Website (React Build)
// ============================================================
const docsPath = path.resolve(__dirname, "../../docs/dist");
const indexPath = path.join(docsPath, "index.html");

// Check if docs build exists
if (fs.existsSync(docsPath)) {
  logger.info(`Docs path found at ${docsPath}`);
  
  // Serve static files from docs
  app.use("/docs", express.static(docsPath));

  // Handle SPA routing - all /docs/* requests should serve index.html
  app.get("/docs", (_req: Request, res: Response, next: NextFunction) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      logger.warn(`index.html not found at ${indexPath}`);
      next();
    }
  });

  app.get(/^\/docs\/.*/, (_req: Request, res: Response, next: NextFunction) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      logger.warn(`index.html not found at ${indexPath}`);
      next();
    }
  });
} else {
  logger.warn(`Docs build not found at ${docsPath}. /docs routes will not be available.`);
}

// ============================================================
// API Routes (with /api prefix)
// ============================================================
app.use("/api", router);

// ============================================================
// Health check endpoint (without /api prefix for monitoring)
// ============================================================
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ============================================================
// Root endpoint
// ============================================================
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "MovieBox API Server",
    version: "1.0.0",
    docs: "GET /docs/ → Documentation website",
    api_docs: "GET /api/ → API documentation",
    test_live: "GET /docs/test-live → Interactive test interface (available in docs)",
    health: "GET /healthz → Health check"
  });
});

// ============================================================
// 404 handler for /api/* paths
// ============================================================
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Endpoint not found. GET /api/ for documentation." });
});

// ============================================================
// Global error handler
// ============================================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ success: false, error: "Internal server error" });
});

export default app;
