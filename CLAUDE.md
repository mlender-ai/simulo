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

## 프로젝트 정보
```
프로젝트명:     Simulo
설명:           AI 기반 UX 테스팅 & 라이팅 검수 도구
기술 스택:      Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL
패키지 매니저:  npm
런타임:         Node.js 20+
배포:           Vercel (앱) + Supabase (DB)
저장소:         https://github.com/mlender-ai/simulo
```

### 주요 제품 구성
- **웹 (simulo.vercel.app)**: 분석 대시보드, 히스토리, UX 라이팅 체크리스트, Google Sheets 연동
- **Figma 플러그인 (`figma-plugin/`)**: UX 분석, 라이팅 체크, CSV/Simulo 내보내기, 자동 수정(프레임 복제)
- 두 제품이 같은 데이터를 공유하며 "분석 → 개선 → 재검증" 사이클 완성

### DB
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
