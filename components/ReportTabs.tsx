"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";

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

const DESIRE_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  utility: { bar: "#3b82f6", bg: "bg-blue-400/10", text: "text-blue-400" },
  healthPride: { bar: "#a855f7", bg: "bg-purple-400/10", text: "text-purple-400" },
  lossAversion: { bar: "#f97316", bg: "bg-orange-400/10", text: "text-orange-400" },
};

const DESIRE_TYPE_BADGE: Record<string, string> = {
  utility: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  healthPride: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  lossAversion: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  general: "text-gray-400 bg-gray-400/10 border-gray-400/20",
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

export function ReportTabs({ data, locale }: { data: AnalysisResult; locale: Locale }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const verdictKey = data.verdict as "Pass" | "Partial" | "Fail";
  const likelihoodKey = data.taskSuccessLikelihood as "High" | "Medium" | "Low";
  const isFlow = data.inputType === "flow" && data.flowAnalysis && data.flowAnalysis.length > 0;
  const hasThumbnails = data.thumbnailUrls && data.thumbnailUrls.length > 0;

  const tabItems: { key: Tab; label: string }[] = [
    { key: "overview", label: t("overview", locale) },
    { key: "thinkAloud", label: t("thinkAloud", locale) },
    ...(isFlow ? [{ key: "flow" as Tab, label: t("flowTab", locale) }] : []),
    { key: "issues", label: `${t("issues", locale)} (${data.issues.length})` },
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
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold mono">{data.score}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{t("usabilityScore", locale)}</div>
            </div>
            <div className="space-y-2">
              <span className={`inline-block text-sm px-3 py-1 rounded border ${VERDICT_COLORS[data.verdict] ?? ""}`}>
                {t(verdictKey, locale)}
              </span>
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
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{t(labelKey, locale)}</span>
                        <span className="text-sm font-medium mono">{entry.score}/25</span>
                      </div>
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

          {data.strengths.length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">{t("strengths", locale)}</h3>
              <ul className="space-y-1.5">
                {data.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-emerald-400 shrink-0">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Money Loop Stage */}
          {data.moneyLoopStage && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{t("moneyLoopStage", locale)}:</span>
              <span className="text-sm px-3 py-1 rounded border border-[var(--border)] bg-white/5 font-medium">
                {data.moneyLoopStage}
              </span>
            </div>
          )}

          {/* Desire Alignment */}
          {data.desireAlignment && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">{t("desireAlignment", locale)}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["utility", "healthPride", "lossAversion"] as const).map((key) => {
                  const desire = data.desireAlignment![key];
                  const colors = DESIRE_COLORS[key];
                  const nameKey = key === "utility" ? "desireUtility" : key === "healthPride" ? "desireHealthPride" : "desireLossAversion";
                  const descKey = key === "utility" ? "desireUtilityDesc" : key === "healthPride" ? "desireHealthPrideDesc" : "desireLossAversionDesc";
                  const pct = (desire.score / 10) * 100;
                  return (
                    <div key={key} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${colors.text}`}>{t(nameKey, locale)}</span>
                        <span className="text-sm font-bold mono">{desire.score}/10</span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mb-2">{t(descKey, locale)}</p>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors.bar }} />
                      </div>
                      <p style={{ fontSize: "12px", color: "#888", lineHeight: "1.4" }}>{desire.comment}</p>
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
                <div className="flex gap-6 mb-3">
                  <div>
                    <span className="text-xs text-[var(--muted)]">{t("d1Risk", locale)}</span>
                    <div className={`text-sm font-medium ${
                      data.retentionRisk.d1Risk === "High" || data.retentionRisk.d1Risk === "높음" ? "text-red-400" :
                      data.retentionRisk.d1Risk === "Medium" || data.retentionRisk.d1Risk === "보통" ? "text-amber-400" : "text-emerald-400"
                    }`}>{data.retentionRisk.d1Risk}</div>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--muted)]">{t("d7Risk", locale)}</span>
                    <div className={`text-sm font-medium ${
                      data.retentionRisk.d7Risk === "High" || data.retentionRisk.d7Risk === "높음" ? "text-red-400" :
                      data.retentionRisk.d7Risk === "Medium" || data.retentionRisk.d7Risk === "보통" ? "text-amber-400" : "text-emerald-400"
                    }`}>{data.retentionRisk.d7Risk}</div>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)]">{t("mainRiskReason", locale)}: </span>
                  <span className="text-sm">{data.retentionRisk.mainRiskReason}</span>
                </div>
              </div>
            </div>
          )}

          {/* Top Priorities */}
          {data.topPriorities && data.topPriorities.length > 0 && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">{t("topPrioritiesLabel", locale)}</h3>
              <ol className="space-y-1.5">
                {data.topPriorities.map((p, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-[var(--muted)] shrink-0 mono">{i + 1}.</span>{p}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {hasThumbnails && (
            <div>
              <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">{t("analyzedScreens", locale)}</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
                {data.thumbnailUrls.map((src, i) => (
                  <div key={i} className="cursor-pointer group" onClick={() => setLightboxIndex(i)}>
                    <div style={{ border: "1px solid #2a2a2a", borderRadius: "6px", overflow: "hidden", height: "120px" }} className="group-hover:border-white/20 transition-colors">
                      <img src={src} alt={`${t("screenLabel", locale)} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <p style={{ fontSize: "13px", color: "#666", marginTop: "6px" }}>
                      {isFlow && data.flowSteps?.[i]
                        ? `${t("stepLabel", locale)} ${i + 1}: ${data.flowSteps[i].stepName}`
                        : `${t("screenLabel", locale)} ${i + 1}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Think Aloud */}
      {tab === "thinkAloud" && (
        <div className="space-y-4">
          {data.thinkAloud.map((entry, i) => (
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
                    {hasThumbnails && data.thumbnailUrls[i] && (
                      <div
                        className="shrink-0 rounded overflow-hidden border border-[var(--border)] cursor-pointer"
                        style={{ width: 64, height: 48 }}
                        onClick={() => setLightboxIndex(i)}
                      >
                        <img src={data.thumbnailUrls[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
        <div className="space-y-3">
          {data.issues.length === 0 && (
            <p className="text-sm text-[var(--muted)]">{t("noIssues", locale)}</p>
          )}
          {data.issues.map((issue, i) => {
            const severityKey = issue.severity as "Critical" | "Medium" | "Low";
            return (
              <div key={i} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded border ${SEVERITY_COLORS[issue.severity] ?? ""}`}>
                    {t(severityKey, locale)}
                  </span>
                  {issue.desireType && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${DESIRE_TYPE_BADGE[issue.desireType] ?? DESIRE_TYPE_BADGE.general}`}>
                      {t("desireType", locale)}: {t(
                        issue.desireType === "utility" ? "desireUtility" :
                        issue.desireType === "healthPride" ? "desireHealthPride" :
                        issue.desireType === "lossAversion" ? "desireLossAversion" : "desireType",
                        locale
                      )}
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
                  <p className="text-sm text-orange-400/80 mt-2">
                    <span className="text-xs uppercase tracking-wider">{t("retentionImpact", locale)}: </span>
                    {issue.retentionImpact}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && hasThumbnails && (
        <Lightbox images={data.thumbnailUrls} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
