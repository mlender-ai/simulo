# AI Handoff 운영 가이드

이 디렉토리는 레포를 어디서 열든 바로 개발을 이어갈 수 있도록 만드는 운영용 문서 모음입니다.

## 목적
- QA, PO, PM, CTO 역할의 에이전트가 24시간 순환 점검 가능하도록 기준 제공
- GitHub Actions에서 LLM API를 호출해 역할별 점검 리포트를 Markdown으로 생성
- 새 환경, 새 세션, 새 개발자, 새 에이전트가 와도 같은 방식으로 이어서 작업 가능

## 구성
- `AGENTS_HANDOFF.md` : 역할 정의, 입력/출력 규격, 핸드오프 포맷
- `CONVENTIONS.md` : 개발/문서/브랜치/이슈/PR/릴리즈 컨벤션
- `MASTER_PROMPTS.md` : 한 번에 넣는 마스터 프롬프트와 분할 순서
- `.github/prompts/*.md` : 역할별 실행 프롬프트
- `.github/workflows/agent-orchestrator.yml` : GitHub Actions 기반 실행 워크플로우

## 가장 빠른 사용 순서
1. `CONVENTIONS.md`를 먼저 읽어 작업 규칙을 맞춘다.
2. `AGENTS_HANDOFF.md`에서 현재 상태를 최신으로 갱신한다.
3. 새 세션에서 작업을 이어야 하면 `MASTER_PROMPTS.md`의 0번~N번 순서로 붙여 넣는다.
4. GitHub Actions를 쓰려면 레포 Secrets에 아래 값을 넣는다.

## 필요한 GitHub Secrets
- `AI_API_URL` : OpenAI 호환 Chat Completions 엔드포인트
- `AI_API_KEY` : LLM API 키
- `AI_MODEL` : 사용할 모델명
- `AI_TEMPERATURE` : 선택, 기본 `0.2`

## 권장 운영 루프
- 매 정시 또는 4시간마다 Actions 실행
- 역할별 산출물을 아티팩트와 Step Summary에 남김
- 사람이 확인 후 실제 이슈/PR/로드맵 반영

## 주의
- 워크플로우는 기본적으로 **리포트 생성** 중심이다.
- 자동 이슈 생성, 자동 PR 생성, 자동 머지는 바로 켜지지 않도록 보수적으로 둔다.
- 먼저 리포트 품질을 안정화한 뒤 issue automation을 붙인다.

## 기본 원칙
- 에이전트는 개발자를 대체하지 않는다. 개발자에게 더 선명한 다음 행동을 준다.
- 모든 제안은 증거 파일/경로/위험도/우선순위를 포함해야 한다.
- 모호한 말보다 체크리스트와 diff 후보가 우선이다.
