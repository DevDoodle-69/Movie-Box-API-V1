import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALLOWED_HOSTS = [
  "hakunaymatata.com",
  "bcdn.hakunaymatata.com",
  "sacdn.hakunaymatata.com",
  "aoneroom.com",
  "pbcdn.aoneroom.com",
  "pbcdnw.aoneroom.com",
  "h5.aoneroom.com",
  "api6.aoneroom.com",
  "cdn.aoneroom.com",
];

function isAllowed(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

const PROXY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * GET /api/proxy/stream?url=<encoded-cdn-url>
 * Streams video/audio from CDN with Range support and CORS headers.
 */
router.get("/proxy/stream", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    res.status(400).json({ error: "invalid url encoding" });
    return;
  }

  if (!isAllowed(decoded)) {
    res.status(403).json({ error: "URL not from allowed domain" });
    return;
  }

  const rangeHeader = req.headers["range"];
  const headers: Record<string, string> = {
    "User-Agent": PROXY_UA,
    "Referer": "https://moviebox.ph/",
    "Origin": "https://moviebox.ph",
    Accept: "*/*",
  };
  if (rangeHeader) headers["Range"] = rangeHeader;

  try {
    const upstream = await fetch(decoded, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    res.status(upstream.status);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) res.setHeader("Content-Length", cl);
    const cr = upstream.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);
    const ar = upstream.headers.get("accept-ranges");
    if (ar) res.setHeader("Accept-Ranges", ar);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    req.on("close", () => reader.cancel());

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const ok = res.write(value);
        if (!ok) {
          await new Promise<void>((r) => res.once("drain", r));
        }
      }
      res.end();
    };

    pump().catch(() => {
      try { res.end(); } catch { /* already ended */ }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upstream error";
    if (!res.headersSent) res.status(502).json({ error: msg });
  }
});

/**
 * GET /api/proxy/sub?url=<encoded-subtitle-url>
 * Proxies subtitle/caption files (SRT, VTT) with CORS headers.
 */
router.get("/proxy/sub", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    res.status(400).json({ error: "invalid url encoding" });
    return;
  }

  if (!isAllowed(decoded)) {
    res.status(403).json({ error: "URL not from allowed domain" });
    return;
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent": PROXY_UA,
        Referer: "https://moviebox.ph/",
      },
      signal: AbortSignal.timeout(15_000),
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "upstream error";
    res.status(502).json({ error: msg });
  }
});

export default router;
