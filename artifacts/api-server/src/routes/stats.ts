import { Router } from "express";
import { cache } from "../lib/cache.js";

const router = Router();
const startedAt = Date.now();

let totalRequests = 0;
let totalErrors = 0;

export function incRequests() { totalRequests++; }
export function incErrors() { totalErrors++; }

router.get("/stats", (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);
  const cacheStats = cache.getStats();

  res.json({
    success: true,
    uptime: {
      seconds: uptimeSec,
      human: formatUptime(uptimeSec),
    },
    requests: {
      total: totalRequests,
      errors: totalErrors,
      errorRate: totalRequests > 0 ? `${((totalErrors / totalRequests) * 100).toFixed(2)}%` : "0%",
    },
    cache: {
      size: cacheStats.size,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      inflight: cacheStats.inflight,
      evictions: cacheStats.evictions,
      hitRate: (cacheStats.hits + cacheStats.misses) > 0
        ? `${((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)}%`
        : "0%",
    },
    memory: {
      rss: formatBytes(process.memoryUsage().rss),
      heapUsed: formatBytes(process.memoryUsage().heapUsed),
      heapTotal: formatBytes(process.memoryUsage().heapTotal),
    },
    node: process.version,
    pid: process.pid,
  });
});

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [d > 0 ? `${d}d` : null, h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null, `${s}s`]
    .filter(Boolean).join(" ");
}

function formatBytes(b: number): string {
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b > 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

export default router;
