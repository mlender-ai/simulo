# 스킬 워크플로우 정의 — 재사용 가능한 개발 패턴 모음

> 스킬은 에이전트가 특정 작업을 수행할 때 따르는 단계별 워크플로우입니다.
> `.claude/skills/[skill-name]/SKILL.md` 형태로 저장하여 활성화합니다.

---

## 스킬 파일 구조

```yaml
---
name: skill-name
description: 이 스킬이 언제 사용되는지 한 줄 설명
triggers:
  - "트리거 문장 1"
  - "트리거 문장 2"
tools: [Read, Write, Edit, Bash]
model: sonnet
---

# 스킬 내용
```

---

## 핵심 스킬 모음

---

### SKILL 1: TDD 워크플로우

```markdown
---
name: tdd-workflow
description: 테스트 주도 개발 사이클을 강제하는 워크플로우
triggers:
  - "테스트 작성"
  - "TDD로 구현"
  - "기능 개발"
tools: [Read, Write, Edit, Bash]
model: sonnet
---

# TDD Workflow

## Phase 1: RED (실패하는 테스트)

1. 구현할 기능의 인터페이스/타입을 먼저 정의한다
2. 아직 존재하지 않는 코드를 호출하는 테스트를 작성한다
3. 테스트를 실행하여 실패(RED)를 확인한다
4. 실패 메시지가 예상과 일치하는지 검증한다

```typescript
// 먼저 이것을 작성
describe('UserService', () => {
  it('should return user by id', async () => {
    const service = new UserService(mockDb);
    const user = await service.findById('user-123');
    expect(user).toMatchObject({ id: 'user-123', name: 'Test User' });
  });

  it('should return null for non-existent user', async () => {
    const service = new UserService(mockDb);
    const user = await service.findById('non-existent');
    expect(user).toBeNull();
  });
});
```

## Phase 2: GREEN (최소 구현)

5. 테스트를 통과하는 가장 단순한 코드를 작성한다
6. "올바른" 코드가 아닌 "통과하는" 코드를 작성한다
7. 테스트가 GREEN임을 확인한다

## Phase 3: REFACTOR (개선)

8. 중복 제거, 명명 개선, 구조 정리
9. 매 리팩토링 단계 후 테스트가 여전히 GREEN인지 확인
10. 커버리지 리포트 실행: 80% 미만이면 추가 케이스 작성

## 커버리지 확인
```bash
npm run test:coverage
# 또는
pytest --cov=src --cov-report=term-missing
# 또는
go test ./... -cover
```

커버리지 80% 미달 시 → 빠진 케이스 목록 출력 → 추가 테스트 작성
```

---

### SKILL 2: 보안 리뷰

```markdown
---
name: security-review
description: 프로덕션 배포 전 OWASP 기준 보안 체크리스트
triggers:
  - "보안 검토"
  - "배포 전 체크"
  - "security scan"
tools: [Read, Grep, Bash]
model: opus
---

# Security Review Checklist

## 1단계: 시크릿 스캔
```bash
# 코드베이스에서 하드코딩된 시크릿 탐지
grep -rn "sk-\|ghp_\|AKIA\|password\s*=\|secret\s*=" --include="*.ts" --include="*.py" --include="*.go" .
grep -rn "Bearer\s\|Authorization:\s" --include="*.ts" .
```

발견 시: 즉시 시크릿 무효화 → 환경 변수로 이동 → git history 정리

## 2단계: 인증/인가 검토
- [ ] 모든 API 엔드포인트에 인증 미들웨어 적용 여부
- [ ] RBAC/ABAC 권한 체크 로직 검토
- [ ] JWT 만료 시간 및 갱신 로직 확인
- [ ] 세션 고정 공격 방어 확인

## 3단계: 입력 검증 검토
```typescript
// 올바른 입력 검증
const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
});

// 잘못된 예 - 검증 없음
app.post('/users', async (req, res) => {
  await db.users.create({ data: req.body }); // 위험!
});
```

## 4단계: SQL 인젝션 검토
```typescript
// 안전: 파라미터 바인딩
await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// 위험: 문자열 연결
await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

## 5단계: 의존성 취약점 스캔
```bash
npm audit --audit-level=high
# 또는
pip-audit
# 또는
govulncheck ./...
```

## 결과 보고 형식
```
CRITICAL (즉시 배포 차단)
  - [파일:라인] 설명 및 수정 방법

HIGH (24시간 내 수정)
  - [파일:라인] 설명 및 수정 방법

MEDIUM (다음 스프린트)
  - 설명 및 권장 사항
```
```

---

### SKILL 3: 지속적 학습 (Continuous Learning)

```markdown
---
name: continuous-learning
description: 세션에서 발견한 패턴을 자동으로 스킬로 추출하여 저장한다
triggers:
  - "/learn"
  - "패턴 저장"
  - "이 방법을 기억해"
tools: [Read, Write, Bash]
model: sonnet
---

# Continuous Learning Workflow

## 패턴 추출 프로세스

세션 종료 전 또는 /learn 명령어 실행 시:

1. **이번 세션에서 해결한 문제 목록화**
   - 어떤 오류를 어떻게 해결했는가
   - 어떤 패턴을 반복적으로 사용했는가
   - 어떤 접근법이 실패하고 성공했는가

2. **패턴을 instinct 형식으로 저장**

```yaml
# ~/.claude/instincts/[date]-[name].md
---
title: "Prisma N+1 쿼리 방지 패턴"
confidence: 0.9
evidence: "이번 세션에서 3번 반복 발생"
tags: [prisma, performance, database]
---

## Action
Prisma에서 관계 데이터를 조회할 때 include를 사용하지 않으면
N+1 쿼리가 발생한다. 항상 include로 관계를 명시하거나
select로 필요한 필드만 가져온다.

## Evidence
user 목록 조회 후 각 user의 posts를 별도 쿼리로 가져오는 코드에서
100명의 user가 있을 때 101번의 쿼리 발생 확인.

## Pattern
- 잘못된 방법:
const users = await prisma.user.findMany();
const posts = await Promise.all(users.map(u => prisma.post.findMany({ where: { userId: u.id } })));

- 올바른 방법:
const users = await prisma.user.findMany({
  include: { posts: true }
});
```

3. **instinct → skill 승격 기준**
   - 같은 패턴이 3회 이상 등장 → /evolve 실행
   - 신뢰도 0.8 이상 → 자동 스킬 생성 후보

## 세션 요약 템플릿
```
## 세션 요약: [날짜]
작업: [무엇을 했는가]
해결한 문제: [어떤 오류/이슈를 해결했는가]
사용한 패턴: [어떤 방법이 효과적이었는가]
실패한 시도: [무엇이 작동하지 않았는가]
다음 세션 시작점: [어디서부터 재개할 것인가]
```
```

---

### SKILL 4: 전략적 컴팩션 (Strategic Compact)

```markdown
---
name: strategic-compact
description: 컨텍스트 창을 효율적으로 관리하여 세션 품질을 유지한다
triggers:
  - "컨텍스트 부족"
  - "compact 권장"
  - "컨텍스트 관리"
tools: [Read]
model: haiku
---

# Strategic Compact Guide

## /compact 실행 타이밍

### 실행해야 할 때
- 리서치/탐색 단계 완료 → 구현 시작 전
- 마일스톤(기능 1개) 완료 → 다음 기능 시작 전
- 디버깅 완료 → 기능 개발 재개 전
- 실패한 접근법 포기 → 새 접근법 시도 전
- 컨텍스트 사용량 50% 초과 시

### 실행하면 안 될 때
- 구현 중간 (변수명, 파일 경로, 부분 상태 손실 위험)
- 테스트 작성 중간
- 여러 파일을 동시에 편집 중

## 컴팩션 전 체크리스트
```
□ 현재 작업 상태를 MEMORY.md에 저장했는가
□ 중요한 파일 경로를 메모했는가
□ 다음 세션 시작점을 명확히 적었는가
□ 완료된 작업은 git commit 했는가
```

## 컨텍스트 절약 팁
1. MCP 서버는 필요한 것만 활성화 (10개 이하)
2. 대용량 파일은 필요한 섹션만 Read
3. /clear → 완전히 다른 주제로 전환 시
4. subagent 사용 시 결과만 받고 세부 과정은 위임
```

---

### SKILL 5: 검증 루프 (Verification Loop)

```markdown
---
name: verification-loop
description: 구현 완료 후 빌드-테스트-린트-타입체크-보안을 순서대로 검증한다
triggers:
  - "검증"
  - "배포 전 체크"
  - "모든 테스트 통과 확인"
tools: [Bash, Read]
model: sonnet
---

# Verification Loop

## 실행 순서 (반드시 이 순서로)

### Step 1: 빌드 검증
```bash
npm run build        # 또는 go build ./... 또는 python -m py_compile
```
빌드 실패 → build-error-resolver 에이전트 호출

### Step 2: 유닛 테스트
```bash
npm test             # 또는 pytest 또는 go test ./...
```
실패한 테스트 → 해당 코드 수정 → Step 1부터 재시작

### Step 3: 타입 체크
```bash
npx tsc --noEmit     # TypeScript
mypy src/            # Python
```
타입 오류 → any 사용 없이 올바른 타입으로 수정

### Step 4: 린트
```bash
npm run lint         # ESLint
ruff check .         # Python ruff
golangci-lint run    # Go
```

### Step 5: 커버리지 확인
```bash
npm run test:coverage
```
80% 미만 → 추가 테스트 작성

### Step 6: 보안 스캔
```bash
npm audit --audit-level=high
```

### 합격 기준
```
빌드 성공
모든 테스트 통과
타입 오류 0개
린트 오류 0개
커버리지 >= 80%
보안 CRITICAL 이슈 0개
```
모든 조건 통과 시에만 PR 생성/머지 진행
```

---

### SKILL 6: API 설계 패턴

```markdown
---
name: api-design
description: REST API 설계 원칙과 표준 응답 형식
triggers:
  - "API 설계"
  - "엔드포인트 생성"
  - "REST API"
tools: [Read, Write, Edit]
model: sonnet
---

# API Design Patterns

## URL 구조
```
GET    /api/v1/users          → 목록 조회
GET    /api/v1/users/:id      → 단건 조회
POST   /api/v1/users          → 생성
PATCH  /api/v1/users/:id      → 부분 수정
DELETE /api/v1/users/:id      → 삭제
```

## 표준 응답 형식
```typescript
// 성공 응답
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}

// 에러 응답
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with id '123' not found",
    "details": []
  }
}
```

## HTTP 상태코드 규칙
```
200 OK           → 성공적 조회/수정
201 Created      → 성공적 생성 (Location 헤더 포함)
204 No Content   → 성공적 삭제
400 Bad Request  → 유효성 검사 실패
401 Unauthorized → 인증 실패
403 Forbidden    → 권한 없음
404 Not Found    → 리소스 없음
409 Conflict     → 중복 리소스
422 Unprocessable Entity → 비즈니스 로직 실패
500 Internal Server Error → 서버 오류
```

## 페이지네이션
```typescript
// cursor 기반 (권장 - 대용량 데이터)
GET /api/v1/posts?cursor=eyJpZCI6MTB9&limit=20

// offset 기반 (소규모 데이터)
GET /api/v1/posts?page=2&limit=20
```
```

---

## 스킬 설치 방법

```bash
# 프로젝트 레벨 스킬
mkdir -p .claude/skills/[skill-name]
# 위 스킬 내용을 .claude/skills/[skill-name]/SKILL.md 에 저장

# 사용자 레벨 스킬 (모든 프로젝트에서 사용)
mkdir -p ~/.claude/skills/[skill-name]
cp SKILL.md ~/.claude/skills/[skill-name]/SKILL.md
```

---

## 스킬 생성 자동화

```bash
# git 히스토리에서 패턴 자동 추출하여 스킬 생성
/skill-create

# instinct를 스킬로 승격
/evolve
```
