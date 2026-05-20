import type { CalibrationRecord, SeverityLevel } from "./calibration";

export interface CalibrationAdjustment {
  criterionId: string;
  direction: "raise" | "lower";
  magnitude: "slight" | "moderate" | "significant";
  sampleSize: number;
  accuracyRate: number;
  generatedAt: Date;
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function analyzeCalibrationTrend(
  records: CalibrationRecord[]
): CalibrationAdjustment[] {
  const grouped = groupBy(records, "criterionId");
  const adjustments: CalibrationAdjustment[] = [];

  for (const [criterionId, group] of Object.entries(grouped)) {
    if (group.length < 5) continue; // need at least 5 data points

    const overCount = group.filter((r) => r.accuracy === "overestimated").length;
    const underCount = group.filter((r) => r.accuracy === "underestimated").length;
    const accurateCount = group.filter((r) => r.accuracy === "accurate").length;
    const total = group.length;
    const accuracyRate = accurateCount / total;

    if (overCount / total > 0.6) {
      adjustments.push({
        criterionId,
        direction: "lower",
        magnitude: overCount / total > 0.8 ? "significant" : "moderate",
        sampleSize: total,
        accuracyRate,
        generatedAt: new Date(),
      });
    } else if (underCount / total > 0.6) {
      adjustments.push({
        criterionId,
        direction: "raise",
        magnitude: underCount / total > 0.8 ? "significant" : "moderate",
        sampleSize: total,
        accuracyRate,
        generatedAt: new Date(),
      });
    }
  }

  return adjustments;
}

export function buildCalibrationDirective(
  adjustments: CalibrationAdjustment[]
): string {
  if (adjustments.length === 0) return "";

  const lines = adjustments.map((adj) => {
    const dirText =
      adj.direction === "raise"
        ? `이 기준의 심각도를 실제보다 낮게 평가하는 경향이 있습니다. 더 엄격하게 평가하세요. (${adj.magnitude})`
        : `이 기준의 심각도를 실제보다 높게 평가하는 경향이 있습니다. 더 관대하게 평가하세요. (${adj.magnitude})`;
    return `- [${adj.criterionId}]: ${dirText} (보정 근거: ${adj.sampleSize}건, 정확도: ${Math.round(adj.accuracyRate * 100)}%)`;
  });

  return `
## 캘리브레이션 보정 (실측 데이터 기반)
아래 기준들은 과거 분석에서 실측과 차이가 있었습니다. 보정 방향을 참고하세요:
${lines.join("\n")}
`;
}

// Re-export SeverityLevel for convenience
export type { SeverityLevel };
