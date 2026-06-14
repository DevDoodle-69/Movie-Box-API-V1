import type {
  SearchResult,
  SuggestResult,
  ItemDetail,
  HomepageResult,
  TrendingResult,
  NormalizedItem,
} from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function search(q: string, page = 1, size = 20, type = "ALL"): Promise<SearchResult> {
  return get<SearchResult>(`/test-live?q=${encodeURIComponent(q)}&page=${page}&size=${size}&type=${type}&multi=false`);
}

export function multiSearch(q: string, size = 15): Promise<{ success: boolean; items: NormalizedItem[]; searchedTypes: string[]; count: number }> {
  return get(`/test-live?q=${encodeURIComponent(q)}&multi=true&suggest=false&size=${size}`);
}

export function suggest(q: string, limit = 8): Promise<SuggestResult> {
  return get<SuggestResult>(`/test-live/suggest?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export function getItem(id: string, season = 0, episode = 0): Promise<ItemDetail> {
  return get<ItemDetail>(`/test-live/item?id=${id}&season=${season}&episode=${episode}`);
}

export function getHomepage(): Promise<HomepageResult> {
  return get<HomepageResult>("/homepage");
}

export function getTrending(page = 1, tab = 0): Promise<TrendingResult> {
  return get<TrendingResult>(`/trending?page=${page}&tab=${tab}`);
}

export function getHot(): Promise<{ success: boolean; data?: { items?: unknown[] }; items?: unknown[] }> {
  return get("/hot");
}

export function getEpisodeResource(id: string, season = 0, episode = 0) {
  return get<{ success: boolean; data?: { resourceDetectors?: unknown[] }; resourceDetectors?: unknown[] }>(
    `/episode/resource?id=${id}&season=${season}&episode=${episode}`
  );
}

export function getSeriesDetails(id: string, season = 1) {
  return get<{ success: boolean; data?: unknown }>(`/series/details?id=${id}&season=${season}`);
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function typeLabel(subjectType: number): string {
  const map: Record<number, string> = {
    1: "MOVIE",
    2: "TV_SERIES",
    5: "EDUCATION",
    6: "MUSIC",
    7: "ANIME",
  };
  return map[subjectType] ?? "MOVIE";
}

export function typeColor(type: string): string {
  const map: Record<string, string> = {
    MOVIE: "#e50914",
    TV_SERIES: "#0090d0",
    ANIME: "#9b59b6",
    MUSIC: "#27ae60",
    EDUCATION: "#f39c12",
  };
  return map[type] ?? "#e50914";
}
