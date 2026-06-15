import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  Play, Star, Clock, Calendar, Globe, Film, Tv,
  ChevronLeft, Loader2, AlertCircle, Download, Languages,
  Award, Users
} from "lucide-react";
import EpisodeSelector from "@/components/EpisodeSelector";
import ContentRow from "@/components/ContentRow";
import Footer from "@/components/Footer";
import { getItem, search, proxyImageUrl } from "@/lib/api";
import type { ItemDetail, NormalizedItem, Season, FlatStream, StaffMember } from "@/lib/types";

function StaffCard({ staff }: { staff: StaffMember }) {
  const [imgError, setImgError] = useState(false);
  const initials = staff.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  const isDirector = staff.staffType === 2 || staff.role?.toLowerCase().includes("director");

  return (
    <div className="shrink-0 flex flex-col items-center gap-1.5 w-[72px]">
      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-800 ring-2 ring-white/5 flex items-center justify-center shadow-md">
        {staff.avatar && !imgError ? (
          <img
            src={staff.avatar}
            alt={staff.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <span className="text-base font-bold text-gray-400">{initials}</span>
        )}
        {isDirector && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#e50914] rounded-full flex items-center justify-center">
            <Award className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      <p className="text-white text-[11px] font-medium text-center line-clamp-2 leading-tight w-full">{staff.name}</p>
      {staff.role && (
        <p className="text-gray-500 text-[10px] text-center line-clamp-1 w-full">{staff.role}</p>
      )}
    </div>
  );
}

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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-[#e50914] animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
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

  const seasons: Season[] = isSeries
    ? Array.from({ length: detail.totalSeasons ?? detail.seNum ?? 1 }, (_, i) => ({
        season: i + 1,
        episodes: Array.from({ length: 12 }, (_, j) => ({ episode: j + 1 })),
      }))
    : [];

  const streams: FlatStream[] = detail.streams ?? [];
  const uniqueResolutions = [...new Map(streams.map((s) => [s.resolution, s])).values()]
    .sort((a, b) => b.resolution - a.resolution);
  const downloadStream = uniqueResolutions.length > 0 ? uniqueResolutions[uniqueResolutions.length - 1] : null;

  const directors = detail.staffList?.filter((s) => s.staffType === 2 || s.role?.toLowerCase().includes("director")) ?? [];
  const cast = detail.staffList?.filter((s) => s.staffType !== 2 && !s.role?.toLowerCase().includes("director")) ?? [];
  const allStaff = [...directors, ...cast];

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Hero backdrop */}
      <div className="relative h-[50vw] max-h-[550px] min-h-[280px] overflow-hidden">
        {detail.coverUrl && (
          <img
            src={detail.coverUrl}
            alt={detail.title}
            className="w-full h-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/95 via-[#141414]/40 to-transparent" />

        <button
          onClick={() => history.back()}
          className="absolute top-20 left-4 sm:left-8 flex items-center gap-1 text-white/70 hover:text-white transition-colors bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-36 relative z-10 pb-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Poster */}
          <div className="shrink-0 w-36 sm:w-44 lg:w-52 self-start">
            <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/60 aspect-[2/3] bg-gray-900 ring-1 ring-white/10">
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
          <div className="flex-1 min-w-0 pt-2">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-[#e50914] text-white text-xs font-bold rounded-full uppercase tracking-wide">
                {isSeries ? "Series" : detail.type === "ANIME" ? "Anime" : detail.type === "MUSIC" ? "Music" : "Movie"}
              </span>
              {detail.contentRating && (
                <span className="px-2 py-0.5 border border-gray-500/60 text-gray-300 text-xs rounded-full">
                  {detail.contentRating}
                </span>
              )}
              {detail.corner && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded-full border border-yellow-500/30">
                  {detail.corner}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-3 tracking-tight">
              {detail.title}
            </h1>

            {/* Rating */}
            {detail.rating && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                  <span className="text-yellow-300 font-bold text-lg">{detail.rating}</span>
                  <span className="text-gray-400 text-xs">/10 IMDb</span>
                </div>
                {detail.ratingCount && (
                  <span className="text-gray-500 text-xs">
                    {Number(detail.ratingCount).toLocaleString()} votes
                  </span>
                )}
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-x-4 gap-y-1.5 mb-4 flex-wrap text-sm">
              {detail.releaseDate && (
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  {detail.releaseDate.slice(0, 4)}
                </div>
              )}
              {detail.duration && (
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  {detail.duration}
                </div>
              )}
              {detail.country && (
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Globe className="w-3.5 h-3.5 text-gray-500" />
                  {detail.country}
                </div>
              )}
              {detail.language && (
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Languages className="w-3.5 h-3.5 text-gray-500" />
                  {detail.language}
                </div>
              )}
              {isSeries && (detail.totalSeasons ?? detail.seNum ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-gray-300">
                  <Tv className="w-3.5 h-3.5 text-gray-500" />
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
                    className="px-3 py-1 bg-white/6 text-gray-300 text-xs rounded-full border border-white/10 hover:bg-white/10 transition-colors cursor-default"
                  >
                    {g.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            {detail.description && (
              <p className="text-gray-300 text-sm sm:text-[15px] leading-relaxed mb-5 max-w-2xl">
                {detail.description}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/watch/${id}${isSeries ? `?season=${currentSeason}&episode=${currentEpisode}` : ""}`}>
                <button className="flex items-center gap-2 bg-white text-black font-bold px-7 py-3 rounded-lg hover:bg-gray-100 transition-all shadow-lg shadow-white/10 text-base active:scale-95">
                  <Play className="w-5 h-5" fill="black" />
                  {isSeries ? `Play S${currentSeason}E${currentEpisode}` : "Play Movie"}
                </button>
              </Link>

              {downloadStream && (
                <a
                  href={downloadStream.resourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-3 rounded-lg hover:bg-white/15 transition-colors border border-white/10"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>

            {/* Available resolutions */}
            {uniqueResolutions.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs">Available in:</span>
                {uniqueResolutions.map((s) => (
                  <span
                    key={s.resolution}
                    className="px-2 py-0.5 bg-white/5 text-gray-400 text-xs rounded border border-white/8"
                  >
                    {s.resolution}p
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cast & Crew */}
        {allStaff.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Cast &amp; Crew</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
              {allStaff.slice(0, 20).map((s, i) => (
                <StaffCard key={`${s.name}-${i}`} staff={s} />
              ))}
            </div>
            {directors.length > 0 && (
              <p className="text-gray-600 text-xs mt-2">
                <span className="inline-flex items-center gap-1 text-[#e50914]">
                  <Award className="w-3 h-3" /> Director badge
                </span>
                {" "}marks the director
              </p>
            )}
          </div>
        )}

        {/* Series info table */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {detail.genre && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/6">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Genre</p>
              <p className="text-gray-200 text-sm">{detail.genre}</p>
            </div>
          )}
          {detail.country && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/6">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Country</p>
              <p className="text-gray-200 text-sm">{detail.country}</p>
            </div>
          )}
          {detail.language && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/6">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Language</p>
              <p className="text-gray-200 text-sm">{detail.language}</p>
            </div>
          )}
          {detail.releaseDate && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/6">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Release Date</p>
              <p className="text-gray-200 text-sm">{detail.releaseDate}</p>
            </div>
          )}
          {detail.duration && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/6">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Duration</p>
              <p className="text-gray-200 text-sm">{detail.duration}</p>
            </div>
          )}
          {detail.totalStreams !== undefined && detail.totalStreams > 0 && (
            <div className="bg-white/3 rounded-xl p-4 border border-white/6">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Stream Options</p>
              <p className="text-gray-200 text-sm">{detail.totalStreams} quality versions available</p>
            </div>
          )}
        </div>

        {/* Episode selector for series */}
        {isSeries && seasons.length > 0 && (
          <div className="mt-8">
            <EpisodeSelector
              seasons={seasons}
              currentSeason={currentSeason}
              currentEpisode={currentEpisode}
              onSelect={handleEpisodeSelect}
              seriesId={id}
            />
          </div>
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
