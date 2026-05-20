export function buildUXWritingPrompt(
  issueContext: string,
  currentCopy: string | undefined,
  screenContext: string,
  tones: string[]
): string {
  return `## UX 라이팅 제안

### 맥락
- 화면: ${screenContext}
- 발견된 이슈: ${issueContext}
${currentCopy ? `- 현재 카피: "${currentCopy}"` : "- 현재 카피: 없음 (신규)"}

### 도메인 규칙
이 앱은 앱테크(만보기 리워드) 앱이다. 카피의 목적은:
1. 포인트 적립의 가치를 체감하게 하기
2. 재방문 동기를 심어주기
3. 광고 스트레스를 완충하기
4. 교환 목표까지의 여정을 즐겁게 만들기

경쟁사 카피 톤 참고:
- 머니워크: "Walk to get healthy & earn rewards" (건강+보상 병행)
- 돈이돼지: "누르면 누른 만큼 버는 정직한 앱테크" (직관적, 정직 강조)

### 생성 지시
아래 톤 각각에 대해 대안 카피를 1개씩 작성하세요.
요청된 톤: ${tones.join(", ")}

각 카피는:
- 15자 이내 (모바일 화면 기준)
- 한국어 자연스러운 구어체
- 해당 톤의 특성이 명확하게 드러나야 함

### 응답 형식 (JSON)
{
  "variants": [
    {
      "tone": "톤 ID",
      "toneLabel": "톤 한글명",
      "copy": "제안 카피",
      "rationale": "왜 이 카피가 효과적인지",
      "expectedEffect": "예상 지표 영향"
    }
  ]
}`;
}

export const TONE_LABELS: Record<string, string> = {
  urgent: "긴급형",
  friendly: "친근형",
  gamified: "게이미피케이션형",
  minimal: "미니멀형",
  trust: "신뢰형",
};
