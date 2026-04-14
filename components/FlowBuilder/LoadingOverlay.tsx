"use client";

import { memo } from "react";

export type AnalysisPhase =
  | "preparing"
  | "phase1"
  | "phase2"
  | "phase3"
  | "applying";

interface LoadingOverlayProps {
  phase: AnalysisPhase;
}

const PHASES: { key: AnalysisPhase; label: string; detail: string }[] = [
  { key: "preparing", label: "준비 중", detail: "플로우 구조를 분석하고 있습니다" },
  { key: "phase1", label: "Phase 1", detail: "개별 화면을 분석하고 있습니다" },
  { key: "phase2", label: "Phase 2", detail: "화면 간 전환을 분석하고 있습니다" },
  { key: "phase3", label: "Phase 3", detail: "통합 분석을 수행하고 있습니다" },
  { key: "applying", label: "적용 중", detail: "결과를 캔버스에 적용하고 있습니다" },
];

function LoadingOverlayComponent({ phase }: LoadingOverlayProps) {
  const currentIndex = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-72 shadow-2xl">
        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
        </div>

        {/* Current phase text */}
        <div className="text-center mb-5">
          <p className="text-sm font-medium text-white/90">
            {PHASES[currentIndex]?.label ?? "분석 중"}
          </p>
          <p className="text-[10px] text-white/40 mt-1">
            {PHASES[currentIndex]?.detail ?? ""}
          </p>
        </div>

        {/* Progress steps */}
        <div className="space-y-2">
          {PHASES.map((p, i) => {
            const isDone = i < currentIndex;
            const isActive = i === currentIndex;
            return (
              <div key={p.key} className="flex items-center gap-2.5">
                {/* Step indicator */}
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-500/80 text-white"
                      : isActive
                      ? "bg-white/20 text-white border border-white/40"
                      : "bg-white/5 text-white/20"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] transition-colors duration-300 ${
                    isDone
                      ? "text-emerald-400/70 line-through"
                      : isActive
                      ? "text-white/80"
                      : "text-white/20"
                  }`}
                >
                  {p.label} — {p.detail}
                </span>
              </div>
            );
          })}
        </div>

        {/* Overall progress bar */}
        <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/40 transition-all duration-700"
            style={{ width: `${((currentIndex + 1) / PHASES.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export const LoadingOverlay = memo(LoadingOverlayComponent);
