"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { storage, type AnalysisResult } from "@/lib/storage";
import { ReportTabs } from "@/components/ReportTabs";
import { ComparisonReportTabs } from "@/components/ComparisonReportTabs";
import { UsabilityReportTabs } from "@/components/UsabilityReportTabs";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { ShareExportPanel } from "@/components/ShareExportPanel";

export default function ReportPage() {
  const params = useParams();
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [locale, setLocale] = useState<Locale>("ko");
  const [notFound, setNotFound] = useState(false);

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
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
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
          <div className="ml-auto">
            <ShareExportPanel analysisId={data.id} />
          </div>
        </div>
        <h1 className="text-xl font-semibold mb-2">
          {data.mode === "usability"
            ? t("usabilityReportTitle", locale)
            : data.hypothesis}
        </h1>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
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
  );
}
