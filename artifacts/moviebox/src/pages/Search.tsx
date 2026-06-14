import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, Filter, Loader2 } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import Footer from "@/components/Footer";
import { search } from "@/lib/api";
import type { NormalizedItem } from "@/lib/types";

const TYPES = ["ALL", "MOVIES", "TV_SERIES", "ANIME", "MUSIC"] as const;
type ContentType = (typeof TYPES)[number];

function getQuery(loc: string): { q: string; type: string } {
  const url = new URL(loc, "http://x");
  return { q: url.searchParams.get("q") ?? "", type: url.searchParams.get("type") ?? "ALL" };
}

export default function SearchPage() {
  const [location, navigate] = useLocation();
  const { q: initialQ, type: initialType } = getQuery(window.location.href);

  const [query, setQuery] = useState(initialQ);
  const [activeType, setActiveType] = useState<ContentType>((initialType as ContentType) || "ALL");
  const [items, setItems] = useState<NormalizedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const loaderRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController>();

  const doSearch = useCallback(async (q: string, type: ContentType, pg: number, append = false) => {
    if (!q.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    try {
      let newItems: NormalizedItem[] = [];
      let more = false;
      let tot = 0;

      const apiType = type === "MOVIES" ? "MOVIES" : type === "TV_SERIES" ? "TV_SERIES" : type === "ANIME" ? "ANIME" : type === "MUSIC" ? "MUSIC" : "ALL";
      const res = await search(q, pg, 20, apiType);
      newItems = (res as { items?: NormalizedItem[] }).items ?? [];
      more = (res as { pager?: { hasMore?: boolean } }).pager?.hasMore ?? false;
      tot = (res as { pager?: { totalCount?: number }; count?: number }).pager?.totalCount ?? (res as { count?: number }).count ?? newItems.length;

      if (append) {
        setItems((prev) => {
          const ids = new Set(prev.map((i) => i.subjectId));
          return [...prev, ...newItems.filter((i) => !ids.has(i.subjectId))];
        });
      } else {
        setItems(newItems);
      }
      setHasMore(more);
      setTotal(tot);
    } catch {
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") ?? "";
    const type = (params.get("type") as ContentType) ?? "ALL";
    setQuery(q);
    setActiveType(type);
    setPage(1);
    doSearch(q, type, 1, false);
  }, [location]);

  // Infinite scroll
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          doSearch(query, activeType, nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, page, query, activeType, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}&type=${activeType}`);
  };

  const handleTypeChange = (type: ContentType) => {
    setActiveType(type);
    navigate(`/search?q=${encodeURIComponent(query)}&type=${type}`);
  };

  const typeLabel: Record<ContentType, string> = {
    ALL: "All",
    MOVIES: "Movies",
    TV_SERIES: "Series",
    ANIME: "Anime",
    MUSIC: "Music",
  };

  return (
    <div className="min-h-screen bg-[#141414] pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, series, anime..."
              className="w-full pl-12 pr-4 py-3.5 bg-[#1f1f1f] border border-white/10 rounded-xl text-white placeholder-gray-500 text-base focus:outline-none focus:border-[#e50914]/50 focus:ring-1 focus:ring-[#e50914]/30 transition-all"
            />
          </div>
        </form>

        {/* Type filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500 shrink-0" />
          {TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeType === type
                  ? "bg-[#e50914] text-white shadow-lg shadow-red-900/30"
                  : "bg-white/8 text-gray-300 hover:bg-white/15 hover:text-white"
              }`}
            >
              {typeLabel[type]}
            </button>
          ))}
        </div>

        {/* Results header */}
        {query && !loading && (
          <div className="mb-4">
            <h1 className="text-xl font-bold text-white">
              {items.length > 0 ? (
                <>
                  <span className="text-gray-400 font-normal text-base">Results for </span>
                  "{query}"
                  <span className="text-gray-400 font-normal text-sm ml-2">
                    {total > 0 && `· ${total.toLocaleString()} found`}
                  </span>
                </>
              ) : (
                <span className="text-gray-400">No results for "{query}"</span>
              )}
            </h1>
          </div>
        )}

        {/* Grid */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {items.map((item) => (
              <MovieCard key={item.subjectId} item={item} size="sm" />
            ))}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && items.length === 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[2/3] rounded-md" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && query && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <SearchIcon className="w-12 h-12 text-gray-600" />
            <p className="text-gray-400 text-lg font-medium">No results found</p>
            <p className="text-gray-600 text-sm">Try a different search term or filter</p>
          </div>
        )}

        {/* Infinite scroll loader */}
        <div ref={loaderRef} className="flex justify-center py-6">
          {loading && items.length > 0 && (
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
