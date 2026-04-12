# Simulo — AI UX 테스팅 도구

야핏무브 팀을 위한 AI 기반 UX 분석 도구. 스크린샷을 업로드하고 가설을 입력하면 Claude가 타깃 유저처럼 행동하며 사용성을 평가합니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **이미지 분석** | 스크린샷 최대 8장 업로드 → 사용성 점수, Think Aloud, 이슈 리포트 |
| **플로우 분석** | 유저 여정 단계별 스크린샷 → 각 단계 이탈 위험도 분석 |
| **Figma 연동** | Figma 파일 URL + 토큰으로 프레임 직접 불러와 분석 |
| **경쟁 분석** | 자사 vs 경쟁사(최대 2개) 동일 가설로 비교, 차이점/우선순위 도출 |
| **Figma 플러그인** | Figma 내에서 직접 분석 실행 (별도 빌드) |
| **히스토리** | DB 또는 localStorage에 분석 결과 자동 저장 |
| **한/영 지원** | 설정에서 언어 전환 |

## 기술 스택

- **프레임워크**: Next.js 14 (App Router) + TypeScript
- **스타일**: Tailwind CSS (다크 테마)
- **AI**: Anthropic Claude SDK (Haiku 4.5 기본, Sonnet 4.5 정밀)
- **DB**: Prisma + PostgreSQL (선택, 없으면 localStorage)
- **배포**: Vercel (앱) + Railway (DB)
- **CI**: GitHub Actions (lint → type-check → build)

## 빠른 시작

### 1. 레포 클론 & 의존성 설치

```bash
git clone https://github.com/cocteau-ai/simulo.git
cd simulo
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local`을 열고 필요한 값을 입력합니다:

| 변수 | 필수 | 설명 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 선택* | Claude API 키. 앱 설정 페이지에서도 입력 가능 |
| `DATABASE_URL` | 선택 | PostgreSQL URL. 없으면 localStorage만 사용 |
| `ADMIN_PASSWORD` | 선택 | 관리자 비밀번호 |

> *API 키는 `.env.local`에 넣거나, 앱 UI의 설정 페이지에서 입력할 수 있습니다. 둘 다 없으면 분석 실행 불가.

### 3. DB 설정 (선택)

PostgreSQL을 사용하는 경우:

```bash
npx prisma generate
npx prisma db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속

## 프로젝트 구조

```
simulo/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 메인 분석 입력 페이지
│   ├── history/           # 분석 히스토리
│   ├── report/[id]/       # 리포트 상세
│   ├── settings/          # API 키, 모델, 언어 설정
│   ├── api/
│   │   ├── analyze/       # 분석 API (image/flow/figma/comparison)
│   │   ├── figma-validate/# Figma 토큰 + URL 검증
│   │   ├── history/       # DB 히스토리 조회
│   │   ├── report/        # DB 리포트 조회
│   │   └── health/        # 헬스체크
│   └── globals.css        # 다크 테마 CSS 변수
├── components/
│   ├── InputSection.tsx   # 입력 탭 (이미지/URL/Figma/플로우/비교)
│   ├── ReportTabs.tsx     # 일반 분석 리포트
│   ├── ComparisonReportTabs.tsx  # 경쟁 분석 리포트
│   ├── ComparisonScoreBar.tsx    # 비교 점수 바 차트
│   ├── OnboardingBanner.tsx      # 사용 가이드 배너
│   └── Tooltip.tsx        # 툴팁 컴포넌트
├── lib/
│   ├── claude.ts          # Claude API 호출 (일반/플로우/비교)
│   ├── storage.ts         # localStorage 저장 + 타입 정의
│   ├── i18n.ts            # 한/영 번역
│   └── db.ts              # Prisma 싱글톤
├── prisma/
│   └── schema.prisma      # DB 스키마
├── figma-plugin/          # Figma 플러그인 (별도 빌드)
│   ├── manifest.json
│   ├── webpack.config.js
│   └── src/
├── .github/
│   └── workflows/ci.yml   # GitHub Actions CI
├── .env.example           # 환경변수 템플릿
├── railway.json           # Railway 배포 설정
└── vercel.json            # Vercel 배포 설정
```

## 주요 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # ESLint 실행
npm run type-check   # TypeScript 타입 체크
npm run validate     # lint + type-check + build 한 번에

# DB (PostgreSQL 사용 시)
npx prisma generate  # Prisma 클라이언트 생성
npx prisma db push   # 스키마 동기화
npx prisma studio    # DB GUI

# Figma 플러그인 빌드
cd figma-plugin && npm install && npm run build
```

## 배포

### Vercel (앱)

1. GitHub 레포 연결
2. 환경변수 설정 (`ANTHROPIC_API_KEY`, `DATABASE_URL` 등)
3. 자동 배포

### Railway (DB)

1. PostgreSQL 인스턴스 생성
2. `DATABASE_URL`을 Vercel 환경변수에 추가

### Figma 플러그인

1. `cd figma-plugin && npm install && npm run build`
2. Figma → Plugins → Development → Import plugin from manifest
3. `figma-plugin/manifest.json` 선택

## Git 워크플로우

```bash
# 새 기능 개발
git checkout -b feature/기능명
# ... 작업 ...
git add -A
git commit -m "feat: 기능 설명"
git push -u origin feature/기능명
# GitHub에서 PR 생성

# 빠른 업데이트 (main 직접)
git add -A
git commit -m "fix: 수정 내용"
git push
```

### 커밋 메시지 컨벤션

```
feat: 새 기능 추가
fix: 버그 수정
refactor: 리팩토링
style: UI/스타일 변경
docs: 문서 수정
chore: 설정/빌드 변경
```

## 라이선스

Private — 야핏무브 팀 내부 사용
