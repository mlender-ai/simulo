/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { STRIPPED_IMAGE } from "@/lib/storage";
import { t, type Locale } from "@/lib/i18n";
import { HeatmapViewer, HeatmapIssueDetail } from "@/components/HeatmapViewer";
import { HEATMAP_STORAGE_KEY } from "./report/constants";
import { groupIssuesByScreen, countIssuesPerScreen } from "./report/helpers";
import { Lightbox } from "./report/Lightbox";
import { OverviewTab } from "./report/OverviewTab";
import { ThinkAloudTab } from "./report/ThinkAloudTab";
import { FlowTab } from "./report/FlowTab";
import { IssuesTab } from "./report/IssuesTab";

type Tab = "overview" | "thinkAloud" | "flow" | "issues";

export function ReportTabs({ data, locale }: { data: AnalysisResult; locale: Locale }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Heatmap state
  const [heatmapOn, setHeatmapOn] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState(0);
  const [activeIssueIdx, setActiveIssueIdx] = useState<number | null>(null);
  const [hoveredIssueIdx, setHoveredIssueIdx] = useState<number | null>(null);
  const [flowHeatmapScreen, setFlowHeatmapScreen] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHeatmapOn(localStorage.getItem(HEATMAP_STORAGE_KEY) === "true");
    }
  }, []);

  const toggleHeatmap = useCallback(() => {
    setHeatmapOn((prev) => {
      const next = !prev;
      localStorage.setItem(HEATMAP_STORAGE_KEY, String(next));
      return next;
    });
    setActiveIssueIdx(null);
  }, []);

  const isFlow = data.inputType === "flow" && data.flowAnalysis && data.flowAnalysis.length > 0;
  const safeIssues = data.issues ?? [];
  const safeThinkAloud = data.thinkAloud ?? [];
  const safeThumbnailUrls = data.thumbnailUrls ?? [];
  const hasThumbnails = safeThumbnailUrls.some((u) => u !== STRIPPED_IMAGE);
  const issuesByScreen = groupIssuesByScreen(safeIssues, safeThumbnailUrls);
  const issueCountPerScreen = countIssuesPerScreen(safeIssues);

  const tabItems: { key: Tab; label: string }[] = [
    { key: "overview", label: t("overview", locale) },
    { key: "thinkAloud", label: t("thinkAloud", locale) },
    ...(isFlow ? [{ key: "flow" as Tab, label: t("flowTab", locale) }] : []),
    { key: "issues", label: `${t("issues", locale)} (${safeIssues.length})` },
  ];

  const handleScreenClick = useCallback((index: number) => {
    setSelectedScreen(index);
    setTab("issues");
    setHeatmapOn(true);
  }, []);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-[var(--border)] w-fit mb-6">
        {tabItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === item.key ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab
          data={data}
          locale={locale}
          issueCountPerScreen={issueCountPerScreen}
          isFlow={!!isFlow}
          onScreenClick={handleScreenClick}
        />
      )}

      {tab === "thinkAloud" && (
        <ThinkAloudTab thinkAloud={safeThinkAloud} locale={locale} />
      )}

      {tab === "flow" && isFlow && (
        <FlowTab
          data={data}
          locale={locale}
          issuesByScreen={issuesByScreen}
          onThumbnailClick={setLightboxIndex}
          onHeatmapClick={setFlowHeatmapScreen}
        />
      )}

      {tab === "issues" && (
        <IssuesTab
          data={data}
          locale={locale}
          issuesByScreen={issuesByScreen}
          issueCountPerScreen={issueCountPerScreen}
          isFlow={!!isFlow}
          heatmapOn={heatmapOn}
          onToggleHeatmap={toggleHeatmap}
          selectedScreen={selectedScreen}
          onSelectScreen={setSelectedScreen}
          activeIssueIdx={activeIssueIdx}
          onSetActiveIssue={setActiveIssueIdx}
          hoveredIssueIdx={hoveredIssueIdx}
          onSetHoveredIssue={setHoveredIssueIdx}
        />
      )}

      {lightboxIndex !== null && hasThumbnails && (
        <Lightbox
          images={safeThumbnailUrls.filter((u) => u !== STRIPPED_IMAGE)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Flow heatmap modal */}
      {flowHeatmapScreen !== null && hasThumbnails && safeThumbnailUrls[flowHeatmapScreen] && safeThumbnailUrls[flowHeatmapScreen] !== STRIPPED_IMAGE && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setFlowHeatmapScreen(null)}
        >
          <div
            className="relative"
            style={{ maxWidth: 700, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-8 right-0 text-white/60 hover:text-white text-xl"
              onClick={() => setFlowHeatmapScreen(null)}
            >
              ✕
            </button>
            <HeatmapViewer
              imageUrl={safeThumbnailUrls[flowHeatmapScreen]}
              imageName={
                data.flowSteps?.[flowHeatmapScreen]
                  ? `${t("stepLabel", locale)} ${flowHeatmapScreen + 1}: ${data.flowSteps[flowHeatmapScreen].stepName}`
                  : `${t("screenLabel", locale)} ${flowHeatmapScreen + 1}`
              }
              issues={issuesByScreen.get(flowHeatmapScreen) || []}
              activeIssueIndex={activeIssueIdx}
              onIssueClick={setActiveIssueIdx}
              onIssueHover={setHoveredIssueIdx}
              hoveredIssueIndex={hoveredIssueIdx}
            />
            {activeIssueIdx !== null && (() => {
              const flowIssues = issuesByScreen.get(flowHeatmapScreen) || [];
              const active = flowIssues.find((iss) => iss.index === activeIssueIdx);
              if (!active) return null;
              return <HeatmapIssueDetail issue={active} onClose={() => setActiveIssueIdx(null)} />;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
