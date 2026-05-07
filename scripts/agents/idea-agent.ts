/**
 * 자율 아이디어 에이전트 + PO 교차검증
 *
 * GitHub Actions cron으로 매일 KST 9시 실행:
 * 1. 최근 git log, 코드 구조, QA 리포트 등 컨텍스트 수집
 * 2. 요일별 렌즈로 제품 아이디어 3개 생성 (draft)
 * 3. PO Validator가 교차검증 (중복/점수/정합성)
 * 4. 승인된 아이디어만 ideas/ 에 최종 저장
 * 5. GitHub Issue는 워크플로우에서 생성
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

function readFileIfExists(filePath: string, maxBytes = 3000): string {
  const full = path.resolve(ROOT, filePath);
  if (fs.existsSync(full)) {
    const content = fs.readFileSync(full, "utf-8");
    return content.slice(0, maxBytes);
  }
  return "(파일 없음)";
}

// 요일별 렌즈 (1=월 ~ 7=일)
const LENSES: Record<number, { name: string; question: string }> = {
  1: { name: "🔥 사용자 고통", question: "야핏무브 사용자가 앱 켜고 1분 안에 포기하는 이유는?" },
  2: { name: "🏆 경쟁사 역공", question: "캐시워크, 스텝업이 못하는데 우리가 할 수 있는 것은?" },
  3: { name: "🌱 습관 심리학", question: "BJ Fogg의 Tiny Habits, 도파민 루프를 어떻게 제품에 녹일까?" },
  4: { name: "💰 수익 모델", question: "리워드 구조를 바꾸면 사용자와 야나두 모두 더 이득인 시나리오는?" },
  5: { name: "🔭 미래 시나리오", question: "1년 후 야핏무브 MAU 10배면 지금과 뭐가 달라야 하는가?" },
  6: { name: "🎮 게임화", question: "레벨, 퀘스트, 길드 같은 게임 메카닉을 어떻게 운동에 연결하는가?" },
  0: { name: "😤 극단적 사용자", question: "운동을 절대 안 하는 사람도 야핏무브를 쓸 이유를 만들 수 있는가?" },
};

function getTodayLens(): { name: string; question: string } {
  const dayOfWeek = new Date().getDay(); // 0=일, 1=월, ...
  return LENSES[dayOfWeek] ?? LENSES[1];
}

function collectContext(): string {
  console.log("[idea-agent] 컨텍스트 수집 중...");

  const gitLog = run("git log --oneline --since='7 days ago' 2>/dev/null") || "(커밋 없음)";
  const hotspots =
    run(
      "git log --pretty=format: --name-only -20 2>/dev/null | sort | uniq -c | sort -rn | head -10"
    ) || "(데이터 없음)";
  const totalCommitsRaw = run("git log --oneline --since='7 days ago' 2>/dev/null | wc -l").trim();
  const fixCommitsRaw = run(
    "git log --oneline --since='7 days ago' --grep='fix' 2>/dev/null | wc -l"
  ).trim();
  const totalCommits = parseInt(totalCommitsRaw) || 0;
  const fixCommits = parseInt(fixCommitsRaw) || 0;

  const appStructure =
    run("find app -name '*.tsx' -o -name '*.ts' 2>/dev/null | head -30") || "(없음)";
  const componentList = run("ls components/*.tsx 2>/dev/null") || "(없음)";
  const latestQAPath = run("ls -t qa-reports/*.md 2>/dev/null | head -1");
  const latestQA = latestQAPath ? readFileIfExists(latestQAPath) : "(QA 리포트 없음)";
  const claudeMd = readFileIfExists("CLAUDE.md");

  // 이전 아이디어 전체 히스토리 (중복 방지)
  const ideaFiles = run("ls -t ideas/*.md 2>/dev/null").split("\n").filter(Boolean);
  const ideaHistory = ideaFiles
    .map((f) => {
      const content = readFileIfExists(f.trim(), 1000);
      return `### ${path.basename(f.trim())}\n${content}`;
    })
    .join("\n\n");

  console.log(
    `[idea-agent] git log: ${totalCommits}개 커밋, fix: ${fixCommits}개, 이전 아이디어: ${ideaFiles.length}개`
  );

  return `
## 최근 7일 Git Log
${gitLog}

## 핫스팟 파일
${hotspots}

## 커밋 통계
- 총 커밋: ${totalCommits}, fix 커밋: ${fixCommits} (${totalCommits > 0 ? ((fixCommits / totalCommits) * 100).toFixed(0) : 0}%)

## 앱 구조
${appStructure}

## 컴포넌트 목록
${componentList}

## 최신 QA 리포트
${latestQA}

## 프로젝트 설정
${claudeMd}

## 이전 아이디어 히스토리 (${ideaFiles.length}개 — 중복 방지 필수)
${ideaHistory || "(없음)"}
`.trim();
}

async function generateIdeas(client: Anthropic, context: string, today: string): Promise<string> {
  const lens = getTodayLens();
  console.log(`[idea-agent] 오늘의 렌즈: ${lens.name}`);
  console.log("[idea-agent] Claude API 호출 중 (아이디어 생성)...");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `당신은 Simulo (AI UX Testing Tool)와 야핏무브의 제품 혁신가입니다.
오늘의 렌즈: ${lens.name}
핵심 질문: "${lens.question}"

절대 금지:
- API 응답 속도 개선, 캐싱 최적화, 에러 핸들링 강화, 코드 리팩토링, 테스트 커버리지 → 개발자 할 일이지 제품 아이디어가 아님
- 이전 아이디어와 완전히 겹치는 주제 (히스토리 참조)

좋은 아이디어 기준:
- 사용자가 앱을 열고 싶어지는 이유가 생기는가
- 운동 완료율이나 리워드 교환율에 직접 영향을 주는가
- 지금 당장 와이어프레임을 그릴 수 있을 만큼 구체적인가

유형 비율: 60% 사용자 경험/기능, 25% 비즈니스/리워드, 15% Simulo 자체 개선`,
    messages: [
      {
        role: "user",
        content: `아래 프로젝트 데이터와 오늘의 렌즈(${lens.name})를 기반으로 제품 아이디어 3개를 생성하세요.
이전 아이디어 히스토리를 반드시 확인하고 중복을 피하세요.

---

${context}

---

다음 형식으로 한국어로 작성하세요:

# 아이디어 리포트 (DRAFT)
날짜: ${today}
오늘의 렌즈: ${lens.name}
히스토리 확인: 이전 아이디어 검토 완료

---

## 아이디어 1: [제목]

**한 줄 설명**: [15자 이내]
**사용자 스토리**: 야핏무브 사용자 [페르소나]가 [상황]에서 [이 기능]을 통해 [가치]를 얻는다.
**왜 지금 이게 필요한가**: [현재 불편함 또는 기회]
**구체적인 동작 방식**:
1. 사용자가 [행동]을 하면
2. [이런 일]이 일어나고
3. 사용자는 [결과]를 경험한다
**개발 난이도**: 상/중/하
**예상 임팩트**: [운동 완료율/리텐션/신규 유입 중 기여 영역]
**이전 아이디어와 다른 점**: [히스토리에 없는 이유]
**영향 파일**: [관련 파일 경로]

---

## 아이디어 2: [제목]
(동일 포맷)

---

## 아이디어 3: [제목]
(동일 포맷)

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
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude API가 텍스트 응답을 반환하지 않았습니다.");
  }
  return textBlock.text;
}

async function validateWithPO(
  client: Anthropic,
  draftContent: string,
  ideaHistory: string,
  today: string
): Promise<{ approved: string; review: string; hasApproved: boolean }> {
  console.log("[idea-agent] PO Validator 교차검증 시작...");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `당신은 Simulo와 야핏무브의 PO(Product Owner)입니다.
idea-generator가 생성한 아이디어를 냉정하게 검증합니다.
"될 것 같은 느낌"이 아니라 "실제로 사용자에게 가치가 있는가"를 판단합니다.

검증 기준 (각 1-5점, 총점 20점):
[U] 사용자 가치: 1=있으면 좋지만 없어도 그만, 5=없으면 불편함
[F] 실현 가능성: 1=6개월 이상, 3=2-3주 MVP, 5=1주 내 테스트 가능
[N] 신선도: 1=대형 앱에 이미 있음, 5=피트니스 리워드 앱에서 본 적 없음
[A] 정합성: 1=핵심 목적과 무관, 5=운동 지속성+리워드에 직접 기여

판정: 14점 이상 → ✅ 승인, 11-13점 → ⚠️ 조건부 승인, 10점 이하 → ❌ 거부
점수가 14점이어도 히스토리와 중복이면 거부 가능.
모든 아이디어를 승인하지 않는다. 평균 3개 중 1-2개 거부가 정상.`,
    messages: [
      {
        role: "user",
        content: `아래 draft 아이디어를 검증하세요.

## 검증 대상 (오늘 생성된 draft)
${draftContent}

## 이전 아이디어 히스토리 (중복 검사용)
${ideaHistory || "(없음)"}

---

다음 형식으로 검증 결과를 작성하세요:

# PO 검증 리포트
날짜: ${today}
히스토리 검토: 이전 아이디어 대조 완료

---

## 아이디어 1: [제목]

### 중복 검사
→ [중복 없음 / 유사 아이디어 존재]

### 점수
| 기준 | 점수 | 근거 |
|------|------|------|
| U 사용자 가치 | [1-5] | [이유] |
| F 실현 가능성 | [1-5] | [이유] |
| N 신선도 | [1-5] | [이유] |
| A 정합성 | [1-5] | [이유] |
| **합계** | **[N]/20** | |

### 판정
[✅ 승인 / ⚠️ 조건부 승인 / ❌ 거부]
**사유**: [2-3줄]

---

(아이디어 2, 3도 동일 포맷)

---

## 최종 요약

| 아이디어 | 점수 | 판정 |
|---------|------|------|
| [제목1] | [N]/20 | ✅/⚠️/❌ |
| [제목2] | [N]/20 | ✅/⚠️/❌ |
| [제목3] | [N]/20 | ✅/⚠️/❌ |

승인된 아이디어: [N]개

---

## idea-generator에게 피드백
- [다음 생성 시 참고사항]`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("PO Validator API가 텍스트 응답을 반환하지 않았습니다.");
  }

  const review = textBlock.text;

  // 승인된 아이디어가 있는지 확인
  const hasApproved = review.includes("✅ 승인") || review.includes("⚠️ 조건부 승인");

  // 승인된 아이디어만 추출하여 최종 보고서 구성
  let approved = draftContent.replace("(DRAFT)", "").trim();
  approved += `\n\n---\n\n# PO 검증 결과\n\n${review}`;

  return { approved, review, hasApproved };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().split("T")[0];
  const todayCompact = today.replace(/-/g, "");
  const outDir = path.join(ROOT, "ideas");
  const reviewDir = path.join(outDir, "reviews");
  const rejectedDir = path.join(outDir, "rejected");
  const draftPath = path.join(outDir, `${today}-draft.md`);
  const finalPath = path.join(outDir, `ideas-${todayCompact}.md`);
  const reviewPath = path.join(reviewDir, `${today}-review.md`);

  // 오늘 이미 최종 파일이 존재하면 스킵
  if (fs.existsSync(finalPath)) {
    console.log(`[idea-agent] 오늘 아이디어가 이미 존재합니다: ${finalPath}`);
    const existing = fs.readFileSync(finalPath, "utf-8");
    console.log("\n--- IDEA REPORT ---\n");
    console.log(existing);
    return;
  }

  // Step 1: 컨텍스트 수집
  const context = collectContext();

  // Step 2: 아이디어 생성 (draft)
  const draftContent = await generateIdeas(client, context, today);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(draftPath, draftContent, "utf-8");
  console.log(`[idea-agent] Draft 저장 완료: ${draftPath}`);

  // Step 3: 이전 아이디어 히스토리 수집 (PO 검증용)
  const ideaFiles = run("ls -t ideas/*.md 2>/dev/null")
    .split("\n")
    .filter((f) => f && !f.includes("-draft") && !f.includes("-review"));
  const ideaHistory = ideaFiles
    .slice(0, 10) // 최근 10개만
    .map((f) => readFileIfExists(f.trim(), 500))
    .join("\n---\n");

  // Step 4: PO Validator 교차검증
  const { approved, review, hasApproved } = await validateWithPO(
    client,
    draftContent,
    ideaHistory,
    today
  );

  // Step 5: 결과 저장
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(reviewPath, review, "utf-8");
  console.log(`[idea-agent] 검증 리포트 저장: ${reviewPath}`);

  if (hasApproved) {
    // 승인된 아이디어 → 최종 파일로 저장
    fs.writeFileSync(finalPath, approved, "utf-8");
    console.log(`[idea-agent] 최종 아이디어 저장: ${finalPath}`);
  } else {
    // 전부 거부 → rejected 폴더로 이동
    fs.mkdirSync(rejectedDir, { recursive: true });
    const rejectedPath = path.join(rejectedDir, `${today}-rejected.md`);
    fs.writeFileSync(rejectedPath, approved, "utf-8");
    console.log(`[idea-agent] 전부 거부됨, rejected 저장: ${rejectedPath}`);
    // 워크플로우가 최종 파일을 찾을 수 있도록 빈 파일 대신 거부 리포트도 저장
    fs.writeFileSync(finalPath, approved, "utf-8");
    console.log(`[idea-agent] (거부 포함) 최종 파일도 저장: ${finalPath}`);
  }

  // draft 파일 정리
  if (fs.existsSync(draftPath)) {
    fs.unlinkSync(draftPath);
    console.log(`[idea-agent] Draft 파일 삭제: ${draftPath}`);
  }

  console.log("\n--- IDEA REPORT ---\n");
  console.log(approved);
}

main().catch((err) => {
  console.error("[idea-agent] 실패:", err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
