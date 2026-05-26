# Simulo — AI UX Testing Tool

## 사용자 (최광혁)
- Simulo 1인 개발자 겸 프로덕트 오너
- Next.js, TypeScript, Figma Plugin API에 익숙한 풀스택 개발자
- 여러 세션/기기에서 병렬로 작업함 → 토큰 효율 중요

## 행동 규칙 (모든 모델, 모든 세션, 모든 기기에서 반드시 준수)

### 대화 스타일
- 한국어로 대화. 간결하게. 핵심만.
- 불필요한 인사, 요약 반복, 확인 질문 금지.
- "~할까요?", "~해도 될까요?" 묻지 말 것 — 크리티컬하지 않으면 바로 실행.
- 작업 끝나면 장황하게 설명하지 말 것. 변경사항은 diff로 보임.

### 자율 실행 원칙
- git commit, push, pull, rebase → 묻지 말고 실행.
- 파일 생성/수정/삭제 → 묻지 말고 실행.
- GitHub API (이슈 close, comment, PR) → 묻지 말고 실행.
- 코드 변경 완료 → 즉시 commit + push. "커밋할까요?" 같은 질문 금지.
- 이슈 구현 완료 → 이슈 close + 오픈 PR 있으면 체크 통과 확인 후 머지. PR 없으면 main에 직접 push.
- **크리티컬 예외만 확인**: 프로덕션 DB 삭제, force push to main, 비밀키 노출, 되돌릴 수 없는 대량 삭제.

### 배포 전 필수 검증 (절대 스킵 금지)
push 전에 아래를 **반드시** 순서대로 통과:
```bash
npm run lint && npm run type-check   # 1. 린트 + 타입
npm run build                         # 2. 프로덕션 빌드 (가장 중요)
```
- 린트/타입만 통과했다고 push 금지 — 빌드 실패 가능.
- `npm run build` 성공해도 500 나올 수 있음 — 의심되면 헬스체크.
- `.next` 캐시 오염 시 `rm -rf .next node_modules/.cache` 후 재빌드.
- Figma 플러그인 수정 시 `cd figma-plugin && npm run build` 도 검증.

---

## 프로젝트 개요

Simulo는 야핏무브 팀을 위한 AI 기반 UX 테스팅 도구이다.
Figma 플러그인 + 웹 앱 두 가지 표면을 가지며,
Figma 플러그인은 **단일 대화형 인터페이스**로 동작한다. 탭, 메뉴, 폼이 없다.

유저가 Figma에서 프레임을 선택하고 자연어로 요청하면,
시스템이 의도를 파악하여 적절한 분석 파이프라인을 조합·실행한다.

## 도메인 컨텍스트
야핏무브는 광고 수익 기반 만보기 리워드 앱이다.
- 타깃: 4060 여성
- 수익원: AdMob, Mintegral 등 광고 네트워크
- 핵심 지표: ARPDAU (일일 활성 유저당 평균 수익)
- 광고 스트레스는 UX가 통제할 수 없는 상수 → UX 역할은 광고 전후 플로우에서 리텐션 방어
- 경쟁사: 머니워크(글로벌 111국, 걷기+식사+수면), 돈이돼지(1:1 현금출금, 터치 무제한)

## 아키텍처 핵심 3요소

### 1. Intent Router (2단계 감지)
유저 발화에서 의도를 파악하여 파이프라인을 결정한다.
- 1단계: 키워드 매칭 (0ms, 80% 커버) — `figma-plugin/src/ui/ui.ts` 내 `detectIntentByKeyword()`
- 2단계: Claude Haiku 호출 (500ms, 나머지 20%) — `app/api/intent/route.ts` + `detectIntentByHaiku()`

### 2. Context Stack
대화 상태를 슬롯으로 관리한다.
`frames → intent → subContext → persona → pipeline → results`
슬롯이 충분히 채워지면 파이프라인 자동 실행. 빈 슬롯이 있으면 라벨로 유저에게 질문.
- 위치: `figma-plugin/src/ui/ui.ts` 내 `contextStack` 변수

### 3. Pipeline Execution
`/api/chat` 엔드포인트에서 intent별 프롬프트를 조합하여 Claude API 호출.
9가지 intent (full-scan, analyze-axis, copy-rewrite, ab-variant, competitor-compare, suggestion, usability, visual, cta)
4축 분석 (ad-buffer, earning-motivation, retention-trigger, exchange-trust)
- 위치: `app/api/chat/route.ts`

## 기술 스택
```
프로젝트명:     Simulo
기술 스택:      Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL
패키지 매니저:  npm
런타임:         Node.js 20+
배포:           Vercel (앱) + Supabase (DB)
저장소:         https://github.com/mlender-ai/simulo
```

## 디렉토리 구조 (핵심)

```
figma-plugin/
├── src/plugin/code.ts         ← Plugin sandbox (프레임 감지, 이미지 캐시, adaptive scale)
├── src/ui/ui.ts               ← 대화 UI + Intent Router + Context Stack + 분석 호출
├── src/ui/index.html          ← 채팅 UI HTML/CSS
└── src/ui/i18n.ts             ← 다국어

app/
├── api/chat/route.ts          ← 대화형 분석 스트리밍 API (단일 진입점)
├── api/chat/sessions/route.ts ← 세션 DB 저장
├── api/intent/route.ts        ← Haiku 의도 감지 (free mode)
└── ...                        ← 웹 대시보드 페이지들

lib/
├── prompts/                   ← 프롬프트 빌더 (heuristic, ux-writing, competitor, simulation)
├── frameworks.ts              ← 4축 프레임워크 정의
├── figma.ts                   ← Figma REST API 연동
└── db.ts                      ← Prisma 클라이언트

prisma/schema.prisma           ← DB 스키마 (Analysis, ChatSession, Competitor 등)
```

## 파이프라인 (Intent → Model → max_tokens)

| Intent | 설명 | 모델 | max_tokens |
|--------|------|------|-----------|
| full-scan | 4축 전체 분석 | Sonnet | 2048 |
| analyze-axis | 단일 축 분석 | Sonnet | 2048 |
| ab-variant | A/B 변형 생성 | Sonnet | 1536 |
| suggestion | 개선안 생성 | Sonnet | 1024 |
| copy-rewrite | UX 카피 제안 | Haiku | 1024 |
| competitor-compare | 경쟁사 비교 | Haiku | 1024 |
| usability | 사용성 검증 | Haiku | 1024 |
| visual | 시각 분석 | Haiku | 1024 |
| cta | CTA 분석 | Haiku | 1024 |

## DB
- Prisma + PostgreSQL (Supabase). 스키마 변경 시 `npx prisma db push` 사용.
- `npx prisma migrate dev` 사용 금지. migrations 폴더 없음.
- `DATABASE_URL` = Supabase Transaction pooler (포트 6543, `?pgbouncer=true`)
- `DIRECT_URL` = Supabase Direct connection (포트 5432) — prisma db push 등에 사용

## 개발 명령어
```bash
npm run dev          # 개발 서버 (.next 캐시 자동 삭제)
npm run dev:quick    # 캐시 유지 빠른 시작 (변경 없을 때만)
npm run build        # 프로덕션 빌드
npm run lint         # 린트
npm run type-check   # 타입 체크
npx prisma db push   # DB 스키마 반영
npx prisma generate  # Prisma 클라이언트 생성
cd figma-plugin && npm run build  # 플러그인 빌드
```

## 디자인 톤앤매너
- 다크 테마 기본 (#0a0a0a, #111111)
- 모노스페이스 + 산세리프 혼용
- 캐릭터, 일러스트, 마케팅 요소 없음
- 애니메이션 최소화, subtle fade만
- 여백 충분히, 불필요한 UI 배제

## 자동화 에이전트 (Remote Trigger)
| 이름 | 스케줄 (KST) | 역할 |
|---|---|---|
| `simulo-daily-v2` | 매일 11:00 | 열린 이슈 1개 개발 + close |
| `simulo-issue-gen-debate` | 매일 08:30 | 멀티 에이전트 토론으로 이슈 생성 |
| `simulo-plugin-idea-daily` | 매일 09:23 | 플러그인 아이디어 1개 → `[플러그인 아이디어]` 라벨로 이슈 등록 |
| `simulo-agent-research` | 월/목 10:13 | GitHub에서 인기 에이전트/MCP/도구 탐색 → `[에이전트 리서치]` 라벨로 이슈 등록 |

## 슬래시 커맨드 (`.claude/commands/`)
- `/idea` — 제품 아이디어 생성 에이전트
- `/plugin-pm` — Figma 플러그인 전용 PM 에이전트 (북극성, 마일스톤, 로드맵)

## 개발 시 핵심 규칙
1. **프롬프트는 `app/api/chat/route.ts`의 `buildSystemPrompt()` 또는 `lib/prompts/` 하위에.** 코드 곳곳에 프롬프트 문자열을 흩뿌리지 마라.
2. **스트리밍 필수.** 대화형에서 "로딩 3초 → 한번에 표시"는 금지. 토큰별 SSE 스트리밍.
3. **라벨은 하드코딩으로 시작.** 후에 Claude가 suggestedLabels를 동적 생성하는 구조로 진화.
4. **Context Stack을 직접 조작하지 마라.** 항상 `handleFramesSelected`, `handleIntentLabel`, `applyIntentAndAnalyze` 등 전용 함수를 통해서.
