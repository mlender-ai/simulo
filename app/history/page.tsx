/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { storage, type AnalysisResult } from "@/lib/storage";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { ShareExportPanel } from "@/components/ShareExportPanel";
import { gradeFromScore } from "@/components/report/constants";

const VERDICT_COLORS: Record<string, string> = {
  Pass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Partial: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Fail: "text-red-400 bg-red-400/10 border-red-400/20",
};

const GRADE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  "우수": { bg: "rgba(20,83,45,0.25)", color: "#86efac", border: "rgba(134,239,172,0.25)" },
  "양호": { bg: "rgba(30,58,95,0.4)", color: "#93c5fd", border: "rgba(147,197,253,0.25)" },
  "개선 필요": { bg: "rgba(67,20,7,0.35)", color: "#fdba74", border: "rgba(253,186,116,0.25)" },
  "미흡": { bg: "rgba(69,10,10,0.35)", color: "#fca5a5", border: "rgba(252,165,165,0.25)" },
};

const MODE_BADGE: Record<string, { bg: string; color: string; border: string; labelKey: "modeBadgeHypothesis" | "modeBadgeUsability" }> = {
  hypothesis: { bg: "rgba(30,58,95,0.5)", color: "#93c5fd", border: "rgba(147,197,253,0.2)", labelKey: "modeBadgeHypothesis" },
  usability: { bg: "rgba(42,26,58,0.6)", color: "#d8b4fe", border: "rgba(216,180,254,0.2)", labelKey: "modeBadgeUsability" },
};

const INPUT_TYPE_BADGE: Record<string, { icon: string; labelKey: "inputTypeImage" | "inputTypeUrl" | "inputTypeFlow" | "inputTypeFigma" | "inputTypeComparison" | "inputTypeVideo" | "inputTypeCode" }> = {
  image: { icon: "🖼", labelKey: "inputTypeImage" },
  url: { icon: "🔗", labelKey: "inputTypeUrl" },
  flow: { icon: "↔", labelKey: "inputTypeFlow" },
  figma: { icon: "◆", labelKey: "inputTypeFigma" },
  comparison: { icon: "⇄", labelKey: "inputTypeComparison" },
  video: { icon: "▶", labelKey: "inputTypeVideo" },
  code: { icon: "<>", labelKey: "inputTypeCode" },
};

function AnalysisCard({
  analysis,
  locale,
  isChild,
  selectable,
  selected,
  onToggleSelect,
  onReanalyze,
}: {
  analysis: AnalysisResult;
  locale: Locale;
  isChild: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onReanalyze: (analysis: AnalysisResult) => void;
}) {
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
        <div
          className="absolute left-2 top-0 bottom-0 flex flex-col items-center"
          style={{ width: 16 }}
        >
          <div className="w-px flex-1 bg-[var(--border)]" style={{ marginTop: 12 }} />
        </div>
      )}
      {isChild && (
        <div
          className="absolute text-[var(--muted)] text-[10px]"
          style={{ left: 14, top: 14 }}
        >
          └
        </div>
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
            {analysis.thumbnailUrls?.[0] &&
              analysis.thumbnailUrls[0] !== STRIPPED_IMAGE && (
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
                  {/* Input type badge */}
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
                      style={{
                        background: modeBadge.bg,
                        color: modeBadge.color,
                        borderColor: modeBadge.border,
                      }}
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
                    style={
                      gradeBadge
                        ? {
                            background: gradeBadge.bg,
                            color: gradeBadge.color,
                            borderColor: gradeBadge.border,
                          }
                        : undefined
                    }
                  >
                    {grade}
                  </span>
                ) : (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${VERDICT_COLORS[analysis.verdict] ?? ""}`}
                  >
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

export default function HistoryPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ko");
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [filter, setFilter] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [inputTypeFilter, setInputTypeFilter] = useState<string>("all");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocale(getLocale());

    // Try DB first, fall back to localStorage
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.analyses && data.analyses.length > 0) {
          setAnalyses(data.analyses);
        } else {
          setAnalyses(storage.getAll());
        }
      })
      .catch(() => {
        setAnalyses(storage.getAll());
      });
  }, []);

  const handleReanalyze = useCallback((analysis: AnalysisResult) => {
    // Store params in sessionStorage so the main page can restore them.
    // analysisId is included so the main page can hydrate images from IndexedDB.
    const params = {
      analysisId: analysis.id,
      hypothesis: analysis.hypothesis,
      targetUser: analysis.targetUser,
      task: analysis.task,
      projectTag: analysis.projectTag,
      mode: analysis.mode ?? "hypothesis",
      inputType: analysis.inputType,
    };
    sessionStorage.setItem("simulo_reanalyze", JSON.stringify(params));
    router.push("/");
  }, [router]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!confirm(t("deleteSelectedConfirm", locale))) return;
    Array.from(selectedIds).forEach((id) => {
      storage.deleteById(id);
    });
    setAnalyses(storage.getAll());
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, locale]);

  // Collect available input types for filter
  const availableInputTypes = Array.from(new Set(analyses.map((a) => a.inputType).filter(Boolean)));

  const filtered = analyses.filter((a) => {
    const matchesSearch =
      !filter ||
      a.hypothesis.toLowerCase().includes(filter.toLowerCase()) ||
      a.projectTag?.toLowerCase().includes(filter.toLowerCase());
    const matchesVerdict =
      verdictFilter === "all" || a.verdict === verdictFilter;
    const rowMode = a.mode ?? "hypothesis";
    const matchesMode = modeFilter === "all" || rowMode === modeFilter;
    const matchesInputType = inputTypeFilter === "all" || a.inputType === inputTypeFilter;
    return matchesSearch && matchesVerdict && matchesMode && matchesInputType;
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">
          {t("history", locale)}
        </h1>
        <p className="text-[var(--muted)] text-sm">
          {analyses.length}{t("analysesTotal", locale)}
        </p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("searchPlaceholder", locale)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
        />
        {/* Input type filter */}
        {availableInputTypes.length > 1 && (
          <select
            value={inputTypeFilter}
            onChange={(e) => setInputTypeFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none"
          >
            <option value="all">{t("filterInputTypeAll", locale)}</option>
            {availableInputTypes.map((type) => {
              const badge = INPUT_TYPE_BADGE[type];
              return (
                <option key={type} value={type}>
                  {badge ? `${badge.icon} ${t(badge.labelKey, locale)}` : type}
                </option>
              );
            })}
          </select>
        )}
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none"
        >
          <option value="all">{t("filterModeAll", locale)}</option>
          <option value="hypothesis">{t("filterModeHypothesis", locale)}</option>
          <option value="usability">{t("filterModeUsability", locale)}</option>
        </select>
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none"
        >
          <option value="all">{t("all", locale)}</option>
          <option value="Pass">{t("Pass", locale)}</option>
          <option value="Partial">{t("Partial", locale)}</option>
          <option value="Fail">{t("Fail", locale)}</option>
        </select>
      </div>

      {/* Bulk actions bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
            bulkMode
              ? "bg-white/10 text-white border-white/20"
              : "text-[var(--muted)] border-[var(--border)] hover:text-white"
          }`}
        >
          {t("bulkDelete", locale)}
        </button>
        {bulkMode && (
          <>
            <button
              onClick={() => {
                if (selectedIds.size === filtered.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(filtered.map((a) => a.id)));
                }
              }}
              className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors"
            >
              {selectedIds.size === filtered.length ? t("deselectAll", locale) : t("selectAll", locale)}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-xs rounded-md border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
              >
                {t("deleteSelected", locale)} ({selectedIds.size})
              </button>
            )}
          </>
        )}
      </div>

      <div className="space-y-6">
        {(() => {
          // Group improvements under their parent
          const parentMap = new Map<string, AnalysisResult[]>();
          const roots: AnalysisResult[] = [];

          for (const a of filtered) {
            if (a.isImprovement && a.previousAnalysisId) {
              const children = parentMap.get(a.previousAnalysisId) ?? [];
              children.push(a);
              parentMap.set(a.previousAnalysisId, children);
            } else {
              roots.push(a);
            }
          }

          // Date group buckets
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const yesterdayStart = todayStart - 86400000;
          const weekStart = todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;

          const getGroup = (createdAt: string) => {
            const t = new Date(createdAt).getTime();
            if (t >= todayStart) return "오늘";
            if (t >= yesterdayStart) return "어제";
            if (t >= weekStart) return "이번 주";
            return "이전";
          };

          const GROUP_ORDER = ["오늘", "어제", "이번 주", "이전"];
          const grouped: Record<string, AnalysisResult[]> = {};
          for (const a of roots) {
            const g = getGroup(a.createdAt);
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(a);
          }

          if (roots.length === 0) {
            return (
              <div className="text-center py-16 text-[var(--muted)]">
                <p className="text-sm">{t("noAnalysesFound", locale)}</p>
              </div>
            );
          }

          return GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-xs text-[var(--muted)] uppercase tracking-wider font-medium">
                  {group}
                </span>
                <span className="text-xs text-[var(--muted)]">· {grouped[group].length}건</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>
              <div className="space-y-2">
                {grouped[group].map((analysis) => {
                  const children = parentMap.get(analysis.id) ?? [];
                  return (
                    <div key={analysis.id} className="space-y-1">
                      <AnalysisCard
                        analysis={analysis}
                        locale={locale}
                        isChild={false}
                        selectable={bulkMode}
                        selected={selectedIds.has(analysis.id)}
                        onToggleSelect={toggleSelect}
                        onReanalyze={handleReanalyze}
                      />
                      {children.map((child) => (
                        <AnalysisCard
                          key={child.id}
                          analysis={child}
                          locale={locale}
                          isChild
                          selectable={bulkMode}
                          selected={selectedIds.has(child.id)}
                          onToggleSelect={toggleSelect}
                          onReanalyze={handleReanalyze}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
