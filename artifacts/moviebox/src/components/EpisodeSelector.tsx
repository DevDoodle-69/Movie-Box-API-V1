import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import type { Season } from "@/lib/types";

interface Props {
  seasons: Season[];
  currentSeason?: number;
  currentEpisode?: number;
  onSelect: (season: number, episode: number) => void;
  seriesId: string;
}

export default function EpisodeSelector({ seasons, currentSeason = 1, currentEpisode = 1, onSelect }: Props) {
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);

  const season = seasons.find((s) => s.season === activeSeason) ?? seasons[0];

  if (!seasons.length) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">Episodes</h3>

        {/* Season selector */}
        {seasons.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setShowSeasonPicker(!showSeasonPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-sm rounded-lg transition-colors"
            >
              Season {activeSeason}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSeasonPicker ? "rotate-180" : ""}`} />
            </button>
            {showSeasonPicker && (
              <div className="absolute right-0 top-full mt-1 bg-[#1f1f1f] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-20 min-w-[120px]">
                {seasons.map((s) => (
                  <button
                    key={s.season}
                    onClick={() => { setActiveSeason(s.season); setShowSeasonPicker(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                      s.season === activeSeason ? "text-[#e50914] font-semibold" : "text-white"
                    }`}
                  >
                    Season {s.season}
                    {s.episodes?.length > 0 && (
                      <span className="ml-2 text-xs text-gray-500">{s.episodes.length} eps</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Episode grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {season?.episodes?.map((ep) => {
          const isActive = activeSeason === currentSeason && ep.episode === currentEpisode;
          return (
            <button
              key={ep.episode}
              onClick={() => onSelect(activeSeason, ep.episode)}
              className={`relative group flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                isActive
                  ? "bg-[#e50914]/20 border border-[#e50914]/40"
                  : "bg-white/5 hover:bg-white/10 border border-transparent"
              }`}
            >
              {ep.coverUrl ? (
                <div className="relative w-full aspect-video rounded overflow-hidden bg-gray-800">
                  <img src={ep.coverUrl} alt={`Ep ${ep.episode}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play className="w-4 h-4 text-white" fill="white" />
                  </div>
                </div>
              ) : (
                <div className={`w-full aspect-video rounded flex items-center justify-center text-sm font-bold ${
                  isActive ? "bg-[#e50914] text-white" : "bg-gray-700 text-gray-300"
                }`}>
                  {ep.episode}
                </div>
              )}
              <span className={`text-xs font-medium ${isActive ? "text-[#e50914]" : "text-gray-300"}`}>
                Ep {ep.episode}
              </span>
              {ep.title && (
                <span className="text-[10px] text-gray-500 text-center line-clamp-1 w-full">{ep.title}</span>
              )}
              {isActive && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#e50914]" />
              )}
            </button>
          );
        })}

        {/* Fill remaining if no episodes */}
        {(!season?.episodes || season.episodes.length === 0) && (
          Array.from({ length: 12 }).map((_, i) => (
            <button
              key={i}
              onClick={() => onSelect(activeSeason, i + 1)}
              className={`flex items-center justify-center aspect-video rounded-lg text-sm font-bold transition-all ${
                activeSeason === currentSeason && i + 1 === currentEpisode
                  ? "bg-[#e50914] text-white"
                  : "bg-white/8 hover:bg-white/15 text-gray-300"
              }`}
            >
              {i + 1}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
