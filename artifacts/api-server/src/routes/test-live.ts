import { Router, type IRouter } from "express";
import {
  searchContent,
  searchSuggest,
  getSubjectById,
  getResource,
  getPlayInfo,
  getSeasonInfo,
  subjectTypeValue,
} from "../lib/moviebox.js";
import { cache, TTL } from "../lib/cache.js";

const router: IRouter = Router();

/**
 * GET /api/test-live
 *
 * All-in-one powerful search + rich metadata endpoint.
 *
 * Params:
 *   q         — search query (required)
 *   page      — page number (default 1)
 *   size      — results per page (default 20, max 50)
 *   type      — ALL | MOVIES | TV_SERIES | ANIME | MUSIC | EDUCATION (default ALL)
 *   details   — "true" to enrich the first result with full subject details
 *   suggest   — "true" to include autocomplete suggestions alongside results
 *   multi     — "true" to run parallel search across MOVIES + TV_SERIES + ANIME
 *               and merge/deduplicate results
 *   resource  — "true" + id= to also fetch stream URLs for a specific subjectId
 *   play      — "true" + id= to also fetch play/MPD info for a specific subjectId
 *   id        — subjectId to fetch resource/play for (used with resource/play flags)
 *   season    — season number (used with resource/play, default 0)
 *   episode   — episode number (used with resource/play, default 0)
 */
router.get("/test-live", async (req, res) => {
  const {
    q,
    page,
    size,
    type,
    details,
    suggest,
    multi,
    resource,
    play,
    id,
    season,
    episode,
  } = req.query as Record<string, string | undefined>;

  if (!q || q.trim() === "") {
    res.status(400).json({
      success: false,
      error: "Required: ?q=<search query>",
      usage: {
        "?q=Avatar": "Basic search",
        "?q=Avatar&type=MOVIES": "Filter by type: ALL | MOVIES | TV_SERIES | ANIME | MUSIC | EDUCATION",
        "?q=Avatar&page=2&size=10": "Paginate results",
        "?q=Avatar&suggest=true": "Include autocomplete suggestions",
        "?q=Avatar&multi=true": "Parallel search across Movies + TV_SERIES + Anime, merged",
        "?q=Avatar&details=true": "Include full subject details for the first result",
        "?q=Avatar&id=<subjectId>&resource=true": "Also fetch stream/download URLs for that id",
        "?q=Avatar&id=<subjectId>&play=true": "Also fetch play/MPD info for that id",
        "?q=Avatar&id=<subjectId>&resource=true&season=1&episode=1": "Series episode resource",
      },
    });
    return;
  }

  const keyword = q.trim();
  const pg = page ? Math.max(1, parseInt(page, 10)) : 1;
  const ps = size ? Math.min(50, Math.max(1, parseInt(size, 10))) : 20;
  const useMulti = multi === "true";
  const wantSuggest = suggest === "true";
  const wantDetails = details === "true";
  const wantResource = resource === "true" && !!id;
  const wantPlay = play === "true" && !!id;
  const se = season ? parseInt(season, 10) : 0;
  const ep = episode ? parseInt(episode, 10) : 0;

  try {
    // ── 1. Search (parallel if multi=true) ────────────────────────────────────
    const searchPromise: Promise<{
      items: unknown[];
      pager: unknown;
      types?: string[];
    }> = useMulti
      ? (async () => {
          const [movies, series, anime] = await Promise.allSettled([
            searchContent(keyword, pg, Math.ceil(ps / 2), "MOVIES"),
            searchContent(keyword, pg, Math.ceil(ps / 2), "TV_SERIES"),
            searchContent(keyword, pg, Math.ceil(ps / 3), "ANIME"),
          ]);

          const allItems: unknown[] = [];
          const seenIds = new Set<string>();

          const addItems = (result: PromiseSettledResult<Awaited<ReturnType<typeof searchContent>>>) => {
            if (result.status === "fulfilled") {
              const list = result.value.items ?? result.value.list ?? [];
              for (const item of list) {
                const sid =
                  (item as Record<string, unknown>)?.subjectId as string ??
                  String((item as Record<string, unknown>)?.id ?? "");
                if (sid && !seenIds.has(sid)) {
                  seenIds.add(sid);
                  allItems.push(item);
                }
              }
            }
          };

          addItems(movies);
          addItems(series);
          addItems(anime);

          // Sort: items that match the keyword title more closely first
          allItems.sort((a, b) => {
            const ta = ((a as Record<string, unknown>)?.title as string ?? "").toLowerCase();
            const tb = ((b as Record<string, unknown>)?.title as string ?? "").toLowerCase();
            const kl = keyword.toLowerCase();
            const aExact = ta === kl ? 0 : ta.startsWith(kl) ? 1 : 2;
            const bExact = tb === kl ? 0 : tb.startsWith(kl) ? 1 : 2;
            return aExact - bExact;
          });

          return {
            items: allItems.slice(0, ps),
            pager: { page: pg, hasMore: allItems.length >= ps },
            types: ["MOVIES", "TV_SERIES", "ANIME"],
          };
        })()
      : (async () => {
          const r = await searchContent(keyword, pg, ps, type);
          return {
            items: r.items ?? r.list ?? [],
            pager: r.pager ?? {},
          };
        })();

    // ── 2. Suggestions (optional) ────────────────────────────────────────────
    const suggestPromise: Promise<unknown[]> = wantSuggest
      ? cache.getOrFetch(`suggest:${keyword}`, async () => {
          try {
            const s = await searchSuggest(keyword);
            if (s.length > 0) return s;
          } catch { /* fallback */ }
          const r = await searchContent(keyword, 1, 8);
          return r.items ?? r.list ?? [];
        }, TTL.TRENDING)
      : Promise.resolve([]);

    // ── 3. Resource fetch (optional) ─────────────────────────────────────────
    const resourcePromise = wantResource
      ? cache.getOrFetch(`resource:${id}:${se}:${ep}`, () => getResource(id!, se, ep), TTL.RESOURCE)
      : Promise.resolve(null);

    // ── 4. Play info (optional) ───────────────────────────────────────────────
    const playPromise = wantPlay
      ? cache.getOrFetch(`play:${id}:${se}:${ep}`, () => getPlayInfo(id!, se, ep), TTL.PLAY)
      : Promise.resolve(null);

    // ── 5. Run all in parallel ────────────────────────────────────────────────
    const [searchResult, suggestions, resourceData, playData] = await Promise.all([
      searchPromise,
      suggestPromise,
      resourcePromise,
      playPromise,
    ]);

    // ── 6. Details for first result (optional) ────────────────────────────────
    let firstDetails: unknown = null;
    if (wantDetails && searchResult.items.length > 0) {
      const firstItem = searchResult.items[0] as Record<string, unknown>;
      const firstId = (firstItem?.subjectId ?? String(firstItem?.id ?? "")) as string;
      if (firstId) {
        try {
          firstDetails = await cache.getOrFetch(
            `subject:${firstId}`,
            () => getSubjectById(firstId),
            TTL.SUBJECT,
          );
        } catch {
          // non-fatal
        }
      }
    }

    // ── 7. Enrich items with normalized shape ─────────────────────────────────
    const enriched = searchResult.items.map((item) => {
      const it = item as Record<string, unknown>;
      const coverUrl =
        (it.coverImageUrl as string) ??
        ((it.cover as Record<string, unknown>)?.url as string) ??
        null;
      return {
        subjectId: it.subjectId ?? it.id,
        title: it.title,
        type: it.subjectType === 1 ? "MOVIE" : it.subjectType === 2 ? "TV_SERIES" : it.subjectType === 7 ? "ANIME" : it.subjectType === 6 ? "MUSIC" : "OTHER",
        subjectType: it.subjectType,
        coverUrl,
        releaseDate: it.releaseDate,
        genre: it.genre,
        rating: it.imdbRatingValue,
        ratingCount: it.imdbRatingCount,
        country: it.countryName,
        season: it.season,
        duration: it.duration,
        corner: it.corner,
        description: it.description,
        detailPath: it.detailPath,
      };
    });

    // ── 8. Build response ─────────────────────────────────────────────────────
    const response: Record<string, unknown> = {
      success: true,
      query: keyword,
      page: pg,
      size: ps,
      type: type?.toUpperCase() ?? (useMulti ? "MULTI" : "ALL"),
      count: enriched.length,
      items: enriched,
      pager: searchResult.pager,
    };

    if (useMulti && searchResult.types) {
      response.searchedTypes = searchResult.types;
    }
    if (wantSuggest) {
      response.suggestions = suggestions;
      response.suggestionCount = (suggestions as unknown[]).length;
    }
    if (wantDetails && firstDetails !== null) {
      response.firstItemDetails = firstDetails;
    }
    if (wantResource && resourceData !== null) {
      const r = resourceData as Record<string, unknown>;
      response.resource = {
        id,
        season: se,
        episode: ep,
        streams: r?.list ?? r?.downloads ?? [],
        totalEpisode: r?.totalEpisode ?? 0,
        resolution: r?.resolution ?? null,
        raw: resourceData,
      };
    }
    if (wantPlay && playData !== null) {
      response.play = {
        id,
        season: se,
        episode: ep,
        raw: playData,
      };
    }

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/test-live/search
 * Dedicated enhanced search sub-route — same as /test-live but cleaner URL.
 */
router.get("/test-live/search", async (req, res) => {
  const { q, page, size, type } = req.query as Record<string, string | undefined>;

  if (!q || q.trim() === "") {
    res.status(400).json({ success: false, error: "Required: ?q=<query>" });
    return;
  }

  const keyword = q.trim();
  const pg = page ? Math.max(1, parseInt(page, 10)) : 1;
  const ps = size ? Math.min(50, Math.max(1, parseInt(size, 10))) : 20;

  try {
    const cacheKey = `tl-search:${keyword}:${pg}:${ps}:${type ?? "ALL"}`;
    const results = await cache.getOrFetch(
      cacheKey,
      () => searchContent(keyword, pg, ps, type),
      TTL.TRENDING,
    );
    const items = (results.items ?? results.list ?? []).map((it) => {
      const i = it as Record<string, unknown>;
      return {
        subjectId: i.subjectId ?? i.id,
        title: i.title,
        type: i.subjectType === 1 ? "MOVIE" : i.subjectType === 2 ? "TV_SERIES" : i.subjectType === 7 ? "ANIME" : "OTHER",
        subjectType: i.subjectType,
        coverUrl: (i.coverImageUrl as string) ?? ((i.cover as Record<string, unknown>)?.url as string) ?? null,
        releaseDate: i.releaseDate,
        genre: i.genre,
        rating: i.imdbRatingValue,
        country: i.countryName,
        detailPath: i.detailPath,
      };
    });
    res.json({ success: true, query: keyword, count: items.length, page: pg, size: ps, type: type?.toUpperCase() ?? "ALL", items, pager: results.pager });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/test-live/multi-search
 * Runs parallel search across MOVIES, TV_SERIES, and ANIME simultaneously,
 * then merges + deduplicates results.
 */
router.get("/test-live/multi-search", async (req, res) => {
  const { q, size } = req.query as Record<string, string | undefined>;

  if (!q || q.trim() === "") {
    res.status(400).json({ success: false, error: "Required: ?q=<query>" });
    return;
  }

  const keyword = q.trim();
  const ps = size ? Math.min(30, Math.max(1, parseInt(size, 10))) : 10;

  try {
    const [movies, series, anime] = await Promise.allSettled([
      searchContent(keyword, 1, ps, "MOVIES"),
      searchContent(keyword, 1, ps, "TV_SERIES"),
      searchContent(keyword, 1, ps, "ANIME"),
    ]);

    const normalize = (item: unknown, label: string) => {
      const i = item as Record<string, unknown>;
      return {
        subjectId: i.subjectId ?? i.id,
        title: i.title,
        type: label,
        subjectType: i.subjectType,
        coverUrl: (i.coverImageUrl as string) ?? ((i.cover as Record<string, unknown>)?.url as string) ?? null,
        releaseDate: i.releaseDate,
        genre: i.genre,
        rating: i.imdbRatingValue,
        country: i.countryName,
      };
    };

    const groups: Record<string, unknown[]> = {
      movies: movies.status === "fulfilled" ? (movies.value.items ?? movies.value.list ?? []).map((i) => normalize(i, "MOVIE")) : [],
      series: series.status === "fulfilled" ? (series.value.items ?? series.value.list ?? []).map((i) => normalize(i, "TV_SERIES")) : [],
      anime: anime.status === "fulfilled" ? (anime.value.items ?? anime.value.list ?? []).map((i) => normalize(i, "ANIME")) : [],
    };

    const errors: Record<string, string> = {};
    if (movies.status === "rejected") errors.movies = movies.reason?.message ?? "failed";
    if (series.status === "rejected") errors.series = series.reason?.message ?? "failed";
    if (anime.status === "rejected") errors.anime = anime.reason?.message ?? "failed";

    res.json({
      success: true,
      query: keyword,
      groups,
      counts: {
        movies: (groups.movies as unknown[]).length,
        series: (groups.series as unknown[]).length,
        anime: (groups.anime as unknown[]).length,
      },
      ...(Object.keys(errors).length > 0 ? { partialErrors: errors } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/test-live/suggest
 * Fast autocomplete + search suggestion combo.
 */
router.get("/test-live/suggest", async (req, res) => {
  const { q, limit } = req.query as Record<string, string | undefined>;

  if (!q || q.trim() === "") {
    res.status(400).json({ success: false, error: "Required: ?q=<partial query>" });
    return;
  }

  const keyword = q.trim();
  const lim = limit ? Math.min(20, Math.max(1, parseInt(limit, 10))) : 8;

  try {
    const cacheKey = `tl-suggest:${keyword}`;
    const suggestions = await cache.getOrFetch(cacheKey, async () => {
      // Try V2 suggest first, fall back to V3 search
      let items: unknown[] = [];
      try {
        items = await searchSuggest(keyword);
      } catch { /* ignore */ }
      if (items.length === 0) {
        const r = await searchContent(keyword, 1, lim);
        items = r.items ?? r.list ?? [];
      }
      return items;
    }, TTL.TRENDING);

    const normalized = (suggestions as unknown[]).slice(0, lim).map((it) => {
      const i = it as Record<string, unknown>;
      return {
        subjectId: i.subjectId ?? i.id,
        title: i.title,
        type: i.subjectType === 1 ? "MOVIE" : i.subjectType === 2 ? "TV_SERIES" : i.subjectType === 7 ? "ANIME" : "OTHER",
        coverUrl: (i.coverImageUrl as string) ?? ((i.cover as Record<string, unknown>)?.url as string) ?? null,
        releaseDate: i.releaseDate,
      };
    });

    res.json({ success: true, query: keyword, count: normalized.length, suggestions: normalized });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

/**
 * GET /api/test-live/item?id=<subjectId>
 * Full item details + stream URLs + season info in one call.
 */
router.get("/test-live/item", async (req, res) => {
  const { id, season, episode } = req.query as Record<string, string | undefined>;

  if (!id) {
    res.status(400).json({
      success: false,
      error: "Required: ?id=<subjectId>. Optional: ?season=1&episode=1",
    });
    return;
  }

  const se = season ? parseInt(season, 10) : 0;
  const ep = episode ? parseInt(episode, 10) : 0;

  try {
    const [subject, resource, playInfo] = await Promise.allSettled([
      cache.getOrFetch(`subject:${id}`, () => getSubjectById(id), TTL.SUBJECT),
      cache.getOrFetch(`resource:${id}:${se}:${ep}`, () => getResource(id, se, ep), TTL.RESOURCE),
      cache.getOrFetch(`play:${id}:${se}:${ep}`, () => getPlayInfo(id, se, ep), TTL.PLAY),
    ]);

    const subjectData = subject.status === "fulfilled" ? subject.value : null;
    const resourceData = resource.status === "fulfilled" ? resource.value : null;
    const playData = playInfo.status === "fulfilled" ? playInfo.value : null;

    const r = resourceData as Record<string, unknown> | null;

    // Determine if series and fetch season info
    const subjectObj = subjectData as Record<string, unknown> | null;
    let seasonData: unknown = null;
    const isSeries = subjectObj?.subjectType === 2 || (subjectObj?.seasons as number) > 1;
    if (isSeries && se > 0) {
      try {
        seasonData = await cache.getOrFetch(
          `season:${id}:${se}`,
          () => getSeasonInfo(id, se),
          TTL.SEASON,
        );
      } catch { /* non-fatal */ }
    }

    res.json({
      success: true,
      id,
      subject: subjectData,
      streams: r?.resourceDetectors ?? r?.list ?? r?.downloads ?? [],
      totalEpisode: r?.totalEpisode ?? 0,
      resolution: r?.resolution ?? null,
      play: playData,
      season: seasonData,
      errors: {
        subject: subject.status === "rejected" ? subject.reason?.message : null,
        resource: resource.status === "rejected" ? resource.reason?.message : null,
        play: playInfo.status === "rejected" ? playInfo.reason?.message : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ success: false, error: message });
  }
});

export default router;
