/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback } from "react";
import type { HeatZone } from "@/lib/storage";

export interface HeatmapIssue {
  index: number;
  severity: string;
  desireType?: string;
  issue: string;
  recommendation: string;
  retentionImpact?: string;
  relevanceToHypothesis?: string;
  heatZone: HeatZone | null;
}

interface HeatmapViewerProps {
  imageUrl: string;
  imageName: string;
  issues: HeatmapIssue[];
  activeIssueIndex: number | null;
  onIssueClick: (index: number | null) => void;
  onIssueHover: (index: number | null) => void;
  hoveredIssueIndex: number | null;
  hypothesisRelevanceFilter?: boolean;
}

const SEVERITY_OVERLAY: Record<string, { bg: string; border: string; bgSolid: string }> = {
  Critical: {
    bg: "rgba(239, 68, 68, 0.35)",
    border: "2px solid rgba(239, 68, 68, 0.8)",
    bgSolid: "rgba(239, 68, 68, 0.9)",
  },
  "심각": {
    bg: "rgba(239, 68, 68, 0.35)",
    border: "2px solid rgba(239, 68, 68, 0.8)",
    bgSolid: "rgba(239, 68, 68, 0.9)",
  },
  Medium: {
    bg: "rgba(245, 158, 11, 0.25)",
    border: "2px solid rgba(245, 158, 11, 0.7)",
    bgSolid: "rgba(245, 158, 11, 0.85)",
  },
  "보통": {
    bg: "rgba(245, 158, 11, 0.25)",
    border: "2px solid rgba(245, 158, 11, 0.7)",
    bgSolid: "rgba(245, 158, 11, 0.85)",
  },
  Low: {
    bg: "rgba(148, 163, 184, 0.2)",
    border: "1px solid rgba(148, 163, 184, 0.5)",
    bgSolid: "rgba(148, 163, 184, 0.75)",
  },
  "낮음": {
    bg: "rgba(148, 163, 184, 0.2)",
    border: "1px solid rgba(148, 163, 184, 0.5)",
    bgSolid: "rgba(148, 163, 184, 0.75)",
  },
};

const DESIRE_TAG: Record<string, { bg: string; color: string; label: string }> = {
  utility: { bg: "#1e3a2a", color: "#86efac", label: "💡 효능감" },
  healthPride: { bg: "#1e2a3a", color: "#93c5fd", label: "🏃 성취" },
  lossAversion: { bg: "#3a1e2a", color: "#f0abfc", label: "⚡ 손실회피" },
  general: { bg: "#1a1a1a", color: "#888", label: "🔧 일반" },
};

function getSeverityStyle(severity: string) {
  return SEVERITY_OVERLAY[severity] || SEVERITY_OVERLAY.Low;
}

/** Clamp zone to valid [0-100] bounds and enforce minimum visible size. */
function normalizeZone(zone: HeatZone): HeatZone {
  const x = Math.max(0, Math.min(zone.x, 97));
  const y = Math.max(0, Math.min(zone.y, 97));
  const width = Math.max(4, Math.min(zone.width, 100 - x));
  const height = Math.max(3, Math.min(zone.height, 100 - y));
  return { ...zone, x, y, width, height };
}

const SEVERITY_ORDER = ["Critical", "심각", "Medium", "보통", "Low", "낮음"];

function zoneOverlapArea(a: HeatZone, b: HeatZone): number {
  const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return ox * oy;
}

function deduplicateZones(issues: HeatmapIssue[]): HeatmapIssue[] {
  const OVERLAP_THRESHOLD = 0.4; // drop zone if >40% of its area overlaps a kept zone
  const kept: HeatmapIssue[] = [];
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  for (const issue of sorted) {
    const z = normalizeZone(issue.heatZone!);
    const area = z.width * z.height;
    const overlaps = kept.some((k) => {
      const ov = zoneOverlapArea(z, normalizeZone(k.heatZone!));
      return area > 0 && ov / area > OVERLAP_THRESHOLD;
    });
    if (!overlaps) kept.push(issue);
  }
  return kept;
}

export function HeatmapViewer({
  imageUrl,
  imageName,
  issues,
  activeIssueIndex,
  onIssueClick,
  onIssueHover,
  hoveredIssueIndex,
  hypothesisRelevanceFilter = false,
}: HeatmapViewerProps) {
  const [tooltipIssue, setTooltipIssue] = useState<HeatmapIssue | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleOverlayMouseEnter = useCallback(
    (issue: HeatmapIssue, e: React.MouseEvent) => {
      onIssueHover(issue.index);
      const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTooltipIssue(issue);
      setTooltipPos({ x, y });
    },
    [onIssueHover]
  );

  const handleOverlayMouseLeave = useCallback(() => {
    onIssueHover(null);
    setTooltipIssue(null);
  }, [onIssueHover]);

  const filtered = issues.filter((iss) => {
    if (!iss.heatZone) return false;
    if (hypothesisRelevanceFilter && iss.relevanceToHypothesis === "Low") return false;
    return true;
  });
  // Always keep active/hovered issue; deduplicate the rest
  const issuesWithZones =
    activeIssueIndex !== null || hoveredIssueIndex !== null
      ? filtered
      : deduplicateZones(filtered);

  return (
    <div style={{ maxWidth: 640, width: "100%" }}>
      {/* Image name */}
      <p style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>{imageName}</p>

      {/* Image + overlays container */}
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a2a" }}>
        <img
          src={imageUrl}
          alt={imageName}
          style={{ width: "100%", height: "auto", display: "block" }}
        />

        {/* Overlay container */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
          {issuesWithZones.map((issue, renderIdx) => {
            const zone = normalizeZone(issue.heatZone!);
            const style = getSeverityStyle(issue.severity);
            const isActive = activeIssueIndex === issue.index;
            const isHovered = hoveredIssueIndex === issue.index;
            const highlighted = isActive || isHovered;

            // Decide where to place the label badge to avoid clipping
            const nearTop = zone.y < 10;
            const nearBottom = zone.y + zone.height > 88;
            const nearRight = zone.x + zone.width > 82;

            const labelTop = nearBottom
              ? "auto"
              : nearTop
              ? "calc(100% + 2px)"
              : 2;
            const labelBottom = nearBottom ? "calc(100% + 2px)" : "auto";
            const labelLeft = nearRight ? "auto" : 2;
            const labelRight = nearRight ? 2 : "auto";

            return (
              <div
                key={issue.index}
                role="button"
                tabIndex={0}
                aria-label={`${issue.severity}: ${issue.issue}`}
                style={{
                  position: "absolute",
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  backgroundColor: highlighted
                    ? style.bg.replace(/[\d.]+\)$/, (m) => `${Math.min(parseFloat(m) * 1.8, 0.7)})`)
                    : style.bg,
                  border: highlighted
                    ? style.border.replace(/\d+px/, "3px")
                    : style.border,
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  zIndex: highlighted ? 10 : 1,
                  outline: "none",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onIssueClick(isActive ? null : issue.index);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onIssueClick(isActive ? null : issue.index);
                  }
                }}
                onMouseEnter={(e) => handleOverlayMouseEnter(issue, e)}
                onMouseLeave={handleOverlayMouseLeave}
              >
                {/* Issue index dot — always visible at top-right inside zone */}
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: style.bgSolid,
                    color: "#fff",
                    fontSize: 8,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    lineHeight: 1,
                  }}
                >
                  {renderIdx + 1}
                </div>

                {/* Label badge — repositioned based on proximity to edges */}
                <div
                  style={{
                    position: "absolute",
                    top: labelTop,
                    bottom: labelBottom,
                    left: labelLeft,
                    right: labelRight,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    background: style.bgSolid,
                    color: "#fff",
                    lineHeight: "14px",
                    pointerEvents: "none",
                    maxWidth: "calc(100% - 20px)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {zone.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        {tooltipIssue && tooltipIssue.index !== activeIssueIndex && (
          <div
            style={{
              position: "absolute",
              left: Math.min(tooltipPos.x + 12, 400),
              top: tooltipPos.y + 12,
              maxWidth: 280,
              background: "rgba(20, 20, 20, 0.95)",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "10px 12px",
              zIndex: 20,
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: getSeverityStyle(tooltipIssue.severity).bgSolid,
                  color: "#fff",
                }}
              >
                {tooltipIssue.severity}
              </span>
              {tooltipIssue.desireType && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 5px",
                    borderRadius: 3,
                    background: (DESIRE_TAG[tooltipIssue.desireType] || DESIRE_TAG.general).bg,
                    color: (DESIRE_TAG[tooltipIssue.desireType] || DESIRE_TAG.general).color,
                  }}
                >
                  {(DESIRE_TAG[tooltipIssue.desireType] || DESIRE_TAG.general).label}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#ddd", lineHeight: 1.5, margin: 0 }}>{tooltipIssue.issue}</p>
            <p style={{ fontSize: 11, color: "#888", lineHeight: 1.4, marginTop: 4 }}>
              💡 {tooltipIssue.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Issue detail side panel shown below heatmap when an issue is active ─── */

export function HeatmapIssueDetail({
  issue,
  onClose,
}: {
  issue: HeatmapIssue;
  onClose: () => void;
}) {
  const style = getSeverityStyle(issue.severity);
  const desire = issue.desireType
    ? DESIRE_TAG[issue.desireType] || DESIRE_TAG.general
    : null;

  return (
    <div
      style={{
        background: "var(--surface, #141414)",
        border: "1px solid var(--border, #2a2a2a)",
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
        position: "relative",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          background: "none",
          border: "none",
          color: "#666",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
        aria-label="Close"
      >
        ✕
      </button>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: style.bgSolid,
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {issue.severity}
        </span>
        {desire && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: desire.bg,
              color: desire.color,
            }}
          >
            {desire.label}
          </span>
        )}
        {issue.heatZone && (
          <span style={{ fontSize: 11, color: "#666" }}>{issue.heatZone.label}</span>
        )}
      </div>

      <p style={{ fontSize: 14, color: "#e5e5e5", lineHeight: 1.6, margin: "0 0 8px" }}>
        {issue.issue}
      </p>

      <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
          개선 권고:{" "}
        </span>
        {issue.recommendation}
      </div>

      {issue.retentionImpact && (
        <div style={{ fontSize: 13, color: "#666", fontStyle: "italic", marginTop: 6 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            리텐션 영향:{" "}
          </span>
          {issue.retentionImpact}
        </div>
      )}
    </div>
  );
}
