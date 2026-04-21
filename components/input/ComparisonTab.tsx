/* eslint-disable @next/next/no-img-element */
"use client";

import { t, type Locale } from "@/lib/i18n";
import type { ComparisonState } from "../InputSection";
import { MediaUploader, type UploadedVideo } from "@/components/MediaUploader";

interface ComparisonTabProps {
  locale: Locale;
  comparison: ComparisonState;
  onComparisonChange: (comparison: ComparisonState) => void;
}

export function ComparisonTab({ locale, comparison, onComparisonChange }: ComparisonTabProps) {

  const updateOursName = (name: string) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, productName: name } });
  };

  const updateOursImages = (images: string[]) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, images } });
  };

  const updateOursVideos = (videos: UploadedVideo[]) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, videos } });
  };

  const updateOursDescription = (description: string) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, description } });
  };

  const updateCompetitorName = (index: number, name: string) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, productName: name } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const updateCompetitorImages = (index: number, images: string[]) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, images } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const updateCompetitorVideos = (index: number, videos: UploadedVideo[]) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, videos } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const updateCompetitorDescription = (index: number, description: string) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, description } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const addCompetitor = () => {
    if (comparison.competitors.length >= 2) return;
    onComparisonChange({
      ...comparison,
      competitors: [...comparison.competitors, { productName: "", images: [], videos: [], description: "" }],
    });
  };

  const removeCompetitor = (index: number) => {
    onComparisonChange({
      ...comparison,
      competitors: comparison.competitors.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">{t("comparisonGuide", locale)}</p>

      {/* Our product */}
      <div className="p-4 rounded-lg border border-white/20 bg-white/[0.04]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-wider text-white/80">{t("ourProduct", locale)}</span>
        </div>
        <input
          value={comparison.ours.productName}
          onChange={(e) => updateOursName(e.target.value)}
          placeholder={t("productNamePlaceholder", locale)}
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 mb-3"
        />
        <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
          {t("productDescriptionLabel", locale)}
        </label>
        <textarea
          value={comparison.ours.description ?? ""}
          onChange={(e) => updateOursDescription(e.target.value)}
          placeholder={t("oursDescriptionPlaceholder", locale)}
          rows={3}
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none mb-3"
        />
        <MediaUploader
          uploadZoneId="cmp-ours"
          maxImages={4}
          maxVideos={1}
          images={comparison.ours.images}
          videos={comparison.ours.videos ?? []}
          onImagesChange={updateOursImages}
          onVideosChange={updateOursVideos}
        />
      </div>

      {/* Competitors */}
      {comparison.competitors.map((comp, i) => (
        <div key={i} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{t("competitorN", locale)} {i + 1}</span>
            <button onClick={() => removeCompetitor(i)} className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors">{t("remove", locale)}</button>
          </div>
          <input
            value={comp.productName}
            onChange={(e) => updateCompetitorName(i, e.target.value)}
            placeholder={t("competitorNamePlaceholder", locale)}
            className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 mb-3"
          />
          <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
            {t("productDescriptionLabel", locale)}
          </label>
          <textarea
            value={comp.description ?? ""}
            onChange={(e) => updateCompetitorDescription(i, e.target.value)}
            placeholder={t("competitorDescriptionPlaceholder", locale)}
            rows={3}
            className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none mb-3"
          />
          <MediaUploader
            uploadZoneId={`cmp-comp-${i}`}
            maxImages={4}
            maxVideos={1}
            images={comp.images}
            videos={comp.videos ?? []}
            onImagesChange={(imgs) => updateCompetitorImages(i, imgs)}
            onVideosChange={(vids) => updateCompetitorVideos(i, vids)}
          />
        </div>
      ))}

      {comparison.competitors.length < 2 && (
        <button
          onClick={addCompetitor}
          className="w-full py-2.5 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
        >
          {t("addCompetitor", locale)}
        </button>
      )}

      {/* Comparison focus */}
      <div>
        <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">{t("comparisonFocus", locale)}</label>
        <input
          value={comparison.focus}
          onChange={(e) => onComparisonChange({ ...comparison, focus: e.target.value })}
          placeholder={t("comparisonFocusPlaceholder", locale)}
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
        />
      </div>
    </div>
  );
}
