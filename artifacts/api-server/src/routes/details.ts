import { Router, type IRouter } from "express";
import {
  getSubjectById,
  getSeasonInfo,
  getPlayInfo,
  getResource,
  getDetailsByPath,
} from "../lib/moviebox.js";
import { cache, TTL } from "../lib/cache.js";

const router: IRouter = Router();

/**
 * GET /api/details?id=<subjectId>
 * Raw detail lookup for any item (movie, series, anime, etc.) by subjectId or detailPath.
 */
router.get("/details", async (req, res) => {
  const { id, path } = req.query as { id?: string; path?: string };

  if (!id && !path) {
    res.status(400).json({
      success: false,
      error: "Provide ?id=<subjectId> (from search results) or ?path=<detailPath>",
    });
    return;
  }

  try {
    const key = id ? `subject:${id}` : `detail-path:${path}`;
    const data = await cache.getOrFetch(
      key,
      () => (id ? getSubjectById(id) : getDetailsByPath(path!)),
      TTL.SUBJECT,
    );
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/movie/details?id=<subjectId>
 * Movie info + stream URLs (clean shape, combines subject + resource in one call).
 */
router.get("/movie/details", async (req, res) => {
  const { id, path } = req.query as { id?: string; path?: string };

  if (!id && !path) {
    res.status(400).json({
      success: false,
      error: "Provide ?id=<subjectId> from search results. Optionally ?path=<detailPath>.",
    });
    return;
  }

  try {
    if (id) {
      const [subject, resource] = await Promise.all([
        cache.getOrFetch(`subject:${id}`, () => getSubjectById(id), TTL.SUBJECT),
        cache.getOrFetch(`resource:${id}:0:0`, () => getResource(id, 0, 0), TTL.RESOURCE),
      ]);
      const r = resource as Record<string, unknown>;
      res.json({
        success: true,
        data: {
          subject,
          streams: r?.list ?? r?.downloads ?? [],
          totalEpisode: r?.totalEpisode ?? 0,
          totalSize: r?.totalSize ?? null,
          resolution: r?.resolution ?? null,
          subjectTitle: r?.subjectTitle ?? null,
          resource,
        },
      });
    } else {
      const raw = await getDetailsByPath(path!);
      const r = raw.resource as Record<string, unknown> | undefined;
      res.json({
        success: true,
        data: {
          subject: raw,
          streams: r?.downloads ?? [],
          subtitles: r?.captions ?? [],
          metadata: raw.metadata ?? {},
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/series/details?id=<subjectId>&season=1
 * Series info + episode list for a given season.
 */
router.get("/series/details", async (req, res) => {
  const { id, path, season } = req.query as { id?: string; path?: string; season?: string };

  if (!id && !path) {
    res.status(400).json({
      success: false,
      error: "Provide ?id=<subjectId> from search results. Optionally ?season=1.",
    });
    return;
  }

  try {
    if (id) {
      const seasonNum = season ? parseInt(season, 10) : undefined;
      const [info, episodes] = await Promise.all([
        cache.getOrFetch(`subject:${id}`, () => getSubjectById(id), TTL.SUBJECT),
        cache.getOrFetch(
          `season:${id}:${seasonNum ?? "all"}`,
          () => getSeasonInfo(id, seasonNum),
          TTL.SEASON,
        ),
      ]);
      res.json({ success: true, data: { info, episodes } });
    } else {
      const raw = await getDetailsByPath(path!);
      const r = raw.resource as Record<string, unknown> | undefined;
      res.json({
        success: true,
        data: {
          info: raw,
          episodes: raw.postList ?? [],
          streams: r?.downloads ?? [],
          subtitles: r?.captions ?? [],
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/episode/play?id=<subjectId>&season=0&episode=0
 * Play/stream info for a specific episode (MPD/HLS URLs).
 */
router.get("/episode/play", async (req, res) => {
  const { id, season, episode } = req.query as {
    id?: string;
    season?: string;
    episode?: string;
  };

  if (!id) {
    res.status(400).json({
      success: false,
      error: "Required: ?id=<subjectId>. Optional: ?season=1&episode=1 (defaults to 0 for movies)",
    });
    return;
  }

  try {
    const se = season ? parseInt(season, 10) : 0;
    const ep = episode ? parseInt(episode, 10) : 0;
    const key = `play:${id}:${se}:${ep}`;
    const data = await cache.getOrFetch(key, () => getPlayInfo(id, se, ep), TTL.PLAY);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/episode/resource?id=<subjectId>&season=0&episode=0
 * Download / stream resource URLs for a specific episode or movie.
 */
router.get("/episode/resource", async (req, res) => {
  const { id, season, episode } = req.query as {
    id?: string;
    season?: string;
    episode?: string;
  };

  if (!id) {
    res.status(400).json({
      success: false,
      error: "Required: ?id=<subjectId>. Optional: ?season=1&episode=1 (defaults to 0 for movies)",
    });
    return;
  }

  try {
    const se = season ? parseInt(season, 10) : 0;
    const ep = episode ? parseInt(episode, 10) : 0;
    const key = `resource:${id}:${se}:${ep}`;
    const data = await cache.getOrFetch(key, () => getResource(id, se, ep), TTL.RESOURCE);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/season?id=<subjectId>&season=1
 * Season metadata + episode list.
 */
router.get("/season", async (req, res) => {
  const { id, season } = req.query as { id?: string; season?: string };

  if (!id) {
    res.status(400).json({
      success: false,
      error: "Required: ?id=<subjectId>. Optional: ?season=1",
    });
    return;
  }

  try {
    const se = season ? parseInt(season, 10) : undefined;
    const key = `season:${id}:${se ?? "all"}`;
    const data = await cache.getOrFetch(key, () => getSeasonInfo(id, se), TTL.SEASON);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

export default router;
