import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, ChevronLeft, ChevronRight, Loader2, AlertCircle
} from "lucide-react";

export interface QualityOption {
  label: string;
  resolution: number;
  url: string;
}

interface Props {
  qualities: QualityOption[];
  title?: string;
  onBack?: () => void;
  autoPlay?: boolean;
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function VideoPlayer({ qualities, title, onBack, autoPlay = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);

  const sortedQualities = [...qualities].sort((a, b) => b.resolution - a.resolution);

  const loadSource = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setBuffering(true);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const isHls = url.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError("Stream error. Try a different quality.");
      });
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      if (autoPlay) video.play().catch(() => {});
    } else {
      video.src = url;
      if (autoPlay) video.play().catch(() => {});
    }
  }, [autoPlay]);

  useEffect(() => {
    if (sortedQualities.length > 0) {
      const best = sortedQualities[0];
      setSelectedQuality(best);
      loadSource(best.url);
    }
  }, [qualities]);

  useEffect(() => {
    return () => { hlsRef.current?.destroy(); };
  }, []);

  const handleQualityChange = (q: QualityOption) => {
    setSelectedQuality(q);
    setShowQuality(false);
    const time = videoRef.current?.currentTime ?? 0;
    loadSource(q.url);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        if (playing) videoRef.current.play().catch(() => {});
      }
    }, 500);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = pct * duration;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  const skip = (secs: number) => {
    if (videoRef.current) videoRef.current.currentTime += secs;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!qualities.length) {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center rounded-lg">
        <div className="text-center text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No streams available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => { setPlaying(true); setBuffering(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onError={() => setError("Failed to load stream. Try another quality.")}
        onEnded={() => setPlaying(false)}
        volume={volume}
        muted={muted}
        playsInline
      />

      {/* Buffering spinner */}
      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-white text-sm font-medium">{error}</p>
          <button
            onClick={(e) => { e.stopPropagation(); if (selectedQuality) loadSource(selectedQuality.url); }}
            className="px-4 py-2 bg-[#e50914] text-white text-sm rounded-lg font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`player-controls absolute inset-0 flex flex-col justify-between pointer-events-none ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
          {onBack && (
            <button onClick={onBack} className="p-1.5 text-white hover:text-gray-200">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {title && <span className="text-white text-sm font-semibold truncate">{title}</span>}
        </div>

        {/* Center double-tap skip areas */}
        <div className="flex-1 flex pointer-events-auto">
          <div
            className="flex-1 flex items-center justify-center"
            onDoubleClick={(e) => { e.stopPropagation(); skip(-10); }}
          >
            <div className="opacity-0 group-hover:opacity-30 transition-opacity text-white text-xs text-center p-2">
              <ChevronLeft className="w-6 h-6 mx-auto" /> -10s
            </div>
          </div>
          <div
            className="flex-1 flex items-center justify-center"
            onDoubleClick={(e) => { e.stopPropagation(); skip(10); }}
          >
            <div className="opacity-0 group-hover:opacity-30 transition-opacity text-white text-xs text-center p-2">
              <ChevronRight className="w-6 h-6 mx-auto" /> +10s
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="bg-gradient-to-t from-black/90 to-transparent p-3 pointer-events-auto">
          {/* Progress bar */}
          <div
            className="w-full h-1 bg-gray-600 rounded-full cursor-pointer mb-3 group/bar hover:h-2 transition-all"
            onClick={seek}
          >
            <div
              className="h-full bg-[#e50914] rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full -mr-1.5 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Play/pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-200 transition-colors"
            >
              {playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5" fill="white" />}
            </button>

            {/* Skip buttons */}
            <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-0.5">
              <ChevronLeft className="w-4 h-4" />10s
            </button>
            <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-0.5">
              10s<ChevronRight className="w-4 h-4" />
            </button>

            {/* Time */}
            <span className="text-white text-xs tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={() => setMuted(!muted)} className="text-white hover:text-gray-200">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => { setVolume(+e.target.value); setMuted(false); }}
                className="w-16 hidden group-hover/vol:block accent-[#e50914]"
              />
            </div>

            {/* Quality selector */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowQuality(!showQuality); }}
                className="flex items-center gap-1 text-white hover:text-gray-200 text-xs font-semibold"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {selectedQuality ? `${selectedQuality.resolution}p` : "HD"}
                </span>
              </button>
              {showQuality && (
                <div
                  className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-50 min-w-[100px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-white/10 font-semibold">Quality</div>
                  {sortedQualities.map((q) => (
                    <button
                      key={q.resolution}
                      onClick={() => handleQualityChange(q)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 hover:bg-white/10 transition-colors ${
                        selectedQuality?.resolution === q.resolution
                          ? "text-[#e50914] font-semibold"
                          : "text-white"
                      }`}
                    >
                      <span>{q.resolution}p</span>
                      {q.resolution >= 1080 && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1 rounded">HD</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-gray-200">
              {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
