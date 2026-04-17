/* eslint-disable @next/next/no-img-element */
"use client";

import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import type { HeatmapIssue } from "@/components/HeatmapViewer";
import { DROP_OFF_COLORS } from "./constants";

interface FlowTabProps {
  data: AnalysisResult;
  locale: Locale;
  issuesByScreen: Map<number, HeatmapIssue[]>;
  onThumbnailClick: (index: number) => void;
  onHeatmapClick: (index: number) => void;
}

export function FlowTab({ data, locale, issuesByScreen, onThumbnailClick, onHeatmapClick }: FlowTabProps) {
  const flowAnalysis = data.flowAnalysis!;
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  const hasThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);
  const highRiskCount = flowAnalysis.filter((f) => f.dropOffRisk === "High" || f.dropOffRisk === "높음").length;

  return (
    <div className="space-y-0">
      <div className="mb-5 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <p className="text-sm">
          <span className="font-medium">{flowAnalysis.length}{t("dropOffSummary", locale)}</span>{" "}
          <span className="text-red-400 font-medium">{highRiskCount}</span>
          {t("dropOffSummaryEnd", locale)}
        </p>
      </div>

      {flowAnalysis.map((entry, i) => {
        const colors = DROP_OFF_COLORS[entry.dropOffRisk] || DROP_OFF_COLORS.Low;
        const isHighRisk = entry.dropOffRisk === "High" || entry.dropOffRisk === "높음";

        return (
          <div key={i} className="relative">
            {i > 0 && (
              <div className="flex justify-start ml-[18px] -mt-0">
                <div className="w-px h-4 bg-[var(--border)]" />
              </div>
            )}

            <div
              className={`p-4 rounded-lg border border-[var(--border)] ${colors.bg} ${
                isHighRisk ? "border-l-2 border-l-red-500" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${
                    isHighRisk ? "bg-red-400/15 text-red-400" : "bg-white/10"
                  }`}>
                    {entry.step}
                  </div>
                </div>

                {hasThumbnails && safeThumbnailUrls[i] && safeThumbnailUrls[i] !== STRIPPED_IMAGE && (
                  <div
                    className="shrink-0 rounded overflow-hidden border border-[var(--border)] cursor-pointer"
                    style={{ width: 64, height: 48 }}
                    onClick={() => {
                      const stepIssues = issuesByScreen.get(i);
                      if (stepIssues && stepIssues.some((iss) => iss.heatZone)) {
                        onHeatmapClick(i);
                      } else {
                        onThumbnailClick(i);
                      }
                    }}
                  >
                    <img src={safeThumbnailUrls[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{entry.stepName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      isHighRisk
                        ? "border-red-400/20 bg-red-400/10 text-red-400"
                        : entry.dropOffRisk === "Medium" || entry.dropOffRisk === "보통"
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-400"
                          : "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                    }`}>
                      {t("dropOffRisk", locale)}: {entry.dropOffRisk}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{entry.reason}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
