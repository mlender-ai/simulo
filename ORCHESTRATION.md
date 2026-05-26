# ORCHESTRATION.md — Simulo 실행 오케스트레이션

## 실행 흐름

모든 분석 요청은 아래 단일 흐름을 따른다. 탭, 메뉴, 별도 페이지가 없다.

```
유저 입력 (Figma 프레임 선택 + 라벨 클릭 or 텍스트 입력)
    │
    ▼
┌─────────────────────┐
│  Frame Handler      │  selectionchange → 프레임 캡처 (adaptive scale)
│  (code.ts)          │  이미지 캐시 (TTL 60s)
└────────┬────────────┘
         │ postMessage → frames-selected
         ▼
┌─────────────────────┐
│  handleFramesSelected│ Context Stack 초기화/갱신
│  (ui.ts)            │ 이전 세션 있으면 "이어서?" 제안
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Intent Router      │  라벨 클릭 → handleIntentLabel() (즉시)
│  (ui.ts)            │  텍스트 입력 → handleChatInput()
│                     │    1단계: detectIntentByKeyword() (0ms)
│                     │    2단계: detectIntentByHaiku() (500ms, 필요 시만)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Context Stack      │  슬롯 채움: frames, intent, subContext
│  (ui.ts)            │  충분 → startChatAnalysis() 실행
│                     │  부족 → follow-up 라벨 질문
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  /api/chat          │  buildSystemPrompt(intent, subContext, ocrContext)
│  (route.ts)         │  selectModel(): Sonnet or Haiku
│                     │  SSE 스트리밍 응답
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Response Parser    │  스트리밍 JSON 파싱 → LiveMiniReport
│  (ui.ts)            │  contextStack.results에 push
│                     │  ChatSession DB 저장 (fire-and-forget)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Label Generator    │  getLabelsForState(ctx) → 다음 라벨 결정
│  (ui.ts)            │  CTA 버튼: 복사(primary) + 다시 분석(secondary)
└────────┬────────────┘
         │
         ▼
  유저에게 표시: 미니 리포트 + CTA + 라벨
  → 유저의 다음 입력을 기다림 (루프)
```

## 모델 분기

| Intent | 모델 | max_tokens | 이유 |
|--------|------|-----------|------|
| full-scan | Sonnet | 2048 | 정밀 판단 |
| analyze-axis | Sonnet | 2048 | 축별 깊은 분석 |
| ab-variant | Sonnet | 1536 | 창의+분석 |
| suggestion | Sonnet | 1024 | 구체적 설계 |
| copy-rewrite | Haiku | 1024 | 빠른 응답 |
| competitor-compare | Haiku | 1024 | 비교 요약 |
| usability / visual / cta | Haiku | 1024 | 경량 분석 |

## 토큰 관리

`compactConversationHistory()` — 대화 히스토리가 10메시지 초과 시:
```
turn 1~2: 유지 (첫 분석 결과)
[이전 대화 요약: N번의 분석 생략됨]
turn N-8~N: 유지 (최근 4턴)
```

## 되돌아가기 오케스트레이션

### 방법 1: 자연어 방향 전환
```
유저: "아 카피 쪽으로 봐줘"
    │
    ▼
isDirectionChange() 감지 (키워드: "잠깐", "다시", "쪽으로", "말고")
    │
    ▼
Context Stack: intent/subContext만 리셋, frames/results 유지
    │
    ▼
새 intent로 Intent Router 재실행 → Pipeline 재결정
```

### 방법 2: 새 프레임 선택
```
Figma에서 새 프레임 클릭
    │
    ▼
handleFramesSelected(): 이전 intent/results 있으면
    │
    ▼
"새 프레임이에요. 이어서 / 새로 시작?" 라벨 제안
    │
    ▼
"이어서" → __continue-{intent} → 이전 intent로 즉시 분석
"새로 시작" → __new-start → 초기 라벨 표시
```

### 방법 3: 명시적 전체 리셋
```
↻ 리셋 버튼 클릭
    │
    ▼
resetChat(): 모든 슬롯 초기화 (frames만 유지)
    │
    ▼
"대화를 새로 시작합니다." + 초기 라벨
```

## 에러 시 오케스트레이션

```
분석 실행 중 에러 발생
    │
    ├─ 401 → "API 키 유효하지 않음" + retry CTA
    ├─ 429 → "요청 제한" + retry CTA
    ├─ 60s 타임아웃 → "응답 지연" + retry CTA
    ├─ 네트워크 에러 → "서버 연결 실패" + retry CTA
    └─ 프레임 변경 abort → streaming 메시지 제거, 새 프레임 전환
```

retry CTA 클릭 → `handleChatAction("retry")` → 에러 메시지 제거 → `startChatAnalysis()` 재실행
