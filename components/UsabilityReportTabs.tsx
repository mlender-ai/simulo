/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import {
  HEATMAP_STORAGE_KEY,
  GRADE_BADGE,
  gradeFromScore,
  RETENTION_RISK_BADGE,
  EFFORT_IMPACT_COLORS,
} from "./report/constants";
import { groupIssuesByScreen, countIssuesPerScreen } from "./report/helpers";
import { Lightbox } from "./report/Lightbox";
import { IssuesTab } from "./report/IssuesTab";
import { CoinIcon, RunnerIcon, BoltIcon } from "./report/icons";

type Tab = "overview" | "quickWins" | "issues";

const EFFORT_RANK: Record<string, number> = { "낮음": 0, Low: 0, "중간": 1, Medium: 1, "높음": 2, High: 2 };
const IMPACT_RANK: Record<string, number> = { "높음": 0, High: 0, "중간": 1, Medium: 1, "낮음": 2, Low: 2 };

export function UsabilityReportTabs({ data, locale }: { data: AnalysisResult; locale: Locale }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState(0);
  const [activeIssueIdx, setActiveIssueIdx] = useState<number | null>(null);
  const [hoveredIssueIdx, setHoveredIssueIdx] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHeatmapOn(localStorage.getItem(HEATMAP_STORAGE_KEY) === "true");
    }
  }, []);

  const toggleHeatmap = useCallback(() => {
    setHeatmapOn((prev) => {
      const next = !prev;
      localStorage.setItem(HEATMAP_STORAGE_KEY, String(next));
      return next;
    });
    setActiveIssueIdx(null);
  }, []);

  const isFlow = data.inputType === "flow";
  const safeIssues = data.issues ?? [];
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  const hasThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);
  const issuesByScreen = groupIssuesByScreen(safeIssues, safeThumbnailUrls);
  const issueCountPerScreen = countIssuesPerScreen(safeIssues);

  const grade = data.grade || gradeFromScore(data.score);
  const gradeBadge = GRADE_BADGE[grade] || GRADE_BADGE["개선 필요"];
  const quickWins = (data.quickWins ?? []).slice().sort((a, b) => {
    const aRank = (IMPACT_RANK[a.impact] ?? 1) * 10 + (EFFORT_RANK[a.effort] ?? 1);
    const bRank = (IMPACT_RANK[b.impact] ?? 1) * 10 + (EFFORT_RANK[b.effort] ?? 1);
    return aRank - bRank;
  });

  const tabItems: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: t("overview", locale) },
    { key: "quickWins", label: `${t("tabQuickWins", locale)} (${quickWins.length})` },
    { key: "issues", label: `${t("issues", locale)} (${safeIssues.length})` },
  ];

  const handleScreenClick = useCallback((index: number) => {
    setSelectedScreen(index);
    setTab("issues");
    setHeatmapOn(true);
  }, []);

  return (
    <div>
      {/* Header: grade badge + score */}
      <div className="flex items-center gap-4 flex-wrap mb-6">
        <div className="text-center">
          <div className="text-5xl font-bold mono">{data.score}</div>
          <div className="text-xs text-[var(--muted)] mt-1">{t("usabilityScore", locale)}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-block text-sm px-3 py-1 rounded"
              style={{ background: gradeBadge.bg, color: gradeBadge.color }}
            >
              {t("gradeLabel", locale)}: {grade}
            </span>
          </div>
          <div className="text-sm text-[var(--muted)]">
            {t("usabilityReportTitle", locale)}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-[var(--border)] w-fit mb-6">
        {tabItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === item.key ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-sm leading-relaxed">{data.summary}</p>
          </div>

          {data.scoreBreakdown && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                {t("scoreBreakdown", locale)}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(["clarity", "flow", "feedback", "efficiency"] as const).map((key) => {
                  const labelKey = key === "flow" ? "flowScore" : key === "feedback" ? "feedbackScore" : key;
                  const entry = data.scoreBreakdown![key];
                  const pct = (entry.score / 25) * 100;
                  const barColor = entry.score >= 20 ? "#22c55e" : entry.score >= 13 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={key} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--muted)] uppercase tracking-wider">
                          {t(labelKey, locale)}
                        </span>
                        <span className="text-sm font-medium mono">{entry.score}/25</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <p style={{ fontSize: "13px", color: "#888", lineHeight: "1.5" }}>{entry.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.desireAlignment && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
                {t("desireAlignment", locale)}
              </h3>
              <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>
                {t("desireAlignmentSub", locale)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["utility", "healthPride", "lossAversion"] as const).map((key) => {
                  const desire = data.desireAlignment![key];
                  const nameKey = key === "utility" ? "desireUtility" : key === "healthPride" ? "desireHealthPride" : "desireLossAversion";
                  const IconComponent = key === "utility" ? CoinIcon : key === "healthPride" ? RunnerIcon : BoltIcon;
                  const pct = (desire.score / 10) * 100;
                  const barColor = desire.score >= 8 ? "#22c55e" : desire.score >= 5 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={key} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ color: barColor }}><IconComponent /></span>
                        <span className="text-sm font-medium">{t(nameKey, locale)}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <span className="text-sm font-bold mono shrink-0">{desire.score}/10</span>
                      </div>
                      <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.6" }}>{desire.comment}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.accessibility4050 && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                {t("accessibility4050Title", locale)}
              </h3>
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold mono">{data.accessibility4050.score}/10</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {(
                    [
                      { key: "fontReadability", labelKey: "fontReadabilityLabel" },
                      { key: "touchTargetSize", labelKey: "touchTargetLabel" },
                      { key: "languageFriendliness", labelKey: "languageFriendlinessLabel" },
                      { key: "visualComplexity", labelKey: "visualComplexityLabel" },
                    ] as const
                  ).map((item) => (
                    <div key={item.key}>
                      <div className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
                        {t(item.labelKey, locale)}
                      </div>
                      <p style={{ fontSize: "13px", color: "#aaa", lineHeight: "1.6" }}>
                        {data.accessibility4050![item.key]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.retentionRisk && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                {t("retentionRisk", locale)}
              </h3>
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex gap-6 mb-4">
                  {(["d1Risk", "d7Risk"] as const).map((riskKey) => {
                    const riskValue = data.retentionRisk![riskKey];
                    const badge = RETENTION_RISK_BADGE[riskValue] || RETENTION_RISK_BADGE.Low;
                    return (
                      <div key={riskKey}>
                        <span className="text-xs text-[var(--muted)] block mb-1">{t(riskKey, locale)}</span>
                        <span
                          className="inline-block text-lg font-bold px-3 py-1 rounded"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {riskValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] block mb-1">{t("mainRiskReasonLabel", locale)}</span>
                  <p style={{ fontSize: "14px", color: "#aaa", lineHeight: "1.7" }}>
                    {data.retentionRisk.mainRiskReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(data.strengths ?? []).length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">{t("strengths", locale)}</h3>
              <ul className="space-y-1.5">
                {data.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-emerald-400 shrink-0">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasThumbnails && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                {t("analyzedScreens", locale)}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
                {safeThumbnailUrls.map((src, i) => {
                  const counts = issueCountPerScreen.get(i);
                  return (
                    <div
                      key={i}
                      className="cursor-pointer group"
                      onClick={() => handleScreenClick(i)}
                    >
                      <div
                        style={{ border: "1px solid #2a2a2a", borderRadius: "6px", overflow: "hidden", height: "120px", position: "relative" }}
                        className="group-hover:border-white/20 transition-colors"
                      >
                        {src === STRIPPED_IMAGE ? (
                          <div style={{ width: "100%", height: "100%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 11, color: "#555" }}>{i + 1}</span>
                          </div>
                        ) : (
                          <img src={src} alt={`${t("screenLabel", locale)} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        {counts && counts.total > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              minWidth: 20,
                              height: 20,
                              borderRadius: 10,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "0 6px",
                              background: counts.critical > 0 ? "#ef4444" : "#f59e0b",
                              color: "#fff",
                            }}
                          >
                            {counts.total}
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: "13px", color: "#666", marginTop: "6px" }}>
                        {isFlow && data.flowSteps?.[i]
                          ? `${t("stepLabel", locale)} ${i + 1}: ${data.flowSteps[i].stepName}`
                          : `${t("screenLabel", locale)} ${i + 1}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "quickWins" && (
        <div>
          <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            {t("quickWinsTitle", locale)}
          </h3>
          {quickWins.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("quickWinsEmpty", locale)}</p>
          ) : (
            <div className="space-y-2">
              {quickWins.map((qw, i) => {
                const isHighPriority =
                  (qw.effort === "낮음" || qw.effort === "Low") &&
                  (qw.impact === "높음" || qw.impact === "High");
                return (
                  <div
                    key={i}
                    className="p-4 rounded-lg border bg-[var(--surface)]"
                    style={{
                      borderColor: isHighPriority ? "rgba(134,239,172,0.35)" : "var(--border)",
                      background: isHighPriority ? "rgba(134,239,172,0.04)" : undefined,
                    }}
                  >
                    {isHighPriority && (
                      <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "#86efac" }}>
                        ★ {t("quickWinsLowEffortHigh", locale)}
                      </div>
                    )}
                    <p className="text-sm mb-2">{qw.issue}</p>
                    <p className="text-sm text-[var(--muted)] mb-3">
                      <span className="text-xs uppercase tracking-wider">{t("recommendation", locale)}: </span>
                      {qw.fix}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[var(--muted)] uppercase tracking-wider mr-1">
                          {t("effortLabel", locale)}:
                        </span>
                        <span className={EFFORT_IMPACT_COLORS[qw.effort] ?? ""}>{qw.effort}</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted)] uppercase tracking-wider mr-1">
                          {t("impactLabel", locale)}:
                        </span>
                        <span className={EFFORT_IMPACT_COLORS[qw.impact] ?? ""}>{qw.impact}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "issues" && (
        <IssuesTab
          data={data}
          locale={locale}
          issuesByScreen={issuesByScreen}
          issueCountPerScreen={issueCountPerScreen}
          isFlow={isFlow}
          heatmapOn={heatmapOn}
          onToggleHeatmap={toggleHeatmap}
          selectedScreen={selectedScreen}
          onSelectScreen={setSelectedScreen}
          activeIssueIdx={activeIssueIdx}
          onSetActiveIssue={setActiveIssueIdx}
          hoveredIssueIdx={hoveredIssueIdx}
          onSetHoveredIssue={setHoveredIssueIdx}
        />
      )}

      {lightboxIndex !== null && hasThumbnails && (
        <Lightbox
          images={safeThumbnailUrls.filter((u) => u !== STRIPPED_IMAGE)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
