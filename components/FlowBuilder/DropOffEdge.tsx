"use client";

import { memo, useState } from "react";
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "reactflow";

export interface DropOffEdgeData {
  dropOffRisk?: "높음" | "보통" | "낮음" | null;
  transitionSmooth?: boolean;
  dropOffAtTransition?: number;
  reason?: string;
  recommendation?: string;
}

function riskFromPercent(pct: number): "높음" | "보통" | "낮음" {
  if (pct >= 30) return "높음";
  if (pct >= 15) return "보통";
  return "낮음";
}

const RISK_CONFIG: Record<string, { stroke: string; width: number; badge: string; text: string }> = {
  "높음": { stroke: "#ef4444", width: 3, badge: "bg-red-500/80 border-red-400/40", text: "text-red-100" },
  "보통": { stroke: "#f59e0b", width: 2, badge: "bg-amber-500/80 border-amber-400/40", text: "text-amber-100" },
  "낮음": { stroke: "#22c55e", width: 1.5, badge: "bg-emerald-500/80 border-emerald-400/40", text: "text-emerald-100" },
};

function DropOffEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<DropOffEdgeData>) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Derive risk from dropOffAtTransition if explicit risk not set
  const risk =
    data?.dropOffRisk ??
    (data?.dropOffAtTransition != null ? riskFromPercent(data.dropOffAtTransition) : null);

  const config = risk ? RISK_CONFIG[risk] : null;
  const hasAnalysis = data?.dropOffAtTransition != null;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={config?.stroke ?? "#444"}
        strokeWidth={config?.width ?? 1}
        markerEnd={markerEnd}
        className={risk ? "" : "animated"}
      />
      {hasAnalysis && config && (
        <EdgeLabelRenderer>
          <div
            className={`absolute px-1.5 py-0.5 rounded-full text-[9px] font-medium border cursor-pointer ${config.badge} ${config.text}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {data!.dropOffAtTransition}% 이탈
          </div>

          {/* Tooltip with reason + recommendation */}
          {showTooltip && (data?.reason || data?.recommendation) && (
            <div
              className="absolute z-50 w-52 p-2 rounded-lg bg-[#1a1a1a] border border-white/10 shadow-xl"
              style={{
                transform: `translate(-50%, 8px) translate(${labelX}px,${labelY}px)`,
                pointerEvents: "none",
              }}
            >
              {data.transitionSmooth === false && (
                <p className="text-[9px] text-red-400/80 mb-1">전환 매끄럽지 않음</p>
              )}
              {data.reason && (
                <p className="text-[9px] text-white/60 mb-1">
                  <span className="text-white/30">원인: </span>{data.reason}
                </p>
              )}
              {data.recommendation && (
                <p className="text-[9px] text-emerald-400/70">
                  <span className="text-white/30">개선: </span>{data.recommendation}
                </p>
              )}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DropOffEdge = memo(DropOffEdgeComponent);
