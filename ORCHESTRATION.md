# 멀티 에이전트 오케스트레이션 — 병렬 실행 & 워크플로우 설계

> 복잡한 작업을 여러 에이전트에 분배하여 병렬로 실행하는 시스템입니다.
> 단순 작업은 단일 에이전트가 더 효율적입니다.
> 반드시 병렬 처리가 명확한 이점을 줄 때만 사용하세요.

---

## 오케스트레이션이 필요한 시점

```
사용해야 할 때:
  - 독립적인 모듈을 동시에 개발할 때 (프론트/백엔드)
  - 여러 서비스를 동시에 검토해야 할 때
  - 코드 리뷰 + 보안 감사를 병렬로 실행할 때
  - 다중 파일 리팩토링 (각 파일이 독립적)

사용하지 말아야 할 때:
  - 순서가 중요한 작업 (A → B → C 의존성)
  - 단순한 단일 기능 구현
  - 컨텍스트를 공유해야 하는 작업
  - 토큰 비용이 더 중요한 상황
```

---

## 오케스트레이션 아키텍처

```
┌─────────────────────────────────────┐
│    오케스트레이터 (메인 Claude)         │
│    model: opus (깊은 계획 수립)        │
└──────────────┬──────────────────────┘
               │ 작업 분해
       ┌───────┼───────┐
       ▼       ▼       ▼
  [Agent A] [Agent B] [Agent C]
  model:    model:    model:
  sonnet    sonnet    haiku
  (구현)    (테스트)   (문서)
       │       │       │
       └───────┴───────┘
               │ 결과 통합
               ▼
    오케스트레이터 검토 및 통합
```

---

## 오케스트레이션 패턴

---

### Pattern 1: 풀스택 기능 개발

```
/multi-plan "사용자 인증 기능 구현"
```

**오케스트레이터 실행 프롬프트:**
```
당신은 멀티 에이전트 오케스트레이터입니다.
아래 기능을 병렬로 구현하기 위해 작업을 분배합니다.

기능: 사용자 인증 (이메일/비밀번호 + JWT)

병렬 작업 분배:

[Agent 1 - Backend]
담당: API 엔드포인트, 서비스 레이어, DB 모델
파일:
  - src/auth/auth.controller.ts
  - src/auth/auth.service.ts
  - src/users/users.service.ts
  - prisma/schema.prisma (User 모델)

[Agent 2 - Frontend]
담당: 로그인 폼, 상태 관리, API 통신
파일:
  - src/components/LoginForm.tsx
  - src/hooks/useAuth.ts
  - src/store/authStore.ts

[Agent 3 - Tests]
담당: 유닛 테스트 + E2E 테스트 시나리오
파일:
  - src/auth/__tests__/auth.service.test.ts
  - e2e/auth.spec.ts

제약사항:
- Agent 1 완료 후 Agent 2가 API 인터페이스를 참조할 것
- Agent 3는 Agent 1, 2 완료 후 실행
- 각 Agent는 자기 담당 파일만 수정

완료 후 오케스트레이터가 통합 검토 실행.
```

---

### Pattern 2: 코드 리뷰 병렬화

```
/multi-execute "PR #42 전체 리뷰"
```

**병렬 리뷰 프롬프트:**
```
PR #42의 변경 파일을 세 에이전트가 동시에 리뷰합니다.

[Agent 1 - code-reviewer]
담당: 코드 품질, 로직 정확성, 가독성
대상 파일: src/payment/*.ts
체크리스트:
  - 함수 복잡도
  - 중복 코드
  - 엣지 케이스 처리

[Agent 2 - security-reviewer]
담당: 보안 취약점
대상 파일: src/payment/*.ts, src/api/routes/*.ts
체크리스트:
  - 입력 검증
  - 인증/인가
  - SQL 인젝션
  - 민감 데이터 노출

[Agent 3 - database-reviewer]
담당: DB 쿼리 성능
대상 파일: src/payment/payment.service.ts
체크리스트:
  - N+1 쿼리
  - 트랜잭션 적절성
  - 인덱스 활용

각 에이전트의 리뷰 결과를 오케스트레이터가 통합하여
최종 리뷰 리포트 작성.
```

---

### Pattern 3: 대규모 리팩토링

```
/multi-execute "레거시 코드를 TypeScript strict mode로 마이그레이션"
```

**병렬 마이그레이션 프롬프트:**
```
대규모 마이그레이션을 모듈별로 병렬 처리합니다.
각 에이전트는 독립적인 모듈을 담당합니다.

사전 조건 (오케스트레이터):
1. 공통 타입 정의 파일 먼저 생성 (types/index.ts)
2. tsconfig.json strict: true 설정
3. 위 완료 후 병렬 실행 시작

병렬 실행:

[Agent 1]
담당 모듈: src/users/
작업: any 제거, 명시적 타입 추가, null 체크
완료 기준: tsc --noEmit 오류 0개

[Agent 2]
담당 모듈: src/products/
작업: (동일)

[Agent 3]
담당 모듈: src/orders/
작업: (동일)

각 에이전트 완료 조건:
  - tsc --noEmit 오류 0개
  - 기존 테스트 모두 통과
  - 새로운 any 타입 미사용

오케스트레이터 통합:
  - 전체 tsc 실행
  - 테스트 스위트 실행
  - 타입 커버리지 리포트
```

---

### Pattern 4: Git Worktree 병렬 개발

```bash
# 실제 병렬 실행을 위한 Git Worktree 설정
git worktree add ../project-frontend feat/user-auth-frontend
git worktree add ../project-backend feat/user-auth-backend
git worktree add ../project-tests feat/user-auth-tests

# 각 worktree에서 독립적으로 Claude Code 실행
cd ../project-backend && claude
cd ../project-frontend && claude
cd ../project-tests && claude
```

**Worktree 오케스트레이션 규칙:**
```
1. 각 worktree는 독립적인 브랜치에서 작업
2. 공유 인터페이스(API 타입)는 별도 파일로 먼저 정의
3. 모든 worktree 완료 후 develop 브랜치에 순서대로 머지
4. 머지 충돌은 오케스트레이터가 직접 해결

머지 순서:
  1. types 브랜치 (공통 타입)
  2. backend 브랜치
  3. frontend 브랜치 (backend API에 의존)
  4. tests 브랜치
```

---

### Pattern 5: 품질 게이트 파이프라인

```
/quality-gate
```

**순차적 품질 검증 파이프라인:**
```
Stage 1: Build (실패 시 즉시 중단)
───────────────────────────────
  npm run build
  결과: Pass → 다음 / Fail → build-error-resolver 호출

Stage 2: Test (병렬 실행)
───────────────────────────────
  [동시 실행]
  A: npm test --testPathPattern=unit
  B: npm test --testPathPattern=integration

  결과: 모두 Pass → 다음 / 실패 케이스 목록 → tdd-guide 호출

Stage 3: Quality (병렬 실행)
───────────────────────────────
  [동시 실행]
  A: npx tsc --noEmit (타입 체크)
  B: npm run lint (린트)
  C: npm run test:coverage (커버리지)

  결과: 모두 Pass → 다음 / 이슈 목록

Stage 4: Security (순차 실행)
───────────────────────────────
  npm audit --audit-level=high

  결과: CRITICAL 없음 → 통과 / CRITICAL 발견 → 배포 차단

최종 결과:
  DEPLOY READY: 모든 Stage 통과
  BLOCKED: 하나라도 실패
```

---

## PM2 멀티 서비스 관리

```bash
# 멀티 서비스 개발 환경 설정
/pm2
```

**pm2.config.js 자동 생성 템플릿:**
```javascript
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/api',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      }
    },
    {
      name: 'web-app',
      script: 'npm',
      args: 'run dev',
      cwd: './apps/web',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    },
    {
      name: 'worker',
      script: 'npm',
      args: 'run worker',
      cwd: './apps/worker',
      watch: false,
    }
  ]
};
```

```bash
# 전체 서비스 시작
pm2 start pm2.config.js

# 상태 확인
pm2 status

# 로그 확인
pm2 logs

# 재시작
pm2 restart all
```

---

## 하네스 감사 (Harness Audit)

```
/harness-audit
```

**감사 항목:**
```
[신뢰성 검사]
□ 훅 스크립트가 모두 실행 가능한가 (권한, 경로)
□ SessionStart/Stop 훅이 정상 작동하는가
□ 메모리 파일들이 정상 로드/저장되는가

[이벨 준비도]
□ 검증 루프가 구성되어 있는가
□ /checkpoint 명령이 상태를 올바르게 저장하는가
□ 커버리지 임계값이 설정되어 있는가

[리스크 평가]
□ 무한 루프 가능성이 있는 에이전트가 있는가
□ 과도한 MCP 서버 활성화로 컨텍스트 낭비가 있는가
□ 시크릿이 노출될 수 있는 훅이 있는가

[모델 라우팅 효율성]
□ 단순 작업에 opus를 사용하고 있지 않은가
□ 서브에이전트 모델이 haiku로 설정되어 있는가
□ 토큰 소비가 예산 범위 내인가
```

---

## 자율 루프 패턴 (Autonomous Loops)

```
/loop-start "버그 수정 루프"
```

**루프 설계 원칙:**
```
1. 종료 조건을 명확히 정의 (무한 루프 방지)
2. 최대 반복 횟수 설정 (기본: 10회)
3. 각 반복 후 /checkpoint로 상태 저장
4. 실패 시 자동 롤백 전략 정의

예시: 테스트 통과까지 반복하는 루프
──────────────────────────────────────
Loop Config:
  max_iterations: 10
  success_condition: "npm test exit code 0"
  failure_action: "rollback to last checkpoint"

Iteration 1:
  → 실패한 테스트 분석
  → 수정 시도
  → 테스트 실행
  → 실패 → 다음 반복

Iteration N:
  → 모든 테스트 통과 → 루프 종료
  → /checkpoint 저장
  → 결과 요약 출력
```

---

## 오케스트레이션 빠른 참조

```bash
# 멀티 에이전트 계획
/multi-plan "작업 설명"

# 멀티 에이전트 실행
/multi-execute

# 백엔드 집중 오케스트레이션
/multi-backend

# 프론트엔드 집중 오케스트레이션
/multi-frontend

# 전체 파이프라인
/multi-workflow

# 품질 게이트 (배포 전)
/quality-gate

# 하네스 상태 감사
/harness-audit

# 루프 시작
/loop-start "목표"

# 루프 상태 확인
/loop-status

# 모델 라우팅
/model-route  # 작업 복잡도에 따라 모델 자동 선택
```

---

## 비용 경고

```
멀티 에이전트 = 여러 컨텍스트 창 동시 사용

비용 계산 예시:
  단일 에이전트 (sonnet): 1x 비용
  3개 병렬 에이전트:       3x 비용
  opus 오케스트레이터 포함: 5-6x 비용

권장:
  - 오케스트레이터: opus (1회만 실행)
  - 서브 에이전트: sonnet
  - 문서/단순 작업: haiku

병렬화 이점이 비용 증가를 정당화할 때만 사용할 것.
```
