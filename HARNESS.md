# HARNESS.md — Simulo 테스트 하니스

## 대화형 E2E 테스트 시나리오

모든 테스트는 "유저가 대화를 통해 목표를 달성하는 과정"을 시뮬레이션한다.

### T1: 기본 분석 플로우
```
1. Figma에서 프레임 "홈 — 오늘의 걸음" 선택
2. 봇: "이 화면에서 뭘 해볼까요?" + 라벨 5개 확인
   - [전체 스캔] [사용성 검증] [카피 다듬기] [A/B 변형] [경쟁사 비교]
3. "전체 스캔" 라벨 클릭
4. 스트리밍 시작 → 미니 리포트 도착 확인
5. severity 뱃지 (sev-0~4) + findings 확인
6. CTA: [📋 결과 복사 (primary)] [↩ 다시 분석] 확인
7. 후속 라벨 확인 (getPostResultLabels 결과)
```

### T2: 카피 리라이트
```
1. 프레임 선택 → "카피 다듬어줘" 텍스트 입력
2. Intent Router: detectIntentByKeyword → "copy-rewrite" 감지 확인
3. startChatAnalysis() 호출 확인
4. 결과 도착: type="copy", findings 확인
5. "📋 결과 복사" CTA 클릭 → 클립보드 복사 확인
```

### T3: 축 분석 (analyze-axis)
```
1. 프레임 선택 → "광고 쪽으로 봐줘" 입력
2. Intent: analyze-axis, axis: "ad-buffer" 감지
3. subContext: "axis:ad-buffer" 세팅 확인
4. Sonnet 모델 + 2048 토큰으로 분석 확인
5. AXIS_PROMPTS["ad-buffer"] 프롬프트 사용 확인
```

### T4: 되돌아가기 — 방향 전환
```
1. 프레임 선택 → "전체적으로 봐줘" → 분석 완료
2. "아 카피 쪽으로 봐줘" 입력
3. isDirectionChange() 감지 확인
4. context.intent 리셋 → "copy-rewrite"로 재설정
5. context.frames 유지, context.results 유지 확인
6. 카피 분석 실행 (같은 프레임) 확인
```

### T5: 이어서 분석 (프레임 변경)
```
1. 프레임 A 선택 → 전체 스캔 → 분석 완료
2. 프레임 B 선택 (contextStack.results.length > 0)
3. 봇: "새 프레임이에요. 이어서 / 새로 시작?" 확인
4. "이어서 분석" 클릭 → __continue-full-scan 처리
5. 이전 intent(full-scan)로 프레임 B 즉시 분석 확인
```

### T6: 다중 프레임
```
1. Figma에서 3개 프레임 동시 선택
2. "3개 프레임 선택됨" 시스템 메시지 확인
3. 모드 라벨: [플로우로 분석] [각각 따로 분석] 확인
4. "플로우로 분석" 선택 → contextStack.frameMode = "flow"
5. intent 라벨 표시 → 분석 실행 확인
```

### T7: 에러 처리
```
1. API 키 없이 분석 시도 → free mode + 서버 프록시 사용 확인
2. 프레임 미선택 → "먼저 Figma에서 프레임을 선택해주세요" 확인
3. 60s 타임아웃 → "응답이 너무 오래 걸려요" + retry CTA 확인
4. retry CTA 클릭 → 에러 메시지 제거 + 재분석 확인
5. 6개 이상 프레임 선택 → "1~5개를 선택해주세요" 확인
```

### T8: abort on frame change
```
1. 프레임 A 선택 → "전체 스캔" → 스트리밍 시작 (chatAnalyzing = true)
2. 스트리밍 중 프레임 B 선택
3. chatAbortController.abort() 호출 확인
4. streaming 메시지 즉시 제거 확인
5. 프레임 B에 대한 새 대화 시작 확인
```

### T9: 이미지 캐시
```
1. 프레임 A 선택 → frames-selected (export 실행)
2. 프레임 B 선택
3. 60초 내에 프레임 A 다시 선택
4. frameCache에서 히트 → export 스킵 확인
5. 60초 후 프레임 A 다시 선택 → 캐시 미스 → 재export
```

### T10: 대형 프레임 adaptive scale
```
1. 800px 이하 프레임 → scale 2.0 확인
2. 1400px 프레임 → scale 1.5 확인
3. 2400px 프레임 → scale 1.0 확인
4. 2400px 초과 프레임 → scale 0.75 확인
```

## 빌드 검증 체크리스트

```bash
# 1. 웹 앱
npm run lint && npm run type-check && npm run build

# 2. Figma 플러그인
cd figma-plugin && npm run build

# 3. DB 스키마 (변경 시)
npx prisma db push
```

## 수동 테스트 환경
- Figma 플러그인 개발 모드에서 실행 (`Import plugin from manifest` → `figma-plugin/manifest.json`)
- 웹: `npm run dev` → `http://localhost:3000`
