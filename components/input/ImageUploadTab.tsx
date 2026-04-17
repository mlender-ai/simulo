/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { t, type Locale } from "@/lib/i18n";

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png", 0.85);
      resolve(dataUrl.split(",")[1]);
    };
    img.src = url;
  });
}

export { resizeImage };

interface ImageUploadTabProps {
  locale: Locale;
  images: string[];
  onImagesChange: (images: string[]) => void;
}

export function ImageUploadTab({ locale, images, onImagesChange }: ImageUploadTabProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList) => {
      const remaining = 8 - images.length;
      const toProcess = Array.from(files).slice(0, remaining);
      Promise.all(toProcess.map((file) => resizeImage(file, 1024))).then(
        (resized) => onImagesChange([...images, ...resized])
      );
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging ? "border-white/40 bg-white/5" : "border-[var(--border)] hover:border-white/20"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <p className="text-sm text-[var(--muted)]">{t("dropImages", locale)}</p>
        <p className="text-xs text-[var(--muted)] mt-1">{t("maxImages", locale)}</p>
        <input id="file-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
      </div>
      {images.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {images.map((img, i) => (
            <div key={i} className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group">
              <img src={`data:image/png;base64,${img}`} alt={`Screen ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => onImagesChange(images.filter((_, j) => j !== i))} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
                {t("remove", locale)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
