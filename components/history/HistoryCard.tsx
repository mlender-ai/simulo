/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { STRIPPED_IMAGE, type AnalysisResult } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import { ShareExportPanel } from "@/components/ShareExportPanel";
import { gradeFromScore } from "@/components/report/constants";

const VERDICT_COLORS: Record<string, string> = {
  Pass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Partial: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Fail: "text-red-400 bg-red-400/10 border-red-400/20",
};

const GRADE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  "우수":     { bg: "rgba(20,83,45,0.25)",   color: "#86efac", border: "rgba(134,239,172,0.25)" },
  "양호":     { bg: "rgba(30,58,95,0.4)",    color: "#93c5fd", border: "rgba(147,197,253,0.25)" },
  "개선 필요": { bg: "rgba(67,20,7,0.35)",   color: "#fdba74", border: "rgba(253,186,116,0.25)" },
  "미흡":     { bg: "rgba(69,10,10,0.35)",   color: "#fca5a5", border: "rgba(252,165,165,0.25)" },
};

const MODE_BADGE: Record<string, { bg: string; color: string; border: string; labelKey: "modeBadgeHypothesis" | "modeBadgeUsability" }> = {
  hypothesis: { bg: "rgba(30,58,95,0.5)",  color: "#93c5fd", border: "rgba(147,197,253,0.2)", labelKey: "modeBadgeHypothesis" },
  usability:  { bg: "rgba(42,26,58,0.6)", color: "#d8b4fe", border: "rgba(216,180,254,0.2)", labelKey: "modeBadgeUsability" },
};

export const INPUT_TYPE_BADGE: Record<string, { icon: string; labelKey: "inputTypeImage" | "inputTypeUrl" | "inputTypeFlow" | "inputTypeFigma" | "inputTypeComparison" | "inputTypeVideo" | "inputTypeCode" }> = {
  image:      { icon: "🖼",  labelKey: "inputTypeImage" },
  url:        { icon: "🔗",  labelKey: "inputTypeUrl" },
  flow:       { icon: "↔",  labelKey: "inputTypeFlow" },
  figma:      { icon: "◆",  labelKey: "inputTypeFigma" },
  comparison: { icon: "⇄",  labelKey: "inputTypeComparison" },
  video:      { icon: "▶",  labelKey: "inputTypeVideo" },
  code:       { icon: "<>", labelKey: "inputTypeCode" },
};

interface HistoryCardProps {
  analysis: AnalysisResult;
  locale: Locale;
  isChild: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onReanalyze: (analysis: AnalysisResult) => void;
}

export function HistoryCard({
  analysis,
  locale,
  isChild,
  selectable,
  selected,
  onToggleSelect,
  onReanalyze,
}: HistoryCardProps) {
  const verdictKey = analysis.verdict as "Pass" | "Partial" | "Fail";
  const rowMode = analysis.mode ?? "hypothesis";
  const isUsability = rowMode === "usability";
  const modeBadge = MODE_BADGE[rowMode];
  const grade = analysis.grade ?? gradeFromScore(analysis.score);
  const gradeBadge = GRADE_BADGE[grade];
  const inputBadge = INPUT_TYPE_BADGE[analysis.inputType] ?? INPUT_TYPE_BADGE.image;

  return (
    <div className={isChild ? "pl-6 relative" : undefined}>
      {isChild && (
        <>
          <div
            className="absolute left-2 top-0 bottom-0 flex flex-col items-center"
            style={{ width: 16 }}
          >
            <div className="w-px flex-1 bg-[var(--border)]" style={{ marginTop: 12 }} />
          </div>
          <div
            className="absolute text-[var(--muted)] text-[10px]"
            style={{ left: 14, top: 14 }}
          >
            └
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(analysis.id)}
            className="shrink-0 w-4 h-4 rounded border border-[var(--border)] accent-white cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <Link
          href={`/report/${analysis.id}`}
          className="block flex-1 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-white/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            {analysis.thumbnailUrls?.[0] && analysis.thumbnailUrls[0] !== STRIPPED_IMAGE && (
              <div
                className="shrink-0 rounded overflow-hidden border border-[var(--border)]"
                style={{ width: isChild ? 36 : 48, height: isChild ? 36 : 48 }}
              >
                <img
                  src={analysis.thumbnailUrls[0]}
                  alt="thumbnail"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate mb-1">
                  {analysis.isImprovement
                    ? `개선 ${analysis.roundNumber ?? "?"}회차`
                    : isUsability
                    ? t("usabilityReportTitle", locale)
                    : analysis.hypothesis}
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)] flex-wrap">
                  <span className="mono">
                    {new Date(analysis.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded border"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <span style={{ fontSize: 10, marginRight: 3 }}>{inputBadge.icon}</span>
                    {t(inputBadge.labelKey, locale)}
                  </span>
                  {!analysis.isImprovement && modeBadge && (
                    <span
                      className="px-1.5 py-0.5 rounded border"
                      style={{ background: modeBadge.bg, color: modeBadge.color, borderColor: modeBadge.border }}
                    >
                      {t(modeBadge.labelKey, locale)}
                    </span>
                  )}
                  {analysis.isImprovement && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--border)]">
                      개선안
                    </span>
                  )}
                  {analysis.projectTag && !analysis.isImprovement && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--border)]">
                      {analysis.projectTag}
                    </span>
                  )}
                  {analysis.isComparison && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-400/10 border border-indigo-400/20 text-indigo-300">
                      {t("comparisonBadge", locale)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="mono text-sm font-medium">{analysis.score}</span>
                {isUsability || analysis.isImprovement ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded border"
                    style={gradeBadge ? { background: gradeBadge.bg, color: gradeBadge.color, borderColor: gradeBadge.border } : undefined}
                  >
                    {grade}
                  </span>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded border ${VERDICT_COLORS[analysis.verdict] ?? ""}`}>
                    {t(verdictKey, locale)}
                  </span>
                )}
                {!isChild && (
                  <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReanalyze(analysis); }}
                      className="px-2 py-1 text-xs rounded border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
                      title={t("reanalyze", locale)}
                    >
                      ↻
                    </button>
                    <ShareExportPanel analysisId={analysis.id} analysisData={analysis} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
