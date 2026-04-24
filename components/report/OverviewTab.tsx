/* eslint-disable @next/next/no-img-element */
"use client";

import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import {
  VERDICT_COLORS,
  LIKELIHOOD_COLORS,
  RETENTION_RISK_BADGE,
  getMoneyLoopColor,
  HEATMAP_STORAGE_KEY,
} from "./constants";
import { CoinIcon, RunnerIcon, BoltIcon } from "./icons";

interface OverviewTabProps {
  data: AnalysisResult;
  locale: Locale;
  issueCountPerScreen: Map<number, { total: number; critical: number }>;
  isFlow: boolean;
  onScreenClick: (index: number) => void;
}

export function OverviewTab({ data, locale, issueCountPerScreen, isFlow, onScreenClick }: OverviewTabProps) {
  const verdictKey = data.verdict as "Pass" | "Partial" | "Fail";
  const likelihoodKey = data.taskSuccessLikelihood as "High" | "Medium" | "Low";
  const safeStrengths = data.strengths ?? [];
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  const hasThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);

  return (
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

      {data.verdictReason && (
        <div className="flex gap-2 text-sm">
          <span className="text-[var(--muted)] shrink-0">{t("verdictReasonLabel", locale)}:</span>
          <span style={{ color: "#aaa" }}>{data.verdictReason}</span>
        </div>
      )}

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

      {(data.evidenceFor?.length || data.evidenceAgainst?.length) && (
        <div>
          <h3 className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3">{t("hypothesisEvidence", locale)}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.evidenceFor && data.evidenceFor.length > 0 && (
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#22c55e" }}>
                  <span>&#10003;</span> {t("evidenceFor", locale)}
                </h4>
                <ul className="space-y-1.5">
                  {data.evidenceFor.map((e, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-emerald-400 shrink-0">+</span>
                      <span style={{ color: "#aaa" }}>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.evidenceAgainst && data.evidenceAgainst.length > 0 && (
              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#ef4444" }}>
                  <span>&#10007;</span> {t("evidenceAgainst", locale)}
                </h4>
                <ul className="space-y-1.5">
                  {data.evidenceAgainst.map((e, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-red-400 shrink-0">&minus;</span>
                      <span style={{ color: "#aaa" }}>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {data.confidence && (
            <div className="mt-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <span className="text-xs text-[var(--muted)]">{t("confidenceLabel", locale)}: </span>
              <span className={`text-sm font-medium ${
                data.confidence === "High" ? "text-emerald-400" : data.confidence === "Medium" ? "text-amber-400" : "text-red-400"
              }`}>
                {t(data.confidence as "High" | "Medium" | "Low", locale)}
              </span>
              {data.confidenceReason && (
                <span style={{ fontSize: "13px", color: "#888", marginLeft: "8px" }}>&mdash; {data.confidenceReason}</span>
              )}
            </div>
          )}
        </div>
      )}

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
                    onScreenClick(i);
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
  );
}
