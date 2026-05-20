// lib/prompts/heuristic.ts
// 선택된 UX 프레임워크 기반 평가를 기존 시스템 프롬프트에 추가하는 레이어

import { FRAMEWORK_MAP, getFrameworksByCategory } from "@/lib/frameworks";

interface HeuristicSystemPromptParams {
  frameworkIds: string[];
  language: "ko" | "en";
}

/**
 * 기존 buildSystemPrompt 결과에 append되는 프레임워크 평가 레이어.
 * Claude에게 frameworkResults를 JSON에 포함하도록 지시한다.
 */
export function buildHeuristicLayer(params: HeuristicSystemPromptParams): string {
  const { frameworkIds, language } = params;
  const isKo = language === "ko";

  const byCategory = getFrameworksByCategory(frameworkIds);
  const lines: string[] = [];

  // 카테고리별 프레임워크 목록
  const sectionTitle = isKo
    ? "## UX 프레임워크 평가 (추가 분석 레이어)"
    : "## UX Framework Evaluation (Additional Analysis Layer)";
  lines.push(sectionTitle);

  lines.push(
    isKo
      ? "위 분석에 더하여, 아래 UX 프레임워크 기준으로 **각 항목을 별도 평가**하라:"
      : "In addition to the above analysis, **evaluate each item separately** against these UX frameworks:"
  );

  for (const [category, frameworks] of Object.entries(byCategory)) {
    if (frameworks.length === 0) continue;
    const catLabel = isKo
      ? { nielsen: "닐슨 사용성 휴리스틱", "ux-laws": "UX 법칙", accessibility: "접근성" }[category]
      : { nielsen: "Nielsen's Usability Heuristics", "ux-laws": "UX Laws", accessibility: "Accessibility" }[category];
    lines.push(`\n### ${catLabel}`);
    for (const f of frameworks) {
      lines.push(
        isKo
          ? `- **[${f.id}] ${f.nameKo}**: ${f.evalPromptKo}`
          : `- **[${f.id}] ${f.nameEn}**: ${f.evalPromptEn}`
      );
    }
  }

  // JSON 출력 지시
  const jsonInstruction = isKo
    ? `\n위 프레임워크 평가 결과를 **최상위 JSON 필드 \`frameworkResults\`**로 반드시 포함하라.

\`\`\`json
"frameworkResults": [
  {
    "frameworkId": "N1",
    "nameKo": "시스템 상태 가시성",
    "score": 7,
    "status": "partial",
    "findings": ["로딩 스피너는 있으나 진행률이 표시되지 않음", "성공 피드백 메시지 없음"],
    "recommendation": "진행률 표시 및 완료 토스트 메시지 추가 권장"
  }
]
\`\`\`
- \`score\`: 0–10 (10점 만점)
- \`status\`: \`"pass"\`(8점+) | \`"partial"\`(5–7점) | \`"fail"\`(4점 이하)
- \`findings\`: 화면에서 발견한 구체적 증거 (잘 된 점 + 개선 필요 점)
- \`recommendation\`: 한 문장으로 가장 중요한 개선 제안`
    : `\nInclude the framework evaluation results as a top-level JSON field \`frameworkResults\`.

\`\`\`json
"frameworkResults": [
  {
    "frameworkId": "N1",
    "nameKo": "시스템 상태 가시성",
    "score": 7,
    "status": "partial",
    "findings": ["Loading spinner exists but no progress indicator", "No success feedback message"],
    "recommendation": "Add progress indicator and completion toast message"
  }
]
\`\`\`
- \`score\`: 0–10
- \`status\`: \`"pass"\`(8+) | \`"partial"\`(5–7) | \`"fail"\`(4 or below)
- \`findings\`: Concrete evidence from the screen
- \`recommendation\`: Single most important improvement suggestion`;

  lines.push(jsonInstruction);

  return lines.join("\n");
}

/**
 * 프레임워크 ID 목록을 받아 유효한 것만 필터링한다.
 */
export function validateFrameworkIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id in FRAMEWORK_MAP);
}
