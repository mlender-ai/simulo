"use client";

import { useRef } from "react";
import { type Locale, t } from "@/lib/i18n";

interface NodePanelProps {
  locale: Locale;
  hypothesis: string;
  targetUser: string;
  analyzing: boolean;
  hasStartNode: boolean;
  hasScreenNodes: boolean;
  onHypothesisChange: (value: string) => void;
  onTargetUserChange: (value: string) => void;
  onAddNode: (type: "start" | "screen" | "end") => void;
  onImagesUpload: (images: { name: string; base64: string }[]) => void;
  onAnalyze: () => void;
}

export function NodePanel({
  locale,
  hypothesis,
  targetUser,
  analyzing,
  hasStartNode,
  hasScreenNodes,
  onHypothesisChange,
  onTargetUserChange,
  onAddNode,
  onImagesUpload,
  onAnalyze,
}: NodePanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const results: { name: string; base64: string }[] = [];
    let loaded = 0;
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        results.push({
          name: file.name.replace(/\.[^.]+$/, ""),
          base64: reader.result as string,
        });
        loaded++;
        if (loaded === imageFiles.length) {
          // Sort by file name to preserve order
          results.sort((a, b) => a.name.localeCompare(b.name, "ko"));
          onImagesUpload(results);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col h-full overflow-y-auto">
      {/* Quick start — image upload */}
      <div className="p-4 border-b border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">
          빠른 시작
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-3 rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 text-white/60 hover:text-white transition-colors text-xs flex flex-col items-center gap-1"
        >
          <span className="text-lg leading-none">+</span>
          <span>이미지로 플로우 만들기</span>
          <span className="text-[10px] text-white/30">여러 장 선택 가능 · 순서대로 연결</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Node palette (advanced) */}
      <div className="p-4 border-b border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-3">
          노드 수동 추가
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onAddNode("start")}
            disabled={hasStartNode}
            draggable={!hasStartNode}
            onDragStart={(e) => onDragStart(e, "start")}
            className="flex-1 px-2 py-1.5 rounded border border-orange-400/30 text-orange-300 text-xs hover:bg-orange-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing"
          >
            {t("fbAddStart", locale)}
          </button>
          <button
            onClick={() => onAddNode("screen")}
            draggable
            onDragStart={(e) => onDragStart(e, "screen")}
            className="flex-1 px-2 py-1.5 rounded border border-white/20 text-white/70 text-xs hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing"
          >
            {t("fbAddScreen", locale)}
          </button>
          <button
            onClick={() => onAddNode("end")}
            draggable
            onDragStart={(e) => onDragStart(e, "end")}
            className="flex-1 px-2 py-1.5 rounded border border-orange-400/30 text-orange-300 text-xs hover:bg-orange-400/10 transition-colors cursor-grab active:cursor-grabbing"
          >
            {t("fbAddEnd", locale)}
          </button>
        </div>
      </div>

      {/* Analysis context */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] block mb-1">
            {t("fbHypothesis", locale)}
          </label>
          <textarea
            value={hypothesis}
            onChange={(e) => onHypothesisChange(e.target.value)}
            placeholder={t("fbHypothesisPlaceholder", locale)}
            rows={3}
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded text-xs text-white/80 placeholder:text-white/20 outline-none resize-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] block mb-1">
            {t("fbTargetUser", locale)}
          </label>
          <textarea
            value={targetUser}
            onChange={(e) => onTargetUserChange(e.target.value)}
            placeholder={t("fbTargetUserPlaceholder", locale)}
            rows={2}
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded text-xs text-white/80 placeholder:text-white/20 outline-none resize-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Analyze button */}
      <div className="p-4 border-t border-[var(--border)]">
        <button
          onClick={onAnalyze}
          disabled={analyzing || !hasScreenNodes}
          className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? t("fbAnalyzing", locale) : t("fbRunAnalysis", locale)}
        </button>
        {!hasScreenNodes && !analyzing && (
          <p className="text-center text-[10px] text-white/25 mt-1.5">
            화면 이미지를 먼저 추가하세요
          </p>
        )}
      </div>
    </div>
  );
}
