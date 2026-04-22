// lib/improvement/opusGenerator.ts
// ⚠️ Claude Design API 출시 시 이 파일을 claudeDesignGenerator.ts로 대체한다.
//    generate-improvement/route.ts의 import 경로만 변경하면 된다.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

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
  };
  score: number;
  roundNumber: number;
}

export interface GenerateImproveResult {
  html: string;
  changes: string[];
}

export async function generateImprovement(input: GenerateImproveParams): Promise<GenerateImproveResult> {
  const { originalImage, issues, desire, options, score, roundNumber } = input;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  // 원본 이미지 첨부 (있을 경우)
  if (originalImage) {
    content.push({ type: "text", text: "## 원본 화면" });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: originalImage.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  // 분석 결과 컨텍스트
  content.push({
    type: "text",
    text: buildAnalysisContext({ issues, desire, options, score, roundNumber }),
  });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: buildSystemPrompt(options),
    messages: [{ role: "user", content }],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  return parseResponse(responseText);
}

function buildSystemPrompt(options: GenerateImproveParams["options"]): string {
  return `You are a senior UI/UX designer specializing in Korean mobile fitness reward apps.
Your target users are Korean women in their 40s-50s who use apps to earn mileage rewards.

You generate improved mobile UI mockups as complete HTML files.

Core design principles for this target:
1. UTILITY (효능감): Make reward amounts clearly visible at all times
2. HEALTH PRIDE (성취·과시): Celebrate achievements visually and prominently
3. LOSS AVERSION (손실회피): Show streak counts, daily deadlines, "don't miss out" cues

Technical requirements:
- Single complete HTML file with all CSS inline in <style> tag
- Mobile-first: fixed width 375px, scrollable height
- Korean text only
- No external resources, fonts, or images (use CSS shapes/gradients for visuals)
- Use the same color palette visible in the original image
- Smooth, app-like feel with subtle shadows and rounded corners
${
  options.restructureLayout
    ? "- You may significantly restructure the layout"
    : "- Keep the overall layout similar to the original, only fix specific issues"
}

Output format — respond with this exact structure:
<CHANGES>
- 변경사항 1
- 변경사항 2
- 변경사항 3
</CHANGES>
<HTML>
<!DOCTYPE html>
...complete HTML...
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
  const desireSection =
    options.desireAlignment && desire
      ? `
## 욕망 충족도 현황 (개선 목표: 모두 8/10 이상)
- 효능감 (가계 보탬): ${desire.utility.score}/10
  현황: ${desire.utility.comment}
- 성취·과시 (건강 인증): ${desire.healthPride.score}/10
  현황: ${desire.healthPride.comment}
- 손실회피 (빠지면 손해): ${desire.lossAversion.score}/10
  현황: ${desire.lossAversion.comment}`
      : "";

  const issuesSection = `
## 해결해야 할 이슈 (${issues.length}건)
${issues
  .map(
    (issue, i) => `
${i + 1}. [${issue.severity}] ${issue.issue}
   개선 방향: ${issue.recommendation ?? "없음"}
   욕망 관련: ${
     issue.desireType === "utility"
       ? "효능감"
       : issue.desireType === "healthPride"
       ? "성취·과시"
       : issue.desireType === "lossAversion"
       ? "손실회피"
       : "일반"
   }`
  )
  .join("\n")}`;

  return `
## 현재 상태
- 사용성 점수: ${score}/100
- 개선 라운드: ${roundNumber}회차
${desireSection}
${issuesSection}

위 이슈들을 해결한 개선된 모바일 화면을 HTML로 생성해줘.`;
}

function parseResponse(text: string): GenerateImproveResult {
  // CHANGES 파싱
  const changesMatch = text.match(/<CHANGES>([\s\S]*?)<\/CHANGES>/);
  const changesText = changesMatch?.[1] ?? "";
  const changes = changesText
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);

  // HTML 파싱
  const htmlMatch = text.match(/<HTML>([\s\S]*?)<\/HTML>/);
  const html = htmlMatch?.[1]?.trim() ?? text;

  return { html, changes: changes.length > 0 ? changes : ["개선 완료"] };
}
