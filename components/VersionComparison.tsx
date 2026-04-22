"use client";

import type { AnalysisResult, DesireAlignment } from "@/lib/storage";
import { gradeFromScore, GRADE_BADGE } from "@/components/report/constants";

interface VersionComparisonProps {
  original: AnalysisResult;
  improved: AnalysisResult;
}

// ── ScoreBlock ────────────────────────────────────────────────────────────────
function ScoreBlock({ score, label }: { score: number; label: string }) {
  const grade = gradeFromScore(score);
  const badge = GRADE_BADGE[grade];
  return (
    <div className="text-center">
      <p className="mono text-3xl font-bold text-white">{score}</p>
      <span
        className="inline-block text-[10px] px-1.5 py-0.5 rounded mt-1"
        style={{ background: badge.bg, color: badge.color }}
      >
        {label}
      </span>
    </div>
  );
}

// ── DiffBadge ─────────────────────────────────────────────────────────────────
function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) {
    return (
      <span className="mono text-xs px-2 py-0.5 rounded bg-white/5 text-[var(--muted)]">
        변화 없음
      </span>
    );
  }
  const positive = diff > 0;
  return (
    <span
      className="mono text-xs font-medium px-2 py-0.5 rounded"
      style={
        positive
          ? { background: "#14532d", color: "#86efac" }
          : { background: "#450a0a", color: "#fca5a5" }
      }
    >
      {positive ? "+" : ""}
      {diff} {positive ? "↑" : "↓"}
    </span>
  );
}

// ── DesireBar ─────────────────────────────────────────────────────────────────
function DesireBar({
  value,
  max = 10,
  variant,
}: {
  value: number;
  max?: number;
  variant: "before" | "after";
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: variant === "after" ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.25)",
          }}
        />
      </div>
      <span
        className="mono text-[11px] w-3 text-right"
        style={{ color: variant === "after" ? "#6ee7b7" : "#555" }}
      >
        {value}
      </span>
    </div>
  );
}

const DESIRE_KEYS = ["utility", "healthPride", "lossAversion"] as const;
type DesireKey = (typeof DESIRE_KEYS)[number];

const DESIRE_LABEL: Record<DesireKey, string> = {
  utility: "효능감",
  healthPride: "성취·과시",
  lossAversion: "손실회피",
};

function getDesireScore(
  desire: DesireAlignment | undefined | null,
  key: DesireKey
): number {
  return desire?.[key]?.score ?? 0;
}

export function VersionComparison({ original, improved }: VersionComparisonProps) {
  const scoreDiff = improved.score - original.score;

  // Issues resolved = in original but not in improved (by issue text)
  const improvedIssueTexts = new Set(
    (improved.issues ?? []).map((i) => i.issue)
  );
  const resolvedIssues = (original.issues ?? []).filter(
    (i) => !improvedIssueTexts.has(i.issue)
  );

  // Remaining issues in improved that are Critical or Medium
  const remainingIssues = (improved.issues ?? []).filter((i) => {
    const s = i.severity as string;
    return s === "Critical" || s === "Medium" || s === "심각" || s === "보통";
  });

  const origDesire = original.desireAlignment;
  const imprDesire = improved.desireAlignment;
  const hasDesire = origDesire || imprDesire;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-[#1a1a1a]">
        <p className="text-sm font-medium text-white">이전 분석 vs 개선안</p>
      </div>

      {/* Score comparison */}
      <div className="p-5 border-b border-[#1a1a1a]">
        <p className="text-xs text-[var(--muted)] mb-3">점수 변화</p>
        <div className="flex items-center gap-3">
          <ScoreBlock score={original.score} label="이전" />
          <p className="text-[var(--muted)] text-lg">→</p>
          <ScoreBlock score={improved.score} label="개선안" />
          <DiffBadge diff={scoreDiff} />
        </div>
      </div>

      {/* Desire alignment comparison */}
      {hasDesire && (
        <div className="p-5 border-b border-[#1a1a1a]">
          <p className="text-xs text-[var(--muted)] mb-3">욕망 충족도 변화</p>
          <div className="space-y-3">
            {DESIRE_KEYS.map((key) => {
              const before = getDesireScore(origDesire, key);
              const after = getDesireScore(imprDesire, key);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-white/50">
                      {DESIRE_LABEL[key]}
                    </span>
                    <span className="mono text-[11px] text-[var(--muted)]">
                      {before} → {after}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <DesireBar value={before} variant="before" />
                    <DesireBar value={after} variant="after" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolved issues */}
      {resolvedIssues.length > 0 && (
        <div className="px-5 pt-4 pb-3">
          <p className="text-xs text-[var(--muted)] mb-2">해결된 이슈</p>
          <ul className="space-y-1.5">
            {resolvedIssues.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-emerald-400"
              >
                <span className="shrink-0">✓</span>
                <span>{issue.issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Remaining issues */}
      {remainingIssues.length > 0 && (
        <div className="px-5 pt-1 pb-4">
          <p className="text-xs text-[var(--muted)] mb-2">남은 이슈</p>
          <ul className="space-y-1.5">
            {remainingIssues.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-amber-400/80"
              >
                <span className="shrink-0">⚠</span>
                <span>{issue.issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
