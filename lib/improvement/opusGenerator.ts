// lib/improvement/opusGenerator.ts
// ⚠️ Claude Design API 출시 시 이 파일을 claudeDesignGenerator.ts로 대체한다.
//    generate-improvement/route.ts의 import 경로만 변경하면 된다.

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export interface GenerateImproveParams {
  originalImage: string | null;
  issues: Array<{
    severity: string;
    desireType?: string;
    issue: string;
    recommendation?: string;
    screen?: string;
  }>;
  desire: {
    utility: { score: number; comment: string };
    healthPride: { score: number; comment: string };
    lossAversion: { score: number; comment: string };
  } | null | undefined;
  options: {
    criticalOnly: boolean;
    desireAlignment: boolean;
    restructureLayout: boolean;
    targetScore: number | null;
    variantIndex?: number;
  };
  score: number;
  roundNumber: number;
  productMode?: "yafit" | "general";
}

export interface GenerateImproveResult {
  html: string;
  changes: string[];
}

export async function generateImprovement(input: GenerateImproveParams): Promise<GenerateImproveResult> {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { originalImage, issues, desire, options, score, roundNumber } = input;

  const content: Anthropic.MessageParam["content"] = [];

  // 원본 이미지 첨부 (있을 경우)
  if (originalImage) {
    content.push({
      type: "text",
      text: "## 원본 화면 (이 화면을 최대한 충실하게 재현한 후 필요한 부분만 수정하세요)",
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: originalImage.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  content.push({
    type: "text",
    text: buildAnalysisContext({ issues, desire, options, score, roundNumber }),
  });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 20000,
    system: buildSystemPrompt(options, input.productMode),
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "max_tokens") {
    console.warn("[opusGenerator] Response hit max_tokens limit — HTML may be truncated");
  }

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  return parseResponse(responseText);
}

function buildSystemPrompt(options: GenerateImproveParams["options"], productMode?: string): string {
  const isGeneral = productMode === "general";
  const variantHint = typeof options.variantIndex === "number" && options.variantIndex > 0
    ? `\n\nVARIANT ${options.variantIndex + 1} DIRECTIVE: This is variant #${options.variantIndex + 1}. Apply the same fixes but use a different visual treatment for the changed elements (e.g., different color emphasis, different layout for just the fixed section, different copy for CTAs) so this variant feels distinct from variant #1. Keep all unchanged areas identical to the original.`
    : "";

  const appType = isGeneral ? "mobile/web apps" : "Korean mobile apps";

  return `You are a surgical UI improvement specialist for ${appType}.

## YOUR SINGLE MOST IMPORTANT RULE
You are NOT redesigning this app. You are making the MINIMUM targeted changes to fix specific issues.
The output must look 95% identical to the original. A UX evaluator must be able to say "yes, this is the same screen with X fixed."

## PROCESS — follow in this exact order:

### STEP 1: Faithfully reproduce the original
- Study the original image pixel by pixel
- Reproduce EVERY element: colors, fonts (use system-ui as fallback), spacing, icons (use unicode/CSS), background, gradients, shadows
- Match the original's color palette exactly (sample the hex values from the image)
- Match element sizes and proportions as closely as possible
- If you see a dark background (#0a0a0a or similar), use that exact dark background
- Reproduce all text content exactly as it appears (Korean text)
- Reproduce images and illustrations as CSS shapes/gradients that approximate the visual

### STEP 2: Apply ONLY the listed fixes
- Change ONLY the specific elements that are called out in the issues
- Each fix must be the minimum change that solves the problem
- Do NOT "improve" things that weren't flagged as issues
- Do NOT add new sections, widgets, or elements that weren't in the original
- Do NOT remove sections that existed in the original
- If the recommendation says "make X more prominent", only change that one element's visual weight — don't restructure the surrounding layout

### STEP 3: Verify before outputting
- Check: does the output look like the original with targeted fixes applied?
- Check: are there any elements you added that weren't in the original? Remove them.
- Check: are there any original elements you accidentally removed? Add them back.
${options.restructureLayout ? "\nEXCEPTION: Layout restructuring is enabled. You may reorganize section order, but must keep all original content." : ""}

## Technical requirements
- Single complete HTML file. ALL styles in ONE <style> block in <head>. NO inline style= attributes.
- Width: 375px fixed. Scrollable height.
- Korean text only
- No external URLs. Approximate images with CSS gradients/shapes.
- System fonts: -apple-system, BlinkMacSystemFont, "Noto Sans KR", sans-serif
${variantHint}

## Output format
<CHANGES>
- [수정 1]: 구체적으로 무엇을 어떻게 바꿨는지 (원본 대비)
- [수정 2]: ...
</CHANGES>
<HTML>
<!DOCTYPE html>
...complete HTML reproducing original with targeted fixes...
</HTML>`;
}

function buildAnalysisContext(
  {
    issues,
    desire,
    options,
    score,
    roundNumber,
  }: Pick<GenerateImproveParams, "issues" | "desire" | "options" | "score" | "roundNumber">
): string {
  const targetIssues = options.criticalOnly
    ? issues.filter((i) => i.severity === "Critical")
    : issues;

  const issuesSection = `## 수정할 이슈 목록 (${targetIssues.length}건 — 이것만 수정하세요)
${targetIssues
  .map(
    (issue, i) => `
[수정 ${i + 1}] 심각도: ${issue.severity}
- 문제: ${issue.issue}
- 권장 수정: ${issue.recommendation ?? "없음"}
- 수정 범위: 위 문제에 해당하는 요소만 변경. 주변 레이아웃 건드리지 말 것.`
  )
  .join("\n")}`;

  const desireSection =
    options.desireAlignment && desire
      ? `
## 욕망 충족도 현황 (수정 시 고려, 하지만 기존 디자인을 유지하면서 개선)
- 효능감: ${desire.utility.score}/10 — ${desire.utility.comment}
- 성취·과시: ${desire.healthPride.score}/10 — ${desire.healthPride.comment}
- 손실회피: ${desire.lossAversion.score}/10 — ${desire.lossAversion.comment}
※ 욕망 관련 개선도 원본 UI 요소 내에서만 (카피 변경, 수치 강조 등). 새 섹션 추가 금지.`
      : "";

  return `
## 현재 상태
- 현재 점수: ${score}/100
- 개선 라운드: ${roundNumber}회차
${desireSection}

${issuesSection}

---
위 수정 사항만 적용한 개선 화면을 생성하세요. 나머지는 원본과 동일하게 유지.`;
}

function parseResponse(text: string): GenerateImproveResult {
  // CHANGES 파싱
  const changesMatch = text.match(/<CHANGES>([\s\S]*?)<\/CHANGES>/);
  const changesText = changesMatch?.[1] ?? "";
  const changes = changesText
    .split("\n")
    .map((line) => line.replace(/^[•\-*\[\]수정\d:\s]+/, "").trim())
    .filter(Boolean);

  // HTML 파싱
  let html = "";
  const doctypeIdx = text.indexOf("<!DOCTYPE html>");
  if (doctypeIdx !== -1) {
    html = text.slice(doctypeIdx);
    html = html.replace(/<\/HTML>\s*$/, "").trim();
    if (!html.toLowerCase().includes("</html>")) {
      html += "\n</body>\n</html>";
    }
  } else {
    const htmlMatch = text.match(/<HTML>([\s\S]+?)(?:<\/HTML>|$)/);
    html = htmlMatch?.[1]?.trim() ?? "";
  }

  if (!html) {
    throw new Error("HTML 생성 결과를 파싱할 수 없습니다. 다시 시도해주세요.");
  }

  return { html, changes: changes.length > 0 ? changes : ["개선 완료"] };
}
