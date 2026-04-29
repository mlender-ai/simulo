"use client";

import { useState, useEffect, useCallback } from "react";
import { storage, type AnalysisResult } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";

export type DateGroup = "오늘" | "어제" | "이번 주" | "이전";
export const GROUP_ORDER: DateGroup[] = ["오늘", "어제", "이번 주", "이전"];

const todayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

export function getDateGroup(createdAt: string): DateGroup {
  const ts = new Date(createdAt).getTime();
  const today = todayStart();
  const yesterday = today - 86400000;
  const now = new Date();
  const weekStart = today - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
  if (ts >= today) return "오늘";
  if (ts >= yesterday) return "어제";
  if (ts >= weekStart) return "이번 주";
  return "이전";
}

export function groupByDate(roots: AnalysisResult[]): Record<DateGroup, AnalysisResult[]> {
  const grouped = {} as Record<DateGroup, AnalysisResult[]>;
  for (const a of roots) {
    const g = getDateGroup(a.createdAt);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(a);
  }
  return grouped;
}

export function partitionTree(items: AnalysisResult[]): {
  roots: AnalysisResult[];
  parentMap: Map<string, AnalysisResult[]>;
} {
  const parentMap = new Map<string, AnalysisResult[]>();
  const roots: AnalysisResult[] = [];
  for (const a of items) {
    if (a.isImprovement && a.previousAnalysisId) {
      const children = parentMap.get(a.previousAnalysisId) ?? [];
      children.push(a);
      parentMap.set(a.previousAnalysisId, children);
    } else {
      roots.push(a);
    }
  }
  return { roots, parentMap };
}

export function useHistory(locale: Locale) {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [filter, setFilter] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [inputTypeFilter, setInputTypeFilter] = useState("all");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        setAnalyses(
          data.analyses && data.analyses.length > 0
            ? data.analyses
            : storage.getAll()
        );
      })
      .catch(() => setAnalyses(storage.getAll()));
  }, []);

  // Derived
  const availableInputTypes = Array.from(
    new Set(analyses.map((a) => a.inputType).filter(Boolean))
  );

  const filtered = analyses.filter((a) => {
    const matchSearch =
      !filter ||
      a.hypothesis.toLowerCase().includes(filter.toLowerCase()) ||
      a.projectTag?.toLowerCase().includes(filter.toLowerCase());
    const matchVerdict = verdictFilter === "all" || a.verdict === verdictFilter;
    const matchMode = modeFilter === "all" || (a.mode ?? "hypothesis") === modeFilter;
    const matchInput = inputTypeFilter === "all" || a.inputType === inputTypeFilter;
    return matchSearch && matchVerdict && matchMode && matchInput;
  });

  const { roots, parentMap } = partitionTree(filtered);
  const grouped = groupByDate(roots);

  // Actions
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(
      selectedIds.size === filtered.length
        ? new Set()
        : new Set(filtered.map((a) => a.id))
    );
  }, [filtered, selectedIds.size]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!confirm(t("deleteSelectedConfirm", locale))) return;
    Array.from(selectedIds).forEach((id) => storage.deleteById(id));
    setAnalyses(storage.getAll());
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, locale]);

  return {
    analyses,
    filter, setFilter,
    verdictFilter, setVerdictFilter,
    modeFilter, setModeFilter,
    inputTypeFilter, setInputTypeFilter,
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
  };
}
