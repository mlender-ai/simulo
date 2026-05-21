import { prisma } from "@/lib/db";
import { analyzeCalibrationTrend } from "@/lib/prompt-calibration";
import type { CalibrationRecord, SeverityLevel } from "@/lib/calibration";

export const dynamic = "force-dynamic";
export const metadata = { title: "개선 효과 추적 | Simulo" };

async function getCalibrationData() {
  const rawRecords = await prisma.calibrationRecord.findMany({
    orderBy: { calibratedAt: "desc" },
    take: 500,
  });

  const records: CalibrationRecord[] = rawRecords.map((r) => ({
    id: r.id,
    analysisId: r.analysisId,
    criterionId: r.criterionId,
    predictedSeverity: r.predictedSeverity as SeverityLevel,
    actualMetric: r.actualMetric,
    actualValue: r.actualValue,
    accuracy: r.accuracy as CalibrationRecord["accuracy"],
    deviation: r.deviation,
    calibratedAt: r.calibratedAt,
  }));

  const adjustments = analyzeCalibrationTrend(records);
  const totalRecords = records.length;
  const accurateCount = records.filter((r) => r.accuracy === "accurate").length;
  const overCount = records.filter((r) => r.accuracy === "overestimated").length;
  const underCount = records.filter((r) => r.accuracy === "underestimated").length;

  return {
    records: records.slice(0, 20),
    adjustments,
    stats: {
      total: totalRecords,
      accurate: accurateCount,
      overestimated: overCount,
      underestimated: underCount,
      accuracyRate: totalRecords > 0 ? Math.round((accurateCount / totalRecords) * 100) : null,
    },
  };
}

export default async function ImpactPage() {
  const { records, adjustments, stats } = await getCalibrationData();

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">개선 효과 추적</h1>
          <p className="text-gray-400 mt-1 text-sm">
            AI 예측과 실측 데이터를 비교하여 분석 정확도를 개선합니다.
          </p>
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "총 캘리브레이션", value: stats.total, color: "text-white" },
            {
              label: "정확 예측",
              value: stats.accurate,
              color: "text-green-400",
            },
            {
              label: "과대 평가",
              value: stats.overestimated,
              color: "text-yellow-400",
            },
            {
              label: "과소 평가",
              value: stats.underestimated,
              color: "text-red-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-gray-900 border border-gray-700 rounded-lg p-4"
            >
              <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Accuracy rate */}
        {stats.accuracyRate !== null && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">예측 정확도</span>
              <span
                className={`text-sm font-mono font-bold ${
                  stats.accuracyRate >= 70
                    ? "text-green-400"
                    : stats.accuracyRate >= 50
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {stats.accuracyRate}%
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.accuracyRate >= 70
                    ? "bg-green-500"
                    : stats.accuracyRate >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${stats.accuracyRate}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">목표: 70% 이상</div>
          </div>
        )}

        {/* Active calibration adjustments */}
        {adjustments.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">
              활성 보정 ({adjustments.length}건)
            </h2>
            <div className="space-y-2">
              {adjustments.map((adj) => (
                <div
                  key={adj.criterionId}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex items-start gap-4"
                >
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono ${
                      adj.direction === "lower"
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-blue-900 text-blue-300"
                    }`}
                  >
                    {adj.direction === "lower" ? "↓ 완화" : "↑ 강화"}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-200 font-mono">{adj.criterionId}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {adj.sampleSize}건 기반 · 강도: {adj.magnitude} · 정확도:{" "}
                      {Math.round(adj.accuracyRate * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent calibration records */}
        {records.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">최근 캘리브레이션</h2>
            <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-3 text-gray-500 font-normal">기준</th>
                    <th className="text-left p-3 text-gray-500 font-normal">예측 심각도</th>
                    <th className="text-left p-3 text-gray-500 font-normal">실측값</th>
                    <th className="text-left p-3 text-gray-500 font-normal">정확도</th>
                    <th className="text-left p-3 text-gray-500 font-normal">날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="p-3 font-mono text-gray-300">{r.criterionId}</td>
                      <td className="p-3 text-gray-300">{r.predictedSeverity}/4</td>
                      <td className="p-3 text-gray-300">{(r.actualValue * 100).toFixed(1)}%</td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            r.accuracy === "accurate"
                              ? "bg-green-900 text-green-300"
                              : r.accuracy === "overestimated"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-red-900 text-red-300"
                          }`}
                        >
                          {r.accuracy === "accurate"
                            ? "정확"
                            : r.accuracy === "overestimated"
                            ? "과대"
                            : "과소"}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">
                        {new Date(r.calibratedAt).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {records.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm">아직 캘리브레이션 데이터가 없습니다.</div>
            <div className="text-xs text-gray-600 mt-1">
              분석 결과와 실측 데이터를 연결하면 여기에 표시됩니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
