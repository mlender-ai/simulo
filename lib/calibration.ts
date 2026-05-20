export type SeverityLevel = 0 | 1 | 2 | 3 | 4;

export interface CalibrationRecord {
  id: string;
  analysisId: string;
  criterionId: string;
  predictedSeverity: SeverityLevel;
  actualMetric: string;
  actualValue: number;
  accuracy: "accurate" | "overestimated" | "underestimated";
  deviation: number;
  calibratedAt: Date;
}

// Severity → metric threshold mapping
// Each criterion maps to an observable metric and what range = what severity
export const METRIC_MAPPING: Record<
  string,
  {
    metricLabel: string;
    thresholds: Record<number, [number, number]>; // severity → [min, max]
  }
> = {
  pre_ad_priming: {
    metricLabel: "광고 시작 직전 화면 도달률",
    thresholds: {
      0: [0.8, 1],
      1: [0.6, 0.8],
      2: [0.4, 0.6],
      3: [0.2, 0.4],
      4: [0, 0.2],
    },
  },
  post_ad_payoff: {
    metricLabel: "광고 후 앱 잔존율",
    thresholds: {
      0: [0.85, 1],
      1: [0.7, 0.85],
      2: [0.55, 0.7],
      3: [0.35, 0.55],
      4: [0, 0.35],
    },
  },
  daily_earning_visibility: {
    metricLabel: "홈 화면 인게이지먼트율",
    thresholds: {
      0: [0.7, 1],
      1: [0.55, 0.7],
      2: [0.4, 0.55],
      3: [0.25, 0.4],
      4: [0, 0.25],
    },
  },
  goal_gradient: {
    metricLabel: "교환 페이지 방문율",
    thresholds: {
      0: [0.3, 1],
      1: [0.2, 0.3],
      2: [0.1, 0.2],
      3: [0.05, 0.1],
      4: [0, 0.05],
    },
  },
  streak_continuity: {
    metricLabel: "D7 리텐션율",
    thresholds: {
      0: [0.5, 1],
      1: [0.35, 0.5],
      2: [0.2, 0.35],
      3: [0.1, 0.2],
      4: [0, 0.1],
    },
  },
  ad_completion_rate: {
    metricLabel: "광고 시청 완료율",
    thresholds: {
      0: [0.8, 1],
      1: [0.65, 0.8],
      2: [0.5, 0.65],
      3: [0.3, 0.5],
      4: [0, 0.3],
    },
  },
};

export function calculateAccuracy(
  predicted: SeverityLevel,
  metricKey: string,
  actualValue: number
): CalibrationRecord["accuracy"] {
  const mapping = METRIC_MAPPING[metricKey];
  if (!mapping) return "accurate";

  const range = mapping.thresholds[predicted];
  if (!range) return "accurate";

  const [min, max] = range;
  if (actualValue >= min && actualValue <= max) return "accurate";
  if (actualValue > max) return "overestimated"; // AI rated it as more severe than it was
  return "underestimated"; // AI rated it as less severe than it was
}

export function calculateDeviation(
  predicted: SeverityLevel,
  metricKey: string,
  actualValue: number
): number {
  const mapping = METRIC_MAPPING[metricKey];
  if (!mapping) return 0;

  // Find which severity level best matches the actual value
  let bestSeverity = predicted;
  let bestDistance = Infinity;

  for (const [sev, range] of Object.entries(mapping.thresholds)) {
    const [min, max] = range;
    const midpoint = (min + max) / 2;
    const dist = Math.abs(actualValue - midpoint);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestSeverity = Number(sev) as SeverityLevel;
    }
  }

  return Math.abs(predicted - bestSeverity);
}
