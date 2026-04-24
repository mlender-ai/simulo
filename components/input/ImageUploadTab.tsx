/* eslint-disable @next/next/no-img-element */
"use client";

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
  showError = false,
}: ImageUploadTabProps) {
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
      <div className="mt-3">
        <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
          {t("productDescriptionLabel", locale)}
        </label>
        <textarea
          value={description ?? ""}
          onChange={(e) => onDescriptionChange?.(e.target.value)}
          placeholder={t("screenDescriptionPlaceholder", locale)}
          rows={3}
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none mb-1.5"
        />
        <p className="text-xs text-[var(--muted)]">{t("productDescriptionHint", locale)}</p>
      </div>
    </div>
  );
}
