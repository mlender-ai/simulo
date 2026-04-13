/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { storage, type AnalysisResult } from "@/lib/storage";
import { getLocale, t, type Locale } from "@/lib/i18n";

const VERDICT_COLORS: Record<string, string> = {
  Pass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Partial: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Fail: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default function HistoryPage() {
  const [locale, setLocale] = useState<Locale>("ko");
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [filter, setFilter] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string>("all");

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

  const filtered = analyses.filter((a) => {
    const matchesSearch =
      !filter ||
      a.hypothesis.toLowerCase().includes(filter.toLowerCase()) ||
      a.projectTag?.toLowerCase().includes(filter.toLowerCase());
    const matchesVerdict =
      verdictFilter === "all" || a.verdict === verdictFilter;
    return matchesSearch && matchesVerdict;
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

      <div className="flex gap-3 mb-6">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("searchPlaceholder", locale)}
          className="flex-1 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
        />
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

      <div className="space-y-2">
        {filtered.map((analysis) => {
          const verdictKey = analysis.verdict as "Pass" | "Partial" | "Fail";
          return (
            <Link
              key={analysis.id}
              href={`/report/${analysis.id}`}
              className="block p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                {analysis.thumbnailUrls?.[0] && (
                  <div
                    className="shrink-0 rounded overflow-hidden border border-[var(--border)]"
                    style={{ width: 48, height: 48 }}
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
                      {analysis.hypothesis}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                      <span className="mono">
                        {new Date(analysis.createdAt).toLocaleDateString()}
                      </span>
                      {analysis.projectTag && (
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
                    <span className="mono text-sm font-medium">
                      {analysis.score}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${VERDICT_COLORS[analysis.verdict] ?? ""}`}
                    >
                      {t(verdictKey, locale)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-[var(--muted)]">
            <p className="text-sm">{t("noAnalysesFound", locale)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
