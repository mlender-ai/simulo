"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type AnalysisResult } from "@/lib/storage";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { useHistory, GROUP_ORDER } from "@/hooks/useHistory";
import { HistoryCard, INPUT_TYPE_BADGE } from "@/components/history/HistoryCard";
import { TrendChart } from "@/components/history/TrendChart";

export default function HistoryPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ko");
  const [view, setView] = useState<"list" | "trend">("list");

  useEffect(() => { setLocale(getLocale()); }, []);

  const {
    analyses,
    filter, setFilter,
    verdictFilter, setVerdictFilter,
    modeFilter, setModeFilter,
    inputTypeFilter, setInputTypeFilter,
    fromDate, setFromDate,
    toDate, setToDate,
    hasActiveFilter,
    clearFilters,
    bulkMode, setBulkMode,
    selectedIds,
    availableInputTypes,
    filtered,
    roots,
    parentMap,
    grouped,
    toggleSelect,
    selectAll,
    deleteSelected,
  } = useHistory(locale);

  const handleReanalyze = useCallback((analysis: AnalysisResult) => {
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

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-5 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold mb-1">{t("history", locale)}</h1>
        <p className="text-[var(--muted)] text-sm">
          {analyses.length}{t("analysesTotal", locale)}
        </p>
      </div>

      {/* View toggle */}
      {analyses.length > 0 && (
        <div className="flex gap-1 mb-5">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              view === "list"
                ? "bg-white/10 text-white border-white/20"
                : "text-[var(--muted)] border-[var(--border)] hover:text-white"
            }`}
          >
            목록
          </button>
          <button
            onClick={() => setView("trend")}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              view === "trend"
                ? "bg-white/10 text-white border-white/20"
                : "text-[var(--muted)] border-[var(--border)] hover:text-white"
            }`}
          >
            트렌드
          </button>
        </div>
      )}

      {/* Trend view */}
      {view === "trend" && (
        <TrendChart analyses={filtered} />
      )}

      {/* List view filters and cards */}
      {view === "list" && (
      <>
      {/* Filters — 검색 + 셀렉트 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("searchPlaceholder", locale)}
          className="flex-1 min-w-0 px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 min-h-[44px]"
        />
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          {availableInputTypes.length > 1 && (
            <select
              value={inputTypeFilter}
              onChange={(e) => setInputTypeFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none min-h-[44px]"
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
            className="flex-1 sm:flex-none px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none min-h-[44px]"
          >
            <option value="all">{t("filterModeAll", locale)}</option>
            <option value="hypothesis">{t("filterModeHypothesis", locale)}</option>
            <option value="usability">{t("filterModeUsability", locale)}</option>
          </select>
          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none min-h-[44px]"
          >
            <option value="all">{t("all", locale)}</option>
            <option value="Pass">{t("Pass", locale)}</option>
            <option value="Partial">{t("Partial", locale)}</option>
            <option value="Fail">{t("Fail", locale)}</option>
          </select>
        </div>
      </div>

      {/* Date range filter */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr] sm:flex sm:flex-row gap-2 mb-4 items-center">
        <span className="text-xs text-[var(--muted)] shrink-0">기간</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="min-w-0 px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none text-[var(--muted)] focus:text-white min-h-[44px]"
        />
        <span className="text-xs text-[var(--muted)] text-center">~</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="min-w-0 px-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none text-[var(--muted)] focus:text-white min-h-[44px]"
        />
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="col-span-4 sm:col-auto px-3 py-2.5 text-xs rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors min-h-[44px]"
          >
            초기화
          </button>
        )}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setBulkMode(!bulkMode); }}
          className={`px-3 py-2.5 text-xs rounded-md border transition-colors min-h-[44px] ${
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
              onClick={selectAll}
              className="px-3 py-2.5 text-xs rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors min-h-[44px]"
            >
              {selectedIds.size === filtered.length ? t("deselectAll", locale) : t("selectAll", locale)}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={deleteSelected}
                className="px-3 py-2.5 text-xs rounded-md border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors min-h-[44px]"
              >
                {t("deleteSelected", locale)} ({selectedIds.size})
              </button>
            )}
          </>
        )}
      </div>

      {/* List */}
      <div className="space-y-6">
        {roots.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted)]">
            <p className="text-sm">{t("noAnalysesFound", locale)}</p>
          </div>
        ) : (
          GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
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
                      <HistoryCard
                        analysis={analysis}
                        locale={locale}
                        isChild={false}
                        selectable={bulkMode}
                        selected={selectedIds.has(analysis.id)}
                        onToggleSelect={toggleSelect}
                        onReanalyze={handleReanalyze}
                      />
                      {children.map((child) => (
                        <HistoryCard
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
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}
