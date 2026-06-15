import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const router = Router();

const ALLOWED_HOSTS = [
  "hakunaymatata.com",
  "ailok.pe",
  "aoneroom.com",
  "pbcdn.aoneroom.com",
  "sacdn.hakunaymatata.com",
  "bcdn.hakunaymatata.com",
];

function isAllowed(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

async function proxyRequest(req: Request, res: Response, rawUrl: string, extraHeaders: Record<string, string> = {}) {
  if (!rawUrl) return void res.status(400).json({ error: "url param required" });
  if (!isAllowed(rawUrl)) return void res.status(403).json({ error: "domain not allowed" });

  const upstreamHeaders: Record<string, string> = {
    "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G991B Build/SP1A.210812.016)",
    "Referer": "https://www.aoneroom.com/",
    "Origin": "https://www.aoneroom.com",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    ...extraHeaders,
  };

  if (req.headers.range) {
    upstreamHeaders["Range"] = req.headers.range;
  }

  try {
    const upstream = await fetch(rawUrl, { headers: upstreamHeaders });

    res.status(upstream.status);

    for (const h of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "last-modified",
    ]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    if (!upstream.body) return void res.end();

    await pipeline(
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),
      res
    );
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: "upstream fetch failed" });
    }
  }
}

/** Legacy: GET /api/stream?url=<encoded> */
router.get("/stream", async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) return void res.status(400).json({ error: "url param required" });
  return proxyRequest(req, res, rawUrl);
});

/** GET /api/proxy/stream?url=<encoded> — video stream with Range support */
router.get("/proxy/stream", async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) return void res.status(400).json({ error: "url param required" });
  return proxyRequest(req, res, rawUrl);
});

/** GET /api/proxy/sub?url=<encoded> — subtitle/caption file proxy */
router.get("/proxy/sub", async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) return void res.status(400).json({ error: "url param required" });
  return proxyRequest(req, res, rawUrl, { Accept: "text/vtt,text/plain,*/*" });
});

/** GET /api/proxy/image?url=<encoded> — image proxy for cast/crew avatars */
router.get("/proxy/image", async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) return void res.status(400).json({ error: "url param required" });

  try {
    const { hostname } = new URL(rawUrl);
    if (!ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h))) {
      return void res.status(403).json({ error: "domain not allowed" });
    }
  } catch {
    return void res.status(400).json({ error: "invalid url" });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        "Referer": "https://www.aoneroom.com/",
        "Accept": "image/*,*/*",
      },
      signal: AbortSignal.timeout(10_000),
    });

    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (!upstream.body) return void res.end();

    await pipeline(
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),
      res
    );
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: "upstream fetch failed" });
    }
  }
});

export default router;
