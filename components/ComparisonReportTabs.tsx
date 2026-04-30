"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult, ComparisonResult, ComparisonProductResult } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import { ComparisonScoreBar } from "./ComparisonScoreBar";

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

const DESIRE_COLORS: Record<string, { bar: string; text: string }> = {
  utility: { bar: "#3b82f6", text: "text-blue-400" },
  healthPride: { bar: "#a855f7", text: "text-purple-400" },
  lossAversion: { bar: "#f97316", text: "text-orange-400" },
};

const DESIRE_TYPE_BADGE: Record<string, string> = {
  utility: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  healthPride: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  lossAversion: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  general: "text-gray-400 bg-gray-400/10 border-gray-400/20",
};

type Tab = "summary" | "table" | "details" | "sideBySide";
const VALID_TABS: readonly Tab[] = ["summary", "table", "details", "sideBySide"];

interface ComparisonReportTabsProps {
  analysis: AnalysisResult;
  locale: Locale;
}

function scoreDelta(ourScore: number, otherScore: number) {
  const diff = ourScore - otherScore;
  if (diff === 0) return { text: "±0", className: "text-[var(--muted)]" };
  if (diff > 0) return { text: `+${diff}`, className: "text-emerald-400" };
  return { text: `${diff}`, className: "text-red-400" };
}

export function ComparisonReportTabs({ analysis, locale }: ComparisonReportTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("summary");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam as Tab);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = useCallback((newTab: Tab) => {
    setActiveTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const data = analysis.comparisonData as ComparisonResult | undefined;
  if (!data || !data.products || data.products.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] text-sm">
        {t("reportNotFound", locale)}
      </div>
    );
  }

  const ourProduct = data.products[0];
  const winnerName = data.comparison?.winner ?? "";

  const tableRows = data.comparison?.comparisonTable ?? [];
  const hasTable = tableRows.length > 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "summary", label: t("comparisonTabSummary", locale) },
    ...(hasTable ? [{ key: "table" as Tab, label: t("comparisonTabTable", locale) }] : []),
    { key: "details", label: t("comparisonTabDetails", locale) },
    { key: "sideBySide", label: t("comparisonTabSideBySide", locale) },
  ];

  return (
    <div className="space-y-6">
      {/* Winner hero */}
      <div className="p-5 rounded-lg border border-white/15 bg-white/[0.04]">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
          <span>🏆</span>
          <span>{t("winner", locale)}</span>
        </div>
        <div className="text-xl font-semibold mb-2">{winnerName}</div>
        {data.comparison?.winnerReason && (
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {data.comparison.winnerReason}
          </p>
        )}
      </div>

      {/* Score bar summary */}
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
          {t("usabilityScore", locale)}
        </div>
        <ComparisonScoreBar
          items={data.products.map((p, i) => ({
            productName: p.productName,
            score: p.score,
            isOurs: i === 0,
          }))}
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "text-white border-white"
                : "text-[var(--muted)] border-transparent hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {data.comparison?.ourProductPosition && (
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                {t("ourProductPosition", locale)}
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                {data.comparison.ourProductPosition}
              </p>
            </div>
          )}

          {data.comparison?.keyDifferences && data.comparison.keyDifferences.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                {t("keyDifferences", locale)}
              </div>
              <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-xs text-[var(--muted)] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2 font-normal">
                        {t("aspect", locale)}
                      </th>
                      <th className="text-left px-3 py-2 font-normal">
                        {t("ourProduct", locale)}
                      </th>
                      <th className="text-left px-3 py-2 font-normal">
                        {t("competitor", locale)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparison.keyDifferences.map((d, i) => (
                      <tr key={i} className="border-t border-[var(--border)]">
                        <td className="px-3 py-2.5 align-top text-[var(--muted)]">
                          {d.aspect}
                        </td>
                        <td className="px-3 py-2.5 align-top">{d.ours}</td>
                        <td className="px-3 py-2.5 align-top text-[var(--muted)]">
                          {d.competitor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.comparison?.topPriorities && data.comparison.topPriorities.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                {t("topPriorities", locale)}
              </div>
              <ol className="space-y-2">
                {data.comparison.topPriorities.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <span className="mono text-xs text-[var(--muted)] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed">{p}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Table tab — per-aspect comparison with winner-based cell coloring */}
      {activeTab === "table" && hasTable && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-xs text-[var(--muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-normal">{t("aspect", locale)}</th>
                {data.products.map((p, i) => (
                  <th key={i} className="text-left px-3 py-2 font-normal">
                    {p.productName}
                    {i === 0 && (
                      <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded border border-white/20 text-white/70 uppercase align-middle">
                        {t("ourProduct", locale)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => {
                const winner = row.winner?.trim() ?? "";
                const hasWinner = winner.length > 0;
                const ourName = data.products[0]?.productName ?? "";
                const oursWon = hasWinner && winner === ourName;
                return (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2.5 align-top text-[var(--muted)]">{row.aspect}</td>
                    {data.products.map((p, j) => {
                      const cell = row.scores.find((s) => s.productName === p.productName)
                        ?? row.scores[j];
                      if (!cell) {
                        return <td key={j} className="px-3 py-2.5 align-top text-[var(--muted)]">—</td>;
                      }
                      const isWinnerCell = hasWinner && cell.productName === winner;
                      const bg = isWinnerCell
                        ? oursWon
                          ? "rgba(134,239,172,0.12)"
                          : "rgba(252,165,165,0.12)"
                        : "transparent";
                      const borderColor = isWinnerCell
                        ? oursWon
                          ? "rgba(134,239,172,0.4)"
                          : "rgba(252,165,165,0.4)"
                        : "transparent";
                      return (
                        <td
                          key={j}
                          className="px-3 py-2.5 align-top"
                          style={{ background: bg, borderLeft: `2px solid ${borderColor}` }}
                        >
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="mono text-sm font-medium">{cell.score}</span>
                            <span className="text-[10px] text-[var(--muted)]">/10</span>
                            {isWinnerCell && <span className="text-[10px]">🏆</span>}
                          </div>
                          {cell.note && (
                            <p className="text-xs text-white/80 leading-snug">{cell.note}</p>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Details tab — per product */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {data.products.map((p, i) => (
            <ProductDetailCard
              key={i}
              product={p}
              isOurs={i === 0}
              isWinner={p.productName === winnerName}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Side-by-side tab */}
      {activeTab === "sideBySide" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${data.products.length}, minmax(0, 1fr))` }}>
          {data.products.map((p, i) => {
            const isOurs = i === 0;
            const delta = !isOurs ? scoreDelta(ourProduct.score, p.score) : null;
            return (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  isOurs ? "border-white/30 bg-white/[0.04]" : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {p.productName === winnerName && <span>🏆</span>}
                  <div className="text-sm font-medium truncate">{p.productName}</div>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <div className="text-3xl font-semibold mono">{p.score}</div>
                  {delta && (
                    <div className={`text-xs mono ${delta.className}`}>{delta.text}</div>
                  )}
                  <span
                    className={`ml-auto text-xs px-2 py-0.5 rounded border ${
                      VERDICT_COLORS[p.verdict] ?? ""
                    }`}
                  >
                    {t(p.verdict as "Pass" | "Partial" | "Fail", locale)}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed mb-4">
                  {p.summary}
                </p>
                {p.strengths && p.strengths.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
                      {t("strengthsLabel", locale)}
                    </div>
                    <ul className="space-y-1">
                      {p.strengths.map((s, j) => (
                        <li key={j} className="text-xs text-white/80 pl-3 relative before:content-['+'] before:absolute before:left-0 before:text-emerald-400">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.weaknesses && p.weaknesses.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
                      {t("weaknessesLabel", locale)}
                    </div>
                    <ul className="space-y-1">
                      {p.weaknesses.map((w, j) => (
                        <li key={j} className="text-xs text-white/80 pl-3 relative before:content-['−'] before:absolute before:left-0 before:text-red-400">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function ProductDetailCard({
  product,
  isOurs,
  isWinner,
  locale,
}: {
  product: ComparisonProductResult;
  isOurs: boolean;
  isWinner: boolean;
  locale: Locale;
}) {
  return (
    <div
      className={`p-5 rounded-lg border ${
        isOurs ? "border-white/30 bg-white/[0.04]" : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isWinner && <span>🏆</span>}
          <span className="text-sm font-medium">{product.productName}</span>
          {isOurs && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-white/80 uppercase">
              {t("ourProduct", locale)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-sm">{product.score}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded border ${
              VERDICT_COLORS[product.verdict] ?? ""
            }`}
          >
            {t(product.verdict as "Pass" | "Partial" | "Fail", locale)}
          </span>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">{product.summary}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {product.strengths && product.strengths.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {t("strengthsLabel", locale)}
            </div>
            <ul className="space-y-1">
              {product.strengths.map((s, i) => (
                <li key={i} className="text-xs text-white/80">
                  + {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {product.weaknesses && product.weaknesses.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {t("weaknessesLabel", locale)}
            </div>
            <ul className="space-y-1">
              {product.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-white/80">
                  − {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {product.desireAlignment && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
            {t("desireAlignment", locale)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["utility", "healthPride", "lossAversion"] as const).map((key) => {
              const desire = product.desireAlignment![key];
              const colors = DESIRE_COLORS[key];
              const nameKey = key === "utility" ? "desireUtility" : key === "healthPride" ? "desireHealthPride" : "desireLossAversion";
              const pct = (desire.score / 10) * 100;
              return (
                <div key={key} className="p-2 rounded border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] ${colors.text}`}>{t(nameKey, locale)}</span>
                    <span className="text-xs mono">{desire.score}/10</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors.bar }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {product.issues && product.issues.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
            {t("issues", locale)}
          </div>
          <div className="space-y-2">
            {product.issues.map((issue, i) => (
              <div
                key={i}
                className="p-3 rounded-md border border-[var(--border)] bg-white/[0.02]"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      SEVERITY_COLORS[issue.severity] ?? ""
                    }`}
                  >
                    {t(issue.severity as "Critical" | "Medium" | "Low", locale)}
                  </span>
                  {issue.desireType && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${DESIRE_TYPE_BADGE[issue.desireType] ?? DESIRE_TYPE_BADGE.general}`}>
                      {t(
                        issue.desireType === "utility" ? "desireUtility" :
                        issue.desireType === "healthPride" ? "desireHealthPride" :
                        issue.desireType === "lossAversion" ? "desireLossAversion" : "desireType",
                        locale
                      )}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--muted)] mono">
                    {issue.screen}
                  </span>
                </div>
                <p className="text-xs text-white/90 mb-1">{issue.issue}</p>
                <p className="text-xs text-[var(--muted)]">→ {issue.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
