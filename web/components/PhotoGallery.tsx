"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Quote, Star, X } from "lucide-react";
import { imgUrl, type PlacePhoto } from "@/lib/api";
import Paged from "./Paged";

/** Anything with photos: a place, or a past trip (which also has a badge and maybe a feedback quote). */
export type GalleryItem = {
  id: string;
  name: string;
  description: string;
  photos: PlacePhoto[];
  badge?: string;
  quotes?: { text: string; by: string | null; rating: number | null }[];
};
type Place = GalleryItem; // the components below were written for places first

/**
 * A photo gallery, six tiles at a time (swipe / arrows / dots for more).
 * Each tile flips through its own photos, and a click opens a larger view.
 */
export default function PhotoGallery({ places, label = "places" }: { places: GalleryItem[]; label?: string }) {
  const [open, setOpen] = useState<GalleryItem | null>(null);
  return (
    <div>
      <Paged
        label={label}
        pageSize={6}
        gridClass="grid-cols-2 gap-4 sm:grid-cols-3"
        items={places.map((p) => (
          <Tile key={p.id} place={p} onOpen={() => setOpen(p)} />
        ))}
      />
      {open && <Viewer place={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Tile({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const [i, setI] = useState(0);
  const n = place.photos.length;
  const step = (d: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setI((x) => (x + d + n) % n);
  };
  return (
    <figure className="glass group relative overflow-hidden !rounded-2xl">
      <button onClick={onOpen} className="block w-full text-left" aria-label={`Open photos of ${place.name}`}>
        <div
          role="img"
          aria-label={place.photos[i].caption ?? place.name}
          className="h-32 bg-leaf-100 bg-cover bg-center transition-[background-image] sm:h-40"
          style={{ backgroundImage: `url(${imgUrl(place.photos[i].url)})` }}
        />
        {place.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {place.badge}
          </span>
        )}
        <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
          <span className="truncate">{place.name}</span>
          {n > 1 && <span className="shrink-0 text-xs font-medium text-leaf-800/70">{i + 1}/{n}</span>}
        </figcaption>
      </button>
      {n > 1 && (
        <>
          <Arrow side="left" onClick={step(-1)} />
          <Arrow side="right" onClick={step(1)} />
        </>
      )}
    </figure>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: (e: React.MouseEvent) => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    // No filled circle: just a soft white chevron with a faint shadow so it reads on any photo.
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-0 grid h-32 w-10 place-items-center text-white/60 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] transition hover:text-white sm:h-40 ${side === "left" ? "left-0" : "right-0"}`}
    >
      <Icon size={22} strokeWidth={2.5} />
    </button>
  );
}

function Viewer({ place, onClose }: { place: Place; onClose: () => void }) {
  const [i, setI] = useState(0);
  const n = place.photos.length;
  const ph = place.photos[i];
  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={place.name}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div className="glass-strong w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl(ph.url) ?? ""} alt={ph.caption ?? place.name} className="max-h-[60vh] w-full object-cover" />
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/30 text-white/80 transition hover:bg-black/50 hover:text-white">
            <X size={18} />
          </button>
          {n > 1 && (
            <>
              <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-0 top-0 grid h-full w-14 place-items-center text-white/60 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition hover:text-white"><ChevronLeft size={34} strokeWidth={2.5} /></button>
              <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-0 top-0 grid h-full w-14 place-items-center text-white/60 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition hover:text-white"><ChevronRight size={34} strokeWidth={2.5} /></button>
            </>
          )}
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-5">
          <h3 className="text-lg font-extrabold">{place.name} <span className="text-sm font-medium text-leaf-800/70">{i + 1}/{n}</span></h3>
          {place.badge && <p className="mt-1 text-xs font-bold uppercase tracking-wide text-leaf-600">{place.badge}</p>}
          {place.description && <p className="mt-1 text-sm text-leaf-800/85">{place.description}</p>}
          {place.quotes?.map((q, k) => (
            <blockquote key={k} className="mt-3 rounded-xl bg-leaf-50/70 p-3 text-sm">
              <Quote size={16} className="mb-1 text-leaf-600" />
              <p className="italic">{q.text}</p>
              <footer className="mt-2 flex items-center gap-2 text-xs font-semibold">
                {q.by && <span>{q.by}</span>}
                {q.rating && (
                  <span className="flex text-sun-500" aria-label={`${q.rating} out of 5`}>
                    {Array.from({ length: q.rating }, (_, s) => <Star key={s} size={13} fill="currentColor" />)}
                  </span>
                )}
              </footer>
            </blockquote>
          ))}
          {ph.credit && (
            <p className="mt-2 text-xs text-leaf-800/60">
              Photo: {ph.source_url ? <a className="underline" href={ph.source_url} target="_blank" rel="noopener noreferrer">{ph.credit}</a> : ph.credit}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
