# AGENTS.md — Simulo 에이전트 역할 정의

## 아키텍처 레이어

Simulo는 3개 레이어로 구성된다. 각 레이어에 특화된 에이전트가 작업한다.

### Layer 1: 대화 인터페이스 (UI Layer)
유저와의 대화를 관리하는 레이어.

**담당 영역:**
- 채팅 UI (MessageList, ChatMessage, InputBar, Labels, CTA)
- 프레임 선택 처리 + 이미지 캐시 + adaptive scale
- 스트리밍 렌더링 (토큰별 타이핑 효과)
- 미니 리포트 카드 렌더링
- 빈 상태, 에러 상태, 타임아웃 처리

**코드 위치:**
- `figma-plugin/src/ui/ui.ts` — 대화 UI + 라벨 + CTA + 스트리밍
- `figma-plugin/src/ui/index.html` — HTML/CSS
- `figma-plugin/src/plugin/code.ts` — 프레임 감지 + 이미지 export

**규칙:**
- 비즈니스 로직을 UI 렌더링에 섞지 마라. Intent Router와 Pipeline은 Layer 2 영역.
- 라벨 클릭 → `handleIntentLabel()` 호출. 라벨이 직접 API를 호출하지 않는다.
- CTA 클릭 → `handleChatAction()` 호출. 즉시 실행 (복사, 재분석 등).

### Layer 2: 라우팅 + 실행 (Logic Layer)
유저 의도를 파악하고 파이프라인을 실행하는 레이어.

**담당 영역:**
- Intent Router (키워드 매칭 + Haiku 호출)
- Context Stack 관리 (슬롯 채움, 리셋, 유지)
- 분석 실행 (`startChatAnalysis` → `/api/chat`)
- 동적 라벨 생성 (`getLabelsForState`, `getPostResultLabels`)
- 되돌아가기 / 방향 전환 처리
- 대화 히스토리 토큰 압축 (`compactConversationHistory`)

**코드 위치:**
- `figma-plugin/src/ui/ui.ts` — Intent Router + Context Stack + Analysis 호출
- `app/api/chat/route.ts` — 서버 사이드 파이프라인 실행
- `app/api/intent/route.ts` — Haiku 의도 감지

**규칙:**
- Intent Router의 키워드 맵(`KEYWORD_INTENT_MAP`)을 수정할 때 기존 키워드와 충돌 확인.
- Context Stack 슬롯 추가 시 `ContextStack` 인터페이스 + 초기값 + 리셋 로직 3곳 동시 수정.
- 새 Intent 추가 시: `KEYWORD_INTENT_MAP` + `INTENT_TO_CATEGORY` + `buildSystemPrompt()` 3곳 수정.

### Layer 3: 분석 엔진 (Prompt Layer)
Claude에게 보내는 프롬프트를 구성하고 결과를 파싱하는 레이어.

**담당 영역:**
- Intent별 시스템 프롬프트 (`buildSystemPrompt` 내 switch-case)
- 4축 프롬프트 (`AXIS_PROMPTS`)
- 도메인 컨텍스트 (야핏무브 비즈니스 모델, 경쟁사)
- 응답 JSON 스키마 (severity, findings, quickSummary)
- 모델 분기 (Sonnet/Haiku) + max_tokens 분기

**코드 위치:**
- `app/api/chat/route.ts` — `buildSystemPrompt()`, `selectModel()`, `getMaxTokens()`
- `lib/prompts/` — 기존 프롬프트 빌더 (웹 대시보드용)
- `lib/frameworks.ts` — 4축 프레임워크 정의

**규칙:**
- 프롬프트 수정 시 기존 분석과의 일관성 확인. 점수 기준이 바뀌면 히스토리와 비교 불가.
- 새 4축 추가: `AXIS_PROMPTS` 객체에 추가 + `KEYWORD_INTENT_MAP`에 키워드 추가.
- severity 기준 (0~4) 변경 금지 — UI 전체에 하드코딩되어 있음.

## 작업 위임 규칙

| 작업 유형 | 레이어 | 수정 위치 |
|----------|--------|----------|
| "채팅 UI에 새 카드 타입 추가" | Layer 1 | `ui.ts` renderMsgHTML + `index.html` CSS |
| "새 intent 타입 추가" | Layer 2 + 3 | `ui.ts` KEYWORD_INTENT_MAP + `route.ts` buildSystemPrompt |
| "프롬프트 수정" | Layer 3 | `route.ts` buildSystemPrompt 또는 AXIS_PROMPTS |
| "에러 처리 개선" | Layer 1 | `ui.ts` startChatAnalysis catch 블록 |
| "새 분석 파이프라인 추가" | Layer 2 + 3 | INTENT_TO_CATEGORY + buildSystemPrompt + selectModel |
