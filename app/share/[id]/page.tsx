"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type AnalysisResult } from "@/lib/storage";
import { ReportTabs } from "@/components/ReportTabs";
import { ComparisonReportTabs } from "@/components/ComparisonReportTabs";
import { UsabilityReportTabs } from "@/components/UsabilityReportTabs";
import { getLocale, t, type Locale } from "@/lib/i18n";

export default function SharePage() {
  const params = useParams();
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [locale, setLocale] = useState<Locale>("ko");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLocale(getLocale());
    const id = params.id as string;

    async function load() {
      // 1. Try localStorage first (no-DB environments)
      const { storage } = await import("@/lib/storage");
      const local = storage.getById(id);
      if (local) { setData(local); return; }

      // 2. Fall back to DB via API
      try {
        const r = await fetch(`/api/report?id=${id}`);
        if (r.status === 404 || r.status === 503) { setNotFound(true); return; }
        if (!r.ok) { setNotFound(true); return; }
        const d = await r.json();
        if (d) setData(d as AnalysisResult);
        else setNotFound(true);
      } catch {
        setNotFound(true);
      }
    }

    load();
  }, [params.id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm mb-4">
            리포트를 찾을 수 없습니다
          </p>
          <Link
            href="/"
            className="text-sm text-white/60 hover:text-white underline underline-offset-4"
          >
            Simulo에서 새 분석 시작하기
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Watermark */}
      <div className="fixed top-4 right-4 z-50 text-[12px] text-[#333] select-none pointer-events-none">
        Simulo로 만든 UX 분석 리포트
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold mb-2 text-white">
            {data.mode === "usability"
              ? t("usabilityReportTitle", locale)
              : data.hypothesis}
          </h1>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="mono">
              {new Date(data.createdAt).toLocaleString()}
            </span>
            {data.projectTag && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                {data.projectTag}
              </span>
            )}
            <span className="uppercase">{data.inputType}</span>
          </div>
        </div>

        {/* Report content */}
        {data.isComparison ? (
          <ComparisonReportTabs analysis={data} locale={locale} />
        ) : data.mode === "usability" ? (
          <UsabilityReportTabs data={data} locale={locale} />
        ) : (
          <ReportTabs data={data} locale={locale} />
        )}

        {/* CTA */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white transition-colors"
          >
            새 분석 시작하기
          </Link>
          <p className="text-[10px] text-white/20 mt-3">
            Powered by Simulo — AI UX Testing Tool
          </p>
        </div>
      </div>
    </div>
  );
}
