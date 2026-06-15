import type { Request, Response, NextFunction } from "express";

export function requestTimeout(ms: number) {
  return function timeoutMiddleware(_req: Request, res: Response, next: NextFunction) {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Request timed out. The upstream API took too long to respond.",
        });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
