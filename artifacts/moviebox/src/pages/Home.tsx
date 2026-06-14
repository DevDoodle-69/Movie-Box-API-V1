import { useEffect, useState } from "react";
import HeroSection from "@/components/HeroSection";
import ContentRow from "@/components/ContentRow";
import Footer from "@/components/Footer";
import { getTrending, search } from "@/lib/api";
import type { NormalizedItem } from "@/lib/types";

interface Subject {
  subjectId?: string;
  title?: string;
  subjectType?: number;
  cover?: { url?: string };
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
    coverUrl: item.cover?.url ?? "",
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

export default function Home() {
  const [hero, setHero] = useState<NormalizedItem[]>([]);
  const [trending, setTrending] = useState<NormalizedItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<NormalizedItem[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<NormalizedItem[]>([]);
  const [topRated, setTopRated] = useState<NormalizedItem[]>([]);
  const [anime, setAnime] = useState<NormalizedItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingMore, setLoadingMore] = useState(true);

  useEffect(() => {
    // Load trending sections (tab=0 all, tab=1 movies, tab=2 series)
    Promise.all([
      getTrending(1, 0),
      getTrending(1, 1),
      getTrending(1, 2),
    ]).then(([all, movies, series]) => {
      const allData = (all as { data?: { items?: Section[] }; items?: Section[] }).data?.items
        ?? (all as { data?: { items?: Section[] }; items?: Section[] }).items ?? [];
      const moviesData = (movies as { data?: { items?: Section[] }; items?: Section[] }).data?.items
        ?? (movies as { data?: { items?: Section[] }; items?: Section[] }).items ?? [];
      const seriesData = (series as { data?: { items?: Section[] }; items?: Section[] }).data?.items
        ?? (series as { data?: { items?: Section[] }; items?: Section[] }).items ?? [];

      const allItems = extractSubjectsFromSections(allData as Section[]).slice(0, 25);
      const movieItems = extractSubjectsFromSections(moviesData as Section[]).slice(0, 20);
      const seriesItems = extractSubjectsFromSections(seriesData as Section[]).slice(0, 20);

      // Deduplicate by subjectId
      const seen = new Set<string>();
      const dedupAll = allItems.filter((i) => !seen.has(i.subjectId) && seen.add(i.subjectId));

      setTrending(dedupAll);
      setTrendingMovies(movieItems);
      setTrendingSeries(seriesItems);
      setHero(dedupAll.slice(0, 6));
      setLoadingTrending(false);
    }).catch(() => setLoadingTrending(false));

    // Also search for top rated & anime
    Promise.all([
      search("top rated 2024", 1, 20, "ALL"),
      search("anime 2024", 1, 20, "ANIME"),
    ]).then(([topRes, animeRes]) => {
      const top = (topRes as { items?: NormalizedItem[] }).items ?? [];
      const an = (animeRes as { items?: NormalizedItem[] }).items ?? [];
      setTopRated(top.filter((i) => i.coverUrl).slice(0, 20));
      setAnime(an.filter((i) => i.coverUrl).slice(0, 20));
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#141414]">
      <HeroSection items={hero} />

      <div className="mt-4">
        <ContentRow title="🔥 Trending Now" items={trending} loading={loadingTrending} cardSize="md" />
        <ContentRow title="🎬 Trending Movies" items={trendingMovies} loading={loadingTrending} cardSize="md" />
        <ContentRow title="📺 Trending Series" items={trendingSeries} loading={loadingTrending} cardSize="md" />
        <ContentRow title="⭐ Top Rated" items={topRated} loading={loadingMore} cardSize="md" />
        <ContentRow title="🎌 Anime" items={anime} loading={loadingMore} cardSize="md" />
      </div>

      <Footer />
    </div>
  );
}
