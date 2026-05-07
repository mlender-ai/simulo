"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { storage, type AnalysisResult } from "@/lib/storage";
import { ReportTabs } from "@/components/ReportTabs";
import { ComparisonReportTabs } from "@/components/ComparisonReportTabs";
import { UsabilityReportTabs } from "@/components/UsabilityReportTabs";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { ShareExportPanel } from "@/components/ShareExportPanel";
import { ImprovementPanel } from "@/components/ImprovementPanel";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [locale, setLocale] = useState<Locale>("ko");
  const [notFound, setNotFound] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  const handleReanalyze = useCallback((analysis: AnalysisResult) => {
    const reanalyzeParams = {
      analysisId: analysis.id,
      hypothesis: analysis.hypothesis,
      targetUser: analysis.targetUser,
      task: analysis.task,
      projectTag: analysis.projectTag,
      mode: analysis.mode ?? "hypothesis",
      inputType: analysis.inputType,
    };
    sessionStorage.setItem("simulo_reanalyze", JSON.stringify(reanalyzeParams));
    router.push("/");
  }, [router]);

  useEffect(() => {
    setLocale(getLocale());
    const id = params.id as string;

    // Try DB first, fall back to localStorage
    fetch(`/api/report?id=${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) return null;
        return r.json();
      })
      .then(async (d) => {
        if (d) {
          setData(d as AnalysisResult);
        } else {
          const local = await storage.getByIdWithImages(id);
          if (local) setData(local);
          else setNotFound(true);
        }
      })
      .catch(async () => {
        const local = await storage.getByIdWithImages(id);
        if (local) setData(local);
        else setNotFound(true);
      });
  }, [params.id]);

  if (notFound) {
    return (
      <div className="p-8">
        <p className="text-[var(--muted)] text-sm">
          {t("reportNotFound", locale)}
        </p>
        <Link
          href="/"
          className="text-sm text-white underline underline-offset-4 mt-2 inline-block"
        >
          ← {t("backToHistory", locale)}
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* 리포트 본문 */}
      <div
        id="report-main"
        className={[
          "w-full overflow-hidden transition-all duration-300 p-4 sm:p-6 md:p-8",
          isPanelOpen ? "md:w-[60%]" : "md:w-full md:max-w-3xl",
        ].join(" ")}
      >
        <div className="mb-6 md:mb-8">
          {/* 상단 내비게이션 */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
            <Link
              href="/history"
              className="text-sm text-[var(--muted)] hover:text-white transition-colors"
            >
              ← {t("backToHistory", locale)}
            </Link>
            <Link
              href="/"
              className="text-sm text-[var(--muted)] hover:text-white transition-colors"
            >
              {t("newAnalysis", locale)}
            </Link>
            <div className="ml-auto flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
              <ShareExportPanel analysisId={data.id} analysisData={data} showPng />
              <button
                onClick={() => handleReanalyze(data)}
                className="text-sm text-[var(--muted)] hover:text-white transition-colors"
              >
                재분석
              </button>
              <button
                onClick={() => setIsPanelOpen((v) => !v)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border",
                  isPanelOpen
                    ? "border-white/25 bg-white/8 text-white"
                    : "border-white/25 text-[var(--muted)] bg-transparent",
                ].join(" ")}
              >
                <span>✦</span>
                <span className="hidden sm:inline">{isPanelOpen ? "패널 닫기" : "개선안 생성"}</span>
                <span className="sm:hidden">✦</span>
              </button>
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-semibold mb-2">
            {data.mode === "usability"
              ? t("usabilityReportTitle", locale)
              : data.hypothesis}
          </h1>
          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs text-[var(--muted)]">
            <span className="mono">
              {new Date(data.createdAt).toLocaleString()}
            </span>
            {data.projectTag && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-[var(--border)]">
                {data.projectTag}
              </span>
            )}
            <span className="uppercase">{data.inputType}</span>
          </div>
        </div>

        {data.isComparison ? (
          <ComparisonReportTabs analysis={data} locale={locale} />
        ) : data.mode === "usability" ? (
          <UsabilityReportTabs data={data} locale={locale} />
        ) : (
          <ReportTabs data={data} locale={locale} />
        )}
      </div>

      {/* 개선안 패널: 데스크탑 우측 고정 / 모바일 하단 슬라이드 */}
      {isPanelOpen && (
        <>
          {/* 모바일: 하단 드로어 */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-40 max-h-[80vh] h-[70vh] bg-[var(--background)] border-t border-[#1a1a1a] overflow-y-auto rounded-t-xl shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] bg-[var(--background)]">
              <span className="text-xs font-medium text-white/60">✦ 개선안 생성</span>
              <button onClick={() => setIsPanelOpen(false)} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
            </div>
            <ImprovementPanel
              originalAnalysis={data}
              roundNumber={roundNumber}
              onNextRound={(n) => setRoundNumber(n)}
            />
          </div>
          {/* 모바일 backdrop */}
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setIsPanelOpen(false)}
          />

          {/* 데스크탑: 우측 고정 패널 */}
          <div className="hidden md:block md:w-[40%] border-l border-[#1a1a1a] sticky top-0 h-screen overflow-y-auto shrink-0">
            <ImprovementPanel
              originalAnalysis={data}
              roundNumber={roundNumber}
              onNextRound={(n) => setRoundNumber(n)}
            />
          </div>
        </>
      )}
    </div>
  );
}
