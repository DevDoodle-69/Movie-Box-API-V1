import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Play, Info, Star, Volume2, VolumeX } from "lucide-react";
import type { NormalizedItem } from "@/lib/types";

interface Props {
  items: NormalizedItem[];
}

export default function HeroSection({ items }: Props) {
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % Math.min(items.length, 5)), 8000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="relative h-[56vw] max-h-[680px] min-h-[400px] skeleton" />
    );
  }

  const item = items[current];

  return (
    <div className="relative h-[56vw] max-h-[680px] min-h-[400px] overflow-hidden select-none">
      {/* Background image */}
      <div className="absolute inset-0">
        {items.slice(0, 5).map((it, i) => (
          <div
            key={it.subjectId}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === current ? "opacity-100" : "opacity-0"}`}
          >
            <img
              src={it.coverUrl}
              alt={it.title}
              className="w-full h-full object-cover object-top"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

      {/* Gradients */}
      <div className="hero-gradient absolute inset-0" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #141414 0%, transparent 50%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%)" }} />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-16 px-4 sm:px-8 lg:px-12">
        {/* Type badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-[#e50914] text-white text-xs font-bold rounded uppercase tracking-wide">
            {item.type === "TV_SERIES" ? "Series" : item.type === "ANIME" ? "Anime" : "Movie"}
          </span>
          {item.rating && (
            <div className="flex items-center gap-1 text-yellow-400">
              <Star className="w-3.5 h-3.5" fill="currentColor" />
              <span className="text-sm font-semibold">{item.rating}</span>
            </div>
          )}
          {item.releaseDate && (
            <span className="text-gray-300 text-sm">{item.releaseDate.slice(0, 4)}</span>
          )}
          {item.genre && (
            <span className="text-gray-400 text-sm hidden sm:inline">· {item.genre.split(",")[0]}</span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-3 max-w-2xl drop-shadow-lg">
          {item.title}
        </h1>

        {/* Description */}
        {item.description && (
          <p className="text-gray-200 text-sm sm:text-base max-w-xl mb-5 line-clamp-3 drop-shadow">
            {item.description}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={`/watch/${item.subjectId}`}>
            <button className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors shadow-lg">
              <Play className="w-5 h-5" fill="black" />
              Play
            </button>
          </Link>
          <Link href={`/detail/${item.subjectId}`}>
            <button className="flex items-center gap-2 bg-gray-600/70 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-gray-500/70 transition-colors backdrop-blur-sm">
              <Info className="w-5 h-5" />
              More Info
            </button>
          </Link>
          <button
            onClick={() => setMuted(!muted)}
            className="ml-auto p-2.5 rounded-full border border-gray-500 text-white hover:border-white transition-colors backdrop-blur-sm"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Pagination dots */}
        {items.length > 1 && (
          <div className="absolute bottom-4 right-8 flex gap-1.5">
            {items.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-0.5 rounded-full transition-all ${
                  i === current ? "w-6 bg-white" : "w-3 bg-gray-500"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
