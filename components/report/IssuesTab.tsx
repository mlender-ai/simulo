/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useEffect } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";

function useResolvedIssues(analysisId: string) {
  const key = `simulo_resolved_${analysisId}`;
  const [resolved, setResolved] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(resolved)); } catch { /* quota */ }
  }, [key, resolved]);

  const toggle = useCallback((idx: number) => {
    setResolved((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }, []);

  return { resolved, toggle };
}
import { t, type Locale } from "@/lib/i18n";
import { HeatmapViewer, HeatmapIssueDetail, type HeatmapIssue } from "@/components/HeatmapViewer";
import { SEVERITY_COLORS, DESIRE_TYPE_BADGE_STYLES } from "./constants";
import { ExpandableText } from "./ExpandableText";

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
  const [hypothesisFilterOn, setHypothesisFilterOn] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<"All" | "Critical" | "Medium" | "Low">("All");
  const [copied, setCopied] = useState(false);
  const [copiedCardIdx, setCopiedCardIdx] = useState<number | null>(null);
  const { resolved, toggle: toggleResolved } = useResolvedIssues(data.id);
  const safeIssues = data.issues ?? [];
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  const hasThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);
  const hasMultipleScreens = safeThumbnailUrls.length > 1;
  const hasRelevanceData = safeIssues.some((iss) => iss.relevanceToHypothesis);

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

  const screenName = isFlow && data.flowSteps?.[selectedScreen]
    ? `${t("stepLabel", locale)} ${selectedScreen + 1}: ${data.flowSteps[selectedScreen].stepName}`
    : `${t("screenLabel", locale)} ${selectedScreen + 1}`;

  const hypothesisFiltered = visibleWithGlobalIdx.filter(({ issue }) => {
    if (!hypothesisFilterOn) return true;
    return issue.relevanceToHypothesis !== "Low";
  });

  const severityCounts = {
    Critical: hypothesisFiltered.filter(({ issue }) => issue.severity === "Critical").length,
    Medium:   hypothesisFiltered.filter(({ issue }) => issue.severity === "Medium").length,
    Low:      hypothesisFiltered.filter(({ issue }) => issue.severity === "Low").length,
  };

  const filteredVisibleWithIdx = severityFilter === "All"
    ? hypothesisFiltered
    : hypothesisFiltered.filter(({ issue }) => issue.severity === severityFilter);

  const handleCopyIssues = useCallback(() => {
    const text = filteredVisibleWithIdx
      .map(({ issue }) =>
        `[${issue.severity}] ${issue.issue}\n→ 권고: ${issue.recommendation}`
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [filteredVisibleWithIdx]);

  if (safeIssues.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t("noIssues", locale)}</p>;
  }

  return (
    <div>
      {/* Top controls row */}
      <div className="mb-4 space-y-2">
        {/* Severity filter — always visible */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["All", "Critical", "Medium", "Low"] as const).map((sev) => {
            const count = sev === "All"
              ? hypothesisFiltered.length
              : severityCounts[sev];
            const activeStyle =
              sev === "Critical" ? "bg-red-500/20 text-red-400 border-red-500/30" :
              sev === "Medium"   ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
              sev === "Low"      ? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" :
              "bg-white/10 text-white border-white/20";
            const inactiveStyle = "text-[var(--muted)] border-[var(--border)] hover:text-white";
            return (
              <button
                key={sev}
                onClick={() => { setSeverityFilter(sev); onSetActiveIssue(null); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  severityFilter === sev ? activeStyle : inactiveStyle
                }`}
              >
                {sev === "All" ? "전체" : sev}
                <span
                  className="inline-flex items-center justify-center rounded-full"
                  style={{
                    minWidth: 16, height: 16, fontSize: 10, fontWeight: 700, padding: "0 4px",
                    background: severityFilter === sev
                      ? (sev === "Critical" ? "#ef4444" : sev === "Medium" ? "#f59e0b" : sev === "Low" ? "#71717a" : "rgba(255,255,255,0.2)")
                      : "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Resolved counter */}
          {resolved.length > 0 && (
            <span className="text-xs text-emerald-400/80 ml-2 self-center">
              해결됨 {resolved.length} / {safeIssues.length}
            </span>
          )}

          {/* Hypothesis filter + heatmap on the right */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleCopyIssues}
              disabled={filteredVisibleWithIdx.length === 0}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                copied
                  ? "bg-white/10 text-white border-white/20"
                  : "text-[var(--muted)] border-[var(--border)] hover:text-white"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {copied ? "✓ 복사됨" : "이슈 복사"}
            </button>
            {hasRelevanceData && (
              <button
                onClick={() => setHypothesisFilterOn((prev) => !prev)}
                className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                  hypothesisFilterOn
                    ? "bg-white/10 text-white border-white/20"
                    : "text-[var(--muted)] border-[var(--border)] hover:text-white"
                }`}
              >
                {t("hypothesisRelevanceFilter", locale)}
              </button>
            )}
            {hasThumbnails && (
              <button
                onClick={onToggleHeatmap}
                className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                  heatmapOn
                    ? "bg-white/10 text-white border-white/20"
                    : "text-[var(--muted)] border-[var(--border)] hover:text-white"
                }`}
              >
                {heatmapOn ? t("heatmapOff", locale) : t("heatmapOn", locale)}
              </button>
            )}
          </div>
        </div>

        {/* Screen selector (multi-screen only) */}
        {hasThumbnails && hasMultipleScreens && (
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
                        minWidth: 16, height: 16, fontSize: 10, fontWeight: 700,
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
      </div>

      {/* Main layout: image (sticky left) + issue list (right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: thumbnailValid ? "240px 1fr" : "1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left column — fixed-size image panel */}
        {thumbnailValid && (
          <div style={{ position: "sticky", top: 16 }}>
            {heatmapOn ? (
              <>
                <HeatmapViewer
                  imageUrl={currentThumbnail}
                  imageName={screenName}
                  issues={issuesByScreen.get(selectedScreen) || []}
                  hypothesisRelevanceFilter={hypothesisFilterOn}
                  activeIssueIndex={activeIssueIdx}
                  onIssueClick={onSetActiveIssue}
                  onIssueHover={onSetHoveredIssue}
                  hoveredIssueIndex={hoveredIssueIdx}
                />
                {activeIssueIdx !== null && (() => {
                  const screenIssues = issuesByScreen.get(selectedScreen) || [];
                  const active = screenIssues.find((iss) => iss.index === activeIssueIdx);
                  if (!active) return null;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <HeatmapIssueDetail issue={active} onClose={() => onSetActiveIssue(null)} />
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
                <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)] truncate">{screenName}</span>
                  {visibleIssues.length > 0 && (
                    <span className="text-xs text-[var(--muted)] shrink-0 ml-2">이슈 {visibleIssues.length}개</span>
                  )}
                </div>
                {/* Fixed aspect-ratio image even without heatmap */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "375 / 812",
                    background: "#0a0a0a",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={currentThumbnail}
                    alt={screenLabel(selectedScreen)}
                    style={{
                      position: "absolute",
                      top: 0, left: 0,
                      width: "100%", height: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right column — issue list */}
        <div>
          {filteredVisibleWithIdx.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-2">
              {severityFilter !== "All"
                ? `${severityFilter} 심각도 이슈가 없습니다.`
                : "이 화면에서 발견된 이슈가 없습니다."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredVisibleWithIdx.map(({ issue, globalIdx }) => {
                const severityKey = issue.severity as "Critical" | "Medium" | "Low";
                const isHighlighted = hoveredIssueIdx === globalIdx || activeIssueIdx === globalIdx;
                const isLowRelevance = issue.relevanceToHypothesis === "Low";
                const isResolved = resolved.includes(globalIdx);

                const handleCopyCard = (e: { stopPropagation: () => void }) => {
                  e.stopPropagation();
                  const text = `[${issue.severity}] ${issue.issue}\n→ 권고: ${issue.recommendation}`;
                  navigator.clipboard.writeText(text);
                  setCopiedCardIdx(globalIdx);
                  setTimeout(() => setCopiedCardIdx((prev) => (prev === globalIdx ? null : prev)), 2000);
                };

                return (
                  <div
                    key={globalIdx}
                    className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors cursor-pointer overflow-hidden"
                    style={{
                      ...(isHighlighted ? { borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)" } : {}),
                      ...(isResolved ? { opacity: 0.4 } : {}),
                      display: "flex",
                    }}
                    onMouseEnter={() => onSetHoveredIssue(globalIdx)}
                    onMouseLeave={() => onSetHoveredIssue(null)}
                    onClick={() => onSetActiveIssue(activeIssueIdx === globalIdx ? null : globalIdx)}
                  >
                    {isLowRelevance && (
                      <div style={{ width: 3, background: "#333", flexShrink: 0 }} />
                    )}
                    <div className="p-4 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={isResolved}
                          onChange={(e) => { e.stopPropagation(); toggleResolved(globalIdx); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-emerald-400 shrink-0 cursor-pointer"
                        />
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
                        {isLowRelevance && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#666" }}>
                            {t("lowRelevanceTag", locale)}
                          </span>
                        )}
                        {!issue.heatZone && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#666" }}>
                            {t("noLocation", locale)}
                          </span>
                        )}
                        <span className="text-xs text-[var(--muted)] mono">{issue.screen}</span>
                      </div>
                      {isHighlighted ? (
                        <p className="text-sm mb-2" style={isResolved ? { textDecoration: "line-through" } : undefined}>{issue.issue}</p>
                      ) : (
                        <ExpandableText text={issue.issue} maxLines={2} className="text-sm mb-2" style={isResolved ? { textDecoration: "line-through" } : undefined} />
                      )}
                      {isHighlighted && (
                        <>
                          {issue.backfireRisk === "High" && (
                            <div className="mb-3 p-3 rounded-md" style={{ background: "#431407" }}>
                              <div className="text-xs font-medium mb-1" style={{ color: "#fdba74" }}>
                                &#9888; {t("backfireWarning", locale)}
                              </div>
                              {issue.backfireReason && (
                                <p style={{ fontSize: "13px", color: "#fdba74", lineHeight: "1.5", margin: 0 }}>{issue.backfireReason}</p>
                              )}
                              {issue.alternative && (
                                <p style={{ fontSize: "13px", color: "#fdba74", lineHeight: "1.5", marginTop: "4px" }}>
                                  {t("backfireAlternative", locale)}: {issue.alternative}
                                </p>
                              )}
                            </div>
                          )}
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
                        </>
                      )}
                      {!isHighlighted && (
                        <p className="text-[11px] text-white/20 mt-1">클릭하여 상세 보기</p>
                      )}
                    </div>
                    {isHighlighted && (
                      <button
                        onClick={handleCopyCard}
                        title="이슈 복사"
                        className="absolute top-2 right-2 flex items-center justify-center rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-white/10 transition-colors"
                        style={{ width: 28, height: 28 }}
                      >
                        {copiedCardIdx === globalIdx ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#fff" }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
