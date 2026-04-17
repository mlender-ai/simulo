"use client";

import { useCallback } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { FigmaState, FigmaFrame } from "../InputSection";

interface FigmaTabProps {
  locale: Locale;
  figma: FigmaState;
  onFigmaChange: (figma: FigmaState) => void;
}

export function FigmaTab({ locale, figma, onFigmaChange }: FigmaTabProps) {
  const validateFigma = useCallback(async () => {
    if (!figma.token || !figma.url) return;
    onFigmaChange({ ...figma, status: "validating", error: "", frames: [], selectedFrameIds: [], fileKey: "", fileName: "" });
    try {
      const res = await fetch("/api/figma-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl: figma.url, figmaToken: figma.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFigmaChange({ ...figma, status: "error", error: data.error || "Validation failed", frames: [], selectedFrameIds: [] });
        return;
      }
      const allIds = data.frames.map((f: FigmaFrame) => f.id);
      onFigmaChange({
        ...figma,
        status: "validated",
        error: "",
        fileKey: data.fileKey,
        fileName: data.fileName,
        frames: data.frames,
        selectedFrameIds: allIds.slice(0, 8),
      });
    } catch {
      onFigmaChange({ ...figma, status: "error", error: "Network error", frames: [], selectedFrameIds: [] });
    }
  }, [figma, onFigmaChange]);

  const toggleFigmaFrame = (id: string) => {
    const selected = figma.selectedFrameIds.includes(id)
      ? figma.selectedFrameIds.filter((fid) => fid !== id)
      : figma.selectedFrameIds.length < 8
        ? [...figma.selectedFrameIds, id]
        : figma.selectedFrameIds;
    onFigmaChange({ ...figma, selectedFrameIds: selected });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <input
            type="password"
            value={figma.token}
            onChange={(e) => onFigmaChange({ ...figma, token: e.target.value, status: "idle", error: "", frames: [], selectedFrameIds: [] })}
            placeholder={t("figmaTokenPlaceholder", locale)}
            className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
          />
          {figma.token && figma.token === localStorage.getItem("simulo_figma_token") && (
            <span className="text-xs text-emerald-400 shrink-0">{t("figmaTokenFromSettings", locale)}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={figma.url}
          onChange={(e) => onFigmaChange({ ...figma, url: e.target.value, status: "idle", error: "", frames: [], selectedFrameIds: [] })}
          placeholder={t("figmaUrlPlaceholder", locale)}
          className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
        />
        <button
          onClick={validateFigma}
          disabled={!figma.token || !figma.url || figma.status === "validating"}
          className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
            figma.token && figma.url && figma.status !== "validating"
              ? "bg-white/10 text-white hover:bg-white/15"
              : "bg-white/5 text-[var(--muted)] cursor-not-allowed"
          }`}
        >
          {figma.status === "validating" ? t("figmaValidating", locale) : t("figmaLoadFrames", locale)}
        </button>
      </div>

      {figma.status === "error" && figma.error && (
        <div className="p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
          {figma.error}
        </div>
      )}

      {figma.status === "validated" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-400">✓</span>
            <span className="text-[var(--muted)]">{t("figmaFileName", locale)}:</span>
            <span className="font-medium">{figma.fileName}</span>
            <span className="text-[var(--muted)]">— {figma.frames.length}{t("figmaFrameCount", locale)}</span>
          </div>

          {figma.frames.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("figmaNoFrames", locale)}</p>
          ) : (
            <div>
              <p className="text-xs text-[var(--muted)] mb-2">{t("figmaSelectFrames", locale)} (max 8)</p>
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)]">
                {figma.frames.map((frame) => {
                  const checked = figma.selectedFrameIds.includes(frame.id);
                  return (
                    <label
                      key={frame.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        checked ? "bg-white/10" : "hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFigmaFrame(frame.id)}
                        className="accent-white"
                      />
                      <div className="min-w-0">
                        <span className="text-sm block truncate">{frame.name}</span>
                        <span className="text-xs text-[var(--muted)]">{frame.pageName}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--muted)] mt-1.5">
                {figma.selectedFrameIds.length}/8 selected
              </p>
            </div>
          )}
        </div>
      )}

      {figma.status === "idle" && (
        <p className="text-xs text-[var(--muted)]">{t("figmaHint", locale)}</p>
      )}
    </div>
  );
}
