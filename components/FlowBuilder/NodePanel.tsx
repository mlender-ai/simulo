"use client";

import { type Locale, t } from "@/lib/i18n";

interface NodePanelProps {
  locale: Locale;
  hypothesis: string;
  targetUser: string;
  analyzing: boolean;
  hasStartNode: boolean;
  onHypothesisChange: (value: string) => void;
  onTargetUserChange: (value: string) => void;
  onAddNode: (type: "start" | "screen" | "end") => void;
  onAnalyze: () => void;
}

export function NodePanel({
  locale,
  hypothesis,
  targetUser,
  analyzing,
  hasStartNode,
  onHypothesisChange,
  onTargetUserChange,
  onAddNode,
  onAnalyze,
}: NodePanelProps) {
  const onDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col h-full overflow-y-auto">
      {/* Node palette */}
      <div className="p-4 border-b border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-3">
          노드
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
          disabled={analyzing}
          className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? t("fbAnalyzing", locale) : t("fbRunAnalysis", locale)}
        </button>
      </div>
    </div>
  );
}
