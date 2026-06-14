import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, Play, Loader2, AlertCircle, Zap, Film, Tv,
  CheckCircle, Clock, Star, Globe
} from "lucide-react";
import VideoPlayer, { type QualityOption } from "@/components/VideoPlayer";
import { suggest, getItem, typeLabel } from "@/lib/api";
import Footer from "@/components/Footer";
import type { SuggestionItem, ResourceDetector } from "@/lib/types";

interface TestResult {
  subjectId: string;
  title: string;
  type: string;
  rating?: string;
  releaseDate?: string;
  country?: string;
  genre?: string;
  coverUrl?: string;
  qualities: QualityOption[];
  loadTimeMs: number;
  error?: string;
}

export default function TestLive() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiLog, setApiLog] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const log = (msg: string) => setApiLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);

  const handleInput = (v: string) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggest(true);
      setShowSuggestions(true);
      log(`GET /api/test-live/suggest?q=${encodeURIComponent(v)}`);
      try {
        const res = await suggest(v, 8);
        setSuggestions(res.suggestions ?? []);
        log(`✓ Got ${res.count} suggestions`);
      } catch {
        setSuggestions([]);
        log("✗ Suggest failed");
      } finally {
        setLoadingSuggest(false);
      }
    }, 300);
  };

  const loadItem = async (item: SuggestionItem) => {
    setShowSuggestions(false);
    setQuery(item.title);
    setSuggestions([]);
    setLoadingItem(true);
    setResult(null);
    const start = Date.now();

    log(`GET /api/test-live/item?id=${item.subjectId}`);

    try {
      const detail = await getItem(item.subjectId);
      const ms = Date.now() - start;
      log(`✓ Item loaded in ${ms}ms`);

      const detectors: ResourceDetector[] = (detail.streams ?? (detail.bestStream ? [detail.bestStream] : [])) as ResourceDetector[];
      const resList = detectors[0]?.resolutionList ?? [];
      const qualities: QualityOption[] = resList
        .filter((r) => r.resourceLink)
        .map((r) => ({ label: `${r.resolution}p`, resolution: r.resolution, url: r.resourceLink }))
        .sort((a, b) => b.resolution - a.resolution);

      log(`✓ Found ${qualities.length} stream quality options`);

      setResult({
        subjectId: item.subjectId,
        title: detail.title,
        type: detail.type ?? typeLabel(item.subjectType),
        rating: detail.rating,
        releaseDate: detail.releaseDate,
        country: detail.country,
        genre: detail.genre,
        coverUrl: detail.coverUrl,
        qualities,
        loadTimeMs: ms,
        error: qualities.length === 0 ? "No streams found for this item" : undefined,
      });
    } catch (e) {
      const ms = Date.now() - start;
      log(`✗ Failed in ${ms}ms: ${(e as Error).message}`);
      setResult({
        subjectId: item.subjectId,
        title: item.title,
        type: item.type,
        coverUrl: item.coverUrl,
        qualities: [],
        loadTimeMs: ms,
        error: (e as Error).message,
      });
    } finally {
      setLoadingItem(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/15 border border-green-500/20 rounded-full mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-semibold tracking-wide uppercase">Live API Test</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Test the API
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Search any movie or series and verify the API is working — live stream previews, quality switching, and real-time response logs.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            {loadingSuggest && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search movies, series, anime to test..."
              className="w-full pl-12 pr-12 py-4 bg-[#1f1f1f] border border-white/10 rounded-xl text-white placeholder-gray-500 text-base focus:outline-none focus:border-[#e50914]/50 focus:ring-1 focus:ring-[#e50914]/30 transition-all"
            />
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-30">
              {suggestions.map((s) => (
                <button
                  key={s.subjectId}
                  onMouseDown={() => loadItem(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/6 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <div className="w-10 h-14 shrink-0 rounded overflow-hidden bg-gray-800">
                    {s.coverUrl && <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{s.title}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        {s.type === "TV_SERIES" ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                        {s.type?.replace("_", " ")}
                      </span>
                      {s.releaseDate && <span>· {s.releaseDate.slice(0, 4)}</span>}
                      {s.rating && <span>· ⭐ {s.rating}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-[#e50914]/10 text-[#e50914] text-xs font-semibold rounded">
                    <Zap className="w-3 h-3" /> Test
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loadingItem && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-[#e50914] animate-spin" />
            <p className="text-gray-400">Fetching streams and details...</p>
          </div>
        )}

        {/* Result */}
        {result && !loadingItem && (
          <div className="space-y-4">
            {/* Status card */}
            <div className={`flex items-start gap-4 p-4 rounded-xl border ${
              result.error ? "bg-red-500/8 border-red-500/20" : "bg-green-500/8 border-green-500/20"
            }`}>
              {result.error ? (
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold ${result.error ? "text-red-400" : "text-green-400"}`}>
                    {result.error ? "Stream not available" : "Stream ready"}
                  </span>
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    <Clock className="w-3 h-3" /> {result.loadTimeMs}ms
                  </span>
                  {!result.error && (
                    <span className="text-gray-400 text-xs">{result.qualities.length} quality options</span>
                  )}
                </div>
                <p className="text-white font-medium mt-0.5">{result.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                  {result.type && (
                    <span className="flex items-center gap-1">
                      {result.type === "TV_SERIES" ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                      {result.type.replace("_", " ")}
                    </span>
                  )}
                  {result.rating && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />{result.rating}</span>}
                  {result.releaseDate && <span>{result.releaseDate.slice(0, 4)}</span>}
                  {result.country && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{result.country}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/detail/${result.subjectId}`)}
                  className="px-3 py-1.5 bg-white/10 text-white text-xs font-semibold rounded-lg hover:bg-white/15 transition-colors"
                >
                  Details
                </button>
                {!result.error && (
                  <button
                    onClick={() => navigate(`/watch/${result.subjectId}`)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#e50914] text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Play className="w-3 h-3" fill="white" /> Full Player
                  </button>
                )}
              </div>
            </div>

            {/* Video player */}
            {result.qualities.length > 0 && (
              <div>
                <h3 className="text-white font-semibold mb-2 text-sm uppercase tracking-wide text-gray-400">
                  Live Preview — {result.title}
                </h3>
                <VideoPlayer
                  qualities={result.qualities}
                  title={result.title}
                  autoPlay={false}
                />
              </div>
            )}

            {/* Quality badges */}
            {result.qualities.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 text-xs">Available streams:</span>
                {result.qualities.map((q) => (
                  <span
                    key={q.resolution}
                    className={`px-2 py-0.5 text-xs rounded font-medium ${
                      q.resolution >= 1080
                        ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
                        : q.resolution >= 720
                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                        : "bg-white/8 text-gray-400 border border-white/10"
                    }`}
                  >
                    {q.resolution}p {q.resolution >= 1080 ? "HD" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* API Log */}
        <div className="mt-8 bg-[#0d0d0d] rounded-xl border border-white/6 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/6">
            <Zap className="w-3.5 h-3.5 text-[#e50914]" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">API Request Log</span>
            {apiLog.length > 0 && (
              <button onClick={() => setApiLog([])} className="ml-auto text-[10px] text-gray-600 hover:text-gray-400">
                Clear
              </button>
            )}
          </div>
          <div className="p-4 font-mono text-xs min-h-[80px] max-h-[200px] overflow-y-auto">
            {apiLog.length === 0 ? (
              <span className="text-gray-600">Search something to see live API calls...</span>
            ) : (
              apiLog.map((line, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    line.includes("✓") ? "text-green-400" :
                    line.includes("✗") ? "text-red-400" :
                    "text-gray-400"
                  }`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Link to docs */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            View all API endpoints and parameters in the{" "}
            <a href="/docs/" className="text-[#e50914] hover:underline font-medium">
              API Docs →
            </a>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
