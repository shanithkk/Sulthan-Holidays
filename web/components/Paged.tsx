"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Shows `items` a page at a time. Swipe, use the arrows below, or click a dot.
 * With one page or less it renders a plain grid with no controls.
 */
export default function Paged({
  items,
  pageSize,
  gridClass,
  label = "items",
}: {
  items: React.ReactNode[];
  pageSize: number;
  gridClass: string;
  label?: string;
}) {
  const [page, setPage] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  const pages: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += pageSize) pages.push(items.slice(i, i + pageSize));
  const last = pages.length - 1;
  const go = (p: number) => setPage(Math.min(last, Math.max(0, p)));

  if (pages.length <= 1) return <div className={`grid ${gridClass}`}>{items}</div>;

  return (
    <div>
      <div
        className="overflow-hidden"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          setTouchX(null);
          if (Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {pages.map((group, n) => (
            <div key={n} className={`grid w-full shrink-0 ${gridClass}`} aria-hidden={n !== page}>
              {group}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button onClick={() => go(page - 1)} disabled={page === 0} aria-label={`Previous ${label}`}
          className="px-2 py-1 text-leaf-700 transition hover:text-leaf-500 disabled:opacity-30">
          <ChevronLeft size={22} />
        </button>
        <div className="flex gap-2">
          {pages.map((_, n) => (
            <button key={n} onClick={() => go(n)} aria-label={`${label} page ${n + 1}`} aria-current={n === page}
              className={`h-2 rounded-full transition-all ${n === page ? "w-6 bg-leaf-600" : "w-2 bg-leaf-300 hover:bg-leaf-400"}`} />
          ))}
        </div>
        <button onClick={() => go(page + 1)} disabled={page === last} aria-label={`Next ${label}`}
          className="px-2 py-1 text-leaf-700 transition hover:text-leaf-500 disabled:opacity-30">
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
