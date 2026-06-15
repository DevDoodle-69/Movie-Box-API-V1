import { useEffect, useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { ChevronLeft, Loader2, AlertCircle, List } from "lucide-react";
import VideoPlayer, { type QualityOption } from "@/components/VideoPlayer";
import EpisodeSelector from "@/components/EpisodeSelector";
import { getItem, getEpisodeResource, proxyStreamUrl } from "@/lib/api";
import type { ItemDetail, Season, FlatStream } from "@/lib/types";

function getSearchParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    season: parseInt(params.get("season") ?? "0", 10),
    episode: parseInt(params.get("episode") ?? "0", 10),
  };
}

/**
 * Build QualityOption[] from flat stream items.
 * - Filters to the right episode for series (season>0 && episode>0)
 * - Deduplicates by resolution, preferring H.264 over HEVC
 * - Proxies URLs through /api/proxy/stream
 */
function buildQualities(streams: FlatStream[], season: number, episode: number): QualityOption[] {
  let pool = streams;

  if (season > 0 && episode > 0) {
    const exact = streams.filter((s) => s.se === season && s.ep === episode);
    if (exact.length > 0) {
      pool = exact;
    } else {
      const epOnly = streams.filter((s) => s.ep === episode);
      if (epOnly.length > 0) pool = epOnly;
    }
  }

  const resMap = new Map<number, FlatStream>();
  for (const s of pool) {
    if (!s.resourceLink || !s.resolution) continue;
    const existing = resMap.get(s.resolution);
    if (!existing) {
      resMap.set(s.resolution, s);
    } else {
      const newIsH264 = s.codecName === "h264" || !s.resourceLink.includes("/h265/");
      const existingIsH264 = existing.codecName === "h264" || !existing.resourceLink.includes("/h265/");
      if (newIsH264 && !existingIsH264) {
        resMap.set(s.resolution, s);
      }
    }
  }

  return [...resMap.values()]
    .filter((s) => s.resourceLink)
    .map((s) => ({
      label: `${s.resolution}p`,
      resolution: s.resolution,
      url: proxyStreamUrl(s.resourceLink),
    }))
    .sort((a, b) => b.resolution - a.resolution);
}

export default function WatchPage() {
  const [, params] = useRoute("/watch/:id");
  const [, navigate] = useLocation();
  const id = params?.id ?? "";

  const [, setSp] = useState(getSearchParams());
  const spRef = useRef(getSearchParams());

  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [currentSeason, setCurrentSeason] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState(0);

  const loadStreams = async (subjectId: string, season: number, episode: number) => {
    setLoading(true);
    setError(null);
    setQualities([]);

    try {
      const [itemDetail, resourceRes] = await Promise.all([
        getItem(subjectId, season, episode),
        getEpisodeResource(subjectId, season, episode),
      ]);

      setDetail(itemDetail);

      const isSeries = itemDetail.type === "TV_SERIES" || (itemDetail.seNum ?? 0) > 0;
      if (isSeries && (itemDetail.totalSeasons ?? itemDetail.seNum ?? 0) > 0) {
        const totalSeasons = itemDetail.totalSeasons ?? itemDetail.seNum ?? 1;
        setSeasons(Array.from({ length: totalSeasons }, (_, i) => ({
          season: i + 1,
          episodes: Array.from({ length: 12 }, (_, j) => ({ episode: j + 1 })),
        })));
      }

      let qs = buildQualities(resourceRes.streams, season, episode);

      if (qs.length === 0 && itemDetail.streams && itemDetail.streams.length > 0) {
        qs = buildQualities(itemDetail.streams, season, episode);
      }

      if (qs.length > 0) {
        setQualities(qs);
      } else {
        setError("No streams available for this content.");
      }
    } catch (e) {
      setError((e as Error).message ?? "Failed to load streams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const sp = getSearchParams();
    spRef.current = sp;
    setSp(sp);
    setCurrentSeason(sp.season);
    setCurrentEpisode(sp.episode);
    loadStreams(id, sp.season, sp.episode);
  }, [id, window.location.search]);

  const handleEpisodeSelect = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    setShowEpisodes(false);
    navigate(`/watch/${id}?season=${season}&episode=${episode}`);
  };

  const isSeries = detail && (detail.type === "TV_SERIES" || (detail.seNum ?? 0) > 0);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href={`/detail/${id}`}>
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Back</span>
            </button>
          </Link>
          {detail && (
            <div>
              <h1 className="text-white font-semibold text-sm sm:text-base leading-tight">{detail.title}</h1>
              {isSeries && currentSeason > 0 && (
                <p className="text-gray-400 text-xs">
                  Season {currentSeason} · Episode {currentEpisode}
                </p>
              )}
            </div>
          )}
        </div>

        {isSeries && (
          <button
            onClick={() => setShowEpisodes(!showEpisodes)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showEpisodes ? "bg-[#e50914] text-white" : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Episodes</span>
          </button>
        )}
      </div>

      {/* Player area */}
      <div className="flex flex-col lg:flex-row flex-1">
        <div className={`${showEpisodes && isSeries ? "lg:flex-1" : "w-full"} flex flex-col`}>
          {loading ? (
            <div className="aspect-video bg-black flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-[#e50914] animate-spin" />
                <p className="text-gray-400 text-sm">Loading streams...</p>
              </div>
            </div>
          ) : error ? (
            <div className="aspect-video bg-black flex flex-col items-center justify-center gap-4 px-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-white font-medium text-center">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => loadStreams(id, currentSeason, currentEpisode)}
                  className="px-4 py-2 bg-[#e50914] text-white text-sm rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
                <Link href={`/detail/${id}`}>
                  <button className="px-4 py-2 bg-white/10 text-white text-sm rounded-lg font-semibold hover:bg-white/15 transition-colors">
                    View Details
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <VideoPlayer
              qualities={qualities}
              title={detail?.title ?? ""}
              onBack={() => navigate(`/detail/${id}`)}
              autoPlay
            />
          )}

          {detail && !loading && (
            <div className="p-4 sm:p-5 bg-[#0a0a0a] border-t border-white/5">
              <h2 className="text-white font-bold text-lg leading-snug">{detail.title}</h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-gray-400">
                {detail.rating && (
                  <span className="flex items-center gap-1 text-yellow-400 font-medium">
                    ⭐ {detail.rating}
                    {detail.ratingCount && (
                      <span className="text-gray-500 text-xs font-normal">
                        ({Number(detail.ratingCount).toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
                {detail.releaseDate && <span className="text-gray-500">·</span>}
                {detail.releaseDate && <span>{detail.releaseDate.slice(0, 4)}</span>}
                {detail.genre && (
                  <>
                    <span className="text-gray-500">·</span>
                    <span>{detail.genre.split(",")[0].trim()}</span>
                  </>
                )}
                {detail.duration && (
                  <>
                    <span className="text-gray-500">·</span>
                    <span>{detail.duration}</span>
                  </>
                )}
                {detail.contentRating && (
                  <span className="px-1.5 py-0.5 border border-gray-600 text-gray-400 text-xs rounded">
                    {detail.contentRating}
                  </span>
                )}
              </div>
              {detail.description && (
                <p className="text-gray-400 text-sm mt-2 leading-relaxed line-clamp-3">{detail.description}</p>
              )}
              {qualities.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-600 text-xs">Available in:</span>
                  {qualities.map((q) => (
                    <span key={q.resolution} className="px-2 py-0.5 bg-white/6 text-gray-400 text-xs rounded border border-white/8">
                      {q.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {showEpisodes && isSeries && seasons.length > 0 && (
          <div className="lg:w-80 bg-[#0d0d0d] border-l border-white/5 overflow-y-auto max-h-screen p-4">
            <EpisodeSelector
              seasons={seasons}
              currentSeason={currentSeason || 1}
              currentEpisode={currentEpisode || 1}
              onSelect={handleEpisodeSelect}
              seriesId={id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
