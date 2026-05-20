// ─── UX Evaluation Framework Registry ───────────────────────────────────────
// FRAMEWORK_MAP: 사용 가능한 평가 프레임워크 정의
// parseFrameworkResponse: Claude 응답에서 frameworkResults 파싱

export type FrameworkCategory = "nielsen" | "ux-laws" | "accessibility";

export interface Framework {
  id: string;
  nameKo: string;
  nameEn: string;
  category: FrameworkCategory;
  shortDescKo: string;
  shortDescEn: string;
  evalPromptKo: string; // buildHeuristicSystemPrompt에서 사용할 평가 지시문
  evalPromptEn: string;
}

export interface FrameworkResult {
  frameworkId: string;
  nameKo: string;
  score: number;        // 0–10
  status: "pass" | "partial" | "fail";
  findings: string[];   // 발견된 문제 / 잘 된 점
  recommendation: string;
}

// ─── Framework 정의 ──────────────────────────────────────────────────────────

export const FRAMEWORK_MAP: Record<string, Framework> = {
  // ── Nielsen's 10 Usability Heuristics ──
  "N1": {
    id: "N1",
    nameKo: "시스템 상태 가시성",
    nameEn: "Visibility of System Status",
    category: "nielsen",
    shortDescKo: "시스템이 현재 무엇을 하고 있는지 사용자에게 항상 알려야 한다",
    shortDescEn: "Keep users informed about what is going on through feedback",
    evalPromptKo: "로딩 상태, 진행률, 피드백 메시지 등이 명확히 표시되는가?",
    evalPromptEn: "Are loading states, progress indicators, and feedback messages clearly visible?",
  },
  "N2": {
    id: "N2",
    nameKo: "실세계와의 일치",
    nameEn: "Match Between System and the Real World",
    category: "nielsen",
    shortDescKo: "사용자의 언어와 익숙한 개념을 사용해야 한다",
    shortDescEn: "Speak the users' language using familiar words and real-world conventions",
    evalPromptKo: "아이콘, 레이블, 용어가 사용자에게 자연스럽고 친숙한가?",
    evalPromptEn: "Are icons, labels, and terms natural and familiar to the user?",
  },
  "N3": {
    id: "N3",
    nameKo: "사용자 자유도와 통제",
    nameEn: "User Control and Freedom",
    category: "nielsen",
    shortDescKo: "실수를 쉽게 되돌릴 수 있어야 한다",
    shortDescEn: "Users often choose functions by mistake; provide clear emergency exits",
    evalPromptKo: "뒤로 가기, 취소, 실행 취소 등 이탈·복구 경로가 명확한가?",
    evalPromptEn: "Are back, cancel, and undo paths clearly available?",
  },
  "N4": {
    id: "N4",
    nameKo: "일관성과 표준",
    nameEn: "Consistency and Standards",
    category: "nielsen",
    shortDescKo: "같은 개념은 같은 방식으로 표현해야 한다",
    shortDescEn: "Follow platform conventions and keep design consistent",
    evalPromptKo: "버튼 스타일, 색상, 타이포그래피, 용어가 화면 전체에서 일관되는가?",
    evalPromptEn: "Are button styles, colors, typography, and terminology consistent across screens?",
  },
  "N5": {
    id: "N5",
    nameKo: "오류 방지",
    nameEn: "Error Prevention",
    category: "nielsen",
    shortDescKo: "오류가 발생하기 전에 미리 방지해야 한다",
    shortDescEn: "Design carefully to prevent problems from occurring in the first place",
    evalPromptKo: "위험한 동작 전에 확인 요청, 입력 제약, 안내 문구가 있는가?",
    evalPromptEn: "Are there confirmations, constraints, or warnings before risky actions?",
  },
  "N6": {
    id: "N6",
    nameKo: "기억보다 인지",
    nameEn: "Recognition Rather Than Recall",
    category: "nielsen",
    shortDescKo: "사용자가 기억하지 않아도 되도록 UI에서 정보를 보여줘야 한다",
    shortDescEn: "Minimize memory load by making objects, actions, and options visible",
    evalPromptKo: "사용자가 이전 선택이나 진행 상황을 기억하지 않아도 화면에서 파악할 수 있는가?",
    evalPromptEn: "Can users understand context without having to remember previous steps?",
  },
  "N7": {
    id: "N7",
    nameKo: "유연성과 효율성",
    nameEn: "Flexibility and Efficiency of Use",
    category: "nielsen",
    shortDescKo: "초보자와 전문가 모두를 위한 경로가 있어야 한다",
    shortDescEn: "Accelerators allow expert users to speed up interaction",
    evalPromptKo: "자주 쓰는 기능에 빠른 접근 방법이 있는가? 숙련 사용자를 위한 단축 경로가 있는가?",
    evalPromptEn: "Are there shortcuts or quick paths for frequent actions for power users?",
  },
  "N8": {
    id: "N8",
    nameKo: "심미성과 간결한 디자인",
    nameEn: "Aesthetic and Minimalist Design",
    category: "nielsen",
    shortDescKo: "불필요한 정보는 핵심 정보를 희석시킨다",
    shortDescEn: "Avoid irrelevant or rarely needed information that competes with relevant info",
    evalPromptKo: "화면에 불필요한 요소, 과도한 텍스트, 시각적 노이즈가 없는가?",
    evalPromptEn: "Is the screen free of unnecessary elements, excessive text, and visual noise?",
  },
  "N9": {
    id: "N9",
    nameKo: "오류 인식·진단·복구",
    nameEn: "Error Recognition, Diagnosis, Recovery",
    category: "nielsen",
    shortDescKo: "오류 메시지는 명확하고 해결책을 제시해야 한다",
    shortDescEn: "Error messages should be expressed in plain language, precisely indicate the problem, and suggest a solution",
    evalPromptKo: "오류 메시지가 사용자 언어로 작성되고 구체적인 해결 방법을 안내하는가?",
    evalPromptEn: "Are error messages written in plain language with specific recovery instructions?",
  },
  "N10": {
    id: "N10",
    nameKo: "도움말과 문서",
    nameEn: "Help and Documentation",
    category: "nielsen",
    shortDescKo: "도움말이 필요 없는 것이 최선이지만, 있다면 쉽게 찾을 수 있어야 한다",
    shortDescEn: "Help information should be easy to search and focused on the user's task",
    evalPromptKo: "어려운 기능에 대한 인라인 가이드, 툴팁, 온보딩이 있는가?",
    evalPromptEn: "Are there inline guides, tooltips, or onboarding for complex features?",
  },

  // ── UX Laws ──
  "fitts": {
    id: "fitts",
    nameKo: "피츠의 법칙",
    nameEn: "Fitts's Law",
    category: "ux-laws",
    shortDescKo: "터치/클릭 대상은 충분히 크고, 이동 거리가 짧을수록 좋다",
    shortDescEn: "Interactive targets should be large enough and close to the user's path",
    evalPromptKo: "버튼과 터치 타깃이 충분히 크고(최소 44px), 주요 동작 버튼이 손이 닿기 쉬운 위치에 있는가?",
    evalPromptEn: "Are buttons and touch targets large enough (min 44px) and placed within easy reach?",
  },
  "hick": {
    id: "hick",
    nameKo: "힉의 법칙",
    nameEn: "Hick's Law",
    category: "ux-laws",
    shortDescKo: "선택지가 많을수록 결정 시간이 길어진다",
    shortDescEn: "Increasing the number of choices increases decision time logarithmically",
    evalPromptKo: "한 화면의 선택지 수가 과도하지 않은가? 메뉴나 옵션이 적절히 그룹화되어 있는가?",
    evalPromptEn: "Is the number of choices on screen manageable? Are options well-grouped?",
  },
  "miller": {
    id: "miller",
    nameKo: "밀러의 법칙",
    nameEn: "Miller's Law",
    category: "ux-laws",
    shortDescKo: "사람은 한 번에 7±2개 항목을 단기 기억으로 처리할 수 있다",
    shortDescEn: "The average person can keep only 7±2 items in working memory at a time",
    evalPromptKo: "리스트나 메뉴 항목이 7개 이하로 그룹화되어 있는가? 정보가 청크 단위로 제공되는가?",
    evalPromptEn: "Are list and menu items chunked into groups of 7 or fewer?",
  },
  "proximity": {
    id: "proximity",
    nameKo: "근접성의 법칙",
    nameEn: "Law of Proximity",
    category: "ux-laws",
    shortDescKo: "가까운 요소들은 관련 있다고 인식된다",
    shortDescEn: "Objects near each other are perceived as belonging together",
    evalPromptKo: "관련 있는 요소들이 시각적으로 가깝게 배치되고, 관련 없는 요소들은 충분히 분리되어 있는가?",
    evalPromptEn: "Are related elements visually grouped, and unrelated elements properly separated?",
  },
  "serial": {
    id: "serial",
    nameKo: "계열 위치 효과",
    nameEn: "Serial Position Effect",
    category: "ux-laws",
    shortDescKo: "사용자는 리스트의 첫 번째와 마지막 항목을 가장 잘 기억한다",
    shortDescEn: "Users remember the first and last items in a list best",
    evalPromptKo: "핵심 CTA나 중요 정보가 화면의 처음 또는 마지막 위치에 배치되어 있는가?",
    evalPromptEn: "Are key CTAs or important information placed at the beginning or end of the screen?",
  },

  // ── Accessibility ──
  "wcag-contrast": {
    id: "wcag-contrast",
    nameKo: "색상 대비",
    nameEn: "Color Contrast (WCAG)",
    category: "accessibility",
    shortDescKo: "텍스트와 배경의 대비율은 최소 4.5:1 (AA 기준)이어야 한다",
    shortDescEn: "Text and background contrast ratio must be at least 4.5:1 (WCAG AA)",
    evalPromptKo: "텍스트와 배경색의 대비가 충분한가? 작은 텍스트, 회색 텍스트에 주의하라.",
    evalPromptEn: "Is there sufficient contrast between text and background? Pay attention to small or gray text.",
  },
  "wcag-readability": {
    id: "wcag-readability",
    nameKo: "텍스트 가독성",
    nameEn: "Text Readability (WCAG)",
    category: "accessibility",
    shortDescKo: "본문 텍스트는 최소 16px, 중요 정보는 더 크게",
    shortDescEn: "Body text should be at least 16px, important content even larger",
    evalPromptKo: "텍스트 크기가 가독성을 보장하는가? 줄 간격, 글자 간격이 읽기 편한가?",
    evalPromptEn: "Is text size adequate for readability? Are line-height and letter-spacing comfortable?",
  },
};

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Claude 응답에서 frameworkResults 배열을 파싱한다.
 * 응답 JSON에 "frameworkResults" 배열이 있으면 그걸 사용하고,
 * 없으면 빈 배열을 반환한다.
 */
export function parseFrameworkResponse(
  rawText: string,
  frameworkIds: string[],
): FrameworkResult[] {
  try {
    // JSON 블록에서 frameworkResults 배열 추출
    const jsonMatch = rawText.match(/"frameworkResults"\s*:\s*\[[\s\S]*?\](?=\s*[,}])/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(`{"frameworkResults":${jsonMatch[0].replace(/^"frameworkResults"\s*:\s*/, "")}}`);
    const results: FrameworkResult[] = parsed.frameworkResults;

    // 요청한 frameworkId에 해당하는 결과만 반환 + nameKo 보완
    return results
      .filter((r) => frameworkIds.includes(r.frameworkId))
      .map((r) => ({
        ...r,
        nameKo: r.nameKo || FRAMEWORK_MAP[r.frameworkId]?.nameKo || r.frameworkId,
        score: Math.min(10, Math.max(0, Number(r.score) || 0)),
        status: (["pass", "partial", "fail"].includes(r.status) ? r.status : "partial") as FrameworkResult["status"],
        findings: Array.isArray(r.findings) ? r.findings : [],
        recommendation: r.recommendation || "",
      }));
  } catch {
    return [];
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

export function getFrameworksByCategory(
  ids: string[],
): Record<FrameworkCategory, Framework[]> {
  const result: Record<FrameworkCategory, Framework[]> = {
    nielsen: [],
    "ux-laws": [],
    accessibility: [],
  };
  for (const id of ids) {
    const f = FRAMEWORK_MAP[id];
    if (f) result[f.category].push(f);
  }
  return result;
}
