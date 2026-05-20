"use client";

import { useState } from "react";
import type { FrameworkResult } from "@/lib/frameworks";

interface SimulationResult {
  before: FrameworkResult[];
  after: FrameworkResult[];
  delta: { frameworkId: string; scoreDelta: number; rationale: string }[];
  abTestWorth: boolean;
  abTestRationale: string;
  estimatedImpact: {
    retention: string;
    arpdau: string;
    risk: string;
  };
}

interface SimulationPanelProps {
  originalResults: FrameworkResult[];
  onClose?: () => void;
}

export default function SimulationPanel({
  originalResults,
  onClose,
}: SimulationPanelProps) {
  const [hypothesis, setHypothesis] = useState("");
  const [changeDescription, setChangeDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    if (!hypothesis.trim() || !changeDescription.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalResults, hypothesis, changeDescription }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">플로우 변경 시뮬레이션</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm"
          >
            닫기
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">가설</label>
          <input
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="예: 광고 직후에 스트릭 보너스 팝업을 보여주면?"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            구체적 변경 내용
          </label>
          <textarea
            value={changeDescription}
            onChange={(e) => setChangeDescription(e.target.value)}
            rows={2}
            placeholder="어떤 화면에서 무엇을 어떻게 바꾸는지 상세히 설명"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
        <button
          onClick={runSimulation}
          disabled={loading || !hypothesis.trim() || !changeDescription.trim()}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
        >
          {loading ? "시뮬레이션 중..." : "시뮬레이션 실행"}
        </button>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {result && (
        <div className="space-y-4 pt-2 border-t border-gray-700">
          {/* A/B Test recommendation */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
              result.abTestWorth
                ? "bg-green-900/40 border border-green-800 text-green-300"
                : "bg-yellow-900/40 border border-yellow-800 text-yellow-300"
            }`}
          >
            <span>
              {result.abTestWorth
                ? "✓ A/B 테스트 권장"
                : "△ A/B 테스트 비권장"}
            </span>
          </div>
          {result.abTestRationale && (
            <p className="text-xs text-gray-400">{result.abTestRationale}</p>
          )}

          {/* Score deltas */}
          {result.delta.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">
                프레임워크별 점수 변화
              </div>
              <div className="space-y-2">
                {result.delta.map((d) => (
                  <div key={d.frameworkId} className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-mono">
                          {d.frameworkId}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            d.scoreDelta > 0
                              ? "text-green-400"
                              : d.scoreDelta < 0
                              ? "text-red-400"
                              : "text-gray-400"
                          }`}
                        >
                          {d.scoreDelta > 0
                            ? `+${d.scoreDelta}`
                            : d.scoreDelta}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {d.rationale}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Impact estimates */}
          {result.estimatedImpact && (
            <div>
              <div className="text-xs text-gray-500 mb-2">예상 지표 영향</div>
              <div className="grid grid-cols-1 gap-2">
                {result.estimatedImpact.retention && (
                  <div className="bg-gray-800 rounded px-3 py-2 text-xs">
                    <span className="text-blue-400">리텐션</span>
                    <span className="text-gray-300 ml-2">
                      {result.estimatedImpact.retention}
                    </span>
                  </div>
                )}
                {result.estimatedImpact.arpdau && (
                  <div className="bg-gray-800 rounded px-3 py-2 text-xs">
                    <span className="text-yellow-400">ARPDAU</span>
                    <span className="text-gray-300 ml-2">
                      {result.estimatedImpact.arpdau}
                    </span>
                  </div>
                )}
                {result.estimatedImpact.risk && (
                  <div className="bg-gray-800 rounded px-3 py-2 text-xs">
                    <span className="text-red-400">리스크</span>
                    <span className="text-gray-300 ml-2">
                      {result.estimatedImpact.risk}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
