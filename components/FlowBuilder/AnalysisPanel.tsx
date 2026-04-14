"use client";

import { memo } from "react";

interface FlowSummary {
  totalDropOffRisk: string;
  estimatedCompletionRate: number;
  biggestDropOffNode: string | null;
  criticalPath: string[];
  overallSummary: string;
}

interface PathResult {
  path: string[];
  pathName: string;
  estimatedCompletionRate: number;
}

interface NodeRiskItem {
  id: string;
  name: string;
  dropOffRisk: string;
  dropOffPercent: number;
}

interface AnalysisPanelProps {
  flowSummary: FlowSummary;
  paths: PathResult[];
  nodeRisks: NodeRiskItem[];
  onNodeFocus?: (nodeId: string) => void;
  onPathHighlight?: (path: string[]) => void;
  onClose: () => void;
}

const RISK_COLORS: Record<string, { text: string; bg: string; bar: string }> = {
  "높음": { text: "text-red-400", bg: "bg-red-500/20", bar: "#ef4444" },
  "보통": { text: "text-amber-400", bg: "bg-amber-500/20", bar: "#f59e0b" },
  "낮음": { text: "text-emerald-400", bg: "bg-emerald-500/20", bar: "#22c55e" },
};

function AnalysisPanelComponent({
  flowSummary,
  paths,
  nodeRisks,
  onNodeFocus,
  onPathHighlight,
  onClose,
}: AnalysisPanelProps) {
  const riskStyle = RISK_COLORS[flowSummary.totalDropOffRisk];
  const sortedNodes = [...nodeRisks].sort((a, b) => b.dropOffPercent - a.dropOffPercent);

  return (
    <div className="w-72 border-l border-[var(--border)] bg-[#0d0d0d] flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-semibold text-white/90">분석 결과</h3>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 text-sm transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Completion rate hero */}
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <div className="text-center mb-3">
            <div className="text-3xl font-bold mono text-white">
              {flowSummary.estimatedCompletionRate}%
            </div>
            <div className="text-[10px] text-white/40 mt-1">예상 완료율</div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-white/40">전체 이탈 위험</span>
            <span className={`text-xs font-semibold ${riskStyle?.text ?? "text-white"}`}>
              {flowSummary.totalDropOffRisk}
            </span>
          </div>
          {/* Completion bar */}
          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${flowSummary.estimatedCompletionRate}%`,
                background: riskStyle?.bar ?? "#888",
              }}
            />
          </div>
        </div>

        {/* Summary text */}
        {flowSummary.overallSummary && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[10px] text-white/50 leading-relaxed">
              {flowSummary.overallSummary}
            </p>
          </div>
        )}

        {/* Paths section */}
        {paths.length > 0 && (
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[8px] uppercase tracking-wider text-white/30 mb-2">
              경로별 완료율
            </p>
            <div className="space-y-2">
              {paths.map((p, i) => {
                const pathRisk =
                  p.estimatedCompletionRate >= 70
                    ? "낮음"
                    : p.estimatedCompletionRate >= 40
                    ? "보통"
                    : "높음";
                const pathColor = RISK_COLORS[pathRisk];
                return (
                  <button
                    key={i}
                    onClick={() => onPathHighlight?.(p.path)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/60 group-hover:text-white/80 transition-colors">
                        {p.pathName}
                      </span>
                      <span className="text-[10px] mono font-medium" style={{ color: pathColor?.bar }}>
                        {p.estimatedCompletionRate}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${p.estimatedCompletionRate}%`,
                          background: pathColor?.bar ?? "#888",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Node risk list */}
        {sortedNodes.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[8px] uppercase tracking-wider text-white/30 mb-2">
              화면별 이탈 위험
            </p>
            <div className="space-y-1">
              {sortedNodes.map((node) => {
                const nodeRisk = RISK_COLORS[node.dropOffRisk];
                return (
                  <button
                    key={node.id}
                    onClick={() => onNodeFocus?.(node.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
                  >
                    {/* Risk indicator dot */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: nodeRisk?.bar ?? "#888" }}
                    />
                    {/* Name */}
                    <span className="text-[10px] text-white/60 group-hover:text-white/80 truncate flex-1 text-left">
                      {node.name || "(이름 없음)"}
                    </span>
                    {/* Percent */}
                    <span
                      className="text-[10px] mono font-medium shrink-0"
                      style={{ color: nodeRisk?.bar }}
                    >
                      {node.dropOffPercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Funnel chart */}
        {sortedNodes.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <p className="text-[8px] uppercase tracking-wider text-white/30 mb-3">
              퍼널 차트
            </p>
            <div className="space-y-1">
              {nodeRisks.map((node, i) => {
                const cumulativeRate = nodeRisks
                  .slice(0, i + 1)
                  .reduce((acc, n) => acc * ((100 - n.dropOffPercent) / 100), 100);
                const nodeRisk = RISK_COLORS[node.dropOffRisk];

                return (
                  <div key={node.id} className="group">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[8px] text-white/40 w-16 truncate">
                        {node.name || `화면 ${i + 1}`}
                      </span>
                      <span className="text-[8px] mono text-white/30">
                        {Math.round(cumulativeRate)}%
                      </span>
                    </div>
                    <div className="h-3 rounded bg-white/5 overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-700"
                        style={{
                          width: `${Math.max(cumulativeRate, 2)}%`,
                          background: nodeRisk?.bar ?? "#888",
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const AnalysisPanel = memo(AnalysisPanelComponent);
