/**
 * 자율 QA 에이전트
 *
 * GitHub Actions로 자동 실행되며:
 * 1. 빌드 검증
 * 2. 코드 품질 분석 (린트, 타입체크)
 * 3. E2E 테스트 실행
 * 4. 코드베이스 분석 → Claude API로 리팩토링/버그/자동화 제안
 * 5. qa-reports/ 폴더에 저장 + GitHub Issue 생성
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");

function run(cmd: string): { output: string; exitCode: number } {
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 120000 }).trim();
    return { output, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { output: (e.stdout || "").toString().trim(), exitCode: e.status || 1 };
  }
}

function readFileIfExists(filePath: string): string {
  const full = path.resolve(ROOT, filePath);
  if (fs.existsSync(full)) {
    return fs.readFileSync(full, "utf-8").slice(0, 3000);
  }
  return "";
}

interface QAResults {
  build: { passed: boolean; output: string };
  lint: { passed: boolean; output: string };
  typeCheck: { passed: boolean; output: string };
  e2e: { passed: boolean; output: string };
  codeAnalysis: string;
}

function runChecks(): QAResults {
  console.log("[qa-agent] 빌드 검증...");
  const build = run("npm run build 2>&1 | tail -30");

  console.log("[qa-agent] 린트 검사...");
  const lint = run("npm run lint 2>&1");

  console.log("[qa-agent] 타입 체크...");
  const typeCheck = run("npm run type-check 2>&1");

  console.log("[qa-agent] E2E 테스트...");
  const e2e = run("npx playwright test --reporter=list 2>&1 | tail -40");

  // 코드 분석 컨텍스트 수집
  console.log("[qa-agent] 코드 분석 컨텍스트 수집...");
  const gitDiff = run("git diff HEAD~5 --stat 2>/dev/null").output || "(diff 없음)";
  const todoComments = run("grep -rn 'TODO\\|FIXME\\|HACK\\|XXX' --include='*.ts' --include='*.tsx' app/ components/ lib/ 2>/dev/null | head -20").output;
  const unusedImports = run("grep -rn '^import.*from' --include='*.tsx' --include='*.ts' app/ components/ lib/ 2>/dev/null | wc -l").output;
  const largeFiles = run("wc -l app/**/*.tsx app/**/*.ts components/*.tsx lib/*.ts 2>/dev/null | sort -rn | head -10").output;
  const errors = readFileIfExists(".claude/memory/errors.md");

  const codeAnalysis = `
## 최근 변경 (git diff --stat HEAD~5)
${gitDiff}

## TODO/FIXME 주석
${todoComments || "(없음)"}

## 대용량 파일 (라인 수 기준)
${largeFiles}

## 총 import 수
${unusedImports}

## 에러 기록
${errors}
`.trim();

  return {
    build: { passed: build.exitCode === 0, output: build.output },
    lint: { passed: lint.exitCode === 0, output: lint.output },
    typeCheck: { passed: typeCheck.exitCode === 0, output: typeCheck.output },
    e2e: { passed: e2e.exitCode === 0, output: e2e.output },
    codeAnalysis,
  };
}

async function analyzeAndSuggest(results: QAResults): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().split("T")[0];

  const prompt = `당신은 Simulo (AI UX Testing Tool)의 시니어 QA 엔지니어 겸 리팩토링 전문가입니다.

아래 자동 검사 결과와 코드 분석 데이터를 보고:
1. 발견된 문제를 분류 (CRITICAL / HIGH / MEDIUM)
2. 리팩토링 기회 제안
3. 자동화할 수 있는 작업 식별
4. 잠재적 버그 예측

---

## 자동 검사 결과

### 빌드: ${results.build.passed ? "PASS" : "FAIL"}
${results.build.output.slice(-500)}

### 린트: ${results.lint.passed ? "PASS" : "FAIL"}
${results.lint.output.slice(-500)}

### 타입 체크: ${results.typeCheck.passed ? "PASS" : "FAIL"}
${results.typeCheck.output.slice(-500)}

### E2E 테스트: ${results.e2e.passed ? "PASS" : "FAIL"}
${results.e2e.output.slice(-500)}

---

## 코드 분석
${results.codeAnalysis}

---

다음 형식으로 한국어 리포트를 작성하세요:

# QA Report — ${today}

## 자동 검사 요약
| 항목 | 상태 |
|------|------|
| 빌드 | PASS/FAIL |
| 린트 | PASS/FAIL |
| 타입 체크 | PASS/FAIL |
| E2E 테스트 | PASS/FAIL |

## 발견된 이슈

### CRITICAL (즉시 수정 필요)
(없으면 "없음")

### HIGH (빠른 수정 권장)
(없으면 "없음")

### MEDIUM (개선 권장)

## 리팩토링 제안
(대용량 파일 분리, 중복 코드 제거, 아키텍처 개선 등)

## 자동화 기회
(테스트 추가, CI 개선, 반복 작업 자동화 등)

## 잠재적 버그 예측
(에러 패턴 기반 예측)
`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "분석 실패";
}

async function main() {
  console.log("[qa-agent] 자동 검사 시작...\n");

  const results = runChecks();
  console.log("\n[qa-agent] Claude API로 분석 중...");

  const report = await analyzeAndSuggest(results);

  // 파일 저장
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const outDir = path.join(ROOT, "qa-reports");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `qa-${today}.md`);
  fs.writeFileSync(outPath, report, "utf-8");
  console.log(`\n[qa-agent] 저장 완료: ${outPath}`);

  // 검사 실패 시 exit code 1 (GitHub Actions에서 Issue 생성 트리거)
  const hasCritical = !results.build.passed || !results.typeCheck.passed;
  if (hasCritical) {
    console.error("[qa-agent] CRITICAL 이슈 발견 — exit 1");
    process.exit(1);
  }

  console.log("[qa-agent] 완료");
}

main().catch((err) => {
  console.error("[qa-agent] 실패:", err.message);
  process.exit(1);
});
