/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import { HeatmapViewer, HeatmapIssueDetail, type HeatmapIssue } from "@/components/HeatmapViewer";

const VERDICT_COLORS: Record<string, string> = {
  Pass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Partial: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Fail: "text-red-400 bg-red-400/10 border-red-400/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "text-red-400 bg-red-400/10 border-red-400/20",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const LIKELIHOOD_COLORS: Record<string, string> = {
  High: "text-emerald-400",
  Medium: "text-amber-400",
  Low: "text-red-400",
};


const DESIRE_TYPE_BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  utility: { bg: "#1e3a2a", color: "#86efac", label: "💡 효능감" },
  healthPride: { bg: "#1e2a3a", color: "#93c5fd", label: "🏃 성취" },
  lossAversion: { bg: "#3a1e2a", color: "#f0abfc", label: "⚡ 손실회피" },
  general: { bg: "#1a1a1a", color: "#888", label: "🔧 일반" },
};

const MONEY_LOOP_STAGE_COLORS: Record<string, string> = {
  "유입": "#334155",
  "Acquisition": "#334155",
  "온보딩": "#1e3a5f",
  "온보딩 & 첫 보상 경험": "#1e3a5f",
  "Onboarding": "#1e3a5f",
  "Onboarding & First Reward": "#1e3a5f",
  "기능참여": "#1a3a2a",
  "기능 참여 & 광고 시청": "#1a3a2a",
  "광고시청": "#1a3a2a",
  "Feature Engagement": "#1a3a2a",
  "Feature Engagement & Ad Viewing": "#1a3a2a",
  "마일리지지급": "#3a2a1a",
  "마일리지 지급": "#3a2a1a",
  "Ad Revenue": "#3a2a1a",
  "Mileage Payout": "#3a2a1a",
  "리텐션": "#2a1a3a",
  "Retention": "#2a1a3a",
};

function getMoneyLoopColor(stage: string): string {
  for (const [key, color] of Object.entries(MONEY_LOOP_STAGE_COLORS)) {
    if (stage.includes(key)) return color;
  }
  return "#334155";
}

// SVG Icons for desire alignment
function CoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.5c.3-.7 1-1.2 1.8-1.3 1.4-.2 2.7.7 2.9 2.1.1.7-.1 1.4-.6 1.9-.5.5-1.1.8-1.6.8v1.5" />
      <circle cx="12" cy="16.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function RunnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17" cy="4" r="2" />
      <path d="M15 7l-4 4-3-2-4 4" />
      <path d="M11 11l2 5-3 3" />
      <path d="M7 9l-3 3" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

const RETENTION_RISK_BADGE: Record<string, { bg: string; color: string }> = {
  "높음": { bg: "#450a0a", color: "#fca5a5" },
  "High": { bg: "#450a0a", color: "#fca5a5" },
  "보통": { bg: "#431407", color: "#fdba74" },
  "Medium": { bg: "#431407", color: "#fdba74" },
  "낮음": { bg: "#14532d", color: "#86efac" },
  "Low": { bg: "#14532d", color: "#86efac" },
};

const DROP_OFF_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  High: { text: "text-red-400", border: "border-l-red-500", bg: "bg-red-400/5" },
  Medium: { text: "text-amber-400", border: "border-l-amber-500", bg: "bg-amber-400/5" },
  Low: { text: "text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-400/5" },
  // Korean variants
  "높음": { text: "text-red-400", border: "border-l-red-500", bg: "bg-red-400/5" },
  "보통": { text: "text-amber-400", border: "border-l-amber-500", bg: "bg-amber-400/5" },
  "낮음": { text: "text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-400/5" },
};

type Tab = "overview" | "thinkAloud" | "flow" | "issues";

function Lightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <button className="absolute top-4 right-5 text-white/60 hover:text-white text-2xl leading-none" onClick={onClose}>✕</button>
      {images.length > 1 && (
        <button className="absolute left-4 text-white/50 hover:text-white text-3xl px-3 py-2" onClick={(e) => { e.stopPropagation(); prev(); }}>‹</button>
      )}
      <img src={images[index]} alt={`Screen ${index + 1}`} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "6px" }} onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <button className="absolute right-4 text-white/50 hover:text-white text-3xl px-3 py-2" onClick={(e) => { e.stopPropagation(); next(); }}>›</button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-5 text-white/40 text-sm">{index + 1} / {images.length}</div>
      )}
    </div>
  );
}

// Helper: group issues by screenIndex
function groupIssuesByScreen(
  issues: AnalysisResult["issues"] | undefined,
  thumbnailUrls: string[]
): Map<number, HeatmapIssue[]> {
  const map = new Map<number, HeatmapIssue[]>();
  (issues ?? []).forEach((issue, i) => {
    const screenIdx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
    if (!map.has(screenIdx)) map.set(screenIdx, []);
    map.get(screenIdx)!.push({
      index: i,
      severity: issue.severity,
      desireType: issue.desireType,
      issue: issue.issue,
      recommendation: issue.recommendation,
      retentionImpact: issue.retentionImpact,
      heatZone: issue.heatZone ?? null,
    });
  });
  // Ensure at least an entry for each thumbnail
  thumbnailUrls.forEach((_, idx) => {
    if (!map.has(idx)) map.set(idx, []);
  });
  return map;
}

// Count issues per screen for overview badges
function countIssuesPerScreen(issues: AnalysisResult["issues"] | undefined): Map<number, { total: number; critical: number }> {
  const map = new Map<number, { total: number; critical: number }>();
  (issues ?? []).forEach((issue) => {
    const idx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
    if (!map.has(idx)) map.set(idx, { total: 0, critical: 0 });
    const entry = map.get(idx)!;
    entry.total++;
    if (issue.severity === "Critical" || (issue.severity as string) === "심각") entry.critical++;
  });
  return map;
}

const HEATMAP_STORAGE_KEY = "simulo_heatmap_on";

export function ReportTabs({ data, locale }: { data: AnalysisResult; locale: Locale }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Heatmap state
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState(0);
  const [activeIssueIdx, setActiveIssueIdx] = useState<number | null>(null);
  const [hoveredIssueIdx, setHoveredIssueIdx] = useState<number | null>(null);
  const [flowHeatmapScreen, setFlowHeatmapScreen] = useState<number | null>(null);

  // Restore heatmap toggle from localStorage
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

  const verdictKey = data.verdict as "Pass" | "Partial" | "Fail";
  const likelihoodKey = data.taskSuccessLikelihood as "High" | "Medium" | "Low";
  const isFlow = data.inputType === "flow" && data.flowAnalysis && data.flowAnalysis.length > 0;

  const safeIssues = data.issues ?? [];
  const safeStrengths = data.strengths ?? [];
  const safeThinkAloud = data.thinkAloud ?? [];
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  // Treat stripped-image sentinels as "no image available"
  const hasRealThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);
  const hasThumbnails = hasRealThumbnails;
  const issuesByScreen = groupIssuesByScreen(safeIssues, safeThumbnailUrls);
  const issueCountPerScreen = countIssuesPerScreen(safeIssues);

  const tabItems: { key: Tab; label: string }[] = [
    { key: "overview", label: t("overview", locale) },
    { key: "thinkAloud", label: t("thinkAloud", locale) },
    ...(isFlow ? [{ key: "flow" as Tab, label: t("flowTab", locale) }] : []),
    { key: "issues", label: `${t("issues", locale)} (${safeIssues.length})` },
  ];

  const highRiskCount = isFlow
    ? data.flowAnalysis!.filter((f) => f.dropOffRisk === "High" || f.dropOffRisk === "높음").length
    : 0;

  return (
    <div>
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

      {/* Overview */}
      {tab === "overview" && (
        <div id="overview-tab-content" className="space-y-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-5xl font-bold mono">{data.score}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{t("usabilityScore", locale)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block text-sm px-3 py-1 rounded border ${VERDICT_COLORS[data.verdict] ?? ""}`}>
                  {t(verdictKey, locale)}
                </span>
                {data.moneyLoopStage && (
                  <span
                    className="inline-block text-sm px-3 py-1 rounded-full font-medium"
                    style={{ background: getMoneyLoopColor(data.moneyLoopStage), color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {data.moneyLoopStage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">{t("taskSuccessLikelihood", locale)}:</span>
                <span className={LIKELIHOOD_COLORS[data.taskSuccessLikelihood] ?? ""}>{t(likelihoodKey, locale)}</span>
              </div>
            </div>
          </div>

          {/* Verdict Reason */}
          {data.verdictReason && (
            <div className="flex gap-2 text-sm">
              <span className="text-[var(--muted)] shrink-0">{t("verdictReasonLabel", locale)}:</span>
              <span style={{ color: "#aaa" }}>{data.verdictReason}</span>
            </div>
          )}

          {/* Score Breakdown */}
          {data.scoreBreakdown && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">{t("scoreBreakdown", locale)}</h3>
              <div className="grid grid-cols-2 gap-3">
                {(["clarity", "flow", "feedback", "efficiency"] as const).map((key) => {
                  const labelKey = key === "flow" ? "flowScore" : key === "feedback" ? "feedbackScore" : key;
                  const descKey = key === "flow" ? "flowScoreDesc" : key === "feedback" ? "feedbackScoreDesc" : key === "clarity" ? "clarityDesc" : "efficiencyDesc";
                  const entry = key === "flow"
                    ? data.scoreBreakdown!.flow
                    : key === "feedback"
                      ? data.scoreBreakdown!.feedback
                      : key === "clarity"
                        ? data.scoreBreakdown!.clarity
                        : data.scoreBreakdown!.efficiency;
                  const pct = (entry.score / 25) * 100;
                  const barColor = entry.score >= 20 ? "#22c55e" : entry.score >= 13 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={key} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{t(labelKey, locale)}</span>
                        <span className="text-sm font-medium mono">{entry.score}/25</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#666", marginBottom: "6px" }}>{t(descKey, locale)}</p>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <p style={{ fontSize: "13px", color: "#888", lineHeight: "1.5" }}>{entry.reason}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-sm leading-relaxed">{data.summary}</p>
          </div>

          <div>
            <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">{t("taskSuccessReasoning", locale)}</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">{data.taskSuccessReason}</p>
          </div>

          {safeStrengths.length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">{t("strengths", locale)}</h3>
              <ul className="space-y-1.5">
                {safeStrengths.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-emerald-400 shrink-0">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Desire Alignment */}
          {data.desireAlignment && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">{t("desireAlignment", locale)}</h3>
              <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>{t("desireAlignmentSub", locale)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["utility", "healthPride", "lossAversion"] as const).map((key) => {
                  const desire = data.desireAlignment![key];
                  const nameKey = key === "utility" ? "desireUtility" : key === "healthPride" ? "desireHealthPride" : "desireLossAversion";
                  const descKey = key === "utility" ? "desireUtilityDesc" : key === "healthPride" ? "desireHealthPrideDesc" : "desireLossAversionDesc";
                  const IconComponent = key === "utility" ? CoinIcon : key === "healthPride" ? RunnerIcon : BoltIcon;
                  const pct = (desire.score / 10) * 100;
                  const barColor = desire.score >= 8 ? "#22c55e" : desire.score >= 5 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={key} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ color: barColor }}><IconComponent /></span>
                        <span className="text-sm font-medium">{t(nameKey, locale)}</span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mb-3">{t(descKey, locale)}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
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

          {/* Retention Risk */}
          {data.retentionRisk && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">{t("retentionRisk", locale)}</h3>
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
                  <p style={{ fontSize: "14px", color: "#aaa", lineHeight: "1.7" }}>{data.retentionRisk.mainRiskReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Top Priorities */}
          {data.topPriorities && data.topPriorities.length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">{t("topPrioritiesLabel", locale)}</h3>
              <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>{t("topPrioritiesSub", locale)}</p>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {data.topPriorities.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3"
                    style={i < data.topPriorities!.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
                  >
                    <span
                      className="shrink-0 flex items-center justify-center rounded-full font-bold"
                      style={{ width: "24px", height: "24px", fontSize: "13px", background: "#fff", color: "#000" }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: "14px", color: "#e5e5e5" }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasThumbnails && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">{t("analyzedScreens", locale)}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
                {safeThumbnailUrls.map((src, i) => {
                  const counts = issueCountPerScreen.get(i);
                  return (
                    <div
                      key={i}
                      className="cursor-pointer group"
                      onClick={() => {
                        setSelectedScreen(i);
                        setTab("issues");
                        setHeatmapOn(true);
                        localStorage.setItem(HEATMAP_STORAGE_KEY, "true");
                      }}
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

      {/* Think Aloud */}
      {tab === "thinkAloud" && (
        <div className="space-y-4">
          {safeThinkAloud.map((entry, i) => (
            <div key={i} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="text-xs text-[var(--muted)] mono mb-2">{entry.screen}</div>
              <p className="text-sm leading-relaxed italic">&ldquo;{entry.thought}&rdquo;</p>
            </div>
          ))}
        </div>
      )}

      {/* Flow Analysis */}
      {tab === "flow" && isFlow && (
        <div className="space-y-0">
          {/* Summary */}
          <div className="mb-5 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <p className="text-sm">
              <span className="font-medium">{data.flowAnalysis!.length}{t("dropOffSummary", locale)}</span>{" "}
              <span className="text-red-400 font-medium">{highRiskCount}</span>
              {t("dropOffSummaryEnd", locale)}
            </p>
          </div>

          {data.flowAnalysis!.map((entry, i) => {
            const colors = DROP_OFF_COLORS[entry.dropOffRisk] || DROP_OFF_COLORS.Low;
            const isHighRisk = entry.dropOffRisk === "High" || entry.dropOffRisk === "높음";

            return (
              <div key={i} className="relative">
                {/* Vertical connector */}
                {i > 0 && (
                  <div className="flex justify-start ml-[18px] -mt-0">
                    <div className="w-px h-4 bg-[var(--border)]" />
                  </div>
                )}

                <div
                  className={`p-4 rounded-lg border border-[var(--border)] ${colors.bg} ${
                    isHighRisk ? "border-l-2 border-l-red-500" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Step number */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                        isHighRisk ? "bg-red-400/15 text-red-400" : "bg-white/10"
                      }`}>
                        {entry.step}
                      </div>
                    </div>

                    {/* Thumbnail */}
                    {hasThumbnails && safeThumbnailUrls[i] && safeThumbnailUrls[i] !== STRIPPED_IMAGE && (
                      <div
                        className="shrink-0 rounded overflow-hidden border border-[var(--border)] cursor-pointer"
                        style={{ width: 64, height: 48 }}
                        onClick={() => {
                          const stepIssues = issuesByScreen.get(i);
                          if (stepIssues && stepIssues.some((iss) => iss.heatZone)) {
                            setFlowHeatmapScreen(i);
                          } else {
                            setLightboxIndex(i);
                          }
                        }}
                      >
                        <img src={safeThumbnailUrls[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{entry.stepName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${
                          isHighRisk
                            ? "border-red-400/20 bg-red-400/10 text-red-400"
                            : entry.dropOffRisk === "Medium" || entry.dropOffRisk === "보통"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-400"
                              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                        }`}>
                          {t("dropOffRisk", locale)}: {entry.dropOffRisk}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)] leading-relaxed">{entry.reason}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issues */}
      {tab === "issues" && (
        <div>
          {safeIssues.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("noIssues", locale)}</p>
          ) : (
            <>
              {/* Top bar: heatmap toggle */}
              {hasThumbnails && (
                <div className="flex items-center justify-between mb-4">
                  {/* Screen selector tabs */}
                  {safeThumbnailUrls.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {safeThumbnailUrls.map((_, i) => {
                        const screenCounts = issueCountPerScreen.get(i);
                        const label = isFlow && data.flowSteps?.[i]
                          ? `${t("stepLabel", locale)} ${i + 1}`
                          : `${t("screenLabel", locale)} ${i + 1}`;
                        return (
                          <button
                            key={i}
                            onClick={() => { setSelectedScreen(i); setActiveIssueIdx(null); }}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              selectedScreen === i
                                ? "bg-white/10 text-white"
                                : "text-[var(--muted)] hover:text-white"
                            }`}
                          >
                            {label}
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
                    onClick={toggleHeatmap}
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

              {/* Heatmap view */}
              {heatmapOn && hasThumbnails && safeThumbnailUrls[selectedScreen] && safeThumbnailUrls[selectedScreen] !== STRIPPED_IMAGE && (
                <div className="mb-6">
                  <HeatmapViewer
                    imageUrl={safeThumbnailUrls[selectedScreen]}
                    imageName={
                      isFlow && data.flowSteps?.[selectedScreen]
                        ? `${t("stepLabel", locale)} ${selectedScreen + 1}: ${data.flowSteps[selectedScreen].stepName}`
                        : `${t("screenLabel", locale)} ${selectedScreen + 1}`
                    }
                    issues={issuesByScreen.get(selectedScreen) || []}
                    activeIssueIndex={activeIssueIdx}
                    onIssueClick={setActiveIssueIdx}
                    onIssueHover={setHoveredIssueIdx}
                    hoveredIssueIndex={hoveredIssueIdx}
                  />

                  {/* Active issue detail panel */}
                  {activeIssueIdx !== null && (() => {
                    const screenIssues = issuesByScreen.get(selectedScreen) || [];
                    const active = screenIssues.find((iss) => iss.index === activeIssueIdx);
                    if (!active) return null;
                    return (
                      <HeatmapIssueDetail
                        issue={active}
                        onClose={() => setActiveIssueIdx(null)}
                      />
                    );
                  })()}
                </div>
              )}

              {/* Issue list */}
              <div className="space-y-3">
                {safeIssues.map((issue, i) => {
                  const severityKey = issue.severity as "Critical" | "Medium" | "Low";
                  const screenIdx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
                  // In heatmap mode, only show issues for the selected screen
                  if (heatmapOn && hasThumbnails && screenIdx !== selectedScreen) return null;
                  const isHighlighted = hoveredIssueIdx === i || activeIssueIdx === i;

                  return (
                    <div
                      key={i}
                      className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors cursor-pointer"
                      style={isHighlighted ? { borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)" } : {}}
                      onMouseEnter={() => setHoveredIssueIdx(i)}
                      onMouseLeave={() => setHoveredIssueIdx(null)}
                      onClick={() => setActiveIssueIdx(activeIssueIdx === i ? null : i)}
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
            </>
          )}
        </div>
      )}

      {lightboxIndex !== null && hasThumbnails && (
        <Lightbox
          images={safeThumbnailUrls.filter((u) => u !== STRIPPED_IMAGE)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Flow heatmap modal */}
      {flowHeatmapScreen !== null && hasThumbnails && safeThumbnailUrls[flowHeatmapScreen] && safeThumbnailUrls[flowHeatmapScreen] !== STRIPPED_IMAGE && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setFlowHeatmapScreen(null)}
        >
          <div
            className="relative"
            style={{ maxWidth: 700, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-8 right-0 text-white/60 hover:text-white text-xl"
              onClick={() => setFlowHeatmapScreen(null)}
            >
              ✕
            </button>
            <HeatmapViewer
              imageUrl={safeThumbnailUrls[flowHeatmapScreen]}
              imageName={
                data.flowSteps?.[flowHeatmapScreen]
                  ? `${t("stepLabel", locale)} ${flowHeatmapScreen + 1}: ${data.flowSteps[flowHeatmapScreen].stepName}`
                  : `${t("screenLabel", locale)} ${flowHeatmapScreen + 1}`
              }
              issues={issuesByScreen.get(flowHeatmapScreen) || []}
              activeIssueIndex={activeIssueIdx}
              onIssueClick={setActiveIssueIdx}
              onIssueHover={setHoveredIssueIdx}
              hoveredIssueIndex={hoveredIssueIdx}
            />
            {activeIssueIdx !== null && (() => {
              const flowIssues = issuesByScreen.get(flowHeatmapScreen) || [];
              const active = flowIssues.find((iss) => iss.index === activeIssueIdx);
              if (!active) return null;
              return <HeatmapIssueDetail issue={active} onClose={() => setActiveIssueIdx(null)} />;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
