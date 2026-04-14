/* eslint-disable @next/next/no-img-element */
"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface ScreenNodeData {
  name: string;
  imageBase64: string | null;
  analysisResult: {
    dropOffRisk: "높음" | "보통" | "낮음" | null;
    dropOffPercent: number | null;
    stayPercent: number | null;
    mainReason: string | null;
    frictionPoints: string[];
    desireScore: {
      utility: number;
      healthPride: number;
      lossAversion: number;
    } | null;
  } | null;
  onNameChange?: (id: string, name: string) => void;
  onImageUpload?: (id: string, base64: string) => void;
  onNodeSelect?: (id: string) => void;
}

const RISK_STYLES: Record<string, {
  border: string;
  bg: string;
  text: string;
  overlay: string;
  borderWidth: string;
}> = {
  "높음": {
    border: "border-red-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
    overlay: "rgba(239, 68, 68, 0.15)",
    borderWidth: "3px",
  },
  "보통": {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    overlay: "rgba(245, 158, 11, 0.10)",
    borderWidth: "2px",
  },
  "낮음": {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    overlay: "rgba(34, 197, 94, 0.05)",
    borderWidth: "1.5px",
  },
};

const DESIRE_LABELS = ["효능", "성취", "손실"] as const;
const DESIRE_COLORS = ["#3b82f6", "#a855f7", "#f97316"];

function ScreenNodeComponent({ id, data }: NodeProps<ScreenNodeData>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleUpload = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        data.onImageUpload?.(id, reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [id, data]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      data.onNameChange?.(id, e.target.value);
    },
    [id, data]
  );

  const risk = data.analysisResult?.dropOffRisk;
  const rs = risk ? RISK_STYLES[risk] : null;
  const ar = data.analysisResult;

  return (
    <div
      className="screen-node relative rounded-lg overflow-visible"
      style={{
        width: 200,
        minHeight: 240,
        background: "#111",
        border: rs ? `${rs.borderWidth} solid` : "1px solid #2a2a2a",
        borderColor: rs
          ? risk === "높음" ? "#ef4444" : risk === "보통" ? "#f59e0b" : "#22c55e"
          : "#2a2a2a",
        borderRadius: 8,
      }}
      onMouseEnter={() => { if (ar) setShowTooltip(true); }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Risk overlay bar at top */}
      {ar && risk && rs && (
        <div
          className={`flex items-center justify-between px-2 py-1.5 text-[10px] font-medium ${rs.bg} ${rs.text}`}
          style={{ borderBottom: `1px solid ${risk === "높음" ? "rgba(239,68,68,0.2)" : risk === "보통" ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)"}` }}
        >
          <span className="font-semibold">{risk}</span>
          <div className="flex items-center gap-1.5">
            {ar.dropOffPercent != null && (
              <span>{ar.dropOffPercent}% 이탈</span>
            )}
            {ar.stayPercent != null && (
              <span className="text-white/30">/ {ar.stayPercent}%</span>
            )}
          </div>
        </div>
      )}

      {/* Screen name input */}
      <div className="px-2 pt-2 pb-1">
        <input
          value={data.name}
          onChange={handleNameChange}
          placeholder="화면 이름"
          className="w-full bg-transparent text-xs text-white/90 placeholder:text-white/30 outline-none border-b border-white/10 pb-1"
        />
      </div>

      {/* Image area with risk tint overlay */}
      <div
        className="mx-2 mb-2 mt-1 rounded cursor-pointer flex items-center justify-center overflow-hidden relative"
        style={{ height: 160 }}
        onClick={handleUpload}
      >
        {data.imageBase64 ? (
          <>
            <img
              src={data.imageBase64}
              alt={data.name || "screen"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              className="rounded"
            />
            {/* Risk tint overlay on image */}
            {rs && (
              <div
                className="absolute inset-0 rounded pointer-events-none"
                style={{ background: rs.overlay }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center">
            <span className="text-xs text-white/30">+ 화면 업로드</span>
          </div>
        )}
      </div>

      {/* Desire score mini bars */}
      {ar?.desireScore && (
        <div className="px-2 pb-1.5 flex gap-1">
          {(["utility", "healthPride", "lossAversion"] as const).map((key, i) => {
            const val = ar.desireScore![key];
            return (
              <div key={key} className="flex-1 text-center">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(val / 10) * 100}%`, background: DESIRE_COLORS[i] }}
                  />
                </div>
                <span className="text-[7px] text-white/30 mono">{DESIRE_LABELS[i]} {val}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover tooltip — floating panel with details */}
      {showTooltip && ar && (
        <div
          className="absolute z-50 left-[210px] top-0 w-56 p-3 rounded-lg bg-[#1a1a1a] border border-white/10 shadow-2xl pointer-events-none"
          style={{ minWidth: 220 }}
        >
          {/* Risk + percent header */}
          {risk && rs && (
            <div className={`flex items-center gap-2 mb-2 ${rs.text}`}>
              <span className="text-xs font-semibold">{risk}</span>
              {ar.dropOffPercent != null && (
                <span className="text-[10px]">{ar.dropOffPercent}% 이탈 예상</span>
              )}
            </div>
          )}

          {/* Main reason */}
          {ar.mainReason && (
            <p className="text-[10px] text-white/70 mb-2 leading-relaxed">{ar.mainReason}</p>
          )}

          {/* Friction points */}
          {(ar.frictionPoints?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-[8px] uppercase tracking-wider text-white/30 mb-1">마찰 포인트</p>
              <div className="space-y-0.5">
                {ar.frictionPoints.map((fp, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-white/50">
                    <span className="text-red-400/60 mt-0.5 shrink-0">•</span>
                    <span>{fp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desire scores breakdown */}
          {ar.desireScore && (
            <div>
              <p className="text-[8px] uppercase tracking-wider text-white/30 mb-1">욕망 충족도</p>
              <div className="grid grid-cols-3 gap-1">
                {(["utility", "healthPride", "lossAversion"] as const).map((key, i) => (
                  <div key={key} className="text-center">
                    <div className="text-[10px] mono font-medium" style={{ color: DESIRE_COLORS[i] }}>
                      {ar.desireScore![key]}
                    </div>
                    <div className="text-[7px] text-white/30">{DESIRE_LABELS[i]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-white/40 !border-white/20"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="a"
        className="!w-2.5 !h-2.5 !bg-white/40 !border-white/20"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        className="!w-2.5 !h-2.5 !bg-white/40 !border-white/20"
      />
    </div>
  );
}

export const ScreenNode = memo(ScreenNodeComponent);
