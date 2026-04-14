/**
 * 자율 아이디어 에이전트
 *
 * GitHub Actions cron으로 매일 실행되며:
 * 1. 최근 git log를 분석
 * 2. 코드베이스 구조를 파악
 * 3. 에러 기록과 QA 리포트를 읽음
 * 4. Claude API로 제품 개선 아이디어를 생성
 * 5. ideas/ 폴더에 저장 + GitHub Issue 생성
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");

function run(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 30000 }).trim();
  } catch {
    return "";
  }
}

function readFileIfExists(filePath: string): string {
  const full = path.resolve(ROOT, filePath);
  if (fs.existsSync(full)) {
    const content = fs.readFileSync(full, "utf-8");
    return content.slice(0, 3000); // 토큰 절약
  }
  return "(파일 없음)";
}

function collectContext(): string {
  // 1. 최근 7일 git log
  const gitLog = run("git log --oneline --since='7 days ago' 2>/dev/null") || "(커밋 없음)";

  // 2. 핫스팟 파일 (최근 20커밋에서 가장 많이 변경된 파일)
  const hotspots = run(
    "git log --pretty=format: --name-only -20 2>/dev/null | sort | uniq -c | sort -rn | head -10"
  ) || "(데이터 없음)";

  // 3. fix 커밋 비율
  const totalCommits = run("git log --oneline --since='7 days ago' 2>/dev/null | wc -l").trim();
  const fixCommits = run("git log --oneline --since='7 days ago' --grep='fix' 2>/dev/null | wc -l").trim();

  // 4. 프로젝트 구조
  const appStructure = run("find app -name '*.tsx' -o -name '*.ts' 2>/dev/null | head -30");
  const componentList = run("ls components/*.tsx 2>/dev/null");

  // 5. 에러 기록
  const errors = readFileIfExists(".claude/memory/errors.md");

  // 6. 패턴 기록
  const patterns = readFileIfExists(".claude/memory/patterns.md");

  // 7. QA 리포트 (최신)
  const qaReports = run("ls -t qa-reports/*.md 2>/dev/null | head -1");
  const latestQA = qaReports ? readFileIfExists(qaReports) : "(QA 리포트 없음)";

  // 8. CLAUDE.md (프로젝트 컨텍스트)
  const claudeMd = readFileIfExists("CLAUDE.md");

  // 9. package.json 의존성
  const deps = readFileIfExists("package.json");

  return `
## 최근 7일 Git Log
${gitLog}

## 핫스팟 파일 (가장 많이 변경된 파일 Top 10)
${hotspots}

## 커밋 통계
- 총 커밋: ${totalCommits}
- fix 커밋: ${fixCommits}
- fix 비율: ${totalCommits !== "0" ? ((parseInt(fixCommits) / parseInt(totalCommits)) * 100).toFixed(0) : 0}%

## 앱 구조
${appStructure}

## 컴포넌트 목록
${componentList}

## 에러 기록 (.claude/memory/errors.md)
${errors}

## 학습된 패턴 (.claude/memory/patterns.md)
${patterns}

## 최신 QA 리포트
${latestQA}

## 프로젝트 설정 (CLAUDE.md)
${claudeMd}

## 의존성 (package.json)
${deps}
`.trim();
}

async function generateIdeas(): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const client = new Anthropic({ apiKey });
  const context = collectContext();
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `당신은 Simulo (AI UX Testing Tool) 프로젝트의 시니어 제품 전략가입니다.
아래 프로젝트 데이터를 분석하여 제품 개선 아이디어 3개를 생성하세요.

분석 기준:
1. 반복되는 에러 패턴 → 근본적 아키텍처 개선
2. 핫스팟 파일 → 불안정한 영역의 리팩토링 기회
3. 누락된 기능 → 사용자 경험 향상
4. 코드 품질 → 자동화/테스트 강화 기회
5. UX 마찰 → 기존 플로우의 개선점

반드시 데이터에 기반한 구체적 아이디어만 제시하세요. 추측하지 마세요.

---

${context}

---

다음 형식으로 한국어로 작성하세요:

# Product Ideas — ${today}

## 분석 요약
- 분석 기간: 최근 7일
- 핵심 발견사항: (2-3줄)

---

### Idea 1: [제목]

**발견 근거**: [어떤 데이터에서 도출했는가]
**현재 문제**: [구체적 마찰 포인트]
**제안**: [실행 가능한 개선 방향]
**구현 난이도**: Low / Medium / High
**예상 임팩트**: Low / Medium / High
**영향 파일**: [파일 경로 목록]
**예상 작업량**: [시간/일]

---

### Idea 2: [제목]
(동일 형식)

---

### Idea 3: [제목]
(동일 형식)

---

## 우선순위 요약

| 순위 | 아이디어 | 임팩트 | 난이도 | 점수 |
|------|---------|--------|--------|------|
| 1 | ... | ... | ... | ... |
| 2 | ... | ... | ... | ... |
| 3 | ... | ... | ... | ... |

점수 = 임팩트(H=3,M=2,L=1) / 난이도(H=3,M=2,L=1)`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "아이디어 생성 실패";
}

async function main() {
  console.log("[idea-agent] 컨텍스트 수집 중...");

  const ideas = await generateIdeas();

  // 파일 저장
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const outDir = path.join(ROOT, "ideas");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `ideas-${today}.md`);
  fs.writeFileSync(outPath, ideas, "utf-8");
  console.log(`[idea-agent] 저장 완료: ${outPath}`);

  // stdout에 출력 (GitHub Actions에서 캡처용)
  console.log("\n--- IDEA REPORT ---\n");
  console.log(ideas);
}

main().catch((err) => {
  console.error("[idea-agent] 실패:", err.message);
  process.exit(1);
});
