/* eslint-disable @next/next/no-img-element */
"use client";

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

  // Issues that have valid heatZones (respecting filter)
  const issuesWithZones = issues.filter((iss) => {
    if (!iss.heatZone) return false;
    if (hypothesisRelevanceFilter && iss.relevanceToHypothesis === "Low") return false;
    return true;
  });

  // Only the single active/hovered issue is rendered on the image
  const activeIssue =
    activeIssueIndex !== null
      ? issuesWithZones.find((iss) => iss.index === activeIssueIndex) ?? null
      : hoveredIssueIndex !== null
      ? issuesWithZones.find((iss) => iss.index === hoveredIssueIndex) ?? null
      : null;

  return (
    <div style={{ maxWidth: 640, width: "100%" }}>
      {/* Image name */}
      <p style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>{imageName}</p>

      {/* Image + single-zone overlay */}
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a2a" }}>
        <img
          src={imageUrl}
          alt={imageName}
          style={{ width: "100%", height: "auto", display: "block" }}
        />

        {/* Single zone overlay — only the selected/hovered issue */}
        {activeIssue && (() => {
          const zone = normalizeZone(activeIssue.heatZone!);
          const style = getSeverityStyle(activeIssue.severity);
          const nearTop = zone.y < 10;
          const nearBottom = zone.y + zone.height > 88;
          const nearRight = zone.x + zone.width > 82;

          return (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              {/* Dim overlay — everything except the active zone */}
              <div
                style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "100%",
                  background: "rgba(0,0,0,0.45)",
                  // Cut-out via clip-path inset
                  clipPath: `polygon(
                    0% 0%, 100% 0%, 100% 100%, 0% 100%,
                    0% ${zone.y}%,
                    ${zone.x}% ${zone.y}%,
                    ${zone.x}% ${zone.y + zone.height}%,
                    ${zone.x + zone.width}% ${zone.y + zone.height}%,
                    ${zone.x + zone.width}% ${zone.y}%,
                    100% ${zone.y}%,
                    100% 0%, 0% 0%
                  )`,
                }}
              />

              {/* Zone highlight border */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${activeIssue.severity}: ${activeIssue.issue}`}
                style={{
                  position: "absolute",
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  border: style.border.replace(/\d+px/, "3px"),
                  borderRadius: 4,
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.15)",
                  pointerEvents: "auto",
                  cursor: "pointer",
                  outline: "none",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onIssueClick(activeIssueIndex === activeIssue.index ? null : activeIssue.index);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onIssueClick(activeIssueIndex === activeIssue.index ? null : activeIssue.index);
                  }
                }}
              >
                {/* Label badge */}
                <div
                  style={{
                    position: "absolute",
                    top: nearBottom ? "auto" : nearTop ? "calc(100% + 3px)" : 2,
                    bottom: nearBottom ? "calc(100% + 3px)" : "auto",
                    left: nearRight ? "auto" : 2,
                    right: nearRight ? 2 : "auto",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    background: style.bgSolid,
                    color: "#fff",
                    lineHeight: "16px",
                    pointerEvents: "none",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {zone.label}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Issue picker pills — one per issue with a heatZone */}
      {issuesWithZones.length > 0 && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {issuesWithZones.map((issue, idx) => {
            const style = getSeverityStyle(issue.severity);
            const isActive = activeIssueIndex === issue.index;
            return (
              <button
                key={issue.index}
                onClick={() => onIssueClick(isActive ? null : issue.index)}
                onMouseEnter={() => onIssueHover(issue.index)}
                onMouseLeave={() => onIssueHover(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: isActive
                    ? `1.5px solid ${style.border.replace(/.*?rgba/, "rgba").replace(/\).*/, ")")}`
                    : "1.5px solid rgba(255,255,255,0.1)",
                  background: isActive ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  color: isActive ? "#fff" : "#888",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.12s",
                  lineHeight: 1.4,
                }}
              >
                {/* Severity dot */}
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: style.bgSolid,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontFamily: "monospace", fontWeight: 700, opacity: 0.6 }}>
                  {idx + 1}
                </span>
                <span
                  style={{
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {issue.heatZone!.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
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
