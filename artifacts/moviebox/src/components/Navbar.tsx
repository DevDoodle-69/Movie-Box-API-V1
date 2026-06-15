import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Search, X, Film, Tv, Home, TrendingUp, Sword } from "lucide-react";
import { suggest } from "@/lib/api";
import type { SuggestionItem } from "@/lib/types";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    try {
      const res = await suggest(q, 6);
      if (res.success) setSuggestions(res.suggestions ?? []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    if (v.trim().length >= 2) {
      debounceRef.current = setTimeout(() => fetchSuggestions(v), 280);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  };

  const handleSuggestionClick = (item: SuggestionItem) => {
    setShowSuggestions(false);
    setQuery("");
    setSearchOpen(false);
    navigate(`/detail/${item.subjectId}`);
  };

  const typeIcon = (type: string) => {
    if (type === "TV_SERIES") return <Tv className="w-3 h-3" />;
    if (type === "ANIME") return <Sword className="w-3 h-3" />;
    return <Film className="w-3 h-3" />;
  };

  const typeColor = (type: string) => {
    if (type === "TV_SERIES") return "text-blue-400";
    if (type === "ANIME") return "text-purple-400";
    return "text-red-400";
  };

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const navLinks = [
    { href: "/", label: "Home", icon: <Home className="w-3.5 h-3.5" /> },
    { href: "/search?q=movies&type=MOVIES", label: "Movies", icon: <Film className="w-3.5 h-3.5" /> },
    { href: "/search?q=series&type=TV_SERIES", label: "Series", icon: <Tv className="w-3.5 h-3.5" /> },
    { href: "/search?q=anime&type=ANIME", label: "Anime", icon: <Sword className="w-3.5 h-3.5" /> },
    { href: "/search?q=trending", label: "Trending", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? "rgba(20,20,20,0.97)"
          : "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        boxShadow: scrolled ? "0 1px 0 rgba(255,255,255,0.05)" : "none",
      }}
    >
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-[#e50914] flex items-center justify-center shadow-lg shadow-red-900/40 group-hover:bg-red-700 transition-colors">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-white hidden sm:block">
            Movie<span className="text-[#e50914]">Box</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-0.5 ml-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive(link.href)
                  ? "text-white bg-white/10"
                  : "text-gray-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative flex items-center">
          {searchOpen ? (
            <form onSubmit={handleSubmit} className="flex items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                  placeholder="Search movies, series, anime..."
                  autoFocus
                  className="w-52 sm:w-72 pl-9 pr-4 py-2 bg-[#1a1a1a] border border-white/15 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#e50914]/60 focus:ring-1 focus:ring-[#e50914]/25 transition-all"
                />

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1c1c1c] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                    {suggestions.map((s) => (
                      <button
                        key={s.subjectId}
                        type="button"
                        onMouseDown={() => handleSuggestionClick(s)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/6 transition-colors text-left"
                      >
                        <div className="w-8 h-11 shrink-0 rounded-md overflow-hidden bg-gray-800">
                          {s.coverUrl && (
                            <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{s.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`flex items-center gap-1 text-[10px] ${typeColor(s.type)}`}>
                              {typeIcon(s.type)}
                              {s.type?.replace("_", " ")}
                            </span>
                            {s.releaseDate && (
                              <span className="text-[10px] text-gray-600">· {s.releaseDate.slice(0, 4)}</span>
                            )}
                          </div>
                        </div>
                        {s.rating && (
                          <span className="text-yellow-400 text-xs font-medium shrink-0">⭐ {s.rating}</span>
                        )}
                      </button>
                    ))}
                    <button
                      type="submit"
                      onMouseDown={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#e50914]/10 hover:bg-[#e50914]/20 text-[#e50914] text-sm font-medium transition-colors border-t border-white/5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      See all results for "{query}"
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
                className="ml-2 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/8"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/8"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mobile bottom nav hint */}
        <div className="md:hidden flex items-center gap-0.5">
          <Link href="/" className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/8 transition-colors">
            <Home className="w-4 h-4" />
          </Link>
          <Link href="/search?q=trending" className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/8 transition-colors">
            <TrendingUp className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
