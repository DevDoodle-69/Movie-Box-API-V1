import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";

const BASE_URL_KEY = "mb_base_url";

function getBaseUrl() {
  const saved = localStorage.getItem(BASE_URL_KEY);
  if (saved) return saved;
  return `${window.location.origin}/api`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentItem {
  subjectId?: string;
  id?: string | number;
  title?: string;
  subjectType?: number;
  coverUrl?: string;
  coverImageUrl?: string;
  cover?: { url?: string };
  releaseDate?: string;
  genre?: string;
  imdbRatingValue?: string;
  rating?: string;
  countryName?: string;
  country?: string;
  duration?: string | number;
  description?: string;
  season?: number;
  seasons?: number;
  corner?: string;
  type?: string;
  detailPath?: string;
  [key: string]: unknown;
}

interface StreamItem {
  url?: string;
  resolution?: string;
  quality?: string;
  format?: string;
  size?: number;
}

interface MovieDetailData {
  subject?: Record<string, unknown>;
  streams?: StreamItem[];
  resource?: Record<string, unknown>;
}

interface SearchResult {
  items?: ContentItem[];
  count?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPoster(item: ContentItem): string {
  return (
    item.coverUrl ||
    item.coverImageUrl ||
    item.cover?.url ||
    ""
  );
}

function getItemId(item: ContentItem): string {
  return String(item.subjectId || item.id || "");
}

function typeLabel(item: ContentItem): string {
  const t = item.subjectType ?? 0;
  if (item.type) return item.type.replace("_", " ");
  if (t === 1) return "MOVIE";
  if (t === 2) return "TV SERIES";
  if (t === 7) return "ANIME";
  if (t === 6) return "MUSIC";
  if (t === 5) return "EDU";
  return "CONTENT";
}

function typeBadgeClass(item: ContentItem): string {
  const t = item.subjectType ?? 0;
  const label = item.type || "";
  if (t === 1 || label === "MOVIE") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (t === 2 || label === "TV_SERIES") return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  if (t === 7 || label === "ANIME") return "bg-pink-500/20 text-pink-400 border-pink-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

// ─── Video Player ─────────────────────────────────────────────────────────────

function VideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError("");
    setLoading(true);

    const isHls = src.includes(".m3u8") || src.includes("manifest");
    const isMpd = src.includes(".mpd");

    if (isMpd) {
      setError("This stream uses MPEG-DASH (MPD) format. Use a DASH-capable player or VLC to play it.\n\nCopy the stream URL below and paste it into VLC: Media → Open Network Stream.");
      setLoading(false);
      return;
    }

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader("Origin", window.location.origin);
        },
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(`HLS error: ${data.details}. Try using VLC with this URL instead.`);
          setLoading(false);
        }
      });
    } else {
      video.src = src;
      video.oncanplay = () => setLoading(false);
      video.onerror = () => {
        setError("Browser cannot play this stream directly. Copy the URL and open it in VLC: Media → Open Network Stream.");
        setLoading(false);
      };
      video.play().catch(() => setLoading(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.src = "";
      }
    };
  }, [src]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-b border-white/10">
        <span className="text-sm text-white/60 font-mono truncate max-w-xs">{src.split("?")[0].slice(-60)}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(src)}
            className="text-xs text-white/50 hover:text-white px-3 py-1 rounded border border-white/20 hover:border-white/40 transition-colors"
          >
            Copy URL
          </button>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-xl px-2 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center relative">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-white/50 text-sm">Loading stream…</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="max-w-lg text-center px-6 space-y-4">
            <div className="text-4xl">📺</div>
            <p className="text-white/70 text-sm whitespace-pre-line leading-relaxed">{error}</p>
            <div className="bg-white/5 border border-white/10 rounded p-3">
              <p className="text-white/40 text-xs mb-1">Stream URL:</p>
              <p className="text-white/80 text-xs font-mono break-all">{src}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(src)}
              className="mt-2 px-4 py-2 bg-primary/20 border border-primary/40 text-primary text-sm rounded hover:bg-primary/30 transition-colors"
            >
              Copy URL for VLC
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="max-w-full max-h-full w-full"
            controls
            playsInline
            style={{ maxHeight: "calc(100vh - 48px)" }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────

function MovieCard({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const poster = getPoster(item);
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-lg overflow-hidden border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-muted overflow-hidden">
        {poster && !imgError ? (
          <img
            src={poster}
            alt={item.title || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <div className="text-3xl">🎬</div>
              <p className="text-xs px-2 text-center opacity-70">{item.title}</p>
            </div>
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeBadgeClass(item)}`}>
            {typeLabel(item)}
          </span>
        </div>
        {/* Rating badge */}
        {(item.rating || item.imdbRatingValue) && (
          <div className="absolute top-2 right-2 bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-1">
            <span className="text-yellow-400 text-[10px]">★</span>
            <span className="text-white text-[10px] font-bold">{item.rating || item.imdbRatingValue}</span>
          </div>
        )}
        {/* Corner badge */}
        {item.corner && (
          <div className="absolute bottom-2 right-2 bg-primary/80 rounded px-1.5 py-0.5">
            <span className="text-white text-[10px] font-bold">{item.corner}</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <span className="text-white text-xl ml-1">▶</span>
          </div>
        </div>
      </div>
      {/* Info */}
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-medium text-foreground truncate leading-tight">{item.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {item.releaseDate?.slice(0, 4) || ""}
          {item.genre ? ` · ${item.genre.split(",")[0].trim()}` : ""}
        </p>
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  baseUrl,
  onClose,
}: {
  item: ContentItem;
  baseUrl: string;
  onClose: () => void;
}) {
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [streamError, setStreamError] = useState("");
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<StreamItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);

  const itemId = getItemId(item);
  const poster = getPoster(item);
  const isSeries = item.subjectType === 2 || typeLabel(item) === "TV SERIES";
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  // Load full details
  useEffect(() => {
    if (!itemId) { setLoadingDetails(false); return; }
    setLoadingDetails(true);
    fetch(`${baseUrl}/details?id=${itemId}`)
      .then((r) => r.json())
      .then((d) => setDetails(d.data || d))
      .catch(() => setDetails(null))
      .finally(() => setLoadingDetails(false));
  }, [baseUrl, itemId]);

  const fetchStreams = useCallback(async () => {
    if (!itemId) return;
    setLoadingStreams(true);
    setStreamError("");
    setStreams([]);
    try {
      const se = isSeries ? season : 0;
      const ep = isSeries ? episode : 0;
      const res = await fetch(`${baseUrl}/episode/resource?id=${itemId}&season=${se}&episode=${ep}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load streams");
      const raw = data.data as Record<string, unknown>;
      const list: StreamItem[] = (
        (raw?.list as StreamItem[]) ||
        (raw?.downloads as StreamItem[]) ||
        []
      );
      if (list.length === 0) throw new Error("No stream URLs found for this title.");
      setStreams(list);
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : "Failed to fetch streams");
    } finally {
      setLoadingStreams(false);
    }
  }, [baseUrl, itemId, isSeries, season, episode]);

  const mergedDetails = details || item;
  const description = (mergedDetails.description as string) || (item.description as string) || "";
  const genre = (mergedDetails.genre as string) || item.genre || "";
  const country = (mergedDetails.countryName as string) || item.country || "";
  const rating = (mergedDetails.imdbRatingValue as string) || item.rating || item.imdbRatingValue || "";
  const seasons = (mergedDetails.seasons as number) || item.seasons || item.season || 0;
  const episodes = (mergedDetails.episodes as number) || 0;

  return (
    <>
      {playUrl && (
        <VideoPlayer src={playUrl} onClose={() => { setPlayUrl(null); setSelectedStream(null); }} />
      )}

      <div className="fixed inset-0 z-40 flex">
        {/* Backdrop */}
        <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <div className="relative ml-auto w-full max-w-2xl bg-[hsl(222,28%,7%)] border-l border-border flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <span className="text-sm font-semibold text-foreground truncate">{item.title}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl ml-3 transition-colors">✕</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Hero */}
            <div className="flex gap-4 p-5 border-b border-border">
              {poster && (
                <img
                  src={poster}
                  alt={item.title || ""}
                  className="w-28 h-40 object-cover rounded-lg flex-shrink-0 border border-border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${typeBadgeClass(item)}`}>
                    {typeLabel(item)}
                  </span>
                  {item.corner && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      {item.corner}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-foreground leading-tight">{item.title}</h2>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {item.releaseDate && <span>📅 {item.releaseDate.slice(0, 10)}</span>}
                  {rating && <span>⭐ {rating}</span>}
                  {country && <span>🌍 {country}</span>}
                  {genre && <span>🎭 {genre}</span>}
                  {isSeries && seasons > 0 && <span>📺 {seasons} Season{seasons > 1 ? "s" : ""}</span>}
                  {isSeries && episodes > 0 && <span>🎞 {episodes} Episodes</span>}
                </div>
                {loadingDetails && <p className="text-xs text-muted-foreground animate-pulse">Loading details…</p>}
                {description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{description}</p>
                )}
              </div>
            </div>

            {/* Stream controls */}
            <div className="p-5 space-y-4">
              {isSeries && (
                <div className="flex gap-3 items-center">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Season</label>
                    <input
                      type="number"
                      min={1}
                      max={seasons || 20}
                      value={season}
                      onChange={(e) => setSeason(parseInt(e.target.value, 10) || 1)}
                      className="w-20 bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Episode</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={episode}
                      onChange={(e) => setEpisode(parseInt(e.target.value, 10) || 1)}
                      className="w-20 bg-muted border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={fetchStreams}
                disabled={loadingStreams}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingStreams ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Fetching streams…
                  </>
                ) : (
                  <>🎬 Get Stream URLs</>
                )}
              </button>

              {streamError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{streamError}</p>
                </div>
              )}

              {/* Stream list */}
              {streams.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Available Streams ({streams.length})
                  </h3>
                  <div className="space-y-2">
                    {streams.map((s, i) => (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 transition-colors ${
                          selectedStream === s
                            ? "border-primary/60 bg-primary/10"
                            : "border-border bg-card hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {s.resolution && (
                            <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                              {s.resolution}
                            </span>
                          )}
                          {s.quality && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                              {s.quality}
                            </span>
                          )}
                          {s.format && (
                            <span className="text-xs text-muted-foreground">.{s.format}</span>
                          )}
                          {s.size ? (
                            <span className="text-xs text-muted-foreground ml-auto">{formatSize(s.size)}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-mono text-muted-foreground truncate flex-1">{s.url}</p>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => navigator.clipboard?.writeText(s.url || "")}
                              className="text-[10px] px-2 py-1 rounded border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStream(s);
                                setPlayUrl(s.url || "");
                              }}
                              className="text-[10px] px-2 py-1 rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors font-medium"
                            >
                              ▶ Play
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    💡 If the stream doesn't play in browser, click "Copy" and open in VLC: Media → Open Network Stream
                  </p>
                </div>
              )}
            </div>

            {/* Raw subject ID */}
            <div className="px-5 pb-5">
              <div className="bg-muted/50 border border-border rounded p-3">
                <p className="text-xs text-muted-foreground mb-1">Subject ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-foreground flex-1">{itemId}</code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(itemId)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border hover:border-primary/30 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({
  onSearch,
  loading,
}: {
  onSearch: (q: string, type: string) => void;
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) onSearch(q.trim(), type);
  };

  return (
    <form onSubmit={submit} className="flex gap-2 items-center flex-wrap">
      <div className="flex-1 min-w-[200px] relative">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies, series, anime…"
          className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
        />
      </div>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
      >
        <option value="ALL">All</option>
        <option value="MOVIES">Movies</option>
        <option value="TV_SERIES">TV Series</option>
        <option value="ANIME">Anime</option>
        <option value="MUSIC">Music</option>
        <option value="EDUCATION">Education</option>
      </select>
      <button
        type="submit"
        disabled={loading || !q.trim()}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          "Search"
        )}
      </button>
    </form>
  );
}

// ─── Trending Row ─────────────────────────────────────────────────────────────

function TrendingRow({ baseUrl, onSelect }: { baseUrl: string; onSelect: (item: ContentItem) => void }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "movies" | "series">("all");

  useEffect(() => {
    setLoading(true);
    setItems([]);
    const endpoint = tab === "movies" ? "/trending/movies" : tab === "series" ? "/trending/series" : "/trending";
    fetch(`${baseUrl}${endpoint}`)
      .then((r) => r.json())
      .then((d) => {
        const raw = d.data;
        if (!raw) return;
        const list: ContentItem[] = [];
        const walk = (obj: unknown) => {
          if (!obj || typeof obj !== "object") return;
          if (Array.isArray(obj)) { obj.forEach(walk); return; }
          const o = obj as Record<string, unknown>;
          if ((o.subjectId || o.id) && o.title) { list.push(o as ContentItem); return; }
          Object.values(o).forEach(walk);
        };
        walk(raw);
        const unique = list.filter(
          (item, idx, arr) =>
            arr.findIndex((x) => getItemId(x) === getItemId(item)) === idx,
        );
        setItems(unique.slice(0, 20));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [baseUrl, tab]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-base font-semibold text-foreground">🔥 Trending</h2>
        <div className="flex gap-1">
          {(["all", "movies", "series"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1 rounded-full transition-colors capitalize ${
                tab === t
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
          {items.map((item, i) => (
            <MovieCard key={getItemId(item) || i} item={item} onClick={() => onSelect(item)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No trending content loaded.</p>
      )}
    </div>
  );
}

// ─── Main TestLivePage ────────────────────────────────────────────────────────

export default function TestLivePage() {
  const [baseUrl] = useState(getBaseUrl);
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (q: string, type: string) => {
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    setSearchQuery(q);
    setSearched(true);
    try {
      const res = await fetch(`${baseUrl}/search?q=${encodeURIComponent(q)}&type=${type}&size=40`);
      const data = await res.json() as { success: boolean; data?: SearchResult; error?: string };
      if (!data.success) throw new Error(data.error || "Search failed");
      const items = data.data?.items || [];
      setSearchResults(items);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [baseUrl]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <a href="." className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg">🎬</span>
          <span className="font-semibold text-sm text-foreground hidden sm:block">MovieBox API</span>
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-border">/</span>
          <span className="text-primary font-medium">Test Live</span>
        </div>
        <div className="ml-auto text-xs font-mono text-muted-foreground hidden sm:block truncate max-w-xs">
          {baseUrl}
        </div>
        <a
          href="."
          className="text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 px-3 py-1 rounded transition-colors flex-shrink-0"
        >
          API Docs
        </a>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Search */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Live Movie Browser</h1>
            <p className="text-sm text-muted-foreground">
              Search movies, TV series, and anime — click any result to view details and stream.
            </p>
          </div>
          <SearchBar onSearch={handleSearch} loading={searching} />

          {searchError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{searchError}</p>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searched && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">
                {searching ? "Searching…" : `Results for "${searchQuery}"`}
              </h2>
              {!searching && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {searchResults.length} found
                </span>
              )}
            </div>

            {searching ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
                {searchResults.map((item, i) => (
                  <MovieCard
                    key={getItemId(item) || i}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm">No results found for "{searchQuery}"</p>
                <p className="text-xs mt-1 opacity-60">Try a different search term or content type</p>
              </div>
            )}
          </div>
        )}

        {/* Trending (shown when no search) */}
        {!searched && (
          <TrendingRow baseUrl={baseUrl} onSelect={setSelectedItem} />
        )}

        {/* Popular Searches */}
        {!searched && (
          <PopularSearches baseUrl={baseUrl} onSearch={handleSearch} />
        )}
      </main>

      {/* Detail Panel */}
      {selectedItem && (
        <DetailPanel
          item={selectedItem}
          baseUrl={baseUrl}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// ─── Popular Searches ─────────────────────────────────────────────────────────

function PopularSearches({
  baseUrl,
  onSearch,
}: {
  baseUrl: string;
  onSearch: (q: string, type: string) => void;
}) {
  const [items, setItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    fetch(`${baseUrl}/popular-searches`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.data) ? d.data.slice(0, 12) : []))
      .catch(() => {});
  }, [baseUrl]);

  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-3">🔍 Popular Searches</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onSearch(item.title || "", "ALL")}
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            {getPoster(item) && (
              <img
                src={getPoster(item)}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
}
