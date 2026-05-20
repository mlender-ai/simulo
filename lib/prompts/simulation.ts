import type { FrameworkResult } from "../frameworks";

export function buildSimulationPrompt(
  originalResults: FrameworkResult[],
  hypothesis: string,
  changeDescription: string
): string {
  return `## 플로우 변경 시뮬레이션

### 현재 상태 (Before)
${JSON.stringify(originalResults, null, 2)}

### 제안된 변경
가설: "${hypothesis}"
구체적 변경: ${changeDescription}

### 시뮬레이션 지시
1. 위 변경이 적용되었다고 가정하고, 각 프레임워크의 점수가 어떻게 변할지 예측하세요.
2. 각 프레임워크의 점수 변화에 대한 근거를 제시하세요.
3. 이 변경이 A/B 테스트할 가치가 있는지 판단하세요.
4. 예상 리텐션/ARPDAU 영향을 추정하세요.

### 주의
- 낙관적 편향을 피하세요. 변경에 따른 부작용(광고 노출 감소, 인지 부하 증가 등)도 반드시 고려하세요.
- 점수 변화는 현실적 범위(±1~15점) 내에서 추정하세요.
- "해볼 만하다"는 결론을 내리더라도 리스크를 명시하세요.

### 응답 형식 (JSON)
{
  "afterResults": [
    { "frameworkId": "...", "frameworkName": "...", "overallScore": 0, "findings": [] }
  ],
  "deltas": [
    { "frameworkId": "...", "scoreDelta": 0, "rationale": "..." }
  ],
  "abTestWorth": true,
  "abTestRationale": "...",
  "estimatedImpact": {
    "retention": "D1 리텐션 +2~5% 예상",
    "arpdau": "ARPDAU 변화 미미",
    "risk": "광고 시청 완료율 하락 리스크 낮음"
  }
}`;
}
