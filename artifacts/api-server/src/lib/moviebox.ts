/**
 * MovieBox API proxy client
 *
 * Implements three API layers found in the moviebox-api Python library:
 *  V1  https://h5.aoneroom.com          — account cookie, used for popular/search-rank
 *  V2  https://h5-api.aoneroom.com       — GET-only endpoints: homepage, suggest, details
 *  V3  https://api6.aoneroom.com         — signed POST/GET: search, subject, season, play
 */

import { createHash, createHmac } from "node:crypto";

// ─── V1 ───────────────────────────────────────────────────────────────────────

const V1_HOST = "h5.aoneroom.com";
const V1_BASE = `https://${V1_HOST}`;
const V1_HDR: Record<string, string> = {
  "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
  "Accept-Language": "en-US,en;q=0.5",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
  Referer: `https://${V1_HOST}/`,
  Host: V1_HOST,
};

// ─── V2 ───────────────────────────────────────────────────────────────────────

const V2_BASE = "https://h5-api.aoneroom.com";
const V2_HDR: Record<string, string> = {
  "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
  "Accept-Language": "en-US,en;q=0.5",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
  Referer: "https://videodownloader.site/",
};

// ─── V3 signing ───────────────────────────────────────────────────────────────

const V3_HOST_POOL = [
  "https://api6.aoneroom.com",
  "https://api5.aoneroom.com",
  "https://api4.aoneroom.com",
  "https://api4sg.aoneroom.com",
  "https://api3.aoneroom.com",
];

// Secret key (base64-encoded) from moviebox_api/v3/constants.py
const V3_SECRET_DEFAULT_B64 = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";

// Generated device info matching the Python library's _generate_client_info()
const V3_USER_AGENT =
  "com.community.oneroom/50020045 (Linux; U; Android 12; en_US; 22101316G; Build/S1B.220414.015; Cronet/135.0.7012.3)";

const V3_CLIENT_INFO = JSON.stringify({
  package_name: "com.community.oneroom",
  version_name: "3.0.03.0529.03",
  version_code: 50020045,
  os: "android",
  os_version: "12",
  install_ch: "ps",
  device_id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  install_store: "ps",
  gaid: "550e8400-e29b-41d4-a716-446655440000",
  brand: "Redmi",
  model: "22101316G",
  system_language: "en",
  net: "NETWORK_WIFI",
  region: "US",
  timezone: "America/New_York",
  sp_code: "40401",
  "X-Play-Mode": "2",
});

// Runtime auth token (updated from x-user response headers)
let _v3RuntimeToken: string | null = null;

function b64Decode(s: string): Buffer {
  const padding = (4 - (s.length % 4)) % 4;
  return Buffer.from(s + "=".repeat(padding), "base64");
}

function md5Hex(data: Buffer | string): string {
  return createHash("md5").update(data).digest("hex");
}

function generateXClientToken(tsMs?: number): string {
  const ts = String(tsMs ?? Date.now());
  const reversed = ts.split("").reverse().join("");
  return `${ts},${md5Hex(reversed)}`;
}

function sortedQueryString(url: string): string {
  try {
    const u = new URL(url);
    const keys = [...u.searchParams.keys()].sort();
    const parts: string[] = [];
    for (const k of keys) {
      for (const v of u.searchParams.getAll(k)) {
        parts.push(`${k}=${v}`);
      }
    }
    return parts.join("&");
  } catch {
    return "";
  }
}

function buildCanonicalString(
  method: string,
  accept: string,
  contentType: string,
  url: string,
  body: string | null,
  tsMs: number,
): string {
  let parsedPath = "";
  try {
    const u = new URL(url);
    parsedPath = u.pathname;
  } catch {
    parsedPath = url;
  }
  const query = sortedQueryString(url);
  const canonicalUrl = query ? `${parsedPath}?${query}` : parsedPath;

  const BODY_MAX = 8192;
  let bodyHash = "";
  let bodyLength = "";
  if (body !== null) {
    const bodyBytes = Buffer.from(body, "utf-8");
    const truncated = bodyBytes.subarray(0, BODY_MAX);
    bodyHash = md5Hex(truncated);
    bodyLength = String(bodyBytes.length);
  }

  return [
    method.toUpperCase(),
    accept,
    contentType,
    bodyLength,
    String(tsMs),
    bodyHash,
    canonicalUrl,
  ].join("\n");
}

function generateXTrSignature(
  method: string,
  accept: string,
  contentType: string,
  url: string,
  body: string | null,
  tsMs?: number,
): string {
  const ts = tsMs ?? Date.now();
  const canonical = buildCanonicalString(method, accept, contentType, url, body, ts);
  const keyBytes = b64Decode(V3_SECRET_DEFAULT_B64);
  const sig = createHmac("md5", keyBytes).update(canonical, "utf-8").digest("base64");
  return `${ts}|2|${sig}`;
}

function buildSignedHeaders(
  method: string,
  url: string,
  body: string | null = null,
  includePLayMode = false,
): Record<string, string> {
  const ts = Date.now();
  const accept = "application/json";
  const contentType = "application/json";
  const headers: Record<string, string> = {
    "User-Agent": V3_USER_AGENT,
    Accept: accept,
    "Content-Type": contentType,
    Connection: "keep-alive",
    "X-Client-Token": generateXClientToken(ts),
    "x-tr-signature": generateXTrSignature(method, accept, contentType, url, body, ts),
    "X-Client-Info": V3_CLIENT_INFO,
    "X-Client-Status": "0",
  };
  if (_v3RuntimeToken) headers["Authorization"] = `Bearer ${_v3RuntimeToken}`;
  if (includePLayMode) headers["X-Play-Mode"] = "2";
  return headers;
}

function absorbXUser(headers: Headers): void {
  const xUser = headers.get("x-user");
  if (!xUser) return;
  try {
    const payload = JSON.parse(xUser) as Record<string, unknown>;
    const token = payload["token"];
    if (typeof token === "string" && token) {
      _v3RuntimeToken = token;
    }
  } catch {
    // ignore
  }
}

// ─── Cookie cache (V1) ────────────────────────────────────────────────────────

let _v1Cookie = "";
let _v1CookieExpiry = 0;

async function getV1Cookie(): Promise<string> {
  if (_v1Cookie && Date.now() < _v1CookieExpiry) return _v1Cookie;
  const res = await fetch(
    `${V1_BASE}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`,
    { headers: V1_HDR, signal: AbortSignal.timeout(10_000) },
  );
  const setCookie = res.headers.get("set-cookie") ?? "";
  _v1Cookie = setCookie.split(";")[0]?.trim() ?? "";
  _v1CookieExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return _v1Cookie;
}

// ─── Generic fetch helpers ────────────────────────────────────────────────────

function extractData(json: unknown): unknown {
  if (json && typeof json === "object" && "data" in json) {
    return (json as Record<string, unknown>).data;
  }
  return json;
}

async function v1Get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const cookie = await getV1Cookie();
  const url = new URL(`${V1_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { ...V1_HDR, Cookie: cookie },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`V1 upstream ${res.status} on ${path}`);
  return extractData(await res.json());
}

async function v2Get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const url = new URL(`${V2_BASE}${path}`);
  url.searchParams.set("host", "moviebox.ph");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: V2_HDR,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`V2 upstream ${res.status} on ${path}: ${t.slice(0, 200)}`);
  }
  return extractData(await res.json());
}

async function v3Get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const lastError: Error[] = [];
  for (const base of V3_HOST_POOL) {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const urlStr = url.toString();
    const hdrs = buildSignedHeaders("GET", urlStr, null);
    try {
      const res = await fetch(urlStr, { headers: hdrs, signal: AbortSignal.timeout(15_000) });
      absorbXUser(res.headers);
      if (res.status >= 500 || res.status === 429 || res.status === 407 || res.status === 403) {
        lastError.push(new Error(`V3 ${res.status} on ${base}${path}`));
        continue;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`V3 upstream ${res.status} on ${path}: ${t.slice(0, 200)}`);
      }
      return extractData(await res.json());
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("V3 upstream")) throw e;
      lastError.push(e as Error);
    }
  }
  throw lastError[lastError.length - 1] ?? new Error("All V3 hosts failed");
}

async function v3Post(path: string, body: Record<string, unknown>): Promise<unknown> {
  const lastError: Error[] = [];
  const bodyStr = JSON.stringify(body);
  for (const base of V3_HOST_POOL) {
    const url = `${base}${path}`;
    const hdrs = buildSignedHeaders("POST", url, bodyStr);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: hdrs,
        body: bodyStr,
        signal: AbortSignal.timeout(15_000),
      });
      absorbXUser(res.headers);
      if (res.status >= 500 || res.status === 429 || res.status === 407 || res.status === 403) {
        lastError.push(new Error(`V3 ${res.status} on ${base}${path}`));
        continue;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`V3 upstream ${res.status} on ${path}: ${t.slice(0, 200)}`);
      }
      return extractData(await res.json());
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("V3 upstream")) throw e;
      lastError.push(e as Error);
    }
  }
  throw lastError[lastError.length - 1] ?? new Error("All V3 hosts failed");
}

// ─── Subject types (matches Python SubjectType) ───────────────────────────────

export const SubjectType = {
  ALL: 0,
  MOVIES: 1,
  TV_SERIES: 2,
  EDUCATION: 5,
  MUSIC: 6,
  ANIME: 7,
} as const;
export type SubjectTypeKey = keyof typeof SubjectType;

export function subjectTypeValue(type?: string): number {
  if (!type) return SubjectType.ALL;
  const key = type.toUpperCase() as SubjectTypeKey;
  return SubjectType[key] ?? SubjectType.ALL;
}

// ─── Data types ───────────────────────────────────────────────────────────────

export interface MbContentItem {
  subjectId?: string;
  id?: string | number;
  title?: string;
  subjectType?: number;
  detailPath?: string;
  coverImageUrl?: string;
  cover?: { url?: string; width?: number; height?: number };
  releaseDate?: string;
  duration?: number;
  genre?: string;
  imdbRatingValue?: string;
  imdbRatingCount?: number;
  countryName?: string;
  season?: number;
  corner?: string;
  description?: string;
  [key: string]: unknown;
}

export interface MbSearchResults {
  items?: MbContentItem[];
  list?: MbContentItem[];
  pager?: {
    page?: number | string;
    perPage?: number;
    hasMore?: boolean;
    has_more?: boolean;
    nextPage?: number | string;
    next_page?: number | string;
    totalCount?: number;
    total?: number;
  };
  [key: string]: unknown;
}

export interface MbDetailResult {
  subjectId?: string;
  subject?: MbContentItem;
  title?: string;
  description?: string;
  genre?: string;
  releaseDate?: string;
  imdbRatingValue?: string;
  seasons?: number;
  episodes?: number;
  resource?: {
    downloads?: Array<{
      url?: string;
      resolution?: string;
      size?: number;
      format?: string;
      quality?: string;
    }>;
    captions?: Array<{
      url?: string;
      language?: string;
      delay?: number;
      format?: string;
    }>;
  };
  metadata?: Record<string, unknown>;
  postList?: MbContentItem[];
  [key: string]: unknown;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Homepage (banners, category rows) — V2 GET */
export async function getHomepage(): Promise<unknown> {
  return v2Get("/wefeed-h5api-bff/home");
}

/** Trending / homepage tabs — V3 GET (signed) */
export async function getMainPage(page = 1, tabId = 0): Promise<unknown> {
  return v3Get("/wefeed-mobile-bff/tab-operating", { page, tabId, version: "" });
}

/**
 * Search content — V3 POST (signed)
 * type: ALL | MOVIES | TV_SERIES | ANIME | MUSIC | EDUCATION
 */
export async function searchContent(
  keyword: string,
  page = 1,
  perPage = 20,
  type?: string,
): Promise<MbSearchResults> {
  const subjectType = subjectTypeValue(type);
  const data = await v3Post("/wefeed-mobile-bff/subject-api/search", {
    keyword,
    page,
    perPage,
    subjectType,
  });
  return data as MbSearchResults;
}

/** Autocomplete search suggestions — V2 GET */
export async function searchSuggest(keyword: string): Promise<MbContentItem[]> {
  const data = await v2Get("/wefeed-h5api-bff/subject/search-suggest", { keyword });
  if (Array.isArray(data)) return data as MbContentItem[];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.list)) return d.list as MbContentItem[];
  if (Array.isArray(d.items)) return d.items as MbContentItem[];
  return [];
}

/** Item details by subjectId — V3 GET (signed) */
export async function getSubjectById(subjectId: string): Promise<MbDetailResult> {
  const data = await v3Get("/wefeed-mobile-bff/subject-api/get", { subjectId });
  return data as MbDetailResult;
}

/** Season info (episode list) by subjectId — V3 GET (signed) */
export async function getSeasonInfo(subjectId: string, season?: number): Promise<unknown> {
  const params: Record<string, string | number> = { subjectId };
  if (season !== undefined) params.seNum = season;
  return v3Get("/wefeed-mobile-bff/subject-api/season-info", params);
}

/** Play/stream info for a specific episode — V3 GET (signed) */
export async function getPlayInfo(
  subjectId: string,
  season = 0,
  episode = 0,
): Promise<unknown> {
  return v3Get("/wefeed-mobile-bff/subject-api/play-info", {
    subjectId,
    se: season,
    ep: episode,
  });
}

/** Download resource URLs for a specific episode — V3 GET (signed) */
export async function getResource(
  subjectId: string,
  season = 0,
  episode = 0,
): Promise<unknown> {
  return v3Get("/wefeed-mobile-bff/subject-api/resource", {
    subjectId,
    se: season,
    ep: episode,
  });
}

/**
 * Full details for any item by detailPath — V2 GET
 * Use this when you have a detailPath from an older V2 result
 */
export async function getDetailsByPath(detailPath: string): Promise<MbDetailResult> {
  const data = await v2Get("/wefeed-h5api-bff/detail", { detailPath });
  return data as MbDetailResult;
}

/** Hot ranked content — V1 GET */
export async function getHotContent(): Promise<unknown> {
  try {
    return await v1Get("/wefeed-h5-bff/web/subject/search-rank");
  } catch {
    return {};
  }
}

/** Popular searches — V1 GET */
export async function getPopularSearches(): Promise<MbContentItem[]> {
  try {
    const data = await v1Get("/wefeed-h5-bff/web/subject/everyone-search");
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.everyoneSearch)) return d.everyoneSearch as MbContentItem[];
    if (Array.isArray(data)) return data as MbContentItem[];
    return [];
  } catch {
    return [];
  }
}
