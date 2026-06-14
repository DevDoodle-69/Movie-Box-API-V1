import { useEffect, useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { ChevronLeft, Loader2, AlertCircle, List } from "lucide-react";
import VideoPlayer, { type QualityOption } from "@/components/VideoPlayer";
import EpisodeSelector from "@/components/EpisodeSelector";
import { getItem, getEpisodeResource } from "@/lib/api";
import type { ItemDetail, Season, ResourceDetector } from "@/lib/types";

function getSearchParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    season: parseInt(params.get("season") ?? "0", 10),
    episode: parseInt(params.get("episode") ?? "0", 10),
  };
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
      // Fetch item details and resource in parallel
      const [itemDetail, resourceRes] = await Promise.all([
        getItem(subjectId, season, episode),
        getEpisodeResource(subjectId, season, episode),
      ]);

      setDetail(itemDetail);

      const isSeries = itemDetail.type === "TV_SERIES" || (itemDetail.seNum ?? 0) > 0;

      if (isSeries && itemDetail.seasons && itemDetail.seasons.length > 0) {
        setSeasons(itemDetail.seasons);
      } else if (isSeries && (itemDetail.seNum ?? itemDetail.totalSeasons ?? 0) > 0) {
        const totalSeasons = itemDetail.totalSeasons ?? itemDetail.seNum ?? 1;
        setSeasons(Array.from({ length: totalSeasons }, (_, i) => ({
          season: i + 1,
          episodes: Array.from({ length: 12 }, (_, j) => ({ episode: j + 1 })),
        })));
      }

      // Extract resolutions from resource response
      const detectors: ResourceDetector[] = (resourceRes.data?.resourceDetectors ?? resourceRes.resourceDetectors ?? []) as ResourceDetector[];
      const bestDetector = detectors[0];
      const resList = bestDetector?.resolutionList ?? itemDetail.bestStream?.resolutionList ?? [];

      if (resList.length > 0) {
        const qs: QualityOption[] = resList
          .filter((r) => r.resourceLink)
          .map((r) => ({
            label: `${r.resolution}p`,
            resolution: r.resolution,
            url: r.resourceLink,
          }))
          .sort((a, b) => b.resolution - a.resolution);
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
      <div className="flex items-center justify-between px-4 py-3 bg-black/90">
        <div className="flex items-center gap-3">
          <Link href={`/detail/${id}`}>
            <button className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Back</span>
            </button>
          </Link>
          {detail && (
            <div>
              <h1 className="text-white font-semibold text-sm sm:text-base">{detail.title}</h1>
              {isSeries && currentSeason > 0 && (
                <p className="text-gray-400 text-xs">
                  Season {currentSeason}, Episode {currentEpisode}
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
        {/* Video player */}
        <div className={`${showEpisodes && isSeries ? "lg:flex-1" : "w-full"} flex flex-col`}>
          {loading ? (
            <div className="aspect-video bg-black flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-[#e50914] animate-spin" />
                <p className="text-gray-400 text-sm">Loading streams...</p>
              </div>
            </div>
          ) : error ? (
            <div className="aspect-video bg-black flex flex-col items-center justify-center gap-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-white font-medium">{error}</p>
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

          {/* Below player info */}
          {detail && !loading && (
            <div className="p-4 bg-[#0a0a0a]">
              <h2 className="text-white font-bold text-lg">{detail.title}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm text-gray-400">
                {detail.rating && <span>⭐ {detail.rating}</span>}
                {detail.releaseDate && <span>· {detail.releaseDate.slice(0, 4)}</span>}
                {detail.genre && <span>· {detail.genre.split(",")[0]}</span>}
                {detail.duration && <span>· {detail.duration}</span>}
              </div>
              {qualities.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-gray-500 text-xs">Streams:</span>
                  {qualities.map((q) => (
                    <span key={q.resolution} className="px-2 py-0.5 bg-white/6 text-gray-400 text-xs rounded">
                      {q.resolution}p
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Episode panel (series only) */}
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
