export type SlackNotificationType =
  | "analysis_complete"
  | "competitor_alert"
  | "calibration_drift"
  | "weekly_digest";

export async function sendSlackNotification(params: {
  webhookUrl: string;
  type: SlackNotificationType;
  data: Record<string, unknown>;
}): Promise<void> {
  const templates: Record<SlackNotificationType, (d: Record<string, unknown>) => string> = {
    analysis_complete: (d) =>
      `📊 *Simulo 분석 완료*\n화면: ${d.screenName}\n전체 점수: ${d.overallScore}/100\n최우선 이슈: ${d.topPriority}`,
    competitor_alert: (d) =>
      `🔔 *경쟁사 변화 감지*\n${d.competitorName}: ${d.alertMessage}\n대응 권장: ${d.recommendation}`,
    calibration_drift: (d) =>
      `⚠️ *캘리브레이션 드리프트*\n기준 [${d.criterionId}]의 예측 정확도가 ${d.accuracy}%로 하락\n자동 보정이 적용되었습니다.`,
    weekly_digest: (d) =>
      `📅 *주간 Simulo 리포트*\n분석 ${d.analysisCount}건 | 경쟁 격차 변화: ${d.gapDelta}\n이번 주 핵심: ${d.keyInsight}`,
  };

  await fetch(params.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: templates[params.type](params.data) }),
  });
}
