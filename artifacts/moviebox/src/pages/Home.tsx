import { useEffect, useState } from "react";
import HeroSection from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import Footer from "@/components/Footer";
import { getTrending, search, getPopularSearches } from "@/lib/api";
import type { NormalizedItem } from "@/lib/types";
import { Link } from "wouter";
import { TrendingUp, Search } from "lucide-react";

interface Subject {
  subjectId?: string;
  title?: string;
  subjectType?: number;
  cover?: { url?: string };
  coverImageUrl?: string;
  releaseDate?: string;
  genre?: string;
  imdbRatingValue?: string;
  countryName?: string;
  season?: number;
  duration?: string;
  corner?: string;
  description?: string;
  hasResource?: boolean;
}

interface Section {
  type?: string;
  subjects?: Subject[];
}

function normalizeSubject(item: Subject): NormalizedItem {
  const typeMap: Record<number, string> = { 1: "MOVIE", 2: "TV_SERIES", 5: "EDUCATION", 6: "MUSIC", 7: "ANIME" };
  return {
    subjectId: item.subjectId ?? "",
    title: item.title ?? "Unknown",
    type: typeMap[item.subjectType ?? 1] ?? "MOVIE",
    subjectType: item.subjectType ?? 1,
    coverUrl: item.cover?.url ?? item.coverImageUrl ?? "",
    releaseDate: item.releaseDate,
    genre: item.genre,
    rating: item.imdbRatingValue,
    country: item.countryName,
    season: item.season,
    duration: item.duration,
    corner: item.corner,
    description: item.description,
  };
}

function extractSubjectsFromSections(sections: Section[]): NormalizedItem[] {
  return sections
    .filter((s) => s.type !== "BANNER" && s.type !== "SPORT_LIVE")
    .flatMap((s) => s.subjects ?? [])
    .map(normalizeSubject)
    .filter((i) => i.subjectId && i.coverUrl);
}

function PopularSearchChip({ item, onClick }: { item: NormalizedItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/6 hover:bg-white/12 border border-white/8 rounded-full text-sm text-gray-300 hover:text-white transition-all"
    >
      {item.coverUrl && (
        <img src={item.coverUrl} alt="" className="w-5 h-7 object-cover rounded-sm shrink-0" />
      )}
      <span className="truncate max-w-[120px]">{item.title}</span>
    </button>
  );
}

export default function Home() {
  const [hero, setHero] = useState<NormalizedItem[]>([]);
  const [trending, setTrending] = useState<NormalizedItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<NormalizedItem[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<NormalizedItem[]>([]);
  const [topRated, setTopRated] = useState<NormalizedItem[]>([]);
  const [anime, setAnime] = useState<NormalizedItem[]>([]);
  const [popular, setPopular] = useState<NormalizedItem[]>([]);
  const [actionMovies, setActionMovies] = useState<NormalizedItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingMore, setLoadingMore] = useState(true);

  useEffect(() => {
    Promise.all([
      getTrending(1, 0),
      getTrending(1, 1),
      getTrending(1, 2),
    ]).then(([all, movies, series]) => {
      const toSections = (r: unknown) => {
        const t = r as { data?: { items?: Section[] }; items?: Section[] };
        return t.data?.items ?? t.items ?? [];
      };

      const allItems = extractSubjectsFromSections(toSections(all) as Section[]).slice(0, 25);
      const movieItems = extractSubjectsFromSections(toSections(movies) as Section[]).slice(0, 20);
      const seriesItems = extractSubjectsFromSections(toSections(series) as Section[]).slice(0, 20);

      const seen = new Set<string>();
      const dedupAll = allItems.filter((i) => !seen.has(i.subjectId) && seen.add(i.subjectId));

      setTrending(dedupAll);
      setTrendingMovies(movieItems);
      setTrendingSeries(seriesItems);
      setHero(dedupAll.filter((i) => i.coverUrl).slice(0, 8));
      setLoadingTrending(false);
    }).catch(() => setLoadingTrending(false));

    Promise.all([
      search("top rated", 1, 20, "ALL"),
      search("anime 2024", 1, 20, "ANIME"),
      search("action thriller", 1, 20, "MOVIES"),
      getPopularSearches(),
    ]).then(([topRes, animeRes, actionRes, popularRes]) => {
      const top = (topRes as { items?: NormalizedItem[] }).items ?? [];
      const an = (animeRes as { items?: NormalizedItem[] }).items ?? [];
      const act = (actionRes as { items?: NormalizedItem[] }).items ?? [];
      const pop = (popularRes as { data?: NormalizedItem[]; items?: NormalizedItem[] }).data
        ?? (popularRes as { items?: NormalizedItem[] }).items ?? [];

      setTopRated(top.filter((i) => i.coverUrl).slice(0, 20));
      setAnime(an.filter((i) => i.coverUrl).slice(0, 20));
      setActionMovies(act.filter((i) => i.coverUrl).slice(0, 20));
      setPopular(pop.filter((i: NormalizedItem) => i.subjectId).slice(0, 12));
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#141414]">
      <HeroSection items={hero} />

      {/* Popular searches */}
      {popular.length > 0 && (
        <div className="px-4 sm:px-6 lg:px-8 mt-2 mb-2">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-400 text-sm font-medium">Popular Searches</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {popular.map((item) => (
              <Link key={item.subjectId} href={`/detail/${item.subjectId}`}>
                <PopularSearchChip item={item} onClick={() => {}} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <ContentRow title="🔥 Trending Now" items={trending} loading={loadingTrending} cardSize="md" />
        <ContentRow title="🎬 Trending Movies" items={trendingMovies} loading={loadingTrending} cardSize="md" />
        <ContentRow title="📺 Trending Series" items={trendingSeries} loading={loadingTrending} cardSize="md" />
        <ContentRow title="⭐ Top Rated" items={topRated} loading={loadingMore} cardSize="md" />
        <ContentRow title="💥 Action &amp; Thriller" items={actionMovies} loading={loadingMore} cardSize="md" />
        <ContentRow title="🎌 Anime" items={anime} loading={loadingMore} cardSize="md" />
      </div>

      {/* Browse section */}
      <div className="px-4 sm:px-6 lg:px-8 mt-10 mb-6">
        <div className="bg-gradient-to-r from-[#e50914]/15 via-[#1a1a1a] to-[#141414] border border-white/6 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#e50914]" />
              <span className="text-[#e50914] text-sm font-semibold uppercase tracking-wider">Discover More</span>
            </div>
            <h2 className="text-white text-xl sm:text-2xl font-bold">Explore thousands of titles</h2>
            <p className="text-gray-400 text-sm mt-1">Movies, series, anime and more — all free to stream</p>
          </div>
          <Link href="/search?q=2024">
            <button className="shrink-0 px-6 py-2.5 bg-[#e50914] hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-900/30">
              Browse All
            </button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
