"use client";

import { useState } from "react";
import type { EconomyVariables } from "@/lib/prompts/economy-sim";

const DEFAULT_VARS: EconomyVariables = {
  pointsPerStep: 100,
  exchangeThreshold: 5000,
  dailyAdSlots: 5,
  streakBonusMultiplier: 1.5,
  adRewardPoints: 100,
  pointExpiryDays: 90,
};

interface SimResult {
  retentionImpact?: { d1: string; d7: string; d30: string };
  arpdauImpact?: string;
  exchangeRateImpact?: string;
  competitivePosition?: string;
  risks?: string[];
  recommendation?: string;
}

const VARIABLE_LABELS: {
  key: keyof EconomyVariables;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "pointsPerStep",
    label: "걸음당 포인트",
    unit: "p/1만보",
    min: 50,
    max: 500,
    step: 10,
  },
  {
    key: "exchangeThreshold",
    label: "최소 교환 금액",
    unit: "원",
    min: 1000,
    max: 20000,
    step: 500,
  },
  {
    key: "dailyAdSlots",
    label: "일일 광고 슬롯",
    unit: "개",
    min: 1,
    max: 20,
    step: 1,
  },
  {
    key: "streakBonusMultiplier",
    label: "스트릭 보너스 배율",
    unit: "x",
    min: 1,
    max: 5,
    step: 0.1,
  },
  {
    key: "adRewardPoints",
    label: "광고 1회 보상",
    unit: "포인트",
    min: 10,
    max: 500,
    step: 10,
  },
  {
    key: "pointExpiryDays",
    label: "포인트 만료",
    unit: "일",
    min: 30,
    max: 365,
    step: 30,
  },
];

export default function EconomyPage() {
  const [current] = useState<EconomyVariables>(DEFAULT_VARS);
  const [proposed, setProposed] = useState<EconomyVariables>({
    ...DEFAULT_VARS,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  async function runSim() {
    setLoading(true);
    try {
      const res = await fetch("/api/simulate/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentVars: current, proposedVars: proposed }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  function updateVar(key: keyof EconomyVariables, value: number) {
    setProposed((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            리워드 이코노미 시뮬레이터
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            포인트 경제 변수를 조절하여 리텐션·ARPDAU에 미치는 영향을
            시뮬레이션합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sliders */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">변수 설정</h2>
            {VARIABLE_LABELS.map(({ key, label, unit, min, max, step }) => (
              <div
                key={key}
                className="bg-gray-900 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 line-through">
                      {current[key]}
                    </span>
                    <span className="text-sm font-mono text-white">
                      {proposed[key]} {unit}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={proposed[key]}
                  onChange={(e) => updateVar(key, Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>{min}</span>
                  <span>{max}</span>
                </div>
              </div>
            ))}
            <button
              onClick={runSim}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
            >
              {loading ? "시뮬레이션 중..." : "시뮬레이션 실행"}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">
              시뮬레이션 결과
            </h2>
            {!result ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-500 text-sm">
                변수를 설정하고 시뮬레이션을 실행하세요
              </div>
            ) : (
              <div className="space-y-3">
                {/* Retention */}
                {result.retentionImpact && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-2">
                      리텐션 변화
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {(["d1", "d7", "d30"] as const).map((k) => (
                        <div key={k} className="text-center">
                          <div className="text-xs text-gray-500">
                            {k.toUpperCase()}
                          </div>
                          <div
                            className={`text-sm font-mono font-bold ${
                              (result.retentionImpact![k] ?? "").startsWith("+")
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {result.retentionImpact![k]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ARPDAU */}
                {result.arpdauImpact && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">
                      ARPDAU 영향
                    </div>
                    <div className="text-sm text-gray-200">
                      {result.arpdauImpact}
                    </div>
                  </div>
                )}

                {/* Exchange rate */}
                {result.exchangeRateImpact && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">교환 전환율</div>
                    <div className="text-sm text-gray-200">
                      {result.exchangeRateImpact}
                    </div>
                  </div>
                )}

                {/* Competitive position */}
                {result.competitivePosition && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">
                      경쟁사 대비 포지션
                    </div>
                    <div className="text-sm text-gray-200">
                      {result.competitivePosition}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {result.risks && result.risks.length > 0 && (
                  <div className="bg-red-900/20 border border-red-900 rounded-lg p-4">
                    <div className="text-xs text-red-400 mb-2">리스크</div>
                    <ul className="space-y-1">
                      {result.risks.map((r, i) => (
                        <li key={i} className="text-sm text-red-300">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                {result.recommendation && (
                  <div className="bg-blue-900/20 border border-blue-900 rounded-lg p-4">
                    <div className="text-xs text-blue-400 mb-1">권장 사항</div>
                    <div className="text-sm text-blue-200">
                      {result.recommendation}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
