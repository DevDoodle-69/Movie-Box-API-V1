import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}

function createLimiter(opts: RateLimitOptions) {
  const { windowMs, max, message = "Too many requests, please slow down." } = opts;
  const store = new Map<string, WindowEntry>();

  const keyFn = opts.keyFn ?? ((req: Request) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.socket.remoteAddress ??
      "unknown"
    );
  });

  setInterval(() => {
    const now = Date.now();
    for (const [k, e] of store.entries()) {
      if (now > e.resetAt) store.delete(k);
    }
  }, windowMs).unref();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = keyFn(req);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    const resetSec = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetSec);

    if (entry.count > max) {
      res.setHeader("Retry-After", resetSec);
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: resetSec,
      });
      return;
    }

    next();
  };
}

export const perIpLimiter = createLimiter({
  windowMs: 60_000,
  max: 600,
  message: "Rate limit exceeded for your IP. Max 600 requests per minute.",
});

export const globalLimiter = createLimiter({
  windowMs: 60_000,
  max: 6000,
  keyFn: () => "global",
  message: "Server is under heavy load. Please try again in a moment.",
});

export const strictLimiter = createLimiter({
  windowMs: 60_000,
  max: 120,
  message: "This endpoint is limited to 120 requests per minute per IP.",
});
