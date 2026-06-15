import type {
  SearchResult,
  SuggestResult,
  ItemDetail,
  HomepageResult,
  TrendingResult,
  NormalizedItem,
  FlatStream,
  StaffMember,
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

/** Proxy a CDN URL through our API server (video streams, subtitles, images) */
export function proxyStreamUrl(url: string): string {
  return `/api/proxy/stream?url=${encodeURIComponent(url)}`;
}

export function proxyImageUrl(url: string): string {
  if (!url) return "";
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export async function getItem(id: string, season = 0, episode = 0): Promise<ItemDetail> {
  const raw = await get<Record<string, unknown>>(`/test-live/item?id=${id}&season=${season}&episode=${episode}`);

  const subjectData = (raw.subject ?? {}) as Record<string, unknown>;
  const inner = (subjectData.subject ?? subjectData) as Record<string, unknown>;
  const cover = (inner.cover ?? subjectData.cover ?? {}) as Record<string, unknown>;

  const streams = (raw.streams ?? []) as FlatStream[];
  const bestStream = streams.length > 0 ? streams[0] : undefined;

  const subjectType = (inner.subjectType ?? subjectData.subjectType ?? 1) as number;
  const typeMap: Record<number, string> = { 1: "MOVIE", 2: "TV_SERIES", 5: "EDUCATION", 6: "MUSIC", 7: "ANIME" };
  const type = typeMap[subjectType] ?? "MOVIE";

  const seNum = (inner.seNum ?? subjectData.seNum ?? inner.season ?? 0) as number;
  const totalSeasons = (subjectData.seasons ?? inner.seasons ?? (seNum > 0 ? seNum : undefined)) as number | undefined;

  // Fix: correctly map avatarUrl → avatar, character → role
  const rawStaffList = (inner.staffList ?? subjectData.staffList ?? []) as Array<Record<string, unknown>>;
  const staffList: StaffMember[] = rawStaffList.map((s) => ({
    name: (s.name as string) ?? "Unknown",
    role: (s.character as string) ?? (s.role as string) ?? "",
    avatar: (s.avatarUrl as string) ?? (s.avatar as string) ?? "",
    staffType: s.staffType as number | undefined,
  }));

  // Tags
  const tagList = (inner.tagList ?? subjectData.tagList ?? []) as string[];

  return {
    success: true,
    subjectId: (inner.subjectId ?? subjectData.subjectId ?? id) as string,
    title: (inner.title ?? subjectData.title ?? "Unknown") as string,
    type,
    subjectType,
    coverUrl: ((inner.coverImageUrl ?? cover.url ?? subjectData.coverImageUrl ?? "") as string),
    releaseDate: (inner.releaseDate ?? subjectData.releaseDate) as string | undefined,
    genre: (inner.genre ?? subjectData.genre) as string | undefined,
    rating: (inner.imdbRatingValue ?? subjectData.imdbRatingValue) as string | undefined,
    ratingCount: (inner.imdbRatingCount ?? subjectData.imdbRatingCount) as string | undefined,
    country: (inner.countryName ?? subjectData.countryName) as string | undefined,
    language: (inner.language ?? subjectData.language ?? inner.languageName ?? subjectData.languageName) as string | undefined,
    duration: (inner.duration ?? subjectData.duration) as string | undefined,
    description: (inner.description ?? subjectData.description) as string | undefined,
    staffList: staffList.length > 0 ? staffList : undefined,
    streams,
    totalStreams: streams.length,
    bestStream,
    seNum: seNum > 0 ? seNum : undefined,
    totalSeasons,
    contentRating: (inner.contentRating ?? subjectData.contentRating) as string | undefined,
    corner: (inner.corner ?? subjectData.corner) as string | undefined,
    tagList: tagList.length > 0 ? tagList : undefined,
    errors: raw.errors as Record<string, string> | undefined,
  };
}

export async function getEpisodeResource(id: string, season = 0, episode = 0): Promise<{
  success: boolean;
  streams: FlatStream[];
}> {
  const raw = await get<{ success: boolean; data?: Record<string, unknown> }>(
    `/episode/resource?id=${id}&season=${season}&episode=${episode}`
  );
  const data = (raw.data ?? {}) as Record<string, unknown>;
  const streams = (data.list ?? data.resourceDetectors ?? data.downloads ?? []) as FlatStream[];
  return { success: raw.success, streams };
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

export function getPopularSearches(): Promise<{ success: boolean; data?: NormalizedItem[]; count?: number }> {
  return get("/popular-searches");
}

export function getSeriesDetails(id: string, season = 1) {
  return get<{ success: boolean; data?: unknown }>(`/series/details?id=${id}&season=${season}`);
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
