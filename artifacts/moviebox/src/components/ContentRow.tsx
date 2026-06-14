import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "./MovieCard";
import type { NormalizedItem } from "@/lib/types";

interface Props {
  title: string;
  items: NormalizedItem[];
  cardSize?: "sm" | "md" | "lg";
  loading?: boolean;
}

export default function ContentRow({ title, items, cardSize = "md", loading = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="skeleton h-5 w-40 rounded mb-4 mx-4 sm:mx-8" />
        <div className="flex gap-3 px-4 sm:px-8 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-36 sm:w-44 aspect-[2/3] skeleton rounded-md"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="mb-8 group/row">
      <h2 className="text-lg font-bold text-white mb-3 px-4 sm:px-8">{title}</h2>
      <div className="relative">
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          className={`absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-12 bg-gradient-to-r from-[#141414] to-transparent transition-opacity ${
            canScrollLeft ? "opacity-0 group-hover/row:opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          className={`absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-12 bg-gradient-to-l from-[#141414] to-transparent transition-opacity ${
            canScrollRight ? "opacity-0 group-hover/row:opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>

        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-3 px-4 sm:px-8 overflow-x-auto row-scroll pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {items.map((item) => (
            <MovieCard key={item.subjectId} item={item} size={cardSize} />
          ))}
        </div>
      </div>
    </div>
  );
}
