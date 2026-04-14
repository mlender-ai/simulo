# 세션 메모리 & 컨텍스트 지속성 시스템

> Claude Code는 세션 간 메모리가 없습니다.
> 이 파일 시스템을 통해 작업 상태, 학습한 패턴, 결정 이유를 세션 간에 유지합니다.
> hooks/hooks.json의 SessionStart/Stop 훅이 이 파일들을 자동으로 로드/저장합니다.

---

## 메모리 파일 구조

```
.claude/
├── memory/
│   ├── session-state.md      ← 현재 작업 상태 (세션마다 갱신)
│   ├── decisions.md          ← 아키텍처 결정 이유 (누적)
│   ├── patterns.md           ← 발견한 패턴과 규칙 (누적)
│   ├── errors.md             ← 반복되는 오류와 해결법 (누적)
│   └── instincts/            ← 학습된 instinct 파일들
│       ├── 2026-03-[name].md
│       └── ...
└── skills/                   ← 승격된 스킬
```

---

## 세션 상태 템플릿 (session-state.md)

> 매 세션 종료 시 이 형식으로 업데이트합니다.
> 세션 시작 시 자동으로 로드됩니다.

```markdown
# Session State
Last Updated: 2026-03-20 14:30

## 현재 진행 중인 작업
- 기능명: [예: 사용자 인증 OAuth2 연동]
- 브랜치: feat/oauth2-login
- 상태: [In Progress | Blocked | Review Needed | Done]

## 마지막 작업 위치
- 파일: src/auth/oauth.service.ts
- 라인: 145
- 컨텍스트: GoogleStrategy 구현 완료, callback URL 처리 중

## 완료된 항목
- [x] OAuth2 패키지 설치 (passport, passport-google-oauth20)
- [x] Google Console에서 클라이언트 ID/Secret 발급
- [x] AuthModule에 GoogleStrategy 등록
- [ ] callback 엔드포인트 구현
- [ ] JWT 토큰 발급 로직 연결
- [ ] 테스트 작성

## 다음 세션 시작점
callback 엔드포인트(`/auth/google/callback`)에서 받은 profile 정보로
기존 User를 찾거나 새 User를 생성하는 로직 구현 필요.
관련 파일: src/users/users.service.ts의 findOrCreate 메서드 참고.

## 알려진 이슈
- 로컬 환경에서 HTTPS 필요 → ngrok 사용 중 (포트: 3000)
- GOOGLE_CALLBACK_URL이 .env.local에만 있고 .env.example 미반영

## 환경 정보
- Node.js: 20.11.0
- 패키지 매니저: pnpm
- 활성 MCP: github, supabase
```

---

## 아키텍처 결정 기록 (decisions.md)

> Architecture Decision Records (ADR) - 왜 이렇게 결정했는지 기록합니다.

```markdown
# Architecture Decision Records

---

## ADR-001: 상태 관리 라이브러리 선택
Date: 2026-03-15
Status: Accepted

### 결정
Zustand 사용 (Redux, Jotai 대신)

### 이유
- 보일러플레이트 코드 최소화 (Redux는 너무 장황함)
- TypeScript 지원 우수
- 프로젝트 규모에 적합 (소-중규모)
- 팀 학습 곡선 낮음

### 트레이드오프
- DevTools 기능이 Redux보다 제한적
- 매우 복잡한 상태 로직에는 Redux가 더 적합할 수 있음

---

## ADR-002: API 통신 레이어
Date: 2026-03-16
Status: Accepted

### 결정
TanStack Query (React Query) + axios 사용

### 이유
- 캐싱, 로딩/에러 상태 자동 관리
- Optimistic updates 지원
- 서버 상태와 클라이언트 상태 명확히 분리

### 대안으로 검토한 것
- SWR: 기능이 TanStack Query보다 제한적
- 직접 fetch: 캐싱/재시도 로직 직접 구현 필요

---

## ADR-003: 데이터베이스 ORM
Date: 2026-03-17
Status: Accepted

### 결정
Prisma 사용

### 이유
- 타입 안전한 쿼리 빌더
- 마이그레이션 관리 내장
- Supabase와 호환성 우수
- 자동 생성 타입으로 런타임 오류 감소
```

---

## 학습한 패턴 (patterns.md)

> 이 프로젝트에서 발견한 효과적인 패턴들을 기록합니다.

```markdown
# Learned Patterns

---

## Pattern: Supabase RLS + Prisma 통합
Confidence: 0.95
Discovered: 2026-03-18

### 문제
Supabase RLS(Row Level Security) 정책이 Prisma를 통해 쿼리할 때
service_role 키를 사용하면 RLS가 bypass 됨.

### 해결책
```typescript
// 올바른 방법: user JWT로 클라이언트 생성
const supabase = createClient(url, process.env.SUPABASE_ANON_KEY!, {
  global: {
    headers: { Authorization: `Bearer ${userJwt}` }
  }
});

// Prisma는 서버사이드 작업에만 (service_role 사용)
// Supabase client는 RLS가 필요한 작업에 사용
```

---

## Pattern: Next.js Server Action 에러 처리
Confidence: 0.9
Discovered: 2026-03-19

### 문제
Server Action에서 throw한 에러가 클라이언트에서 제대로 캐치 안 됨.

### 해결책
```typescript
// 올바른 방법: Result 타입 반환
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createUser(formData: FormData): Promise<ActionResult<User>> {
  try {
    const user = await db.users.create({ ... });
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: '사용자 생성에 실패했습니다' };
  }
}
```

---

## Pattern: Prisma N+1 방지
Confidence: 0.98
Discovered: 2026-03-15

### 문제
findMany 후 각 아이템의 관계 데이터를 개별 쿼리로 가져오면
N+1 쿼리 발생.

### 해결책
```typescript
// N+1 문제
const posts = await prisma.post.findMany();
const postsWithAuthor = await Promise.all(
  posts.map(post => prisma.user.findUnique({ where: { id: post.authorId } }))
);

// include로 한 번에
const posts = await prisma.post.findMany({
  include: { author: { select: { id: true, name: true } } }
});
```
```

---

## 오류 해결 기록 (errors.md)

> 반복적으로 만나는 오류와 해결법을 기록합니다.

```markdown
# Error Solutions

---

## Error: "Cannot find module '@/components/...'"
Frequency: 자주 발생
Last Seen: 2026-03-20

### 원인
tsconfig.json의 paths 설정이 jest.config.ts의 moduleNameMapper와 불일치.

### 해결법
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}

// jest.config.ts
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

---

## Error: Supabase "JWT expired"
Frequency: 가끔
Last Seen: 2026-03-18

### 원인
access_token 만료 후 자동 갱신이 안 되는 경우.

### 해결법
```typescript
// supabase client 초기화 시 autoRefreshToken 활성화
const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  }
});
```

---

## Error: "ECONNREFUSED" in tests
Frequency: 종종
Last Seen: 2026-03-17

### 원인
통합 테스트에서 실제 DB에 연결 시도.

### 해결법
```typescript
// jest.setup.ts - DB 모킹
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    }
  }
}));
```
```

---

## 훅 설정 (자동 메모리 관리)

`hooks/hooks.json`에 아래를 추가하면 세션 시작/종료 시 자동으로 메모리를 관리합니다:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "node scripts/hooks/session-start.js"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node scripts/hooks/session-end.js"
        }]
      }
    ]
  }
}
```

### session-start.js (컨텍스트 자동 로드)
```javascript
// scripts/hooks/session-start.js
const fs = require('fs');
const path = require('path');

const memoryDir = path.join(process.cwd(), '.claude', 'memory');

// session-state.md 로드
const statePath = path.join(memoryDir, 'session-state.md');
if (fs.existsSync(statePath)) {
  const state = fs.readFileSync(statePath, 'utf-8');
  console.error(`[Memory] 이전 세션 상태 로드됨:\n${state.split('\n').slice(0, 10).join('\n')}...`);
}

// 최근 patterns.md 로드
const patternsPath = path.join(memoryDir, 'patterns.md');
if (fs.existsSync(patternsPath)) {
  console.error(`[Memory] ${fs.readdirSync(path.join(memoryDir, 'instincts') || []).length}개의 학습된 패턴 로드됨`);
}
```

### session-end.js (상태 자동 저장)
```javascript
// scripts/hooks/session-end.js
const fs = require('fs');
const path = require('path');

const memoryDir = path.join(process.cwd(), '.claude', 'memory');
fs.mkdirSync(memoryDir, { recursive: true });

const timestamp = new Date().toISOString();
const summary = process.env.CLAUDE_SESSION_SUMMARY || '세션 요약 없음';

const statePath = path.join(memoryDir, 'session-state.md');
const existing = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf-8') : '';

fs.appendFileSync(
  path.join(memoryDir, 'session-history.log'),
  `\n## ${timestamp}\n${summary}\n`
);

console.error(`[Memory] 세션 상태 저장됨: ${statePath}`);
```

---

## 메모리 관리 명령어

```bash
# 현재 세션 패턴 추출
/learn

# 학습된 instinct 확인
/instinct-status

# instinct를 스킬로 승격
/evolve

# 이전 세션들 확인
/sessions
```
