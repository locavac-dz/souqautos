"use client";

// Lot 154 — galerie photos avec lightbox, navigation clavier/swipe

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

type Photo = { id: string; path: string };

export function PhotoGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const t = useTranslations("PhotoGallery");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus to close button when lightbox opens (WCAG 2.4.3)
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  // Touch swipe tracking
  const touchStartX = useRef<number | null>(null);

  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const close = () => setOpen(false);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (photos.length === 0) return null;

  return (
    <>
      {/* Grid — identique au rendu serveur précédent */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openAt(i)}
            aria-label={t("openPhoto", { index: i + 1, total: photos.length })}
            className={`relative aspect-[16/10] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md ${
              i === 0 ? "col-span-2 sm:col-span-2 sm:row-span-2" : ""
            }`}
          >
            <Image
              src={photo.path}
              alt=""
              fill
              className="rounded-md object-cover border border-slate-200 dark:border-slate-600 hover:opacity-90 transition-opacity"
              sizes={i === 0 ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 50vw, 33vw"}
              loading={i === 0 ? "eager" : undefined}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — ${t("photoOf", { current: index + 1, total: photos.length })}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={close}
        >
          {/* Close */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="absolute top-3 right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/25"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path d="M6 18 18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>

          {/* Counter */}
          <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {index + 1} / {photos.length}
          </span>

          {/* Photo */}
          <div
            className="relative max-h-[90dvh] max-w-[90dvw] w-full h-full"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
              touchStartX.current = null;
            }}
          >
            <Image
              src={photos[index].path}
              alt={`${alt} — photo ${index + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
            />
          </div>

          {/* Prev / Next — masqués s'il n'y a qu'une seule photo */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label={t("prevPhoto")}
                className="absolute left-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label={t("nextPhoto")}
                className="absolute right-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
