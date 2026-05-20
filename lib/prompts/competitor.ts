import type { FrameworkResult } from "../frameworks";

export function buildCompetitorSystemPrompt(competitorName: string): string {
  return `지금 분석하는 화면은 야핏무브가 아닌 경쟁사 "${competitorName}"의 앱 화면입니다.
야핏무브와 동일한 평가 기준으로 분석하되, 추가로:
1. 이 경쟁사가 야핏무브보다 잘하고 있는 점을 명시하세요.
2. 이 경쟁사가 야핏무브보다 못하고 있는 점을 명시하세요.
3. 야핏무브가 이 경쟁사로부터 벤치마킹할 수 있는 구체적 요소를 제안하세요.`;
}

export function buildCompetitorComparePrompt(
  ourResults: FrameworkResult[],
  competitorResults: FrameworkResult[],
  competitorName: string
): string {
  return `## 야핏무브 vs ${competitorName} 비교 분석

### 야핏무브 프레임워크 결과
${JSON.stringify(ourResults, null, 2)}

### ${competitorName} 프레임워크 결과
${JSON.stringify(competitorResults, null, 2)}

### 비교 지시
1. 프레임워크별로 두 앱의 점수 차이를 분석하세요.
2. 야핏무브가 앞서는 영역과 뒤처지는 영역을 구분하세요.
3. 가장 시급하게 개선해야 할 격차 3가지를 우선순위 순으로 제시하세요.
4. 각 격차에 대한 구체적인 개선 방향을 제시하세요.

### 응답 형식 (JSON)
{
  "leading": [{ "frameworkId": "...", "gap": 숫자, "insight": "..." }],
  "lagging": [{ "frameworkId": "...", "gap": 숫자, "insight": "..." }],
  "topPriorities": [{ "rank": 1, "area": "...", "currentGap": 숫자, "recommendation": "..." }],
  "overallVerdict": "..."
}`;
}
