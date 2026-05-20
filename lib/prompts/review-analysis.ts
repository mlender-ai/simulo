import type { Review } from "../store-research";

export function buildReviewAnalysisPrompt(
  competitorName: string,
  reviews: Review[]
): string {
  return `다음은 "${competitorName}" 앱의 최근 사용자 리뷰 ${reviews.length}건입니다.

## 분석 지시
1. 부정 리뷰에서 반복되는 불만을 클러스터링하세요 (최대 5개 클러스터).
2. 긍정 리뷰에서 반복되는 만족 요인을 클러스터링하세요 (최대 5개 클러스터).
3. 각 클러스터에 대해 야핏무브가 선점/개선할 수 있는 기회를 제안하세요.
4. 업데이트 노트에서 새로 추가된 기능이 있으면 야핏무브 대응 필요 여부를 판단하세요.

## 응답 형식 (JSON)
{
  "negativePatterns": [
    { "pattern": "패턴 설명", "frequency": 리뷰수, "yafitOpportunity": "야핏무브 기회" }
  ],
  "positivePatterns": [
    { "pattern": "패턴 설명", "frequency": 리뷰수, "yafitRisk": "야핏무브에 이것이 없으면 리스크" }
  ],
  "featureAlerts": [
    { "feature": "새 기능", "impact": "high", "recommendation": "야핏무브 대응 방향" }
  ]
}

## 리뷰 데이터
${reviews.map((r) => `[${r.rating}★] ${r.text}`).join("\n")}`;
}
