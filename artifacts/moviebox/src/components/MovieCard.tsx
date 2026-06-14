import { useState } from "react";
import { Link } from "wouter";
import { Star, Play, Tv, Film } from "lucide-react";
import type { NormalizedItem } from "@/lib/types";

interface Props {
  item: NormalizedItem;
  size?: "sm" | "md" | "lg";
}

export default function MovieCard({ item, size = "md" }: Props) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const sizes = {
    sm: "w-32 sm:w-36",
    md: "w-36 sm:w-44",
    lg: "w-44 sm:w-52",
  };

  const typeColor: Record<string, string> = {
    MOVIE: "#e50914",
    TV_SERIES: "#0090d0",
    ANIME: "#9b59b6",
    MUSIC: "#27ae60",
    EDUCATION: "#f39c12",
  };

  const TypeIcon = item.type === "TV_SERIES" ? Tv : Film;

  return (
    <Link href={`/detail/${item.subjectId}`}>
      <div
        className={`movie-card relative shrink-0 ${sizes[size]} cursor-pointer select-none`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Poster */}
        <div className="relative rounded-md overflow-hidden bg-gray-900 aspect-[2/3]">
          {item.coverUrl && !imgError ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-900 text-gray-600 p-2">
              <TypeIcon className="w-8 h-8" />
              <span className="text-xs text-center line-clamp-3 text-gray-500">{item.title}</span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="card-gradient absolute inset-0 pointer-events-none" />

          {/* Corner badge */}
          {item.corner && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-[#e50914] text-white text-[9px] font-bold rounded uppercase tracking-wide">
              {item.corner}
            </div>
          )}

          {/* Type badge */}
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-white text-[9px] font-semibold rounded uppercase tracking-wide"
            style={{ background: typeColor[item.type] ?? "#e50914" }}
          >
            {item.type === "TV_SERIES" ? "Series" : item.type === "ANIME" ? "Anime" : item.type === "MUSIC" ? "Music" : "Movie"}
          </div>

          {/* Play overlay on hover */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-black ml-0.5" fill="black" />
            </div>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <h3 className="text-white text-xs font-semibold leading-tight truncate drop-shadow">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {item.rating && (
                <div className="flex items-center gap-0.5 text-yellow-400">
                  <Star className="w-2.5 h-2.5" fill="currentColor" />
                  <span className="text-[10px] font-medium">{item.rating}</span>
                </div>
              )}
              {item.releaseDate && (
                <span className="text-[10px] text-gray-300">{item.releaseDate.slice(0, 4)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
