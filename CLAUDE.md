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

## 대규모 파일 변경 후 필수 절차
layout.tsx, globals.css, 또는 5개 이상 파일 동시 수정 시:
```bash
lsof -ti:3000 | xargs kill -9   # dev 서버 종료
rm -rf .next                      # 캐시 삭제
npm run build                     # 빌드 검증
npm run dev                       # 깨끗한 재시작
# 브라우저에서 Cmd+Shift+R (Hard Refresh)
```
이 순서를 지키지 않으면 .next 캐시 불일치로 CSS/JS 404 대량 발생.
참고: .claude/memory/errors.md

## 디자인 톤앤매너
- 다크 테마 기본 (#0a0a0a, #111111)
- 모노스페이스 + 산세리프 혼용
- 캐릭터, 일러스트, 마케팅 요소 없음
- 애니메이션 최소화, subtle fade만
- 여백 충분히, 불필요한 UI 배제
