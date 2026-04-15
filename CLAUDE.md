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

## 디자인 톤앤매너
- 다크 테마 기본 (#0a0a0a, #111111)
- 모노스페이스 + 산세리프 혼용
- 캐릭터, 일러스트, 마케팅 요소 없음
- 애니메이션 최소화, subtle fade만
- 여백 충분히, 불필요한 UI 배제
