import { Router, type IRouter } from "express";
import { getHomepage, getMainPage, getHotContent, getPopularSearches } from "../lib/moviebox.js";
import { cache, TTL } from "../lib/cache.js";

const router: IRouter = Router();

router.get("/trending", async (req, res) => {
  try {
    const { page, tab } = req.query as { page?: string; tab?: string };
    const pg = page ? Math.max(1, parseInt(page, 10)) : 1;
    const tb = tab !== undefined ? parseInt(tab, 10) : 0;
    const key = `trending:${pg}:${tb}`;
    const data = await cache.getOrFetch(key, () => getMainPage(pg, tb), TTL.TRENDING);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

router.get("/trending/movies", async (_req, res) => {
  try {
    const data = await cache.getOrFetch("trending:1:1", () => getMainPage(1, 1), TTL.TRENDING);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

router.get("/trending/series", async (_req, res) => {
  try {
    const data = await cache.getOrFetch("trending:1:2", () => getMainPage(1, 2), TTL.TRENDING);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

router.get("/hot", async (_req, res) => {
  try {
    const data = await cache.getOrFetch("hot", getHotContent, TTL.HOT);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

router.get("/popular-searches", async (_req, res) => {
  try {
    const data = await cache.getOrFetch("popular-searches", getPopularSearches, TTL.POPULAR);
    res.json({ success: true, data, count: Array.isArray(data) ? (data as unknown[]).length : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

router.get("/homepage", async (_req, res) => {
  try {
    const data = await cache.getOrFetch("homepage", getHomepage, TTL.HOMEPAGE);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

export default router;
