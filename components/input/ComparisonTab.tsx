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

// Variant labels: A안, B안, C안
const VARIANT_LABELS = ["A안", "B안", "C안"];

export function ComparisonTab({ locale, comparison, onComparisonChange }: ComparisonTabProps) {
  const isVariant = comparison.comparisonType === "variant";

  const setComparisonType = (type: "competitor" | "variant") => {
    onComparisonChange({ ...comparison, comparisonType: type });
  };

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

  const addItem = () => {
    if (comparison.competitors.length >= 2) return;
    onComparisonChange({
      ...comparison,
      competitors: [...comparison.competitors, { productName: "", images: [], videos: [], description: "" }],
    });
  };

  const removeItem = (index: number) => {
    onComparisonChange({
      ...comparison,
      competitors: comparison.competitors.filter((_, i) => i !== index),
    });
  };

  // Labels
  const primaryLabel = isVariant ? VARIANT_LABELS[0] : t("ourProduct", locale);
  const primaryNamePlaceholder = isVariant ? "예: A안 — 현재 디자인" : t("productNamePlaceholder", locale);
  const primaryDescPlaceholder = isVariant
    ? "예: 현재 라이브 버전. CTA 버튼 배치 기준..."
    : t("oursDescriptionPlaceholder", locale);
  const itemLabel = (i: number) => isVariant ? VARIANT_LABELS[i + 1] ?? `시안 ${i + 2}` : `${t("competitorN", locale)} ${i + 1}`;
  const itemNamePlaceholder = isVariant ? "예: B안 — 개선 시안" : t("competitorNamePlaceholder", locale);
  const itemDescPlaceholder = isVariant
    ? "예: CTA를 상단으로 이동한 개선안..."
    : t("competitorDescriptionPlaceholder", locale);
  const addButtonLabel = isVariant ? "+ 시안 추가" : t("addCompetitor", locale);
  const focusPlaceholder = isVariant
    ? "예: CTA 클릭률, 정보 가독성, 첫 인상..."
    : t("comparisonFocusPlaceholder", locale);
  const guideText = isVariant
    ? "동일 화면의 A안·B안을 업로드해 어떤 디자인이 더 효과적인지 비교 분석합니다. 최대 3개 시안까지 가능합니다."
    : t("comparisonGuide", locale);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-[var(--border)] w-fit">
        {([
          { key: "competitor" as const, label: "경쟁사 비교" },
          { key: "variant" as const, label: "시안 비교" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setComparisonType(key)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              comparison.comparisonType === key
                ? "bg-white/10 text-white"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-sm text-[var(--muted)]">{guideText}</p>

      {/* Primary item (자사 제품 or A안) */}
      <div className="p-4 rounded-lg border border-white/20 bg-white/[0.04]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-wider text-white/80">{primaryLabel}</span>
        </div>
        <input
          value={comparison.ours.productName}
          onChange={(e) => updateOursName(e.target.value)}
          placeholder={primaryNamePlaceholder}
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 mb-3"
        />
        <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
          {t("productDescriptionLabel", locale)}
        </label>
        <textarea
          value={comparison.ours.description ?? ""}
          onChange={(e) => updateOursDescription(e.target.value)}
          placeholder={primaryDescPlaceholder}
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

      {/* Secondary items (경쟁사 or B안, C안) */}
      {comparison.competitors.map((comp, i) => (
        <div key={i} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{itemLabel(i)}</span>
            <button
              onClick={() => removeItem(i)}
              className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors"
            >
              {t("remove", locale)}
            </button>
          </div>
          <input
            value={comp.productName}
            onChange={(e) => updateCompetitorName(i, e.target.value)}
            placeholder={itemNamePlaceholder}
            className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 mb-3"
          />
          <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
            {t("productDescriptionLabel", locale)}
          </label>
          <textarea
            value={comp.description ?? ""}
            onChange={(e) => updateCompetitorDescription(i, e.target.value)}
            placeholder={itemDescPlaceholder}
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
          onClick={addItem}
          className="w-full py-2.5 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
        >
          {addButtonLabel}
        </button>
      )}

      {/* Focus */}
      <div>
        <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
          {t("comparisonFocus", locale)}
        </label>
        <input
          value={comparison.focus}
          onChange={(e) => onComparisonChange({ ...comparison, focus: e.target.value })}
          placeholder={focusPlaceholder}
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
        />
      </div>
    </div>
  );
}
