/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { MediaUploader, type UploadedVideo } from "@/components/MediaUploader";

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
  videos?: UploadedVideo[];
  onVideosChange?: (videos: UploadedVideo[]) => void;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  descriptionImages?: string[];
  onDescriptionImagesChange?: (images: string[]) => void;
  showError?: boolean;
}

export function ImageUploadTab({
  locale,
  images,
  onImagesChange,
  videos = [],
  onVideosChange,
  description,
  onDescriptionChange,
  descriptionImages = [],
  onDescriptionImagesChange,
  showError = false,
}: ImageUploadTabProps) {
  const [descOpen, setDescOpen] = useState(false);
  const hasDescContent = (description && description.trim().length > 0) || descriptionImages.length > 0;

  const handleDescriptionImageUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      resizeImage(file, 1280).then((base64) => {
        const dataUrl = `data:image/png;base64,${base64}`;
        onDescriptionImagesChange?.([...descriptionImages, dataUrl]);
      });
    });
  };

  return (
    <div>
      <MediaUploader
        uploadZoneId="img-tab"
        maxImages={8}
        maxVideos={2}
        images={images}
        videos={videos}
        onImagesChange={onImagesChange}
        onVideosChange={onVideosChange ?? (() => {})}
        showError={showError}
      />

      {/* Collapsible product description */}
      <div className="mt-3 border border-[var(--border)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setDescOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[var(--muted)] uppercase tracking-wider hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            {t("productDescriptionLabel", locale)}
            <span className="normal-case font-normal text-white/30 tracking-normal">(선택)</span>
            {hasDescContent && !descOpen && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 normal-case tracking-normal font-normal">
                {[description?.trim() ? "텍스트" : null, descriptionImages.length > 0 ? `이미지 ${descriptionImages.length}` : null].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <span className="text-[10px]">{descOpen ? "▲" : "▼"}</span>
        </button>

        {descOpen && (
          <div className="px-4 pb-4 pt-2 border-t border-[var(--border)] space-y-3">
            {/* Text area */}
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1.5">텍스트 설명</label>
              <textarea
                value={description ?? ""}
                onChange={(e) => onDescriptionChange?.(e.target.value)}
                placeholder={t("screenDescriptionPlaceholder", locale)}
                rows={3}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none"
              />
            </div>

            {/* Reference images */}
            <div>
              <label className="block text-[11px] text-[var(--muted)] mb-1.5">참고 이미지</label>
              {descriptionImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {descriptionImages.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={src}
                        alt={`참고 이미지 ${idx + 1}`}
                        className="w-16 h-16 object-cover rounded border border-[var(--border)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onDescriptionImagesChange?.(descriptionImages.filter((_, i) => i !== idx))
                        }
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black border border-white/20 text-white/60 hover:text-white text-[10px] flex items-center justify-center leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer w-fit px-3 py-1.5 rounded-md border border-dashed border-white/20 hover:border-white/40 transition-colors">
                <span className="text-xs text-white/40">+ 이미지 추가</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleDescriptionImageUpload(e.target.files)}
                />
              </label>
              <p className="text-[11px] text-[var(--muted)] mt-1.5">
                {t("productDescriptionHint", locale)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
