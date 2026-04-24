# Simulo — 매일 자동 이슈 개발 에이전트 설정 가이드

> Claude Code Remote Trigger를 사용해 매일 아침 9시(KST) GitHub 이슈를 자동으로 개발하고 close하는 에이전트 설정 방법입니다.

---

## 개요

```
흐름:
  매일 KST 09:00
    → Remote Agent 실행 (Anthropic Cloud)
    → mlender-ai/simulo 레포 체크아웃
    → 열린 GitHub 이슈 중 우선순위 1개 선택
    → 코드 구현 (TypeScript 컴파일 검증)
    → 이슈 close + 코멘트 작성
```

---

## 사전 준비

### 필요한 것
- Claude.ai 계정 (claude.ai/code 접근 가능)
- GitHub Personal Access Token (repo + issues 권한)
- mlender-ai/simulo 레포 접근 권한

---

## Step 1 — GitHub MCP 커넥터 연결

### 1-1. 커넥터 페이지 접속

[claude.ai/settings/connectors](https://claude.ai/settings/connectors) 접속

### 1-2. GitHub 커넥터 추가

1. "Add connector" → GitHub 선택
2. GitHub OAuth 로그인 및 권한 승인
3. 연결 완료 후 커넥터 목록에서 **UUID 복사**

### 1-3. UUID 확인 방법

커넥터 목록에서 GitHub 커넥터를 클릭하면 URL이 아래처럼 바뀝니다:

```
https://claude.ai/settings/connectors/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

이 URL의 마지막 부분이 **connector UUID**입니다.

또는 curl로 직접 조회:

```bash
# claude.ai 세션 쿠키가 있는 경우
curl -s https://claude.ai/api/mcp_connectors \
  -H "Cookie: YOUR_SESSION_COOKIE" | python3 -m json.tool
```

---

## Step 2 — Remote Trigger 생성

Claude Code CLI가 설치된 환경에서 아래 명령을 실행합니다.

### 2-1. Trigger 생성 (처음 설정하는 경우)

```bash
# Claude Code CLI로 새 트리거 생성
claude -p "
아래 설정으로 Remote Trigger를 생성해줘:

- 이름: simulo-daily-issue-dev
- 스케줄: 매일 KST 09:00 (UTC 00:00, cron: 0 0 * * *)
- 레포: https://github.com/mlender-ai/simulo
- GitHub MCP 커넥터 UUID: [여기에 Step 1에서 복사한 UUID 입력]
- 프롬프트: SCHEDULE.md의 '에이전트 프롬프트' 섹션 참고
"
```

### 2-2. 기존 Trigger에 커넥터 연결 (이미 Trigger가 있는 경우)

현재 설정된 Trigger ID: `trig_01BBrJHW6h9ZKRS432KS9uCa`

```bash
# Claude Code CLI
claude -p "
trigger ID 'trig_01BBrJHW6h9ZKRS432KS9uCa'에
GitHub MCP 커넥터 UUID '[여기에 UUID 입력]'를 mcp_connections에 추가해줘.

connector URL은 https://mcp.github.com (또는 커넥터 설정에 표시된 URL).
RemoteTrigger update action을 써줘.
"
```

또는 직접 API 호출:

```bash
# 환경변수 설정
export CLAUDE_API_KEY="your_claude_api_key"
export CONNECTOR_UUID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export CONNECTOR_URL="https://mcp.github.com"  # 커넥터 설정에서 확인

curl -s -X POST \
  -H "Authorization: Bearer $CLAUDE_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.claude.ai/v1/code/triggers/trig_01BBrJHW6h9ZKRS432KS9uCa \
  -d "{
    \"mcp_connections\": [{
      \"connector_uuid\": \"$CONNECTOR_UUID\",
      \"name\": \"github\",
      \"url\": \"$CONNECTOR_URL\"
    }]
  }"
```

---

## Step 3 — Trigger 관리

### Trigger 목록 확인

[claude.ai/code/scheduled](https://claude.ai/code/scheduled) 에서 UI로 확인 가능

또는 CLI:

```bash
claude -p "RemoteTrigger list action으로 현재 등록된 trigger 목록 보여줘"
```

### 지금 바로 실행 (테스트)

```bash
claude -p "trigger ID 'trig_01BBrJHW6h9ZKRS432KS9uCa' 지금 바로 실행해줘. RemoteTrigger run action 사용."
```

또는 UI에서: [claude.ai/code/scheduled/trig_01BBrJHW6h9ZKRS432KS9uCa](https://claude.ai/code/scheduled/trig_01BBrJHW6h9ZKRS432KS9uCa) → "Run now"

### Trigger 일시 중지

```bash
claude -p "trigger 'trig_01BBrJHW6h9ZKRS432KS9uCa' enabled: false로 업데이트해줘"
```

### Trigger 삭제

UI에서만 가능: [claude.ai/code/scheduled](https://claude.ai/code/scheduled)

---

## Step 4 — GITHUB_TOKEN 설정 (MCP 커넥터 미사용 시 대안)

GitHub MCP 커넥터 대신 Personal Access Token을 환경변수로 사용할 경우:

1. [github.com/settings/tokens](https://github.com/settings/tokens) → "Generate new token (classic)"
2. 권한 선택: `repo` (전체), `issues` (읽기/쓰기)
3. 생성된 토큰을 Remote Trigger 환경에 주입

> 현재 Remote Trigger는 환경변수 직접 주입을 UI에서 지원하지 않습니다.
> GitHub MCP 커넥터 연결을 권장합니다.

---

## 에이전트 프롬프트 (현재 설정)

아래가 매일 실행되는 에이전트의 전체 프롬프트입니다.
Trigger를 재생성할 때 이 내용을 사용하세요.

```
You are a daily development agent for the mlender-ai/simulo project
(Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL).

## Your job (run once per day)

1. **Fetch open issues** from GitHub:
   - If GitHub MCP tools are available, use them directly
   - Otherwise: curl -s -H "Authorization: token $GITHUB_TOKEN"
     -H "Accept: application/vnd.github+json"
     https://api.github.com/repos/mlender-ai/simulo/issues?state=open&per_page=20

2. **Pick one issue** to work on:
   - Priority order: bug > feature > idea label
   - Among equals: pick the oldest (lowest issue number)
   - Skip issues labelled `skip` or `wontfix`

3. **Read the issue** carefully.
   Follow sub-tasks or recommended implementation order if present.

4. **Implement the changes** in the cloned repo:
   - Stack: Next.js 14 App Router, TypeScript, Tailwind CSS
   - DB: Prisma with `prisma db push` (no migrations folder)
   - Design: dark theme (#0a0a0a / #111111), no illustrations or emoji
   - Verify: npx tsc --noEmit must pass before finishing

5. **Close the issue** after successful implementation:
   - If GitHub MCP tools available: use close_issue tool
   - Otherwise: curl -X PATCH
     -H "Authorization: token $GITHUB_TOKEN"
     https://api.github.com/repos/mlender-ai/simulo/issues/NUMBER
     -d '{"state":"closed","state_reason":"completed"}'

6. **Add a comment** summarising what was implemented.

7. **Commit changes**:
   git commit -m 'feat/fix: [description] (closes #NUMBER)'

## Rules
- Work on exactly ONE issue per run
- Stop with a clear error if GitHub auth fails
- TypeScript must compile cleanly before marking done
```

---

## 트러블슈팅

### 이슈 close가 안 될 때

```
원인 1: GitHub 인증 실패
  → GitHub MCP 커넥터가 Trigger에 연결됐는지 확인
  → claude.ai/code/scheduled/trig_01BBrJHW6h9ZKRS432KS9uCa 에서 MCP Connections 확인

원인 2: 레포 권한 없음
  → GitHub 커넥터 연결 시 mlender-ai/simulo 레포 접근 권한 승인 여부 확인
```

### TypeScript 오류로 에이전트가 중단될 때

```
에이전트는 npx tsc --noEmit 통과 전까지 이슈를 close하지 않습니다.
이슈가 너무 복잡해 에이전트가 완수하지 못한 경우:
  → 이슈에 sub-task를 명확히 작성
  → 또는 이슈에 `skip` 라벨 추가 (이번 실행 건너뜀)
```

### Trigger 실행 이력 확인

[claude.ai/code/scheduled/trig_01BBrJHW6h9ZKRS432KS9uCa](https://claude.ai/code/scheduled/trig_01BBrJHW6h9ZKRS432KS9uCa) 에서 실행 로그 확인 가능

---

## 현재 Trigger 정보

| 항목 | 값 |
|------|-----|
| Trigger ID | `trig_01BBrJHW6h9ZKRS432KS9uCa` |
| 이름 | simulo-daily-issue-dev |
| 스케줄 | 매일 KST 09:00 (UTC 00:00) |
| 레포 | https://github.com/mlender-ai/simulo |
| 모델 | claude-sonnet-4-6 |
| 환경 | Default (env_016DjvCoGgZS815hAcWn6wcA) |
| 관리 UI | https://claude.ai/code/scheduled/trig_01BBrJHW6h9ZKRS432KS9uCa |
