export interface EconomyVariables {
  pointsPerStep: number;
  exchangeThreshold: number;
  dailyAdSlots: number;
  streakBonusMultiplier: number;
  adRewardPoints: number;
  pointExpiryDays: number;
}

export function buildEconomySimPrompt(
  currentVars: EconomyVariables,
  proposedVars: EconomyVariables
): string {
  return `## 리워드 이코노미 시뮬레이션

### 현재 설정
${JSON.stringify(currentVars, null, 2)}

### 제안 설정
${JSON.stringify(proposedVars, null, 2)}

### 경쟁사 기준점
- 돈이돼지: 1포인트=1원, 무제한 적립, 수수료 무료 출금
- 머니워크: 글로벌 기프트카드 교환, 다채널(걷기+식사+수면) 적립

### 시뮬레이션 지시
제안 설정이 적용되었을 때:
1. D1/D7/D30 리텐션 변화 예측 (현재 대비 +/-%)
2. ARPDAU 변화 예측 (세션당 광고 노출 × 유저 체류 기반)
3. 월간 포인트 교환 전환율 변화
4. 경쟁사 대비 포지셔닝 변화
5. 리스크 (포인트 인플레이션, 마진 압박 등)

### 응답 형식 (JSON)
{
  "retentionImpact": { "d1": "+2%", "d7": "+5%", "d30": "+3%" },
  "arpdauImpact": "+8% (세션 길이 증가로 광고 1회 추가 노출)",
  "exchangeRateImpact": "+12% (임계값 하락으로 교환 접근성 향상)",
  "competitivePosition": "돈이돼지 1:1 대비 여전히 불리하나, 스트릭 보너스로 차별화",
  "risks": ["포인트 인플레이션으로 6개월 후 마진 압박 가능"],
  "recommendation": "2주 A/B 테스트 후 점진 적용 권장"
}`;
}
