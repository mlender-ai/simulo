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
  devServerHealth: { passed: boolean; output: string };
  cacheCheck: { passed: boolean; output: string };
  codeAnalysis: string;
}

function runChecks(): QAResults {
  // .next 캐시 정리 후 빌드 (stale chunk 404 방지)
  console.log("[qa-agent] .next 캐시 정리...");
  run("rm -rf .next");

  console.log("[qa-agent] 빌드 검증...");
  const build = run("npm run build 2>&1 | tail -30");

  console.log("[qa-agent] 린트 검사...");
  const lint = run("npm run lint 2>&1");

  console.log("[qa-agent] 타입 체크...");
  const typeCheck = run("npm run type-check 2>&1");

  console.log("[qa-agent] E2E 테스트...");
  const e2e = run("npx playwright test --reporter=list 2>&1 | tail -40");

  // dev 서버 기동 후 헬스체크
  console.log("[qa-agent] dev 서버 헬스체크...");
  run("rm -rf .next"); // 빌드 후 캐시가 남으므로 다시 정리
  const devStart = run("timeout 15 bash -c 'npm run dev:quick &>/dev/null & sleep 8 && curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3000 && kill $(lsof -ti:3000) 2>/dev/null'");
  const devServerHealth = {
    passed: devStart.output.includes("200"),
    output: devStart.output.includes("200") ? "dev server: 200 OK" : `dev server: ${devStart.output || "failed to start"}`,
  };

  // 캐시 불일치 체크 — dev 스크립트가 .next 캐시를 자동 정리하는지 확인
  console.log("[qa-agent] 캐시 안전성 검사...");
  const devScript = run("node -e \"const p=require('./package.json'); console.log(p.scripts.dev)\"");
  const cacheCheck = {
    passed: devScript.output.includes("rm -rf .next"),
    output: devScript.output.includes("rm -rf .next")
      ? "dev script includes cache cleanup"
      : `WARNING: dev script does NOT clean .next cache. Current: '${devScript.output}'. This causes stale chunk 404 errors after code changes.`,
  };

  // 코드 분석 컨텍스트 수집
  console.log("[qa-agent] 코드 분석 컨텍스트 수집...");
  const gitDiff = run("git diff HEAD~5 --stat 2>/dev/null").output || "(diff 없음)";
  const todoComments = run("grep -rn 'TODO\\|FIXME\\|HACK\\|XXX' --include='*.ts' --include='*.tsx' app/ components/ lib/ 2>/dev/null | head -20").output;
  const unusedImports = run("grep -rn '^import.*from' --include='*.tsx' --include='*.ts' app/ components/ lib/ 2>/dev/null | wc -l").output;
  const largeFiles = run("wc -l app/**/*.tsx app/**/*.ts components/*.tsx lib/*.ts 2>/dev/null | sort -rn | head -10").output;
  const errors = readFileIfExists(".claude/memory/errors.md");

  // ── 기능별 정적 검사 (no-DB 환경 기준) ──
  console.log("[qa-agent] 기능 정적 검사...");

  // export API가 DB 없이도 POST로 동작하는지 확인
  const exportRoutes = ["pdf", "docx", "md", "jira"].map((fmt) => {
    const content = readFileIfExists(`app/api/export/${fmt}/[id]/route.ts`);
    const hasPost = content.includes("export async function POST");
    const hasResolve = content.includes("resolveAnalysis");
    return `${fmt}: POST=${hasPost ? "✅" : "❌"} resolveAnalysis=${hasResolve ? "✅" : "❌"}`;
  }).join("\n");

  // ShareExportPanel이 analysisData prop을 받는지 확인
  const sharePanelContent = readFileIfExists("components/ShareExportPanel.tsx");
  const sharePanelHasDataProp = sharePanelContent.includes("analysisData");
  const sharePanelHasFetchExport = sharePanelContent.includes("fetchExport");
  const sharePanelHasShowPng = sharePanelContent.includes("showPng");

  // 히스토리 페이지에서 analysisData를 넘기는지 확인
  const historyPageContent = readFileIfExists("app/history/page.tsx");
  const historyPassesData = historyPageContent.includes("analysisData={analysis}");

  // 공유 페이지가 localStorage fallback을 갖는지 확인
  const sharePageContent = readFileIfExists("app/share/[id]/page.tsx");
  const sharePageHasFallback = sharePageContent.includes("storage.getById");

  // URL 탭이 이미지 업로드 없이 URL만으로 분석 가능한지 확인
  const urlHandlerExists = run("ls app/api/analyze/handlers/url.ts 2>/dev/null").exitCode === 0;
  const urlPluginRegistered = readFileIfExists("app/api/analyze/registry.ts").includes("urlPlugin");

  const featureChecks = `
## 기능 정적 검사 (no-DB 환경 기준)

### Export API — no-DB POST 지원
${exportRoutes}

### ShareExportPanel
- analysisData prop: ${sharePanelHasDataProp ? "✅" : "❌ MISSING — export 패널이 localStorage 데이터를 받지 못함"}
- fetchExport 헬퍼: ${sharePanelHasFetchExport ? "✅" : "❌ MISSING — POST/GET 분기 로직 없음"}
- showPng 조건부 노출: ${sharePanelHasShowPng ? "✅" : "❌ MISSING — 히스토리에서도 PNG 버튼 노출됨"}

### 히스토리 페이지
- analysisData prop 전달: ${historyPassesData ? "✅" : "❌ MISSING — 히스토리에서 내보내기 불가"}

### 공유 페이지 (/share/:id)
- localStorage fallback: ${sharePageHasFallback ? "✅" : "❌ MISSING — DB 없는 환경에서 공유 링크 404"}

### URL 분석
- url.ts 핸들러: ${urlHandlerExists ? "✅" : "❌ MISSING"}
- registry 등록: ${urlPluginRegistered ? "✅" : "❌ MISSING — URL 탭 분석 불가"}
`.trim();

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

${featureChecks}
`.trim();

  return {
    build: { passed: build.exitCode === 0, output: build.output },
    lint: { passed: lint.exitCode === 0, output: lint.output },
    typeCheck: { passed: typeCheck.exitCode === 0, output: typeCheck.output },
    e2e: { passed: e2e.exitCode === 0, output: e2e.output },
    devServerHealth,
    cacheCheck,
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

Simulo의 핵심 전제: **DATABASE_URL 없는 로컬 환경에서도 모든 기능이 작동해야 한다.**
데이터는 localStorage에 저장되고, export API는 POST body로 데이터를 받아 처리해야 한다.

아래 자동 검사 결과와 코드 분석 데이터를 보고:
1. 발견된 문제를 분류 (CRITICAL / HIGH / MEDIUM)
   - CRITICAL 기준: ① DB 없는 환경에서 기능 불가 ② 빌드/타입 실패 ③ 사용자가 마주치는 에러 UI
   - HIGH 기준: ① UI에서 기능이 있는데 동작 안 함 ② API가 잘못된 상태코드 반환
2. 기능 정적 검사 결과(아래 "기능 정적 검사" 섹션)에서 ❌ 항목을 CRITICAL/HIGH로 분류
3. 리팩토링 기회 제안
4. 자동화할 수 있는 작업 식별
5. 잠재적 버그 예측

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

### Dev 서버 헬스체크: ${results.devServerHealth.passed ? "PASS" : "FAIL"}
${results.devServerHealth.output}

### 캐시 안전성: ${results.cacheCheck.passed ? "PASS" : "FAIL"}
${results.cacheCheck.output}

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
| Dev 서버 | PASS/FAIL |
| 캐시 안전성 | PASS/FAIL |

## 기능 정적 검사 요약
(기능 정적 검사 섹션의 ✅/❌ 항목을 표로 정리. ❌가 하나라도 있으면 CRITICAL로 승격)

## 발견된 이슈

### CRITICAL (즉시 수정 필요)
(없으면 "없음". 기능 정적 검사 ❌ 항목 반드시 포함)

### HIGH (빠른 수정 권장)
(없으면 "없음")

### MEDIUM (개선 권장)

## 리팩토링 제안
(대용량 파일 분리, 중복 코드 제거, 아키텍처 개선 등)

## 자동화 기회
(테스트 추가, CI 개선, 반복 작업 자동화 등)

## 잠재적 버그 예측
(기능 정적 검사 + 에러 패턴 기반 예측. "DB 없는 환경에서 작동하는가" 관점 필수 포함)
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
  const hasCritical = !results.build.passed || !results.typeCheck.passed || !results.cacheCheck.passed;
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
