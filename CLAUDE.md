# Simulo — AI UX Testing Tool

## 프로젝트 정보
```
프로젝트명:     Simulo
기술 스택:      Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL
패키지 매니저:  npm
주요 언어:      TypeScript
런타임:         Node.js 20+
배포 환경:      Vercel (앱) + Railway (DB)
```

## 개발 명령어
```bash
npm run dev          # 개발 서버
npm run build        # 빌드
npm run lint         # 린트
npx prisma migrate dev  # DB 마이그레이션
npx prisma generate     # Prisma 클라이언트 생성
```

## Dev 서버 실행
```bash
npm run dev        # 항상 .next 캐시 삭제 후 시작 (기본값)
npm run dev:quick  # 캐시 유지한 채 빠르게 시작 (변경 없을 때만)
```
`npm run dev`는 매번 `.next`를 삭제하므로 stale chunk 404 에러가 발생하지 않음.
코드 변경 후에는 반드시 `npm run dev`(또는 브라우저 Cmd+Shift+R).
QA 에이전트가 dev 스크립트에 캐시 정리가 포함되어 있는지 자동 검증함.

## 배포 전 필수 검증 (절대 스킵 금지)

코드 변경 후 `git push` 전에 아래를 **반드시** 순서대로 통과해야 한다.
pre-push hook이 자동 실행하지만, Claude가 코드를 수정할 때도 push 전에 수동 확인해야 한다.

```bash
# 1. 린트 + 타입 체크
npm run lint && npm run type-check

# 2. 프로덕션 빌드 (가장 중요 — 런타임 에러 감지)
npm run build

# 3. 빌드된 서버로 주요 페이지 헬스체크
PORT=3099 npx next start &
# 모든 페이지가 200 OK인지 확인: / /ux-writing /dashboard /history /settings
```

**절대 하지 말 것:**
- 린트/타입체크만 통과했다고 push하지 말 것 — 빌드 실패 가능
- `npm run build` 성공해도 실제 페이지가 500 나올 수 있음 — 헬스체크 필수
- `.next` 캐시 오염 시 `rm -rf .next node_modules/.cache` 후 재빌드

## 디자인 톤앤매너
- 다크 테마 기본 (#0a0a0a, #111111)
- 모노스페이스 + 산세리프 혼용
- 캐릭터, 일러스트, 마케팅 요소 없음
- 애니메이션 최소화, subtle fade만
- 여백 충분히, 불필요한 UI 배제
