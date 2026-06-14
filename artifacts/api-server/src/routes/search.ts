import { Router, type IRouter } from "express";
import { searchContent, searchSuggest } from "../lib/moviebox.js";

const router: IRouter = Router();

/**
 * GET /api/search?q=Avatar
 * Search movies & series.
 * Optional: ?page=1  &size=20  &type=MOVIES|TV_SERIES|ANIME|MUSIC|EDUCATION|ALL
 */
router.get("/search", async (req, res) => {
  const { q, page, size, type } = req.query as {
    q?: string;
    page?: string;
    size?: string;
    type?: string;
  };

  if (!q || q.trim() === "") {
    res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    return;
  }

  const pg = page ? Math.max(1, parseInt(page, 10)) : 1;
  const ps = size ? Math.min(50, Math.max(1, parseInt(size, 10))) : 20;

  try {
    const results = await searchContent(q.trim(), pg, ps, type);
    const items = results.items ?? results.list ?? [];
    const pager = results.pager ?? {};
    res.json({
      success: true,
      data: {
        items,
        pager,
        count: items.length,
        query: q.trim(),
        page: pg,
        size: ps,
        type: type?.toUpperCase() ?? "ALL",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/search/suggest?q=Av
 * Autocomplete suggestions (falls back to a fast V3 search when V2 is unavailable).
 */
router.get("/search/suggest", async (req, res) => {
  const { q } = req.query as { q?: string };

  if (!q || q.trim() === "") {
    res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
    return;
  }

  try {
    let suggestions: unknown[] = [];
    try {
      suggestions = await searchSuggest(q.trim());
    } catch {
      // V2 suggest unreliable — fall through to search fallback
    }
    if (suggestions.length === 0) {
      const results = await searchContent(q.trim(), 1, 8);
      suggestions = results.items ?? results.list ?? [];
    }
    res.json({ success: true, data: suggestions, count: suggestions.length, query: q.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

export default router;
