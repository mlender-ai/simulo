/* eslint-disable @next/next/no-img-element */
"use client";

import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import { HeatmapViewer, HeatmapIssueDetail, type HeatmapIssue } from "@/components/HeatmapViewer";
import { SEVERITY_COLORS, DESIRE_TYPE_BADGE_STYLES } from "./constants";

interface IssuesTabProps {
  data: AnalysisResult;
  locale: Locale;
  issuesByScreen: Map<number, HeatmapIssue[]>;
  issueCountPerScreen: Map<number, { total: number; critical: number }>;
  isFlow: boolean;
  heatmapOn: boolean;
  onToggleHeatmap: () => void;
  selectedScreen: number;
  onSelectScreen: (index: number) => void;
  activeIssueIdx: number | null;
  onSetActiveIssue: (idx: number | null) => void;
  hoveredIssueIdx: number | null;
  onSetHoveredIssue: (idx: number | null) => void;
}

export function IssuesTab({
  data,
  locale,
  issuesByScreen,
  issueCountPerScreen,
  isFlow,
  heatmapOn,
  onToggleHeatmap,
  selectedScreen,
  onSelectScreen,
  activeIssueIdx,
  onSetActiveIssue,
  hoveredIssueIdx,
  onSetHoveredIssue,
}: IssuesTabProps) {
  const safeIssues = data.issues ?? [];
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  const hasThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);
  const hasMultipleScreens = safeThumbnailUrls.length > 1;

  if (safeIssues.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t("noIssues", locale)}</p>;
  }

  // When multiple screens exist, always filter by selected screen
  const visibleIssues = hasMultipleScreens
    ? safeIssues.filter((issue, _i) => {
        const screenIdx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
        return screenIdx === selectedScreen;
      })
    : safeIssues;

  // Map visible issues back to their original global indices (for heatmap highlight sync)
  const visibleWithGlobalIdx = hasMultipleScreens
    ? safeIssues
        .map((issue, i) => ({ issue, globalIdx: i }))
        .filter(({ issue }) => {
          const screenIdx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
          return screenIdx === selectedScreen;
        })
    : safeIssues.map((issue, i) => ({ issue, globalIdx: i }));

  const currentThumbnail = safeThumbnailUrls[selectedScreen];
  const thumbnailValid = currentThumbnail && currentThumbnail !== STRIPPED_IMAGE;
  const screenLabel = (i: number) =>
    isFlow && data.flowSteps?.[i]
      ? `${t("stepLabel", locale)} ${i + 1}`
      : `${t("screenLabel", locale)} ${i + 1}`;

  return (
    <div>
      {/* Screen tabs + heatmap toggle */}
      {hasThumbnails && (
        <div className="flex items-center justify-between mb-4">
          {hasMultipleScreens && (
            <div className="flex gap-1 flex-wrap">
              {safeThumbnailUrls.map((_, i) => {
                const screenCounts = issueCountPerScreen.get(i);
                return (
                  <button
                    key={i}
                    onClick={() => { onSelectScreen(i); onSetActiveIssue(null); }}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      selectedScreen === i
                        ? "bg-white/10 text-white"
                        : "text-[var(--muted)] hover:text-white"
                    }`}
                  >
                    {screenLabel(i)}
                    {screenCounts && screenCounts.total > 0 && (
                      <span
                        className="ml-1 inline-flex items-center justify-center rounded-full"
                        style={{
                          minWidth: 16,
                          height: 16,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "0 4px",
                          background: screenCounts.critical > 0 ? "#ef4444" : "#f59e0b",
                          color: "#fff",
                        }}
                      >
                        {screenCounts.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={onToggleHeatmap}
            className={`shrink-0 px-3 py-1.5 text-xs rounded-md border transition-colors ${
              heatmapOn
                ? "bg-white/10 text-white border-white/20"
                : "text-[var(--muted)] border-[var(--border)] hover:text-white"
            }`}
          >
            {heatmapOn ? t("heatmapOff", locale) : t("heatmapOn", locale)}
          </button>
        </div>
      )}

      {/* Screen image — always shown when thumbnail available (heatmap overlay optional) */}
      {thumbnailValid && (
        <div className="mb-6">
          {heatmapOn ? (
            <>
              <HeatmapViewer
                imageUrl={currentThumbnail}
                imageName={
                  isFlow && data.flowSteps?.[selectedScreen]
                    ? `${t("stepLabel", locale)} ${selectedScreen + 1}: ${data.flowSteps[selectedScreen].stepName}`
                    : `${t("screenLabel", locale)} ${selectedScreen + 1}`
                }
                issues={issuesByScreen.get(selectedScreen) || []}
                activeIssueIndex={activeIssueIdx}
                onIssueClick={onSetActiveIssue}
                onIssueHover={onSetHoveredIssue}
                hoveredIssueIndex={hoveredIssueIdx}
              />
              {activeIssueIdx !== null && (() => {
                const screenIssues = issuesByScreen.get(selectedScreen) || [];
                const active = screenIssues.find((iss) => iss.index === activeIssueIdx);
                if (!active) return null;
                return <HeatmapIssueDetail issue={active} onClose={() => onSetActiveIssue(null)} />;
              })()}
            </>
          ) : (
            <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">
                  {isFlow && data.flowSteps?.[selectedScreen]
                    ? `${t("stepLabel", locale)} ${selectedScreen + 1}: ${data.flowSteps[selectedScreen].stepName}`
                    : `${t("screenLabel", locale)} ${selectedScreen + 1}`}
                </span>
                {visibleIssues.length > 0 && (
                  <span className="text-xs text-[var(--muted)]">이슈 {visibleIssues.length}개</span>
                )}
              </div>
              <img
                src={currentThumbnail}
                alt={screenLabel(selectedScreen)}
                className="w-full max-h-72 object-contain bg-black/20"
                style={{ display: "block" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Issue list — filtered by selected screen when multiple screens */}
      {visibleIssues.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-2">이 화면에서 발견된 이슈가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {visibleWithGlobalIdx.map(({ issue, globalIdx }) => {
            const severityKey = issue.severity as "Critical" | "Medium" | "Low";
            const isHighlighted = hoveredIssueIdx === globalIdx || activeIssueIdx === globalIdx;

            return (
              <div
                key={globalIdx}
                className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors cursor-pointer"
                style={isHighlighted ? { borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)" } : {}}
                onMouseEnter={() => onSetHoveredIssue(globalIdx)}
                onMouseLeave={() => onSetHoveredIssue(null)}
                onClick={() => onSetActiveIssue(activeIssueIdx === globalIdx ? null : globalIdx)}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded border ${SEVERITY_COLORS[issue.severity] ?? ""}`}>
                    {t(severityKey, locale)}
                  </span>
                  {issue.desireType && (() => {
                    const badge = DESIRE_TYPE_BADGE_STYLES[issue.desireType] || DESIRE_TYPE_BADGE_STYLES.general;
                    return (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                  {!issue.heatZone && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#666" }}>
                      {t("noLocation", locale)}
                    </span>
                  )}
                  <span className="text-xs text-[var(--muted)] mono">{issue.screen}</span>
                </div>
                <p className="text-sm mb-2">{issue.issue}</p>
                <p className="text-sm text-[var(--muted)]">
                  <span className="text-xs uppercase tracking-wider">{t("recommendation", locale)}: </span>
                  {issue.recommendation}
                </p>
                {issue.retentionImpact && (
                  <div className="mt-2">
                    <span style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("retentionImpact", locale)}: </span>
                    <span style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>{issue.retentionImpact}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
