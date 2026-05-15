// lib/improvement/opusGenerator.ts
// ⚠️ Claude Design API 출시 시 이 파일을 claudeDesignGenerator.ts로 대체한다.
//    generate-improvement/route.ts의 import 경로만 변경하면 된다.

import Anthropic from "@anthropic-ai/sdk";
import { detectMediaType } from "../claude";

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
  description?: string;
  referenceImages?: string[];
  apiKey: string;
}

export interface GenerateImproveResult {
  html: string;
  changes: string[];
}

export async function generateImprovement(input: GenerateImproveParams): Promise<GenerateImproveResult> {
  const anthropic = new Anthropic({ apiKey: input.apiKey });
  const { originalImage, issues, desire, options, score, roundNumber, description, referenceImages } = input;

  const content: Anthropic.MessageParam["content"] = [];

  // 원본 이미지 첨부 (있을 경우)
  if (originalImage) {
    content.push({
      type: "text",
      text: "## ORIGINAL SCREEN — Reproduce this faithfully, then apply only the listed fixes",
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: detectMediaType(originalImage.replace(/^data:image\/\w+;base64,/, "")),
        data: originalImage.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  // 레퍼런스 이미지 첨부 (있을 경우)
  if (referenceImages && referenceImages.length > 0) {
    content.push({
      type: "text",
      text: `## REFERENCE IMAGES (${referenceImages.length} — visual style reference only, do NOT copy their content into the output)`,
    });
    for (const refImg of referenceImages) {
      const mimeMatch = refImg.match(/^data:(image\/\w+);base64,/);
      const mediaType = (mimeMatch?.[1] ?? "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: refImg.replace(/^data:image\/\w+;base64,/, ""),
        },
      });
    }
  }

  content.push({
    type: "text",
    text: buildAnalysisContext({ issues, desire, options, score, roundNumber, description }),
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
  const appContext = isGeneral ? "모바일/웹 앱" : "한국 모바일 앱 (야핏무브)";

  const variantDirective = typeof options.variantIndex === "number" && options.variantIndex > 0
    ? `\n## VARIANT ${options.variantIndex + 1} DIRECTIVE
이 시안은 시안 #${options.variantIndex + 1}입니다. 수정 방향은 동일하되, 수정된 요소에만 다른 시각적 처리를 적용하세요 (예: 다른 강조 색상, 수정된 섹션의 다른 정렬, CTA 문구 변형 등). 수정하지 않는 영역은 시안 #1과 완전히 동일하게 유지하세요.`
    : "";

  return `당신은 ${appContext} 전문 UI 개선 엔지니어입니다. 외과적 정밀도로 특정 이슈만 수정하고 나머지는 원본과 동일하게 유지합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
절대 원칙 — 이것을 어기면 실패입니다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**원칙 A — 중복 절대 금지**
모든 텍스트 문자열, UI 컴포넌트, 아이콘은 최대 1회만 등장합니다.
동일한 메시지를 두 번 쓰면 즉시 버그입니다. 강조를 위해 같은 내용을 반복하지 마세요.
출력 전 스스로 확인: "같은 문구가 두 곳 이상 있는가?" → 있으면 하나만 남기세요.

**원칙 B — 원본에 없던 요소 추가 금지**
이슈를 수정하는 방법은 기존 요소를 수정하는 것이지, 새 섹션/위젯/배너를 추가하는 것이 아닙니다.
원본 화면에 없던 요소가 출력에 있다면 즉시 제거하세요.
${options.restructureLayout ? "예외: 레이아웃 구조 변경 옵션이 켜진 경우 섹션 순서 재배치는 허용되지만, 원본에 없던 콘텐츠는 여전히 추가 금지입니다." : ""}

**원칙 C — 1 이슈 = 1 요소 수정**
각 이슈는 원본에서 정확히 1개의 UI 요소와 대응됩니다.
그 요소를 찾아서 최소한의 방식으로 수정하세요. 주변 요소를 건드리지 마세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
작업 프로세스 (순서 준수 필수)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[PRE-ANALYSIS — HTML 생성 전 반드시 수행]**
각 이슈에 대해 원본 화면에서 대응되는 요소 1개를 명시적으로 식별하세요:
→ 이슈 N: "원본의 [요소명]을 [구체적 변경]으로 수정. 이 요소는 화면에서 [위치]에 있음."
이 매핑이 완성된 후에만 HTML을 작성하세요.

**[STEP 1] 원본 충실 재현**
- 배경색, 폰트, 간격, 아이콘, 그라디언트 등 모든 시각 요소를 원본 그대로 재현
- 한국어 텍스트는 원본과 완전히 동일하게
- 이미지/일러스트는 CSS 그라디언트/도형으로 근사 재현
- 색상은 원본에서 직접 샘플링한 hex값 사용

**[STEP 2] 수정 적용**
- PRE-ANALYSIS에서 식별한 요소만 수정
- 각 수정은 해당 이슈를 해결하는 최소한의 변경
- 수정 전/후를 머릿속에서 diff로 상상하세요 — 다른 부분은 모두 동일해야 함

**[STEP 3] 품질 체크 (출력 전)**
□ 동일한 텍스트가 2회 이상 등장하는가? → 하나 삭제
□ 원본에 없던 새 섹션/요소가 있는가? → 삭제
□ 수정하지 말아야 할 요소가 변경되었는가? → 원복
□ 원본에 있던 요소가 사라졌는가? → 복구

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HTML 기술 규격
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 단일 완전한 HTML 파일. 모든 스타일은 <head>의 <style> 블록 하나에만 작성. inline style= 금지.
- 고정 너비 375px. 높이는 콘텐츠에 맞게 자동 확장(스크롤 가능).
- 한국어만 사용
- 외부 URL 없음. 이미지는 CSS로 근사.
- 폰트: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif
- 모바일 네이티브 앱처럼 보여야 함: 적절한 패딩(16px), 터치 타겟(44px+), 선명한 계층구조
${variantDirective}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
금지 패턴 (흔한 실수)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ CTA를 강조하려고 동일한 CTA를 여러 위치에 배치
✗ 메시지를 강조하려고 같은 텍스트를 배너 + 본문 + 하단에 반복
✗ 이슈를 해결하려고 팝업, 배너, 모달을 추가로 삽입
✗ "개선"을 위해 원본에 없던 섹션 전체를 추가
✗ 욕망 점수를 올리려고 관련 없는 새 UI 요소 삽입

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<ANALYSIS>
[PRE-ANALYSIS 결과 — 이슈별 수정 요소 매핑]
</ANALYSIS>
<CHANGES>
- [수정 1]: 원본 대비 구체적으로 무엇을 어떻게 바꿨는지
- [수정 2]: ...
</CHANGES>
<HTML>
<!DOCTYPE html>
...원본을 충실히 재현하고 지정된 수정만 적용한 완전한 HTML...
</HTML>`;
}

function buildAnalysisContext(
  {
    issues,
    desire,
    options,
    score,
    roundNumber,
    description,
  }: Pick<GenerateImproveParams, "issues" | "desire" | "options" | "score" | "roundNumber" | "description">
): string {
  const targetIssues = options.criticalOnly
    ? issues.filter((i) => i.severity === "Critical")
    : issues;

  // Sort: Critical first
  const sortedIssues = [...targetIssues].sort((a, b) => {
    const order = { Critical: 0, Medium: 1, Low: 2 };
    return (order[a.severity as keyof typeof order] ?? 2) - (order[b.severity as keyof typeof order] ?? 2);
  });

  const issuesSection = `## 수정할 이슈 목록 (총 ${sortedIssues.length}건)
※ 아래 이슈들은 각각 원본 화면의 기존 UI 요소 하나와 대응됩니다. 새 요소를 추가하지 말고 기존 요소를 수정하세요.

${sortedIssues
    .map(
      (issue, i) => `### 이슈 ${i + 1} [${issue.severity}]
문제: ${issue.issue}
수정 방향: ${issue.recommendation ?? "해당 요소의 시각적 명확성 개선"}
주의: 이 이슈와 관련된 원본 요소 1개만 수정. 그 요소가 화면에 이미 있다면 추가 삽입 금지.`
    )
    .join("\n\n")}`;

  const desireSection =
    options.desireAlignment && desire
      ? `
## 욕망 충족도 현황 (수정 시 참고 — 기존 요소의 카피/강조도 개선에만 활용)
- 효능감(보상 명확성): ${desire.utility.score}/10 — ${desire.utility.comment}
- 성취·과시: ${desire.healthPride.score}/10 — ${desire.healthPride.comment}
- 손실회피(긴박감): ${desire.lossAversion.score}/10 — ${desire.lossAversion.comment}
→ 새 요소 추가 없이, 기존 텍스트 카피·숫자 강조·색상으로만 개선 가능한 부분을 찾아 수정.`
      : "";

  const targetScoreNote = options.targetScore
    ? `\n목표 점수: ${options.targetScore}/100 (현재 ${score}/100)`
    : "";

  const descriptionSection = description
    ? `\n## 추가 지시사항 (최우선 반영)\n${description}`
    : "";

  return `## 현재 상태
- 현재 점수: ${score}/100${targetScoreNote}
- 개선 라운드: ${roundNumber}회차
${desireSection}

${issuesSection}
${descriptionSection}

---
PRE-ANALYSIS → CHANGES → HTML 순서로 출력하세요.
PRE-ANALYSIS에서 각 이슈에 대응하는 원본 요소를 명시한 뒤 HTML을 작성하세요.`;
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
