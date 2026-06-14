import { useState, useCallback, useRef, useEffect } from "react";
import { Router as WouterRouter, Switch, Route } from "wouter";

const BASE_URL_KEY = "mb_base_url";

function getDefaultBase() {
  const saved = localStorage.getItem(BASE_URL_KEY);
  if (saved) return saved;
  const origin = window.location.origin;
  return `${origin}/api`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Param {
  name: string;
  in: "query" | "path";
  required: boolean;
  type: string;
  description: string;
  example?: string;
}

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  params: Param[];
  examplePath: string;
  note?: string;
}

interface Group {
  id: string;
  label: string;
  icon: string;
  endpoints: Endpoint[];
}

// ─── API Spec ─────────────────────────────────────────────────────────────────

const API_GROUPS: Group[] = [
  {
    id: "system",
    label: "System",
    icon: "⚡",
    endpoints: [
      {
        method: "GET",
        path: "/healthz",
        summary: "Health Check",
        description: "Returns server health status. Use this to verify the API is reachable and responding.",
        params: [],
        examplePath: "/healthz",
      },
      {
        method: "GET",
        path: "/",
        summary: "API Documentation",
        description: "Returns full JSON documentation with all endpoints, workflow steps, and content type codes.",
        params: [],
        examplePath: "/",
      },
    ],
  },
  {
    id: "browse",
    label: "Browse",
    icon: "🏠",
    endpoints: [
      {
        method: "GET",
        path: "/homepage",
        summary: "Homepage",
        description: "Fetches the full homepage with featured banners and category content rows. Powered by V2 upstream. Cached for 10 minutes.",
        params: [],
        examplePath: "/homepage",
      },
      {
        method: "GET",
        path: "/trending",
        summary: "Trending Content",
        description: "Trending content via V3 signed request with tab support. Tab 0 = all, 1 = movies, 2 = series. Cached for 5 minutes.",
        params: [
          { name: "page", in: "query", required: false, type: "integer", description: "Page number", example: "1" },
          { name: "tab", in: "query", required: false, type: "integer", description: "Tab: 0=All 1=Movies 2=Series", example: "0" },
        ],
        examplePath: "/trending?page=1&tab=0",
      },
      {
        method: "GET",
        path: "/trending/movies",
        summary: "Trending Movies",
        description: "Shortcut for trending with tab=1 (movies only). Cached for 5 minutes.",
        params: [],
        examplePath: "/trending/movies",
      },
      {
        method: "GET",
        path: "/trending/series",
        summary: "Trending Series",
        description: "Shortcut for trending with tab=2 (series only). Cached for 5 minutes.",
        params: [],
        examplePath: "/trending/series",
      },
      {
        method: "GET",
        path: "/hot",
        summary: "Hot / Ranked",
        description: "Hot and ranked content from V1 (cookie-auth endpoint). Cached for 10 minutes.",
        params: [],
        examplePath: "/hot",
      },
      {
        method: "GET",
        path: "/popular-searches",
        summary: "Popular Searches",
        description: "Returns popular/trending search terms. Cached for 15 minutes.",
        params: [],
        examplePath: "/popular-searches",
      },
    ],
  },
  {
    id: "search",
    label: "Search",
    icon: "🔍",
    endpoints: [
      {
        method: "GET",
        path: "/search",
        summary: "Search Content",
        description: "Full-text search across movies, series, anime, music, and education content. Uses V3 HMAC-MD5 signed request internally. Returns paginated results with cover images, ratings, stream availability.",
        params: [
          { name: "q", in: "query", required: true, type: "string", description: "Search query", example: "Avatar" },
          { name: "page", in: "query", required: false, type: "integer", description: "Page number (default: 1)", example: "1" },
          { name: "size", in: "query", required: false, type: "integer", description: "Results per page (default: 20, max: 50)", example: "20" },
          { name: "type", in: "query", required: false, type: "string", description: "Content filter: ALL | MOVIES | TV_SERIES | ANIME | MUSIC | EDUCATION", example: "MOVIES" },
        ],
        examplePath: "/search?q=Avatar&size=5&type=MOVIES",
      },
      {
        method: "GET",
        path: "/search/suggest",
        summary: "Search Suggestions",
        description: "Autocomplete/suggest endpoint. Returns up to 8 results. Falls back to a fast V3 search if the V2 suggest endpoint is unavailable.",
        params: [
          { name: "q", in: "query", required: true, type: "string", description: "Partial search query", example: "Av" },
        ],
        examplePath: "/search/suggest?q=Av",
      },
    ],
  },
  {
    id: "movies",
    label: "Movies",
    icon: "🎬",
    endpoints: [
      {
        method: "GET",
        path: "/movie/details",
        summary: "Movie Details",
        description: "Full movie info combined with resource/stream URLs. Returns subject info + list of available resolutions with direct CDN download links. Use a subjectId from /search results.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId from search results", example: "8906247916759695608" },
        ],
        examplePath: "/movie/details?id=8906247916759695608",
        note: "Avatar (2009) — subjectId: 8906247916759695608",
      },
      {
        method: "GET",
        path: "/episode/resource",
        summary: "Stream / Download URLs",
        description: "All available download and stream URLs for a movie or episode. Returns multiple resolutions (360p→1080p), codec info, file sizes, and subtitle links.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId", example: "8906247916759695608" },
          { name: "season", in: "query", required: false, type: "integer", description: "Season number (0 for movies)", example: "0" },
          { name: "episode", in: "query", required: false, type: "integer", description: "Episode number (0 for movies)", example: "0" },
        ],
        examplePath: "/episode/resource?id=8906247916759695608",
      },
      {
        method: "GET",
        path: "/episode/play",
        summary: "Play Info (MPD / HLS)",
        description: "Streaming play info including MPD manifest and HLS URL. Used for adaptive streaming playback. Returns title + available stream qualities.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId", example: "8906247916759695608" },
          { name: "season", in: "query", required: false, type: "integer", description: "Season number (0 for movies)", example: "0" },
          { name: "episode", in: "query", required: false, type: "integer", description: "Episode number (0 for movies)", example: "0" },
        ],
        examplePath: "/episode/play?id=8906247916759695608",
      },
    ],
  },
  {
    id: "series",
    label: "Series",
    icon: "📺",
    endpoints: [
      {
        method: "GET",
        path: "/series/details",
        summary: "Series Details",
        description: "Full series info with episode list for a given season. Combines V3 subject detail + season episode data into a single response.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId from search results", example: "6207982430134357800" },
          { name: "season", in: "query", required: false, type: "integer", description: "Season number (default: 1)", example: "1" },
        ],
        examplePath: "/series/details?id=6207982430134357800&season=1",
        note: "Breaking Bad — subjectId: 6207982430134357800",
      },
      {
        method: "GET",
        path: "/season",
        summary: "Season Info",
        description: "Season metadata and full episode list for any season. Returns season count, episode count, and episode details.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId", example: "6207982430134357800" },
          { name: "season", in: "query", required: false, type: "integer", description: "Season number", example: "1" },
        ],
        examplePath: "/season?id=6207982430134357800&season=1",
      },
      {
        method: "GET",
        path: "/episode/resource",
        summary: "Episode Stream URLs",
        description: "Stream and download URLs for a specific episode. Pass season and episode numbers.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId", example: "6207982430134357800" },
          { name: "season", in: "query", required: true, type: "integer", description: "Season number", example: "1" },
          { name: "episode", in: "query", required: true, type: "integer", description: "Episode number", example: "1" },
        ],
        examplePath: "/episode/resource?id=6207982430134357800&season=1&episode=1",
      },
      {
        method: "GET",
        path: "/episode/play",
        summary: "Episode Play Info",
        description: "Streaming play info for a specific series episode.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId", example: "6207982430134357800" },
          { name: "season", in: "query", required: true, type: "integer", description: "Season number", example: "1" },
          { name: "episode", in: "query", required: true, type: "integer", description: "Episode number", example: "1" },
        ],
        examplePath: "/episode/play?id=6207982430134357800&season=1&episode=1",
      },
    ],
  },
  {
    id: "details",
    label: "Details",
    icon: "📋",
    endpoints: [
      {
        method: "GET",
        path: "/details",
        summary: "Raw Details",
        description: "Fetch raw V3 subject details by subjectId, or V2 details by detailPath. Use when you need the raw upstream response without any normalization.",
        params: [
          { name: "id", in: "query", required: false, type: "string", description: "subjectId (use this or ?path)", example: "8906247916759695608" },
          { name: "path", in: "query", required: false, type: "string", description: "detailPath from V2 search results", example: "" },
        ],
        examplePath: "/details?id=8906247916759695608",
      },
    ],
  },
  {
    id: "test-live",
    label: "Test Live",
    icon: "🧪",
    endpoints: [
      {
        method: "GET",
        path: "/test-live",
        summary: "All-in-One Search",
        description: "Powerful combined endpoint: search + optional suggestions, multi-type parallel search, first-result details enrichment, resource fetch, and play info — all in a single request. Returns normalized items with coverUrl, type label, rating, genre, country.",
        params: [
          { name: "q", in: "query", required: true, type: "string", description: "Search query", example: "Avatar" },
          { name: "page", in: "query", required: false, type: "integer", description: "Page number (default: 1)", example: "1" },
          { name: "size", in: "query", required: false, type: "integer", description: "Results per page (default: 20, max: 50)", example: "10" },
          { name: "type", in: "query", required: false, type: "string", description: "Content filter: ALL | MOVIES | TV_SERIES | ANIME | MUSIC | EDUCATION", example: "MOVIES" },
          { name: "multi", in: "query", required: false, type: "boolean", description: "true = parallel search across MOVIES + TV_SERIES + ANIME, merged & deduplicated", example: "true" },
          { name: "suggest", in: "query", required: false, type: "boolean", description: "true = include autocomplete suggestions alongside results", example: "true" },
          { name: "details", in: "query", required: false, type: "boolean", description: "true = include full subject details for the first result", example: "true" },
          { name: "id", in: "query", required: false, type: "string", description: "subjectId to also fetch resource/play info for", example: "8906247916759695608" },
          { name: "resource", in: "query", required: false, type: "boolean", description: "true + id= → fetch stream/download URLs", example: "true" },
          { name: "play", in: "query", required: false, type: "boolean", description: "true + id= → fetch MPD/HLS play info", example: "true" },
          { name: "season", in: "query", required: false, type: "integer", description: "Season number (used with resource/play, default 0)", example: "0" },
          { name: "episode", in: "query", required: false, type: "integer", description: "Episode number (used with resource/play, default 0)", example: "0" },
        ],
        examplePath: "/test-live?q=Avatar&multi=true&suggest=true&size=5",
        note: "Combines search + suggestions + multi-type + resource in one call",
      },
      {
        method: "GET",
        path: "/test-live/search",
        summary: "Enhanced Search",
        description: "Dedicated search sub-route with normalized output: subjectId, title, type label, coverUrl, releaseDate, genre, rating, country. Results are cached for speed.",
        params: [
          { name: "q", in: "query", required: true, type: "string", description: "Search query", example: "Breaking Bad" },
          { name: "page", in: "query", required: false, type: "integer", description: "Page number", example: "1" },
          { name: "size", in: "query", required: false, type: "integer", description: "Results per page (max 50)", example: "20" },
          { name: "type", in: "query", required: false, type: "string", description: "Content filter: ALL | MOVIES | TV_SERIES | ANIME | MUSIC | EDUCATION", example: "TV_SERIES" },
        ],
        examplePath: "/test-live/search?q=Breaking+Bad&type=TV_SERIES&size=5",
      },
      {
        method: "GET",
        path: "/test-live/multi-search",
        summary: "Multi-Type Search",
        description: "Runs parallel search across MOVIES, TV_SERIES, and ANIME simultaneously. Returns grouped results with per-type counts. Partial errors (one type failing) don't fail the whole response.",
        params: [
          { name: "q", in: "query", required: true, type: "string", description: "Search query", example: "Naruto" },
          { name: "size", in: "query", required: false, type: "integer", description: "Results per type (max 30, default 10)", example: "10" },
        ],
        examplePath: "/test-live/multi-search?q=Naruto&size=5",
      },
      {
        method: "GET",
        path: "/test-live/suggest",
        summary: "Fast Suggest",
        description: "Autocomplete suggestion combo: tries V2 suggest first, falls back to V3 search. Returns normalized suggestions with coverUrl and type label.",
        params: [
          { name: "q", in: "query", required: true, type: "string", description: "Partial query", example: "Av" },
          { name: "limit", in: "query", required: false, type: "integer", description: "Max suggestions (default 8, max 20)", example: "8" },
        ],
        examplePath: "/test-live/suggest?q=Av&limit=8",
      },
      {
        method: "GET",
        path: "/test-live/item",
        summary: "Full Item Info",
        description: "Fetches subject details + stream URLs + play info in a single parallel call. Returns streams list, totalEpisode, resolution, play info, and season data (for series). Partial failures are reported in the errors field.",
        params: [
          { name: "id", in: "query", required: true, type: "string", description: "subjectId from search results", example: "8906247916759695608" },
          { name: "season", in: "query", required: false, type: "integer", description: "Season number (0 for movies)", example: "0" },
          { name: "episode", in: "query", required: false, type: "integer", description: "Episode number (0 for movies)", example: "0" },
        ],
        examplePath: "/test-live/item?id=8906247916759695608",
        note: "Avatar (2009) — subjectId: 8906247916759695608",
      },
    ],
  },
];

// ─── JSON Syntax Highlighter ──────────────────────────────────────────────────

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          if (/:$/.test(match)) cls = "json-key";
          else cls = "json-string";
        } else if (/true|false/.test(match)) cls = "json-bool";
        else if (/null/.test(match)) cls = "json-null";
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

// ─── Components ───────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const cls = `method-${method.toLowerCase()}`;
  return (
    <span className={`${cls} text-xs font-bold px-2 py-0.5 rounded font-mono tracking-wide`}>
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/5"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

interface TryItResult {
  status: number;
  time: number;
  data: unknown;
  error?: string;
}

function EndpointCard({ ep, baseUrl }: { ep: Endpoint; baseUrl: string }) {
  const [expanded, setExpanded] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ep.params.map((p) => [p.name, p.example ?? ""])),
  );
  const [result, setResult] = useState<TryItResult | null>(null);
  const [loading, setLoading] = useState(false);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    for (const p of ep.params) {
      const val = paramValues[p.name];
      if (val) params.set(p.name, val);
    }
    const qs = params.toString();
    return `${baseUrl}${ep.path}${qs ? "?" + qs : ""}`;
  }, [baseUrl, ep, paramValues]);

  const curlCmd = `curl "${buildUrl()}"`;

  const tryIt = async () => {
    setLoading(true);
    setResult(null);
    const start = performance.now();
    try {
      const res = await fetch(buildUrl());
      const time = Math.round(performance.now() - start);
      const data = await res.json();
      setResult({ status: res.status, time, data });
    } catch (e) {
      const time = Math.round(performance.now() - start);
      setResult({ status: 0, time, data: null, error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const statusClass =
    result && result.status >= 200 && result.status < 300
      ? "status-2xx"
      : result && result.status >= 400 && result.status < 500
        ? "status-4xx"
        : "status-5xx";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <MethodBadge method={ep.method} />
        <code className="text-sm text-foreground font-mono flex-1">{ep.path}</code>
        <span className="text-sm text-muted-foreground hidden sm:block">{ep.summary}</span>
        <span className="text-muted-foreground text-xs ml-2">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-5">
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">{ep.description}</p>

          {ep.note && (
            <div className="text-xs text-accent bg-accent/10 border border-accent/20 rounded px-3 py-2">
              💡 {ep.note}
            </div>
          )}

          {/* Parameters */}
          {ep.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Parameters</h4>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Type</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium hidden md:table-cell">Required</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Description</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ep.params.map((p) => (
                      <tr key={p.name} className="border-t border-border">
                        <td className="px-3 py-2">
                          <code className="text-xs text-primary">{p.name}</code>
                        </td>
                        <td className="px-3 py-2">
                          <code className="text-xs text-muted-foreground">{p.type}</code>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <span className={`text-xs ${p.required ? "text-red-400" : "text-muted-foreground"}`}>
                            {p.required ? "required" : "optional"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.description}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={paramValues[p.name] ?? ""}
                            onChange={(e) =>
                              setParamValues((v) => ({ ...v, [p.name]: e.target.value }))
                            }
                            placeholder={p.example ?? ""}
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 min-w-[80px]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request URL */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request</h4>
            <div className="bg-[#0d1117] rounded border border-border p-3 flex items-start gap-2">
              <pre className="text-xs font-mono text-muted-foreground flex-1 overflow-x-auto whitespace-pre-wrap break-all">
                <span className="text-primary">{ep.method}</span>{" "}
                {buildUrl()}
              </pre>
              <CopyButton text={curlCmd} />
            </div>
          </div>

          {/* Curl */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">curl</h4>
            <div className="bg-[#0d1117] rounded border border-border p-3 flex items-start gap-2">
              <pre className="text-xs font-mono text-green-400/80 flex-1 overflow-x-auto whitespace-pre-wrap break-all">
                {curlCmd}
              </pre>
              <CopyButton text={curlCmd} />
            </div>
          </div>

          {/* Try It Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={tryIt}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary border border-primary/30 rounded text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>▶ Try It</>
              )}
            </button>
            {result && (
              <span className={`text-xs font-mono ${statusClass}`}>
                HTTP {result.status} · {result.time}ms
              </span>
            )}
          </div>

          {/* Response */}
          {result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</h4>
                {result.data && (
                  <CopyButton text={JSON.stringify(result.data, null, 2)} />
                )}
              </div>
              <div className="bg-[#0d1117] rounded border border-border p-3 max-h-96 overflow-auto">
                {result.error ? (
                  <pre className="text-xs text-red-400 font-mono">{result.error}</pre>
                ) : (
                  <pre
                    className="text-xs font-mono leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: syntaxHighlight(JSON.stringify(result.data, null, 2)),
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {API_GROUPS.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm text-left transition-colors ${
            active === g.id
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
          }`}
        >
          <span>{g.icon}</span>
          <span>{g.label}</span>
          <span className="ml-auto text-xs opacity-50">{g.endpoints.length}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  baseUrl,
  onBaseUrl,
}: {
  baseUrl: string;
  onBaseUrl: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(baseUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    const clean = draft.replace(/\/$/, "");
    onBaseUrl(clean);
    localStorage.setItem(BASE_URL_KEY, clean);
    setEditing(false);
  };

  return (
    <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎬</span>
        <span className="font-semibold text-sm text-foreground">MovieBox API</span>
        <span className="text-xs text-muted-foreground/50 font-mono">v1</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:block">Base URL:</span>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex items-center gap-1"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              className="bg-background border border-primary/50 rounded px-2 py-1 text-xs font-mono text-foreground w-64 focus:outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setDraft(baseUrl);
              setEditing(true);
            }}
            className="text-xs font-mono text-muted-foreground hover:text-primary bg-muted/50 hover:bg-muted px-2 py-1 rounded transition-colors max-w-xs truncate"
          >
            {baseUrl}
          </button>
        )}
      </div>
    </header>
  );
}

// ─── Content Type Table ───────────────────────────────────────────────────────

function ContentTypes() {
  const types = [
    { code: 0, key: "ALL", desc: "All content types" },
    { code: 1, key: "MOVIES", desc: "Movies only" },
    { code: 2, key: "TV_SERIES", desc: "TV series / shows" },
    { code: 5, key: "EDUCATION", desc: "Educational content" },
    { code: 6, key: "MUSIC", desc: "Music videos" },
    { code: 7, key: "ANIME", desc: "Anime" },
  ];
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Code</th>
            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Key</th>
            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.code} className="border-t border-border">
              <td className="px-3 py-2">
                <code className="text-xs text-yellow-400">{t.code}</code>
              </td>
              <td className="px-3 py-2">
                <code className="text-xs text-primary">{t.key}</code>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{t.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Workflow Steps ───────────────────────────────────────────────────────────

function WorkflowSteps({ baseUrl }: { baseUrl: string }) {
  const steps = [
    { n: 1, title: "Search for content", cmd: `${baseUrl}/search?q=Avatar&size=5` },
    { n: 2, title: "Pick a result — note its subjectId", cmd: `// subjectId from result: "8906247916759695608"` },
    { n: 3, title: "Get movie streams", cmd: `${baseUrl}/episode/resource?id=8906247916759695608` },
    { n: 4, title: "Get adaptive play info (MPD/HLS)", cmd: `${baseUrl}/episode/play?id=8906247916759695608` },
    { n: 5, title: "Series: get season episode list", cmd: `${baseUrl}/series/details?id=6207982430134357800&season=1` },
    { n: 6, title: "Series: get episode streams", cmd: `${baseUrl}/episode/resource?id=6207982430134357800&season=1&episode=1` },
  ];

  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.n} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
            {s.n}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground mb-1">{s.title}</div>
            <div className="flex items-start gap-2 bg-[#0d1117] border border-border rounded p-2">
              <pre className="text-xs font-mono text-muted-foreground flex-1 overflow-x-auto whitespace-pre-wrap break-all">
                {s.cmd}
              </pre>
              {!s.cmd.startsWith("//") && <CopyButton text={`curl "${s.cmd}"`} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection({ group, baseUrl }: { group: Group; baseUrl: string }) {
  return (
    <div id={`section-${group.id}`} className="scroll-mt-16">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{group.icon}</span>
        <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {group.endpoints.map((ep, i) => (
          <EndpointCard key={`${ep.path}-${i}`} ep={ep} baseUrl={baseUrl} />
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function DocsPage() {
  const [baseUrl, setBaseUrl] = useState(getDefaultBase);
  const [activeGroup, setActiveGroup] = useState("browse");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollTo = (id: string) => {
    setActiveGroup(id);
    setMobileNavOpen(false);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header baseUrl={baseUrl} onBaseUrl={setBaseUrl} />

      {/* Mobile nav toggle */}
      <div className="sm:hidden border-b border-border px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ☰ Sections
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            ${mobileNavOpen ? "block" : "hidden"} sm:block
            w-full sm:w-52 flex-shrink-0
            bg-[hsl(var(--sidebar,222_30%_6%))]
            border-r border-border
            p-3 space-y-1
            sm:sticky sm:top-[53px] sm:h-[calc(100vh-53px)] sm:overflow-y-auto
            absolute sm:relative z-10 top-[93px] sm:top-auto
          `}
        >
          <Sidebar active={activeGroup} onSelect={scrollTo} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-12">

            {/* Hero */}
            <div className="text-center space-y-3 py-4">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs text-primary font-medium mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live API
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                MovieBox API Docs
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
                Full-featured REST proxy for movies, series, anime, and more. Search content,
                browse trending, and get direct stream URLs — all via clean JSON endpoints.
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {["V3 HMAC-MD5 Signed", "Host Pool Fallback", "Response Caching", "CORS Enabled"].map((badge) => (
                  <span key={badge} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Upstream table */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                🔗 Upstream API Layers
              </h2>
              <div className="border border-border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Layer</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Base URL</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Auth</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium hidden md:table-cell">Used For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { layer: "V1", url: "h5.aoneroom.com", auth: "account cookie", use: "Hot content, popular searches" },
                      { layer: "V2", url: "h5-api.aoneroom.com", auth: "none", use: "Homepage, suggest, detailPath" },
                      { layer: "V3", url: "api6.aoneroom.com", auth: "HMAC-MD5 signed", use: "Search, subjects, seasons, play, resources" },
                    ].map((r) => (
                      <tr key={r.layer} className="border-t border-border">
                        <td className="px-3 py-2"><code className="text-xs text-yellow-400">{r.layer}</code></td>
                        <td className="px-3 py-2"><code className="text-xs text-blue-400">{r.url}</code></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.auth}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">{r.use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Workflow */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                🗺️ Typical Workflow
              </h2>
              <WorkflowSteps baseUrl={baseUrl} />
            </div>

            {/* Content Types */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                🏷️ Content Type Codes
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Use these as the <code className="text-primary text-xs">type</code> parameter in search requests.
              </p>
              <ContentTypes />
            </div>

            {/* API Reference */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-6 flex items-center gap-2">
                📖 API Reference
              </h2>
              <div className="space-y-10">
                {API_GROUPS.map((group) => (
                  <GroupSection key={group.id} group={group} baseUrl={baseUrl} />
                ))}
              </div>
            </div>

            {/* Footer */}
            <footer className="text-center text-xs text-muted-foreground border-t border-border pt-6 pb-4 space-y-1">
              <p>MovieBox Express API — Pure proxy, no database required</p>
              <p>All content is served from upstream aoneroom.com servers</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={DocsPage} />
        <Route component={DocsPage} />
      </Switch>
    </WouterRouter>
  );
}

export default App;
