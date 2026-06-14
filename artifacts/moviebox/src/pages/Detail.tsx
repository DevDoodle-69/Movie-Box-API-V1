import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  Play, Star, Clock, Calendar, Globe, Film, Tv,
  ChevronLeft, Loader2, AlertCircle, Download
} from "lucide-react";
import EpisodeSelector from "@/components/EpisodeSelector";
import ContentRow from "@/components/ContentRow";
import Footer from "@/components/Footer";
import { getItem, search } from "@/lib/api";
import type { ItemDetail, NormalizedItem, Season } from "@/lib/types";

export default function DetailPage() {
  const [, params] = useRoute("/detail/:id");
  const [, navigate] = useLocation();
  const id = params?.id ?? "";

  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<NormalizedItem[]>([]);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setDetail(null);

    getItem(id, 0, 0)
      .then((data) => {
        setDetail(data);
        setLoading(false);

        // Fetch related content
        if (data.title) {
          const q = data.title.split(":")[0].split("(")[0].trim();
          search(q, 1, 12, data.type === "TV_SERIES" ? "TV_SERIES" : "ALL")
            .then((res) => {
              setRelated(res.items?.filter((i) => i.subjectId !== id).slice(0, 12) ?? []);
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load");
        setLoading(false);
      });
  }, [id]);

  const handleEpisodeSelect = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    navigate(`/watch/${id}?season=${season}&episode=${episode}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] pt-20 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#e50914] animate-spin" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-[#141414] pt-20 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-white text-lg font-medium">{error ?? "Content not found"}</p>
        <Link href="/">
          <button className="px-6 py-2.5 bg-[#e50914] text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">
            Go Home
          </button>
        </Link>
      </div>
    );
  }

  const isSeries = detail.type === "TV_SERIES" || (detail.seNum ?? 0) > 0 || (detail.totalSeasons ?? 0) > 0;
  const TypeIcon = isSeries ? Tv : Film;

  const seasons: Season[] = detail.seasons ?? (isSeries ? Array.from({ length: detail.totalSeasons ?? detail.seNum ?? 1 }, (_, i) => ({
    season: i + 1,
    episodes: Array.from({ length: 12 }, (_, j) => ({ episode: j + 1 })),
  })) : []);

  const streams = detail.streams ?? detail.bestStream ? [detail.bestStream!] : [];
  const resolutions = detail.bestStream?.resolutionList ?? streams[0]?.resolutionList ?? [];

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Hero backdrop */}
      <div className="relative h-[50vw] max-h-[600px] min-h-[320px] overflow-hidden">
        {detail.coverUrl && (
          <img
            src={detail.coverUrl}
            alt={detail.title}
            className="w-full h-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/90 via-transparent to-transparent" />

        {/* Back button */}
        <button
          onClick={() => history.back()}
          className="absolute top-20 left-4 sm:left-8 flex items-center gap-1 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10 pb-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Poster */}
          <div className="shrink-0 w-40 sm:w-48 lg:w-56 self-start">
            <div className="rounded-xl overflow-hidden shadow-2xl aspect-[2/3] bg-gray-900">
              {detail.coverUrl ? (
                <img src={detail.coverUrl} alt={detail.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <TypeIcon className="w-12 h-12 text-gray-600" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 bg-[#e50914] text-white text-xs font-bold rounded uppercase tracking-wide">
                {isSeries ? "Series" : detail.type === "ANIME" ? "Anime" : "Movie"}
              </span>
              {detail.contentRating && (
                <span className="px-2 py-0.5 border border-gray-500 text-gray-300 text-xs rounded">
                  {detail.contentRating}
                </span>
              )}
              {detail.corner && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded">
                  {detail.corner}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
              {detail.title}
            </h1>

            {/* Meta row */}
            <div className="flex items-center gap-4 mb-4 flex-wrap text-sm">
              {detail.rating && (
                <div className="flex items-center gap-1.5 text-yellow-400">
                  <Star className="w-4 h-4" fill="currentColor" />
                  <span className="font-bold text-base">{detail.rating}</span>
                  <span className="text-gray-400 text-xs">IMDb</span>
                </div>
              )}
              {detail.releaseDate && (
                <div className="flex items-center gap-1 text-gray-300">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  {detail.releaseDate.slice(0, 4)}
                </div>
              )}
              {detail.duration && (
                <div className="flex items-center gap-1 text-gray-300">
                  <Clock className="w-4 h-4 text-gray-500" />
                  {detail.duration}
                </div>
              )}
              {detail.country && (
                <div className="flex items-center gap-1 text-gray-300">
                  <Globe className="w-4 h-4 text-gray-500" />
                  {detail.country}
                </div>
              )}
              {isSeries && (detail.totalSeasons ?? detail.seNum ?? 0) > 0 && (
                <div className="text-gray-300">
                  {detail.totalSeasons ?? detail.seNum} Season{(detail.totalSeasons ?? detail.seNum ?? 1) > 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Genre tags */}
            {detail.genre && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {detail.genre.split(",").map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 bg-white/8 text-gray-300 text-xs rounded-full border border-white/10"
                  >
                    {g.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {detail.description && (
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-5 max-w-2xl">
                {detail.description}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/watch/${id}${isSeries ? `?season=${currentSeason}&episode=${currentEpisode}` : ""}`}>
                <button className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors shadow-lg text-base">
                  <Play className="w-5 h-5" fill="black" />
                  {isSeries ? `Play S${currentSeason}E${currentEpisode}` : "Play Movie"}
                </button>
              </Link>

              {resolutions.length > 0 && (
                <a
                  href={resolutions[resolutions.length - 1]?.resourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-3 rounded-lg hover:bg-white/15 transition-colors border border-white/10"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>

            {/* Streams info */}
            {resolutions.length > 0 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs">Available in:</span>
                {[...resolutions].sort((a, b) => b.resolution - a.resolution).map((r) => (
                  <span
                    key={r.resolution}
                    className="px-2 py-0.5 bg-white/6 text-gray-400 text-xs rounded border border-white/8"
                  >
                    {r.resolution}p
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Staff / Cast */}
        {detail.staffList && detail.staffList.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-white mb-3">Cast & Crew</h2>
            <div className="flex gap-3 overflow-x-auto row-scroll pb-2">
              {detail.staffList.slice(0, 15).map((s, i) => (
                <div key={i} className="shrink-0 flex flex-col items-center gap-1.5 w-20">
                  <div className="w-16 h-16 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                    {s.avatar ? (
                      <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-gray-500">
                        {s.name?.charAt(0) ?? "?"}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-[11px] font-medium text-center line-clamp-2 leading-tight">{s.name}</p>
                  {s.role && (
                    <p className="text-gray-500 text-[10px] text-center line-clamp-1">{s.role}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Episode selector for series */}
        {isSeries && seasons.length > 0 && (
          <EpisodeSelector
            seasons={seasons}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            onSelect={handleEpisodeSelect}
            seriesId={id}
          />
        )}

        {/* Related content */}
        {related.length > 0 && (
          <div className="mt-8">
            <ContentRow
              title="More Like This"
              items={related}
              cardSize="md"
            />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
