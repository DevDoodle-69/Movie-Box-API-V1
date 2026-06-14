import { Router, type IRouter } from "express";
import { cache } from "../lib/cache.js";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  const cacheSize = cache.size();
  res.json({
    name: "MovieBox Express API",
    version: "1.0.0",
    description:
      "Full-featured Express proxy for the MovieBox API. Search movies, series, anime, music; browse trending; fetch stream URLs, subtitles, and episode lists.",
    status: "ok",
    cache: { entries: cacheSize },
    upstream: {
      v1: { base: "https://h5.aoneroom.com", auth: "account cookie", use: "Hot content, popular searches" },
      v2: { base: "https://h5-api.aoneroom.com", auth: "none", use: "Homepage, suggest, detailPath lookups" },
      v3: { base: "https://api6.aoneroom.com", auth: "HMAC-MD5 signed headers", use: "Search, subjects, seasons, play info, resources" },
      hostPool: ["api6", "api5", "api4", "api4sg", "api3"].map((h) => `https://${h}.aoneroom.com`),
    },
    contentTypes: {
      ALL: 0,
      MOVIES: 1,
      TV_SERIES: 2,
      EDUCATION: 5,
      MUSIC: 6,
      ANIME: 7,
    },
    endpoints: {
      system: {
        "GET /api/healthz": "Health check → {status:'ok'}",
        "GET /api/": "This documentation",
      },
      browse: {
        "GET /api/homepage": "Homepage banners + category rows (V2, cached 10m)",
        "GET /api/trending": "Trending content (V3 signed). ?page=1 &tab=0|1|2 (0=all,1=movies,2=series). Cached 5m.",
        "GET /api/trending/movies": "Trending movies shortcut (tab=1, cached 5m)",
        "GET /api/trending/series": "Trending series shortcut (tab=2, cached 5m)",
        "GET /api/hot": "Hot / ranked content (V1, cached 10m)",
        "GET /api/popular-searches": "Popular search terms (V1, cached 15m)",
      },
      search: {
        "GET /api/search": "Search. Required: ?q=query. Optional: ?page=1 &size=20 &type=ALL|MOVIES|TV_SERIES|ANIME|MUSIC|EDUCATION",
        "GET /api/search/suggest": "Autocomplete. Required: ?q=query. Returns up to 8 suggestions.",
      },
      movies: {
        "GET /api/movie/details": "Movie info + stream links. Required: ?id=<subjectId>",
        "GET /api/episode/resource": "Download/stream URLs. Required: ?id=<subjectId>. Optional: ?season=0&episode=0",
        "GET /api/episode/play": "Play info (MPD/HLS). Required: ?id=<subjectId>. Optional: ?season=0&episode=0",
      },
      series: {
        "GET /api/series/details": "Series info + episode list. Required: ?id=<subjectId>. Optional: ?season=1",
        "GET /api/season": "Season metadata + episodes. Required: ?id=<subjectId>. Optional: ?season=1",
      },
      generic: {
        "GET /api/details": "Raw detail. Required: ?id=<subjectId> or ?path=<detailPath>",
      },
    },
    workflow: [
      "1. Search:              GET /api/search?q=Avatar",
      "2. Pick result subjectId from items[].subjectId",
      "3. Movie streams:       GET /api/episode/resource?id=<subjectId>",
      "4. Movie play info:     GET /api/episode/play?id=<subjectId>",
      "5. Series details:      GET /api/series/details?id=<subjectId>&season=1",
      "6. Episode streams:     GET /api/episode/resource?id=<subjectId>&season=1&episode=3",
      "7. Episode play info:   GET /api/episode/play?id=<subjectId>&season=1&episode=3",
    ],
    examples: {
      avatarSubjectId: "8906247916759695608",
      breakingBadSubjectId: "6207982430134357800",
    },
  });
});

export default router;
