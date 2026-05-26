# MEMORY.md — Simulo 메모리 시스템

## 메모리 3계층

### 1. 턴 메모리 (Turn Memory)
- **범위:** 현재 턴 내
- **내용:** 유저 발화 → Intent 감지 결과 → Pipeline 선택
- **관리:** Intent Router가 자동 처리 (`detectIntentByKeyword` → `applyIntentAndAnalyze`)
- **수명:** 턴 종료 시 Context Stack의 `results`에 축적

### 2. 세션 메모리 (Session Memory)
- **범위:** 현재 대화 세션 내 (플러그인 열려 있는 동안)
- **내용:** Context Stack 전체

```typescript
interface ContextStack {
  frames: FrameInfo[];           // 선택된 프레임 (1~5개)
  frameMode: 'single' | 'compare' | 'flow' | 'separate' | null;
  intent: string | null;        // full-scan, analyze-axis, copy-rewrite, ...
  subContext: string | null;     // follow-up으로 좁혀진 맥락
  persona: { id, label, promptContext } | null;
  pipeline: string[];            // 실행 파이프라인
  results: TurnResult[];         // 턴별 결과 누적 (append-only)
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastReport: LiveMiniReport | null;
  selectedCategory: string | null;
}
```

- **관리:** `figma-plugin/src/ui/ui.ts` 내 `contextStack` 변수
- **수명:** 리셋 버튼(↻) 또는 새 프레임 선택 시 부분 리셋
- **토큰 관리:** 10메시지 이상 → `compactConversationHistory()` 자동 압축
  ```
  turn 1~2: 유지 (첫 분석 결과)
  [이전 대화 요약: N번의 분석 생략됨]
  turn N-8~N: 유지 (최근 4턴)
  ```

### 3. 프로젝트 메모리 (Project Memory)
- **범위:** 세션을 넘어서 영구 유지
- **내용:**
  - 분석 세션 히스토리 (`ChatSession` 테이블)
  - 분석 결과 히스토리 (`Analysis` 테이블)
  - 경쟁사 분석 히스토리 (`CompetitorAnalysis` 테이블)
  - 캘리브레이션 데이터 (`CalibrationRecord` 테이블)
- **관리:** Prisma DB (`lib/db.ts`)
- **저장 시점:** 분석 완료 시 `/api/chat/sessions`에 fire-and-forget POST
- **수명:** 영구

## Context Stack 슬롯별 메모리 규칙

| 슬롯 | 세팅 주체 | 리셋 조건 | 유지 조건 |
|------|----------|----------|----------|
| frames | code.ts selectionchange | 새 프레임 선택 | 방향 전환, 리셋 |
| intent | Intent Router | 방향 전환, 명시적 리셋 | 새 프레임 선택 시 "이어서?" 제안 |
| subContext | follow-up 라벨 선택 | intent 변경 | 같은 intent 내 추가 질문 |
| persona | 라벨 선택 또는 자연어 | 명시적 리셋 | 프레임 변경, 방향 전환 |
| results | startChatAnalysis 완료 | 새 프레임 선택 | 방향 전환, 추가 분석 |
| conversationHistory | 매 턴 자동 push | 명시적 리셋 | 항상 유지 (압축 가능) |

## 이미지 캐시 메모리

`code.ts`의 `frameCache` — `Map<nodeId, { base64, texts, width, height, ts }>`
- TTL: 60초
- 같은 nodeId 재선택 시 재export 스킵 → selectionchange 응답 속도 개선
- 캐시 미스 시 adaptive scale로 export (프레임 크기 기반 0.75x~2.0x)

## 세션 간 메모리 활용 (향후)

- 같은 프레임을 다시 분석할 때: "이전에 이 화면을 분석한 적 있어요" 자동 표시
- ChatSession DB에서 frameId로 조회하여 이전 결과와 비교 가능
