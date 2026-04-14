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
}

const RISK_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  "높음": { border: "border-red-500", bg: "bg-red-500/10", text: "text-red-400" },
  "보통": { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-400" },
  "낮음": { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

const DESIRE_LABELS = ["효능", "성취", "손실"] as const;

function ScreenNodeComponent({ id, data }: NodeProps<ScreenNodeData>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleUpload = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        data.onImageUpload?.(id, result);
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
  const riskStyle = risk ? RISK_STYLES[risk] : null;
  const ar = data.analysisResult;

  return (
    <div
      className={`screen-node relative rounded-lg overflow-hidden ${
        riskStyle ? `border-2 ${riskStyle.border}` : "border border-[#2a2a2a]"
      }`}
      style={{ width: 200, minHeight: 240, background: "#111" }}
    >
      {/* Risk overlay bar */}
      {ar && risk && riskStyle && (
        <div
          className={`flex items-center justify-between px-2 py-1 text-[10px] font-medium cursor-pointer ${riskStyle.bg} ${riskStyle.text}`}
          onClick={() => setShowDetail(!showDetail)}
        >
          <span>{risk}</span>
          <div className="flex items-center gap-1.5">
            {ar.dropOffPercent != null && (
              <span>{ar.dropOffPercent}% 이탈</span>
            )}
            {ar.stayPercent != null && (
              <span className="text-white/40">/ {ar.stayPercent}% 잔존</span>
            )}
          </div>
        </div>
      )}

      {/* Screen name input */}
      <div className="px-2 pt-2 pb-1">
        <input
          value={data.name}
          onChange={handleNameChange}
          placeholder="화면 이���"
          className="w-full bg-transparent text-xs text-white/90 placeholder:text-white/30 outline-none border-b border-white/10 pb-1"
        />
      </div>

      {/* Image area */}
      <div
        className="mx-2 mb-2 mt-1 rounded cursor-pointer flex items-center justify-center overflow-hidden"
        style={{ height: 160 }}
        onClick={handleUpload}
      >
        {data.imageBase64 ? (
          <img
            src={data.imageBase64}
            alt={data.name || "screen"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            className="rounded"
          />
        ) : (
          <div className="w-full h-full border border-dashed border-white/20 rounded flex items-center justify-center">
            <span className="text-xs text-white/30">+ 화면 업로드</span>
          </div>
        )}
      </div>

      {/* Desire score mini bar */}
      {ar?.desireScore && (
        <div className="px-2 pb-1 flex gap-1">
          {(["utility", "healthPride", "lossAversion"] as const).map((key, i) => {
            const val = ar.desireScore![key];
            return (
              <div key={key} className="flex-1 text-center">
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/60"
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
                <span className="text-[7px] text-white/30 mono">{DESIRE_LABELS[i]} {val}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Friction points (shown on click) */}
      {showDetail && ar && (
        <div className="px-2 pb-2 border-t border-white/5 mt-1 pt-1">
          {ar.mainReason && (
            <p className="text-[9px] text-white/50 mb-1">{ar.mainReason}</p>
          )}
          {ar.frictionPoints.length > 0 && (
            <div className="space-y-0.5">
              {ar.frictionPoints.map((fp, i) => (
                <div key={i} className="flex items-start gap-1 text-[8px] text-white/40">
                  <span className="text-red-400/60 mt-px">•</span>
                  <span>{fp}</span>
                </div>
              ))}
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
