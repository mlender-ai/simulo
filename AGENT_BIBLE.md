# Claude Code 에이전트 운영 바이블
# 출처: claudeguide-dv5ktqnq.manus.space (2026.02 최신판)

> 이 파일은 Claude Code를 단순 어시스턴트가 아닌
> **결정론적으로 제어 가능한 엔지니어링 시스템**으로 운영하기 위한
> 핵심 원칙과 실전 패턴을 담습니다.
> CLAUDE.md, AGENTS.md, orchestration.md와 함께 사용하세요.

---

## 2026 패러다임: 프롬프팅 → 거버넌스

```
옛 방식: 프롬프트 엔지니어링
  → 잘 쓴 프롬프트에 의존
  → LLM이 "따를 수도, 안 따를 수도"인 확률적 제어

새 방식: 거버넌스 엔지니어링
  → Hooks로 결정론적 강제
  → Agent Teams로 역할 분리
  → Context Engineering으로 환경 구조화
  → "Stop Prompting, Start Governing"
```

**핵심 불변 원칙 (도구가 5번 바뀌어도 변하지 않은 것):**
```
1. Clean context         → 컨텍스트를 항상 깨끗하게 유지
2. Explicit goals        → 목표를 명시적으로 선언
3. Plan before executing → 실행 전 반드시 계획
4. Read before editing   → 편집 전 반드시 읽기
5. Verify before trusting → 신뢰 전 반드시 검증
```

---

## 4단계 황금 워크플로우

모든 기능 개발에 이 사이클을 적용합니다.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. EXPLORE        2. PLAN         3. IMPLEMENT     │
│  ──────────        ──────          ────────────     │
│  현재 구조 파악    변경 계획 수립   Plan Mode 탈출   │
│  Shift+Tab×2       접근법 결정     실제 코드 작성   │
│  (Plan Mode 진입)  파일 목록 확인  테스트 포함      │
│                                                     │
│  4. COMMIT                                          │
│  ──────────                                         │
│  검증 후 커밋                                       │
│  PR 생성                                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Plan Mode 사용 기준
```
사용해야 할 때:
  - 접근법이 불확실할 때
  - 여러 파일을 동시에 수정할 때
  - 익숙하지 않은 코드를 수정할 때

불필요할 때:
  - 오타 수정 같은 명확한 소규모 작업
  - 로그 추가 등 단순 변경

2026 팁:
  계획 수립 후 /clear로 컨텍스트 초기화 →
  깨끗한 컨텍스트로 구현 시작 (성능 최적)
```

---

## 프롬프팅 핵심 법칙

### 법칙 1: 검증 수단을 반드시 제공한다
> "검증 수단 제공이 단일 최고 레버리지 행동" — Anthropic 공식

```
잘못된 예:
  "이메일 검증 함수 구현해줘"

올바른 예:
  "validateEmail 작성.
   테스트: valid@email.com=true, invalid=false.
   구현 후 테스트 실행해서 결과 보여줘."
```

### 법칙 2: 역할 + 컨텍스트 + 제약 + 검증 구조

```
"당신은 [역할]입니다.
 컨텍스트: [기술 스택, 기존 구조]
 요구사항: [무엇을 만들어야 하는가]
 제약조건: [반드시 지켜야 할 것]
 출력: [코드 + 테스트 + 문서]
 검증 기준: [성공 조건]"
```

### 법칙 3: 대형 기능은 인터뷰 기법 사용

```
"[기능 설명]을 만들고 싶어.
 자세히 인터뷰해줘.
 기술 구현 방식, UI/UX,
 엣지 케이스, 트레이드오프에 대해 질문해줘.
 모든 내용을 다룰 때까지 계속 인터뷰하고,
 완성된 스펙을 SPEC.md에 작성해줘."
```

### 법칙 4: 파이프로 컨텍스트 주입

```bash
cat error.log | claude "이 에러 원인 분석해줘"
npm run build 2>&1 | claude "빌드 실패 원인 수정해줘"
git diff | claude "이 변경사항 리뷰해줘"
```

### 법칙 5: @참조로 필요한 것만 지정

```
@src/auth/          # 디렉토리 전체
@package.json       # 특정 파일
@docs/api.md        # 문서
# 필요한 파일만 → 컨텍스트 낭비 방지
```

---

## 컨텍스트 관리 전략

### 컨텍스트 윈도우 상태

```
0────────────50%────────80%────100%
│   안전      │  주의   │  위험  │
│ 정상 작동   │ 모니터링│ 성능↓  │

전체: 200K 토큰
자동 컴팩션 트리거: ~80%
```

### 핵심 명령어

| 명령어 | 용도 | 사용 시점 |
|--------|------|-----------|
| `/clear` | 컨텍스트 완전 초기화 | 새 작업 전, 성능 저하 시 |
| `/compact [힌트]` | 지능형 압축 | 컨텍스트 절약하며 이어가기 |
| `/context` | 토큰 사용량 확인 | 현재 상태 점검 |
| `/rewind` | 체크포인트 복원 | 잘못된 방향 되돌리기 |
| `claude --continue` | 최근 세션 재개 | 중단된 작업 이어가기 |
| `claude --resume` | 세션 목록에서 선택 | 특정 세션 복귀 |

### Handoff 문서 패턴
컨텍스트 초기화 전 반드시 실행:
```
"지금까지 작업한 내용을 HANDOFF.md에 정리해줘.
 시도한 것, 성공한 것, 실패한 것,
 다음 세션이 이어받을 시작점을 포함해줘."
```

---

## Hooks 시스템 — 결정론적 제어

> CLAUDE.md 규칙은 확률적 (따를 수도, 안 따를 수도)
> **Hooks는 결정론적** (무조건 실행)

### 이벤트 종류

| 이벤트 | 트리거 | 활용 |
|--------|--------|------|
| `PreToolUse` | 도구 실행 전 | 보호 파일 차단, 위험 명령 필터 |
| `PostToolUse` | 도구 실행 후 | 자동 포맷, 린트 실행 |
| `Notification` | 입력 대기 시 | 완료 알림 전송 |
| `SessionStart` | 세션 시작/재개 | 컨텍스트 재주입 |
| `Stop` | 응답 완료 | 자동 커밋, 품질 체크 |
| `UserPromptSubmit` | 프롬프트 제출 | 전처리 |

### Exit Code 규칙

```
0 → 성공, 계속 진행
2 → 차단, 도구 실행 중단  ← 가장 중요
기타 → 경고 표시 후 계속
```

### 실전 Hook 레시피

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "bash .claude/hooks/protect-files.sh"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "npx prettier --write \"$TOOL_INPUT_FILE_PATH\" 2>/dev/null || true"
        }]
      }
    ],
    "Notification": [
      {
        "hooks": [{
          "type": "command",
          "command": "osascript -e 'display notification \"Claude 작업 완료\" with title \"Claude Code\"'"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "bash .claude/hooks/quality-check.sh"
        }]
      }
    ]
  }
}
```

```bash
# .claude/hooks/protect-files.sh
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
PROTECTED=("package-lock.json" ".env" ".env.production" "docker-compose.yml")
for p in "${PROTECTED[@]}"; do
  if [[ "$FILE" == *"$p"* ]]; then
    echo "BLOCKED: $FILE은 보호된 파일입니다"
    exit 2
  fi
done
exit 0
```

```bash
# .claude/hooks/quality-check.sh
#!/bin/bash
echo "품질 체크 실행 중..."
npm run typecheck 2>/dev/null && echo "타입 체크 통과" || echo "타입 오류 발견"
exit 0
```

---

## 서브에이전트 설계 원칙

### 모델 선택 기준

| 작업 유형 | 권장 모델 | 이유 |
|-----------|-----------|------|
| 코드베이스 탐색, 파일 읽기 | haiku | 빠르고 저렴, 탐색만 필요 |
| 일반 구현, 테스트 작성 | sonnet | 균형잡힌 성능/비용 |
| 아키텍처, 보안 리뷰, 복잡한 디버깅 | opus | 최고 추론 능력 |

### 에이전트 파일 구조

```markdown
---
name: [에이전트명]
description: [언제 이 에이전트를 사용하는가 — 명확하게]
tools: [Read, Grep, Glob, Bash, Edit, Write 중 필요한 것만]
model: [haiku|sonnet|opus]
isolation: worktree   # 독립 브랜치에서 실행 (선택)
memory: project       # 세션 간 기억 유지 (선택)
background: true      # 항상 백그라운드 실행 (선택)
---

[에이전트 페르소나와 역할 정의]

[구체적 책임 목록]

[출력 형식 명시]

[절대 하지 말아야 할 것]
```

### Writer/Reviewer 패턴

```
Session A (구현): 코드 작성
       ↓
Session B (리뷰): 즉시 리뷰 실행
       ↓
Session A (수정): 리뷰 결과 반영

→ 인간 코드 리뷰 대기 시간 제거
→ 메인 컨텍스트 보호
```

### 병렬 개발 패턴

```bash
# 독립 기능을 워크트리에서 동시 개발
claude --worktree feature-auth  &
claude --worktree feature-db    &
claude --worktree feature-ui    &
# 각각 독립 브랜치 → 충돌 없음 → PR로 병합
```

---

## Agent Teams (2026)

기본은 비활성화. 아래 설정으로 활성화:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process"
}
```

### 서브에이전트 vs Agent Teams

| 항목 | 서브에이전트 | Agent Teams |
|------|-------------|-------------|
| 소통 방식 | 메인에게만 보고 | 팀원 간 직접 소통 |
| 컨텍스트 | 메인 세션 내부 | 각자 독립 윈도우 |
| 조율 | 메인이 제어 | 공유 태스크 리스트 |
| 토큰 비용 | 적음 | 많음 (병렬) |

### 사용할 상황

```
Agent Teams:
  - 여러 측면 동시 리서치
  - 독립 모듈 병렬 개발
  - 경쟁 가설 병렬 디버깅
  - 프론트/백엔드/테스트 각각 담당

단일 세션이 나은 경우:
  - 같은 파일 편집
  - 순차적 작업
  - 의존성이 많은 작업
```

### 팀 제어 단축키

```
Shift+Down  → 팀원 간 순환
Enter       → 팀원 세션 보기
Escape      → 현재 턴 중단
Ctrl+T      → 공유 태스크 리스트 토글
```

### 팀 생성 프롬프트 패턴

```
"Create an agent team to explore this from different angles:
 - teammate 1: UX와 사용자 경험 관점
 - teammate 2: 기술 아키텍처 관점
 - teammate 3: 보안과 리스크 관점 (devil's advocate)
 결과를 TEAM_REPORT.md에 통합해줘."
```

---

## 보안 필수 체크리스트

Claude Code 설정 전 반드시 확인:

```
[권한 최소화]
□ 에이전트 tools: 필요한 것만 (Read-only 가능하면 Read-only)
□ Bash 도구는 정말 필요한 에이전트에만 부여
□ network: "none" 가능하면 적용

[보호 파일 설정]
□ .env, .env.* 절대 편집 불가 hook 설정
□ package-lock.json, yarn.lock 보호
□ docker-compose.yml, k8s/*.yml 보호
□ 프로덕션 DB 연결 설정 파일 보호

[시크릿 관리]
□ CLAUDE.md에 API 키 절대 포함 금지
□ .gitignore에 CLAUDE.local.md 추가
□ 환경 변수는 .env.example로 구조만 공유

[감사 로그]
□ ConfigChange hook으로 설정 변경 기록
□ PreToolUse hook으로 Bash 명령 로깅
□ 위험 명령 패턴 차단 (rm -rf, DROP TABLE 등)
```

```bash
# .claude/hooks/security-log.sh
# PreToolUse — Bash 명령 실행 전 로깅
#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

DANGEROUS=("rm -rf /" "DROP TABLE" "DELETE FROM" "format c:" "mkfs")
for pattern in "${DANGEROUS[@]}"; do
  if echo "$CMD" | grep -qi "$pattern"; then
    echo "BLOCKED: 위험 명령 차단됨: $CMD" >&2
    exit 2
  fi
done

echo "$(date '+%Y-%m-%d %H:%M:%S') [$TOOL] $CMD" >> .claude/audit.log
exit 0
```

---

## 비용 최적화 원칙

```
[모델 라우팅]
탐색/리딩 작업   → haiku   (5-10x 저렴)
일반 구현        → sonnet  (기본값)
복잡한 추론      → opus    (필요할 때만)

[컨텍스트 절약]
- /clear 적극 사용 (작업 간 초기화)
- 필요한 @파일만 참조
- Agent Teams는 토큰 많이 소비 → 신중하게

[세션 전략]
- 복잡한 계획 → /clear → 깨끗한 컨텍스트로 구현
- 80% 이전에 /compact 실행
- MCP 서버는 필요한 것만 활성화 (10개 이하)
```

---

## 에이전트 설계 7대 원칙

```
1. 최소 권한     → tools: 필요한 것만 부여
2. 단일 책임     → 에이전트당 하나의 명확한 역할
3. 검증 내장     → 모든 에이전트는 성공 기준 포함
4. 결과 보고     → 완료 후 반드시 요약 출력
5. 실패 명시     → 불확실하면 추측 말고 중단 후 보고
6. 컨텍스트 보호  → 서브에이전트로 메인 컨텍스트 분리
7. 결정론적 강제  → 중요 규칙은 Hooks로 강제 (CLAUDE.md 의존 금지)
```

---

## 파일 시스템 구조 (권장)

```
프로젝트/
├── CLAUDE.md              ← 팀 공유 (git 추적)
├── CLAUDE.local.md        ← 개인 설정 (.gitignore)
├── AGENTS.md              ← 에이전트 위임 규칙
├── AGENT_BIBLE.md         ← 이 파일 (운영 원칙)
├── MEMORY.md              ← 세션 메모리
├── ORCHESTRATION.md       ← 멀티 에이전트 패턴
├── GSTACK.md              ← 인지 모드 전환
│
├── .claude/
│   ├── settings.json      ← Hooks 설정
│   ├── agents/            ← 서브에이전트 정의
│   │   ├── planner.md
│   │   ├── reviewer.md
│   │   └── security.md
│   ├── hooks/             ← Hook 스크립트
│   │   ├── protect-files.sh
│   │   ├── security-log.sh
│   │   └── quality-check.sh
│   ├── skills/            ← 스킬 워크플로우
│   └── memory/            ← 세션 상태 저장
│
└── HANDOFF.md             ← 세션 인계 (자동 생성)
```

---

## 자주 쓰는 프롬프트 템플릿

### 새 기능 시작

```
"[기능명]을 구현하려 해.
 1. 먼저 관련 파일들을 읽고 현재 구조를 파악해줘 (@src/관련디렉토리)
 2. 구현 계획을 단계별로 작성해줘
 3. 내가 계획을 검토한 후에 구현 시작해줘
 검증 기준: [성공 조건]"
```

### 버그 수정

```
"빌드 실패 에러:
 [에러 메시지 붙여넣기]

 1. 에러 로그를 분석하고 근본 원인을 찾아줘
 2. 증상 억제 말고 근본 원인을 수정해줘
 3. 수정 후 빌드 재실행해서 성공 확인해줘"
```

### 코드 리뷰 요청

```
"이 PR/브랜치의 변경사항을 집착형 시니어 엔지니어처럼 리뷰해줘.
 git diff main을 읽고:
 - 경쟁 조건, N+1 쿼리, 보안 취약점
 - CI는 통과하지만 프로덕션에서 터질 수 있는 버그
 발견사항을 CRITICAL / HIGH / MEDIUM으로 분류해줘"
```

### 세션 종료 전 인계

```
"작업을 마무리하기 전에 HANDOFF.md를 작성해줘:
 - 오늘 완료한 작업
 - 시도했지만 실패한 접근법
 - 다음 세션 시작점
 - 주의해야 할 사항"
```

---

*출처: claudeguide-dv5ktqnq.manus.space — Claude Code 마스터 가이드 2026.02*
*함께 사용: CLAUDE.md + AGENTS.md + SKILLS.md + MEMORY.md + ORCHESTRATION.md + GSTACK.md*
