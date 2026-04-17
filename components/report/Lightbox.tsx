/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";

export function Lightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <button className="absolute top-4 right-5 text-white/60 hover:text-white text-2xl leading-none" onClick={onClose}>✕</button>
      {images.length > 1 && (
        <button className="absolute left-4 text-white/50 hover:text-white text-3xl px-3 py-2" onClick={(e) => { e.stopPropagation(); prev(); }}>‹</button>
      )}
      <img src={images[index]} alt={`Screen ${index + 1}`} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "6px" }} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <button className="absolute right-4 text-white/50 hover:text-white text-3xl px-3 py-2" onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-5 text-white/40 text-sm">{index + 1} / {images.length}</div>
      )}
    </div>
  );
}
