import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Search, X, Film, Tv, Flame, Home } from "lucide-react";
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
      debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
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
    if (type === "ANIME") return <span className="text-[10px] font-bold">A</span>;
    return <Film className="w-3 h-3" />;
  };

  const isActive = (path: string) => location === path;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? "rgba(20,20,20,0.97)"
          : "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)",
        backdropFilter: scrolled ? "blur(8px)" : "none",
        boxShadow: scrolled ? "0 1px 0 rgba(255,255,255,0.06)" : "none",
      }}
    >
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="w-8 h-8 rounded bg-[#e50914] flex items-center justify-center shadow-lg shadow-red-900/40">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-white hidden sm:block">
            Movie<span className="text-[#e50914]">Box</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1 ml-4">
          {[
            { href: "/", label: "Home", icon: <Home className="w-3.5 h-3.5" /> },
            { href: "/search?q=trending", label: "Movies", icon: <Film className="w-3.5 h-3.5" /> },
            { href: "/search?q=series&type=TV_SERIES", label: "Series", icon: <Tv className="w-3.5 h-3.5" /> },
            { href: "/search?q=anime&type=ANIME", label: "Anime", icon: <span className="text-xs font-bold">ア</span> },
            { href: "/test-live", label: "Test Live", icon: <Flame className="w-3.5 h-3.5" /> },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                  placeholder="Search movies, series..."
                  autoFocus
                  className="w-56 sm:w-72 pl-9 pr-4 py-2 bg-[#1a1a1a] border border-white/15 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#e50914]/60 focus:ring-1 focus:ring-[#e50914]/30 transition-all"
                />
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-50">
                    {suggestions.map((s) => (
                      <button
                        key={s.subjectId}
                        type="button"
                        onMouseDown={() => handleSuggestionClick(s)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/8 transition-colors text-left"
                      >
                        <div className="w-8 h-11 shrink-0 rounded overflow-hidden bg-gray-800">
                          {s.coverUrl && (
                            <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{s.title}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                              {typeIcon(s.type)} {s.type?.replace("_", " ")}
                            </span>
                            {s.releaseDate && (
                              <span className="text-[10px] text-gray-500">
                                · {s.releaseDate.slice(0, 4)}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                    <button
                      type="submit"
                      onMouseDown={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-[#e50914]/10 hover:bg-[#e50914]/20 text-[#e50914] text-sm font-medium transition-colors border-t border-white/5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Search for "{query}"
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setQuery(""); setSuggestions([]); }}
                className="ml-2 p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/8"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mobile nav toggle */}
        <div className="md:hidden flex items-center gap-1">
          <Link href="/" className="p-2 text-gray-300 hover:text-white"><Home className="w-4 h-4" /></Link>
          <Link href="/test-live" className="p-2 text-gray-300 hover:text-white"><Flame className="w-4 h-4" /></Link>
        </div>
      </div>
    </nav>
  );
}
