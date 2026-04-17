/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { ComparisonState } from "../InputSection";
import { resizeImage } from "./ImageUploadTab";

interface ComparisonTabProps {
  locale: Locale;
  comparison: ComparisonState;
  onComparisonChange: (comparison: ComparisonState) => void;
}

export function ComparisonTab({ locale, comparison, onComparisonChange }: ComparisonTabProps) {
  const [draggingZone, setDraggingZone] = useState<string | null>(null);

  const updateOursName = (name: string) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, productName: name } });
  };

  const handleOursImages = (files: FileList) => {
    const remaining = 4 - comparison.ours.images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    Promise.all(toProcess.map((f) => resizeImage(f, 1024))).then((resized) => {
      onComparisonChange({
        ...comparison,
        ours: { ...comparison.ours, images: [...comparison.ours.images, ...resized] },
      });
    });
  };

  const removeOursImage = (index: number) => {
    onComparisonChange({
      ...comparison,
      ours: { ...comparison.ours, images: comparison.ours.images.filter((_, i) => i !== index) },
    });
  };

  const updateCompetitorName = (index: number, name: string) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, productName: name } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const handleCompetitorImages = (index: number, files: FileList) => {
    const comp = comparison.competitors[index];
    if (!comp) return;
    const remaining = 4 - comp.images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    Promise.all(toProcess.map((f) => resizeImage(f, 1024))).then((resized) => {
      const updated = comparison.competitors.map((c, i) =>
        i === index ? { ...c, images: [...c.images, ...resized] } : c
      );
      onComparisonChange({ ...comparison, competitors: updated });
    });
  };

  const removeCompetitorImage = (compIndex: number, imgIndex: number) => {
    const updated = comparison.competitors.map((c, i) =>
      i === compIndex ? { ...c, images: c.images.filter((_, j) => j !== imgIndex) } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const updateOursDescription = (description: string) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, description } });
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
      competitors: [...comparison.competitors, { productName: "", images: [], description: "" }],
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
          className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none mb-1.5"
        />
        <p className="text-xs text-[var(--muted)] mb-3">{t("productDescriptionHint", locale)}</p>
        <div
          className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
            draggingZone === "cmp-ours" ? "border-white/40 bg-white/5" : "border-[var(--border)] hover:border-white/20"
          }`}
          onClick={() => document.getElementById("cmp-ours-file")?.click()}
          onDragOver={(e) => { e.preventDefault(); setDraggingZone("cmp-ours"); }}
          onDragLeave={() => setDraggingZone(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingZone(null);
            if (e.dataTransfer.files.length > 0) handleOursImages(e.dataTransfer.files);
          }}
        >
          <p className="text-xs text-[var(--muted)]">{t("dropImages", locale)}</p>
          <p className="text-xs text-[var(--muted)] mt-1">{comparison.ours.images.length}/4</p>
          <input id="cmp-ours-file" type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files) handleOursImages(e.target.files); }}
          />
        </div>
        {comparison.ours.images.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {comparison.ours.images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group">
                <img src={`data:image/png;base64,${img}`} alt={`Ours ${i + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => removeOursImage(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
                  {t("remove", locale)}
                </button>
              </div>
            ))}
          </div>
        )}
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
          <div
            className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
              draggingZone === `cmp-comp-${i}` ? "border-white/40 bg-white/5" : "border-[var(--border)] hover:border-white/20"
            }`}
            onClick={() => document.getElementById(`cmp-comp-file-${i}`)?.click()}
            onDragOver={(e) => { e.preventDefault(); setDraggingZone(`cmp-comp-${i}`); }}
            onDragLeave={() => setDraggingZone(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingZone(null);
              if (e.dataTransfer.files.length > 0) handleCompetitorImages(i, e.dataTransfer.files);
            }}
          >
            <p className="text-xs text-[var(--muted)]">{t("dropImages", locale)}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{comp.images.length}/4</p>
            <input id={`cmp-comp-file-${i}`} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { if (e.target.files) handleCompetitorImages(i, e.target.files); }}
            />
          </div>
          {comp.images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {comp.images.map((img, j) => (
                <div key={j} className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group">
                  <img src={`data:image/png;base64,${img}`} alt={`Competitor ${i + 1} ${j + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeCompetitorImage(i, j)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
                    {t("remove", locale)}
                  </button>
                </div>
              ))}
            </div>
          )}
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
