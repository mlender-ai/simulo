// Simulo Figma Plugin — UI logic (iframe side)
// Communicates with plugin sandbox via parent.postMessage.

import { t, setLang, getLang, type Lang } from "./i18n";

interface ExtractedText {
  text: string;
  parentName: string;
  fontSize: number | null;
  fontWeight: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface ImageItem {
  name: string;
  nodeId?: string;
  base64: string;
  texts?: ExtractedText[];
}

interface AnalysisResult {
  verdict: string;
  score: number;
  summary: string;
  strengths?: string[];
  taskSuccessLikelihood?: string;
  thinkAloud?: { screen: string; thought: string }[];
  issues?: { screen: string; severity: string; issue: string; recommendation: string }[];
}

interface WritingIssue {
  location: string;
  original: string;
  suggestion: string;
  reason: string;
  severity: "critical" | "warning" | "info";
  principle: string;
}

interface ScreenLevel {
  hasOneKeyMessage: boolean;
  hasWordRepetition: boolean;
  repeatedWords: string[];
  ctaCount: number;
  ctaClarity: string;
}

interface WritingCheckResult {
  summary: string;
  score: number;
  issues: WritingIssue[];
  strengths: string[];
  frameName: string;
  figmaNodeId?: string;
  screenLevel?: ScreenLevel;
}

let selectedImages: ImageItem[] = [];
let pendingVariantNodeId: string | null = null;
let multiResults: (AnalysisResult & { _frameName?: string })[] = [];
let currentResultIndex = 0;
let pendingMultiAnalysis = false;
let analysisMode: "hypothesis" | "usability" = "hypothesis";
let lastWritingResults: WritingCheckResult[] = [];
let lastFileKey = "";
let appliedFixes = new Set<string>(); // "frameIdx-issueIdx" tracking
let freeMode = false; // API 키 없거나 초과 시 true

// ── Chat interface types ──
interface FrameInfo {
  nodeId: string;
  nodeName: string;
  imageBase64: string;
  width: number;
  height: number;
  parentName: string;
  order: number;
  texts: ExtractedText[];
}

interface ChatMessage {
  id: string;
  role: "bot" | "user" | "system";
  content: string;
  labels?: { id: string; name: string }[];
  followUps?: { id: string; label: string; contextValue: string }[];
  miniReport?: LiveMiniReport | null;
  actions?: { id: string; label: string; primary?: boolean }[];
  streaming?: boolean;
}

interface LiveMiniReport {
  quickSummary: string;
  findings: Array<{
    criterion: string;
    severity: number;
    oneLineFinding: string;
    detail: string;
    fix: string;
  }>;
  nextQuestion: string | null;
}

interface ContextStack {
  frames: FrameInfo[];
  frameMode: "single" | "compare" | "flow" | "separate" | null;
  intent: string | null;
  subContext: string | null;
  persona: { id: string; label: string; promptContext: string } | null;
  pipeline: string[];
  results: TurnResult[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  lastReport: LiveMiniReport | null;
  selectedCategory: string | null;
}

const HINT_CHIPS = [
  { label: "전체 분석",  text: "전체 분석해줘" },
  { label: "A/B 변형",  text: "A/B 변형 만들어줘" },
  { label: "카피 다듬기", text: "카피 다듬어줘" },
  { label: "경쟁사 비교", text: "경쟁사와 비교해줘" },
  { label: "사용성 점검", text: "사용성 점검해줘" },
  { label: "CTA 분석",  text: "CTA 분석해줘" },
  { label: "개선안 제안", text: "개선안 제안해줘" },
];

let chipsHidden = false;

let chatMessages: ChatMessage[] = [];
let contextStack: ContextStack = {
  frames: [], frameMode: null,
  intent: null, subContext: null,
  persona: null, pipeline: [],
  results: [],
  conversationHistory: [], lastReport: null,
  selectedCategory: null,
};
let chatAnalyzing = false;
let chatAbortController: AbortController | null = null;

// ── Phase B: Intent Router ──

interface IntentDetectionResult {
  intent: string;
  axis?: string;
  subContext?: string;
  confidence: number;
  source: "keyword" | "haiku";
}

interface TurnResult {
  intent: string;
  pipeline: string[];
  output: LiveMiniReport | null;
  timestamp: number;
}

const KEYWORD_INTENT_MAP: Array<{ keywords: string[]; intent: string; axis?: string }> = [
  { keywords: ["전체", "전반", "봐줘", "검토", "분석해", "뭐가 문제", "어때", "어떤지", "살펴", "전반적"], intent: "full-scan" },
  { keywords: ["광고", "배너", "리워드 광고"], intent: "analyze-axis", axis: "ad-buffer" },
  { keywords: ["적립", "포인트", "체감", "쌓이", "마일리지 체감"], intent: "analyze-axis", axis: "earning-motivation" },
  { keywords: ["재방문", "리텐션", "스트릭", "푸시", "재접속", "다시 와"], intent: "analyze-axis", axis: "retention-trigger" },
  { keywords: ["교환", "출금", "기프티콘", "환전", "마일리지샵"], intent: "analyze-axis", axis: "exchange-trust" },
  { keywords: ["카피", "문구", "워딩", "다듬", "텍스트 고쳐", "바꿔줘", "라이팅", "문장 고쳐"], intent: "copy-rewrite" },
  { keywords: ["A/B", "a/b", "ab", "변형", "테스트", "실험안"], intent: "ab-variant" },
  { keywords: ["비교", "경쟁사", "머니워크", "돈이돼지", "타사", "competitor"], intent: "competitor-compare" },
  { keywords: ["개선안", "개선해줘", "어떻게 고치", "솔루션", "제안해줘"], intent: "suggestion" },
  { keywords: ["상태 누락", "빈 화면", "empty state", "에러 상태", "로딩 상태", "상태 커버리지", "빠진 상태", "상태 감사", "상태 점검"], intent: "state-audit" },
  { keywords: ["일관성", "텍스트 통일", "같은 표현", "용어 혼용", "표현 불일치", "텍스트 일관", "워딩 통일"], intent: "text-consistency" },
  { keywords: ["타이포", "텍스트 위계", "글자 위계", "폰트 위계", "위계 역전", "시각 가중치", "위계 오류", "위계 검증", "장식 텍스트", "CTA보다 큰", "중요도 역전"], intent: "typography-hierarchy" },
];

const INTENT_TO_CATEGORY: Record<string, string> = {
  "full-scan":          "scan",
  "analyze-axis":       "scan",
  "copy-rewrite":       "writing",
  "ab-variant":         "scan",
  "competitor-compare": "scan",
  "suggestion":         "scan",
  "state-audit":           "scan",
  "text-consistency":      "scan",
  "typography-hierarchy":  "scan",
  "flow-analysis":         "scan",
  "compound":           "scan",
  "usability":          "usability",
  "visual":             "visual",
  "cta":                "cta",
};

const DIRECTION_CHANGE_KEYWORDS = ["잠깐", "아니", "아 그게 아니라", "다시 봐줘", "다른 걸로", "바꿔서", "쪽으로 봐줘", "말고", "대신에"];

const PERSONA_KEYWORDS: Array<{ keywords: string[]; id: string; label: string; promptContext: string }> = [
  { keywords: ["시니어", "노인", "어르신", "60대", "고령"], id: "senior", label: "시니어(60+)", promptContext: "시니어(60대 이상). 기술 친숙도 낮음, 작은 글씨 읽기 어려움, 복잡한 단계 혼란 유발." },
  { keywords: ["초보", "비친숙", "처음 쓰는", "입문자"], id: "novice", label: "기술 비친숙", promptContext: "기술 비친숙 사용자. 스마트폰 기본 조작만 가능, 전문 용어 이해 불가, 실수 시 당황." },
  { keywords: ["글로벌", "외국인", "비원어민"], id: "global", label: "글로벌(비원어민)", promptContext: "글로벌 비원어민 사용자. 한국어 읽기 불가, 아이콘/시각 단서에 의존, 문화적 맥락 차이." },
  { keywords: ["시각장애", "저시력", "접근성"], id: "a11y", label: "접근성", promptContext: "저시력/시각장애 사용자. 스크린 리더 사용, 고대비 필요, 색상만으로 정보 전달 불가." },
];

function detectPersonaFromText(text: string): { id: string; label: string; promptContext: string } | null {
  const lower = text.toLowerCase();
  for (const entry of PERSONA_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { id: entry.id, label: entry.label, promptContext: entry.promptContext };
    }
  }
  return null;
}

function detectIntentByKeyword(text: string): IntentDetectionResult | null {
  const lower = text.toLowerCase();
  for (const entry of KEYWORD_INTENT_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return { intent: entry.intent, axis: entry.axis, confidence: 0.9, source: "keyword" };
    }
  }
  return null;
}

async function detectIntentByHaiku(text: string): Promise<IntentDetectionResult> {
  const apiKey = getApiKey();
  const baseUrl = getSimuloBaseUrl();
  const convSummary = contextStack.conversationHistory
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 80)}`)
    .join("\n");

  const prompt = `사용자가 Figma 플러그인에서 디자인 프레임을 선택한 뒤 다음과 같이 말했습니다:
"${text}"

이전 대화:
${convSummary || "(없음)"}

아래 intent 중 가장 적합한 것 1개를 선택하세요.
- full-scan: 화면 전체 종합 분석
- analyze-axis: 특정 관점(광고, 적립, 재방문, 교환) 분석
- copy-rewrite: 화면 텍스트/카피 개선
- ab-variant: A/B 테스트 변형 생성
- competitor-compare: 경쟁사 비교
- suggestion: 구체적 개선안 요청
- flow-analysis: 여러 화면 흐름 분석
- typography-hierarchy: 타이포그래피 시각 위계 검증 (폰트 크기·굵기 vs 정보 중요도 역전 탐지)

JSON만 응답:
{"intent":"...","axis":"ad-buffer|earning-motivation|retention-trigger|exchange-trust|null","subContext":"추출된 맥락 또는 null","confidence":0.0}`;

  try {
    let raw: string;
    if (apiKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL_MAP.haiku,
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json() as { content: Array<{ text: string }> };
      raw = data.content?.[0]?.text ?? "{}";
    } else {
      const res = await fetch(`${baseUrl}/api/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userText: text, conversationSummary: convSummary }),
      });
      const data = await res.json() as Record<string, unknown>;
      raw = JSON.stringify(data);
    }
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { intent?: string; axis?: string; subContext?: string; confidence?: number };
    return {
      intent: parsed.intent || "full-scan",
      axis: parsed.axis && parsed.axis !== "null" ? parsed.axis : undefined,
      subContext: parsed.subContext && parsed.subContext !== "null" ? parsed.subContext : undefined,
      confidence: parsed.confidence ?? 0.5,
      source: "haiku",
    };
  } catch {
    return { intent: "full-scan", confidence: 0.3, source: "haiku" };
  }
}

function isDirectionChange(text: string): boolean {
  return DIRECTION_CHANGE_KEYWORDS.some((kw) => text.includes(kw));
}

function getLabelsForState(ctx: ContextStack): { id: string; name: string }[] {
  // No intent → initial labels
  if (!ctx.intent) {
    return [
      { id: "full-scan",            name: "전체 스캔" },
      { id: "usability",            name: "사용성 검증" },
      { id: "copy-rewrite",         name: "카피 다듬기" },
      { id: "ab-variant",           name: "A/B 변형" },
      { id: "competitor-compare",   name: "경쟁사 비교" },
      { id: "typography-hierarchy", name: "타이포 위계" },
    ];
  }

  // After results → post-result labels
  if (ctx.results && ctx.results.length > 0) {
    return getPostResultLabels(ctx);
  }

  return [];
}

function getPostResultLabels(ctx: ContextStack): { id: string; name: string }[] {
  const labels: { id: string; name: string }[] = [];
  const lastIntent = ctx.results?.[ctx.results.length - 1]?.intent;

  if (lastIntent !== "copy-rewrite")       labels.push({ id: "copy-rewrite",       name: "카피도 바꿔줘" });
  if (lastIntent !== "ab-variant")         labels.push({ id: "ab-variant",         name: "A/B안 만들어줘" });
  if (lastIntent !== "competitor-compare") labels.push({ id: "competitor-compare", name: "경쟁사는?" });
  labels.push({ id: "__new-frame", name: "다른 프레임 보기" });
  return labels;
}

const FOLLOW_UP_TREE: Record<string, { question: string; options: { id: string; label: string; contextValue: string }[] }> = {
  usability: {
    question: "어떤 사용 맥락에서 이 화면을 보나요?",
    options: [
      { id: "onboarding", label: "신규 사용자 첫 경험", contextValue: "신규 사용자가 처음 보는 화면입니다. 학습 없이도 다음 행동이 명확한지, 혼란 요소가 없는지 집중 평가하세요." },
      { id: "core",       label: "반복 사용자 핵심 기능", contextValue: "이미 앱에 익숙한 반복 사용자가 핵심 기능을 사용하는 화면입니다. 효율성과 피로도에 집중하세요." },
      { id: "conversion", label: "전환/완료 직전 단계",  contextValue: "사용자가 구매, 가입, 미션 완료 등 핵심 전환 직전의 화면입니다. 마지막 장벽과 불안 요소를 집중 분석하세요." },
    ],
  },
  writing: {
    question: "어떤 텍스트 요소를 집중 검토할까요?",
    options: [
      { id: "headline",  label: "헤드라인·제목",    contextValue: "화면의 헤드라인과 주요 제목 텍스트를 집중 분석합니다. 명확성, 감정, 행동 유도 여부를 평가하세요." },
      { id: "cta-label", label: "버튼·CTA 레이블",  contextValue: "버튼과 CTA 레이블의 명확성을 집중 분석합니다. 클릭 후 어떤 일이 일어날지 예측 가능한지 평가하세요." },
      { id: "guide",     label: "안내문·도움말",     contextValue: "안내 문구, 설명 텍스트, 마이크로카피를 집중 분석합니다. 필요한 정보를 최소 언어로 전달하는지 평가하세요." },
    ],
  },
  visual: {
    question: "시각 요소 중 어디를 집중 검토할까요?",
    options: [
      { id: "hierarchy", label: "정보 계층·레이아웃", contextValue: "화면의 정보 계층과 레이아웃을 집중 분석합니다. 사용자 시선이 중요도 순서대로 이동하는지 평가하세요." },
      { id: "contrast",  label: "색상·대비·가독성",  contextValue: "색상 사용과 대비, 텍스트 가독성을 집중 분석합니다. WCAG 대비 기준 충족 여부와 접근성을 확인하세요." },
      { id: "density",   label: "여백·밀도·집중도",  contextValue: "여백 사용과 정보 밀도를 집중 분석합니다. 과부하 없이 핵심에 집중하게 만드는지 평가하세요." },
    ],
  },
  cta: {
    question: "전환 흐름의 어느 부분을 검토할까요?",
    options: [
      { id: "button", label: "CTA 버튼 명확성",  contextValue: "CTA 버튼의 명확성과 시각적 우선순위를 집중 분석합니다. 가장 중요한 행동이 즉시 눈에 띄는지 확인하세요." },
      { id: "form",   label: "폼/입력 흐름",     contextValue: "입력 폼의 흐름과 마찰 요소를 집중 분석합니다. 완료까지의 인지 부하와 입력 오류 가능성을 평가하세요." },
      { id: "trust",  label: "신뢰·불안 요소",   contextValue: "전환을 방해하는 불안 요소와 신뢰를 높이는 요소를 분석합니다. 사용자가 주저하게 만드는 모든 마찰을 찾으세요." },
    ],
  },
};
let googleTokens: { access_token: string; refresh_token: string; expiry_date?: number } | null = null;
let savedSpreadsheetId = "";
let googleAuthPollTimer: ReturnType<typeof setInterval> | null = null;

const MODEL_MAP = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-20250514",
} as const;

function getSelectedModel(): string {
  const sel = $<HTMLSelectElement>("modelSelect");
  return MODEL_MAP[(sel?.value as keyof typeof MODEL_MAP) || "haiku"];
}

function checkFreeMode() {
  const apiKey = getApiKey();
  freeMode = !apiKey;
  $("freeModeBanner").className = freeMode ? "free-mode-banner visible" : "free-mode-banner";
}

// -------- DOM helpers --------
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function showHintChips() {
  if (chipsHidden) return;
  $("hint-chips")?.classList.remove("hidden");
}

function hideHintChips() {
  chipsHidden = true;
  $("hint-chips")?.classList.add("hidden");
}

/**
 * Figma 텍스트 노드를 서버 OCR 패스 없이 Claude에 전달하기 위한 컨텍스트 문자열로 변환.
 * 이미지 OCR 대신 이 값을 사용하면 한국어 텍스트 오독 문제가 없어짐.
 */
function buildFigmaOcrContext(images: ImageItem[], frameWidths?: number[], frameHeights?: number[]): string {
  const screens = images.map((img, si) => {
    if (!img.texts || img.texts.length === 0) return `화면 ${si + 1} (${img.name}): (텍스트 없음)`;
    const fw = frameWidths?.[si];
    const fh = frameHeights?.[si];
    // Compute frame origin from first text node
    let frameOriginX = Infinity;
    let frameOriginY = Infinity;
    if (fw && fh) {
      for (const tx of img.texts) {
        if (tx.x !== undefined && tx.x < frameOriginX) frameOriginX = tx.x;
        if (tx.y !== undefined && tx.y < frameOriginY) frameOriginY = tx.y;
      }
    }
    const lines = img.texts.map((tx) => {
      const role = tx.fontSize && tx.fontSize >= 20 ? "heading"
        : tx.fontWeight === "bold" ? "label"
        : tx.parentName.toLowerCase().includes("button") || tx.parentName.toLowerCase().includes("btn") || tx.parentName.toLowerCase().includes("cta") ? "button"
        : "body";
      let coord = "";
      if (fw && fh && tx.x !== undefined && tx.y !== undefined && tx.width !== undefined && tx.height !== undefined) {
        const ox = isFinite(frameOriginX) ? frameOriginX : 0;
        const oy = isFinite(frameOriginY) ? frameOriginY : 0;
        const xPct = Math.round(((tx.x - ox) / fw) * 100);
        const yPct = Math.round(((tx.y - oy) / fh) * 100);
        const wPct = Math.round((tx.width / fw) * 100);
        const hPct = Math.round((tx.height / fh) * 100);
        coord = ` [x=${xPct}%, y=${yPct}%, w=${wPct}%, h=${hPct}%]`;
      }
      const sizeTag = tx.fontSize ? ` fs=${tx.fontSize}` : "";
      const boldTag = tx.fontWeight === "bold" ? " bold" : "";
      return `  [${role}${sizeTag}${boldTag}${coord}] "${tx.text}"`;
    });
    return `화면 ${si + 1} (${img.name}):\n${lines.join("\n")}`;
  });
  return `=== Figma 실제 텍스트 (OCR 오차 없음, 100% 정확) ===\n아래 텍스트는 Figma 디자인 파일에서 직접 추출한 것으로, 이미지 OCR 없이 정확합니다. 반드시 이 텍스트를 기준으로 분석하세요.\n\n${screens.join("\n\n")}`;
}

function buildTypographyWeightContext(frames: FrameInfo[]): string {
  interface WeightedText { frameName: string; text: string; fontSize: number; isBold: boolean; weight: number; }
  const all: WeightedText[] = [];
  for (const f of frames) {
    if (!f.texts?.length) continue;
    for (const t of f.texts) {
      const size = t.fontSize ?? 14;
      const bold = t.fontWeight === "bold";
      all.push({ frameName: f.nodeName, text: t.text, fontSize: size, isBold: bold, weight: size * (bold ? 1.5 : 1.0) });
    }
  }
  if (all.length === 0) return "";
  all.sort((a, b) => b.weight - a.weight);

  const topN = Math.min(15, all.length);
  const topLines = all.slice(0, topN).map((t, i) => {
    const boldTag = t.isBold ? " 볼드" : "";
    return `${i + 1}. [가중치=${t.weight.toFixed(0)} fs=${t.fontSize}${boldTag}] "${t.text}" (${t.frameName})`;
  });
  const allLines = all.map((t) => {
    const boldTag = t.isBold ? " bold" : "";
    return `  [${t.fontSize}px${boldTag}] "${t.text}" (${t.frameName})`;
  });

  return `\n=== 타이포그래피 위계 분석 데이터 (시각 가중치 = fontSize × (볼드?1.5:1.0)) ===
[시각 가중치 TOP ${topN} — 가장 눈에 띄는 텍스트]:
${topLines.join("\n")}

[전체 텍스트 목록 (${all.length}개)]:
${allLines.join("\n")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -------- Initialization --------
// -------- i18n helpers --------
function applyI18n() {
  // Settings panel labels
  const allLabels = document.querySelectorAll("#settingsPanel label");
  if (allLabels[0]) allLabels[0].textContent = t("settings.apiKeyLabel");
  if (allLabels[1]) allLabels[1].textContent = t("settings.modelLabel");
  if (allLabels[2]) allLabels[2].textContent = t("settings.simuloUrlLabel");
  if (allLabels[3]) allLabels[3].textContent = t("settings.langLabel");

  const hints = document.querySelectorAll("#settingsPanel .settings-hint");
  if (hints[0]) hints[0].textContent = t("settings.apiKeyHint");
  if (hints[1]) hints[1].textContent = t("settings.modelHint");
  if (hints[2]) hints[2].textContent = t("settings.simuloUrlHint");

  const haikuOpt = $<HTMLSelectElement>("modelSelect")?.options[0];
  if (haikuOpt) haikuOpt.text = t("settings.modelHaiku");
  const sonnetOpt = $<HTMLSelectElement>("modelSelect")?.options[1];
  if (sonnetOpt) sonnetOpt.text = t("settings.modelSonnet");

  // Free mode banner
  const freeModeBanner = $("freeModeBanner");
  if (freeModeBanner) freeModeBanner.textContent = t("freeMode.banner");

  updateSheetsButtonState();
}

window.addEventListener("DOMContentLoaded", () => {
  // Restore previous chat session
  const restored = loadChatHistory();
  if (restored.length > 0) {
    chatMessages = [
      { id: chatId(), role: "system" as const, content: "── 이전 세션 ──" },
      ...restored,
    ];
    renderMessages();
  }

  // Load settings from plugin storage
  parent.postMessage({ pluginMessage: { type: "load-api-key" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-simulo-url" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-language" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-model" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-google-tokens" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-spreadsheet-id" } }, "*");

  // Settings toggle
  $("settingsBtn").addEventListener("click", () => {
    const panel = $("settingsPanel");
    const btn = $("settingsBtn");
    const isVisible = panel.classList.toggle("visible");
    btn.classList.toggle("active", isVisible);
  });

  // Settings changes
  $("apiKey").addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    if (val) parent.postMessage({ pluginMessage: { type: "save-api-key", key: val } }, "*");
    checkFreeMode();
  });
  $("modelSelect").addEventListener("change", (e) => {
    parent.postMessage({ pluginMessage: { type: "save-model", model: (e.target as HTMLSelectElement).value } }, "*");
  });
  $("simuloUrl").addEventListener("change", (e) => {
    parent.postMessage({ pluginMessage: { type: "save-simulo-url", url: (e.target as HTMLInputElement).value.trim() } }, "*");
  });
  $("langSelect").addEventListener("change", (e) => {
    const lang = (e.target as HTMLSelectElement).value as Lang;
    setLang(lang);
    parent.postMessage({ pluginMessage: { type: "save-language", lang } }, "*");
    applyI18n();
  });

  // Hint chips setup
  const hintChipsEl = $("hint-chips");
  if (hintChipsEl) {
    hintChipsEl.innerHTML = HINT_CHIPS.map((c) =>
      `<button class="hint-chip" data-text="${escapeHtml(c.text)}">${escapeHtml(c.label)}</button>`
    ).join("");
    hintChipsEl.querySelectorAll(".hint-chip").forEach((btn) => {
      (btn as HTMLElement).addEventListener("click", () => {
        const text = (btn as HTMLElement).dataset.text ?? "";
        const inputEl = $<HTMLInputElement>("chatInput");
        inputEl.value = text;
        handleChatInput(text);
        inputEl.value = "";
      });
    });
  }

  // Chat input
  const chatInputEl = $<HTMLInputElement>("chatInput");
  const chatSendBtnEl = $<HTMLButtonElement>("chatSendBtn");
  chatInputEl.addEventListener("input", () => hideHintChips());
  chatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && chatInputEl.value.trim()) {
      handleChatInput(chatInputEl.value.trim());
      chatInputEl.value = "";
    }
  });
  chatSendBtnEl.addEventListener("click", () => {
    if (chatInputEl.value.trim()) {
      handleChatInput(chatInputEl.value.trim());
      chatInputEl.value = "";
    }
  });

  // Reset button
  $("chatResetBtn").addEventListener("click", resetChat);

  setTimeout(checkFreeMode, 500);
});

// -------- Messages from plugin sandbox --------
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "api-key-loaded") {
    const key = msg.key as string;
    if (key) {
      $<HTMLInputElement>("apiKey").value = key;
    }
    checkFreeMode();
  }

  if (msg.type === "simulo-url-loaded") {
    const url = msg.url as string;
    if (url) {
      $<HTMLInputElement>("simuloUrl").value = url;
    }
  }

  if (msg.type === "language-loaded") {
    const lang = (msg.lang as Lang) || "ko";
    setLang(lang);
    $<HTMLSelectElement>("langSelect").value = lang;
    applyI18n();
  }

  if (msg.type === "model-loaded") {
    const model = msg.model as string;
    if (model) {
      $<HTMLSelectElement>("modelSelect").value = model;
    }
  }

  // New frame selection messages
  if (msg.type === "frames-selected") {
    handleFramesSelected((msg.payload as { frames: FrameInfo[] }).frames);
  }
  if (msg.type === "frames-deselected") {
    handleFramesDeselected();
  }
  if (msg.type === "frames-too-many") {
    handleTooManyFrames(msg.count as number);
  }

  if (msg.type === "variant-result") {
    if (!msg.success) {
      showError(msg.error || t("error.variantFail"));
    }
  }

  if (msg.type === "selected-text-node") {
    const inp = $<HTMLInputElement>("variantOriginal");
    if (inp && msg.text) {
      inp.value = msg.text as string;
      pendingVariantNodeId = (msg.nodeId as string) || null;
    }
  }

  if (msg.type === "selection-ready") {
    selectedImages = msg.images as ImageItem[];
    if (pendingMultiAnalysis) {
      pendingMultiAnalysis = false;
      startMultiAnalysis();
    } else {
      startAnalysisWithImages();
    }
  }

  if (msg.type === "writing-selection-ready") {
    const frames = msg.frames as ImageItem[];
    lastFileKey = (msg.fileKey as string) || "";
    startWritingCheck(frames);
  }

  if (msg.type === "flow-selection-ready") {
    selectedImages = (msg.flowSteps as Array<{ stepNumber: number; stepName: string; base64: string }>).map((s) => ({
      name: s.stepName,
      base64: s.base64,
      texts: [],
    }));
    startFlowAnalysisWithImages();
  }

  if (msg.type === "fix-result") {
    const fixLoading = document.querySelector(".fix-loading") as HTMLElement | null;
    if (fixLoading) fixLoading.remove();

    if (msg.success) {
      const appliedCount = msg.appliedCount as number;
      const totalFixes = msg.totalFixes as number;

      const pendingFrameIdx = (window as unknown as Record<string, number>).__pendingFixFrameIdx;
      if (pendingFrameIdx !== undefined) {
        const result = lastWritingResults[pendingFrameIdx];
        if (result) {
          for (let i = 0; i < result.issues.length; i++) {
            appliedFixes.add(`${pendingFrameIdx}-${i}`);
          }
          updateFixButtons(pendingFrameIdx);
        }
      }

      showFixToast(t("toast.fixApplied", { applied: appliedCount, total: totalFixes }), "success");
    } else {
      showFixToast(t("toast.fixFail", { msg: msg.error || "?" }), "error");
    }
  }

  if (msg.type === "google-tokens-loaded") {
    const raw = msg.tokens as string;
    if (raw) {
      try { googleTokens = JSON.parse(raw); } catch { googleTokens = null; }
    }
    updateSheetsButtonState();
  }

  if (msg.type === "spreadsheet-id-loaded") {
    savedSpreadsheetId = (msg.spreadsheetId as string) || "";
  }

  if (msg.type === "error") {
    showError(msg.message);
  }
};

// -------- Selection state (stub — UI elements removed) --------
function updateSelectionBar(_count: number, _names: string[]) {
  // No-op: selection bar removed from UI
}

// -------- Analysis mode switching (stub) --------
function switchAnalysisMode(mode: "hypothesis" | "usability") {
  analysisMode = mode;
}

// -------- Run analysis --------
function runAnalysis() {
  checkFreeMode();

  if (analysisMode === "hypothesis") {
    const hypothesis = $<HTMLTextAreaElement>("hypothesis")?.value?.trim();
    if (!hypothesis) {
      showError(t("error.noHypothesis"));
      return;
    }
  }

  hideError();
  showLoading();
  parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
}

// -------- Multi-frame individual analysis --------
function runMultiAnalysis() {
  checkFreeMode();
  if (analysisMode === "hypothesis") {
    const hypothesis = $<HTMLTextAreaElement>("hypothesis")?.value?.trim();
    if (!hypothesis) { showError(t("error.noHypothesis")); return; }
  }
  hideError();
  showLoading();
  updateLoadingMsg(t("multi.extracting"));
  pendingMultiAnalysis = true;
  parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
}

async function startMultiAnalysis() {
  const images = selectedImages.slice(0, 8);
  multiResults = [];
  currentResultIndex = 0;

  for (let i = 0; i < images.length; i++) {
    updateLoadingMsg(t("multi.analyzing", { current: i + 1, total: images.length, name: images[i].name }));
    try {
      const result = await analyzeSingleFrameViaBackend(images[i]);
      multiResults.push({ ...result, _frameName: images[i].name });
    } catch (e) {
      multiResults.push({
        verdict: t("report.verdict.fail"),
        score: 0,
        summary: t("multi.analysisFail", { msg: e instanceof Error ? e.message : String(e) }),
        _frameName: images[i].name,
      });
    }
  }

  showMultiReport(0);
}

async function analyzeSingleFrameViaBackend(img: ImageItem): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  const baseUrl = getSimuloBaseUrl();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();

  const hasFigmaTexts = img.texts && img.texts.length > 0;
  const figmaOcrContext = hasFigmaTexts ? buildFigmaOcrContext([img]) : undefined;

  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputType: "image",
      images: [img.base64],
      hypothesis: hypothesis || `화면 "${img.name}"의 사용성 분석`,
      targetUser: targetUser || t("form.defaultTargetUser"),
      locale: getLang(),
      mode: analysisMode,
      apiKey: apiKey || undefined,
      figmaOcrContext: figmaOcrContext || undefined,
      focusKeyword: analysisMode === "usability" ? (getFocusKeyword() || undefined) : undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || t("error.apiFail", { status: response.status }));
  }

  return response.json() as Promise<AnalysisResult>;
}

function showMultiReport(index: number) {
  currentResultIndex = index;
  const result = multiResults[index];

  // 페이지네이션 표시
  const paginationEl = $("multiPagination");
  paginationEl.style.display = "flex";
  $("paginationFrameName").textContent = result._frameName || t("multi.frameName", { n: index + 1 });
  $("paginationInfo").textContent = `${index + 1} / ${multiResults.length}`;
  ($("paginationPrev") as HTMLButtonElement).disabled = index === 0;
  ($("paginationNext") as HTMLButtonElement).disabled = index === multiResults.length - 1;

  showReport(result);
}

// -------- Run flow scenario analysis --------
function runFlowAnalysis() {
  checkFreeMode();

  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  if (!hypothesis) {
    showError(t("error.noFlowHypothesis"));
    return;
  }

  hideError();
  showLoading();
  updateLoadingMsg(t("flow.extracting"));
  parent.postMessage({ pluginMessage: { type: "get-selection-for-flow" } }, "*");
}

async function startFlowAnalysisWithImages() {
  const apiKey = getApiKey();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();
  const baseUrl = getSimuloBaseUrl();

  const flowSteps = selectedImages.slice(0, 8).map((img, i) => ({
    stepNumber: i + 1,
    stepName: img.name,
    image: img.base64,
  }));

  try {
    updateLoadingMsg(t("flow.analyzing", { n: flowSteps.length }));

    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputType: "flow",
        flowSteps,
        hypothesis,
        targetUser: targetUser || t("form.defaultTargetUser"),
        locale: getLang(),
        mode: "hypothesis",
        apiKey: apiKey || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || t("flow.apiFail", { status: response.status }));
    }

    const data = await response.json();
    showFlowReport(data);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("flow.error", { msg }));
  }
}

function showFlowReport(data: Record<string, unknown>) {
  hideLoading();

  const score = (data.score as number) ?? 0;
  const summary = (data.summary as string) ?? "";
  const issues = (data.issues as Array<Record<string, string>>) ?? [];
  const flowAnalysis = (data.flowAnalysis as Array<Record<string, unknown>>) ?? [];

  $("reportScore").textContent = String(score);
  const verdict = score >= 80 ? t("report.verdict.pass") : score >= 60 ? t("report.verdict.partial") : t("report.verdict.fail");
  $("reportVerdict").textContent = t("flow.label", { verdict });
  $("reportVerdict").className = `verdict-badge ${score >= 80 ? "pass" : score >= 60 ? "partial" : "fail"}`;
  $("reportSummary").textContent = summary;

  // Flow transition issues
  const flowIssues = issues.filter((i) => i.screen === "플로우" || i.screen?.includes("→") || i.type === "transition");
  const screenIssues = issues.filter((i) => !flowIssues.includes(i));

  let overviewHtml = "";
  if (flowAnalysis.length > 0) {
    overviewHtml += `<div style="margin-bottom:12px"><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${t("flow.screenTransition")}</div>`;
    for (const step of flowAnalysis) {
      const dropOff = step.dropOffAtTransition as number | undefined;
      const risk = step.dropOffRisk as string | undefined;
      const riskColor = risk === "High" || risk === "높음" ? "#ef4444" : risk === "보통" ? "#f59e0b" : "#22c55e";
      overviewHtml += `<div style="padding:6px 0;border-bottom:1px solid #1a1a1a;font-size:12px">
        <span style="color:#888">${step.stepName as string ?? ""}</span>
        ${dropOff !== undefined ? `<span style="float:right;color:${riskColor}">${t("flow.dropOffRisk", { n: dropOff })}</span>` : ""}
      </div>`;
    }
    overviewHtml += `</div>`;
  }

  if (flowIssues.length > 0) {
    overviewHtml += `<div style="font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${t("flow.frictionIssues")}</div>`;
    for (const issue of flowIssues) {
      overviewHtml += `<div style="padding:6px;margin-bottom:4px;background:#1a0f0f;border-radius:4px;border-left:2px solid #ef4444;font-size:12px">
        <div style="color:#e5e5e5;margin-bottom:2px">${issue.issue ?? ""}</div>
        <div style="color:#888">${issue.recommendation ?? ""}</div>
      </div>`;
    }
  }

  $("tab-overview").innerHTML = overviewHtml || `<p style='color:#555;font-size:12px'>${t("flow.noFriction")}</p>`;

  // Think aloud tab — per-screen thoughts
  const thinkAloud = (data.thinkAloud as Array<Record<string, string>>) ?? [];
  let thinkHtml = "";
  for (const t of thinkAloud) {
    thinkHtml += `<div style="padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:12px">
      <div style="color:#666;font-size:10px;margin-bottom:3px">${t.screen ?? ""}</div>
      <div style="color:#ccc">"${t.thought ?? ""}"</div>
    </div>`;
  }
  $("tab-think").innerHTML = thinkHtml || `<p style='color:#555;font-size:12px'>${t("report.noThinkAloud")}</p>`;

  // Issues tab
  let issuesHtml = "";
  for (const issue of screenIssues) {
    const sev = issue.severity ?? "낮음";
    const sevColor = sev === "심각" || sev === "Critical" ? "#ef4444" : sev === "보통" || sev === "Medium" ? "#f59e0b" : "#22c55e";
    issuesHtml += `<div style="padding:8px;margin-bottom:6px;background:#111;border-radius:6px;border-left:2px solid ${sevColor};font-size:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="color:#888">${issue.screen ?? ""}</span>
        <span style="color:${sevColor};font-size:10px">${sev}</span>
      </div>
      <div style="color:#e5e5e5;margin-bottom:3px">${issue.issue ?? ""}</div>
      <div style="color:#666">${issue.recommendation ?? ""}</div>
    </div>`;
  }
  $("tab-issues").innerHTML = issuesHtml || `<p style='color:#555;font-size:12px'>${t("report.noIssues")}</p>`;

  $("report").className = "report visible";
  switchTab("overview");
}

function getApiKey(): string {
  return $<HTMLInputElement>("apiKey").value.trim();
}

// -------- Claude API call --------
async function startAnalysisWithImages() {
  const apiKey = getApiKey();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();

  // 사용성 분석 모드: 항상 백엔드 /api/analyze 사용
  if (analysisMode === "usability") {
    return startUsabilityAnalysis(targetUser);
  }

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const content: ContentBlock[] = [];
  selectedImages.forEach((img, i) => {
    content.push({ type: "text", text: `[화면 ${i + 1}: ${img.name}]` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: img.base64 },
    });
    // 추출된 텍스트가 있으면 이미지 바로 뒤에 첨부
    if (img.texts && img.texts.length > 0) {
      let textList = `\n[화면 ${i + 1} 텍스트 — Figma에서 직접 추출 (OCR 아님)]\n`;
      for (const t of img.texts) {
        const meta: string[] = [];
        if (t.parentName) meta.push(t.parentName);
        if (t.fontSize) meta.push(`${t.fontSize}px`);
        if (t.fontWeight === "bold") meta.push("볼드");
        textList += `- "${t.text}"${meta.length ? ` (${meta.join(", ")})` : ""}\n`;
      }
      content.push({ type: "text", text: textList });
    }
  });
  content.push({
    type: "text",
    text: `가설: "${hypothesis}"\n타깃 유저: "${targetUser || t("form.defaultTargetUser")}"\n\n위 화면들을 분석하여 가설에 대한 사용성 평가를 JSON으로 반환해주세요.\n\n중요: 각 화면의 텍스트는 Figma 레이어에서 직접 추출한 것이므로 정확합니다. 이미지에서 텍스트를 OCR로 읽지 말고 추출된 텍스트를 기준으로 분석하세요.`,
  });

  const systemPrompt = `You are a professional UX analysis agent for YafitMove, a Korean fitness reward app. Analyze the provided design screens against the given hypothesis and target user profile. Respond ONLY in pure JSON, no markdown, no code blocks.

{
  "verdict": "통과" | "부분 통과" | "실패",
  "score": 0-100,
  "summary": "2-3문장 한국어 요약",
  "strengths": ["강점1", "강점2"],
  "taskSuccessLikelihood": "높음" | "보통" | "낮음",
  "thinkAloud": [{"screen": "화면명", "thought": "1인칭 한국어 발화"}],
  "issues": [{"screen": "화면명", "severity": "심각" | "보통" | "낮음", "issue": "한국어 설명", "recommendation": "한국어 권고"}]
}`;

  try {
    updateLoadingMsg(t("loading.analyzing"));

    let result: AnalysisResult;

    if (freeMode) {
      // 무료 모드: Simulo 백엔드 프록시를 통한 분석
      result = await callFreeMode("analysis", { systemPrompt, content }) as AnalysisResult;
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: getSelectedModel(),
          max_tokens: 4096,
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const status = response.status;
        // 429(rate limit) 또는 401(invalid key) → 무료 모드 전환
        if (status === 429 || status === 401) {
          freeMode = true;
          $("freeModeBanner").className = "free-mode-banner visible";
          result = await callFreeMode("analysis", { systemPrompt, content }) as AnalysisResult;
        } else {
          throw new Error(err?.error?.message || t("error.apiFail", { status }));
        }
      } else {
        const data = await response.json();
        const raw: string = data.content?.[0]?.text ?? "";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      }
    }

    showReport(result);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("error.analysisFail", { msg }));
  }
}

// -------- Usability analysis (via backend API) --------
function getFocusKeyword(): string {
  return $<HTMLInputElement>("focusKeyword")?.value?.trim() || "";
}

async function startUsabilityAnalysis(targetUser: string) {
  const apiKey = getApiKey();
  const baseUrl = getSimuloBaseUrl();

  const srcImages = selectedImages.slice(0, 8);
  const images = srcImages.map((img) => img.base64);

  // Figma 실제 텍스트를 OCR 컨텍스트로 변환 (서버 OCR 패스 우회)
  const hasFigmaTexts = srcImages.some((img) => img.texts && img.texts.length > 0);
  const figmaOcrContext = hasFigmaTexts ? buildFigmaOcrContext(srcImages) : undefined;

  try {
    updateLoadingMsg(t("loading.usability"));

    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        inputType: "image",
        mode: "usability",
        targetUser: targetUser || t("form.defaultTargetUser"),
        locale: getLang(),
        model: freeMode ? "haiku" : (getSelectedModel().includes("sonnet") ? "sonnet" : "haiku"),
        apiKey: apiKey || undefined,
        figmaOcrContext: figmaOcrContext || undefined,
        focusKeyword: getFocusKeyword() || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || t("error.apiFail", { status: response.status }));
    }

    const data = await response.json();
    showUsabilityReport(data);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("error.analysisFail", { msg }));
  }
}

function showUsabilityReport(data: Record<string, unknown>) {
  hideLoading();

  const score = (data.score as number) ?? 0;
  const grade = (data.grade as string) ?? (data.verdict as string) ?? "개선 필요";
  const summary = (data.summary as string) ?? "";
  const strengths = (data.strengths as string[]) ?? [];
  const issues = (data.issues as Array<Record<string, string>>) ?? [];
  const quickWins = (data.quickWins as Array<Record<string, string>>) ?? [];
  const scoreBreakdown = data.scoreBreakdown as Record<string, { score: number; reason: string } | number> | undefined;

  $("reportScore").textContent = String(score);

  const verdictEl = $("reportVerdict");
  verdictEl.textContent = grade;
  const gradeClass = score >= 80 ? "verdict-pass" : score >= 60 ? "verdict-partial" : "verdict-fail";
  verdictEl.className = `verdict-badge ${gradeClass}`;

  $("reportSummary").textContent = summary;

  // Overview tab — scoreBreakdown + strengths
  let overviewHtml = "";

  if (scoreBreakdown && typeof scoreBreakdown === "object") {
    overviewHtml += `<div class="section-label">${t("report.scoreBreakdown")}</div><div class="score-breakdown">`;
    for (const [key, val] of Object.entries(scoreBreakdown)) {
      const scoreVal = typeof val === "object" && val !== null ? (val as { score: number; reason?: string }).score : val;
      const reason = typeof val === "object" && val !== null ? (val as { score: number; reason?: string }).reason : undefined;
      overviewHtml += `<div class="score-breakdown-item" title="${reason ? escapeHtml(reason) : ""}"><span class="score-breakdown-label">${escapeHtml(key)}</span><span class="score-breakdown-value">${scoreVal}</span></div>`;
    }
    overviewHtml += `</div>`;
  }

  if (strengths.length > 0) {
    overviewHtml += `<div class="section-label">${t("report.strengths")}</div>`;
    for (const s of strengths) {
      overviewHtml += `<div class="strength-item">+ ${escapeHtml(s)}</div>`;
    }
  }

  $("tab-overview").innerHTML = overviewHtml || `<div class="empty">${t("report.noStrengths")}</div>`;

  // 개선안 탭 (Think Aloud 탭 재활용)
  const effortLabel = (e: string) => {
    if (e === "낮음" || e === "Low" || e === "低" || e === "低い") return `<span class="effort-badge effort-low">${escapeHtml(e)}</span>`;
    if (e === "높음" || e === "High" || e === "高" || e === "高い") return `<span class="effort-badge effort-high">${escapeHtml(e)}</span>`;
    return `<span class="effort-badge effort-mid">${escapeHtml(e)}</span>`;
  };
  const impactLabel = (e: string) => {
    if (e === "높음" || e === "High" || e === "高" || e === "高い") return `<span class="impact-badge impact-high">${escapeHtml(e)}</span>`;
    if (e === "낮음" || e === "Low" || e === "低" || e === "低い") return `<span class="impact-badge impact-low">${escapeHtml(e)}</span>`;
    return `<span class="impact-badge impact-mid">${escapeHtml(e)}</span>`;
  };

  let improvementsHtml = "";

  if (quickWins.length > 0) {
    improvementsHtml += `<div class="section-label">${t("report.improvements.quickWins")}</div>`;
    // Group by category if available
    const hasCats = quickWins.some((qw) => qw.category);
    if (hasCats) {
      const catOrder = ["UX 라이팅", "CTA / 버튼", "정보 구조", "비주얼", "신뢰 / 권한", "피드백 / 상태"];
      const grouped: Record<string, Array<Record<string, string>>> = {};
      const uncategorized: Array<Record<string, string>> = [];
      for (const qw of quickWins) {
        const cat = qw.category || "";
        if (cat) {
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(qw);
        } else {
          uncategorized.push(qw);
        }
      }
      const catKeys = [...catOrder.filter((c) => grouped[c]), ...Object.keys(grouped).filter((c) => !catOrder.includes(c))];
      for (const cat of catKeys) {
        improvementsHtml += `<div class="improvement-category-header">${escapeHtml(cat)}</div>`;
        for (const qw of grouped[cat]) {
          const fix = qw.fix || qw.description || qw.recommendation || "";
          const effort = qw.effort || "";
          const impact = qw.impact || "";
          improvementsHtml += `
            <div class="improvement-item">
              <div class="improvement-problem">${escapeHtml(qw.issue || qw.title || "")}</div>
              <div class="improvement-fix"><span class="fix-label">${t("report.fix.label")}</span>${escapeHtml(fix)}</div>
              ${(effort || impact) ? `<div class="improvement-badges">${effort ? `<span class="badge-label">${t("report.effort")}: </span>${effortLabel(effort)}` : ""}${impact ? `&nbsp;&nbsp;<span class="badge-label">${t("report.impact")}: </span>${impactLabel(impact)}` : ""}</div>` : ""}
            </div>`;
        }
      }
      for (const qw of uncategorized) {
        const fix = qw.fix || qw.description || qw.recommendation || "";
        const effort = qw.effort || "";
        const impact = qw.impact || "";
        improvementsHtml += `
          <div class="improvement-item">
            <div class="improvement-problem">${escapeHtml(qw.issue || qw.title || "")}</div>
            <div class="improvement-fix">→ ${escapeHtml(fix)}</div>
            ${(effort || impact) ? `<div class="improvement-badges">${effort ? `<span class="badge-label">${t("report.effort")}: </span>${effortLabel(effort)}` : ""}${impact ? `&nbsp;&nbsp;<span class="badge-label">${t("report.impact")}: </span>${impactLabel(impact)}` : ""}</div>` : ""}
          </div>`;
      }
    } else {
      for (const qw of quickWins) {
        const fix = qw.fix || qw.description || qw.recommendation || "";
        const effort = qw.effort || "";
        const impact = qw.impact || "";
        improvementsHtml += `
          <div class="improvement-item">
            <div class="improvement-problem">${escapeHtml(qw.issue || qw.title || "")}</div>
            <div class="improvement-fix">→ ${escapeHtml(fix)}</div>
            ${(effort || impact) ? `<div class="improvement-badges">${effort ? `<span class="badge-label">${t("report.effort")}: </span>${effortLabel(effort)}` : ""}${impact ? `&nbsp;&nbsp;<span class="badge-label">${t("report.impact")}: </span>${impactLabel(impact)}` : ""}</div>` : ""}
          </div>`;
      }
    }
  }

  const issuesWithRec = issues.filter((i) => i.recommendation);
  if (issuesWithRec.length > 0) {
    improvementsHtml += `<div class="section-label" style="margin-top:14px">${t("report.improvements.recommendations")}</div>`;
    for (const issue of issuesWithRec) {
      const sev = issue.severity ?? "낮음";
      const sevCls = sev === "심각" || sev === "Critical" || sev === "重大" ? "sev-critical"
        : sev === "보통" || sev === "Medium" || sev === "中" ? "sev-medium" : "sev-low";
      improvementsHtml += `
        <div class="improvement-item">
          <div class="improvement-problem-row">
            <span class="issue-severity ${sevCls}" style="font-size:9px;padding:1px 5px">${escapeHtml(sev)}</span>
            ${issue.screen ? `<span class="issue-screen">${escapeHtml(issue.screen)}</span>` : ""}
          </div>
          <div class="improvement-problem">${escapeHtml(issue.issue || "")}</div>
          <div class="improvement-fix"><span class="fix-label">${t("report.fix.label")}</span>${escapeHtml(issue.recommendation)}</div>
        </div>`;
    }
  }

  $("tab-think").innerHTML = improvementsHtml || `<div class="empty">${t("report.improvements.noData")}</div>`;

  // 개선안 탭 레이블 변경
  document.querySelectorAll(".tab").forEach((el) => {
    if ((el as HTMLElement).dataset.tab === "think") el.textContent = t("tab.improvements");
  });

  // Issues tab — 이슈 목록만 (recommendation 요약 포함)
  const sevClass = (s: string) =>
    s === "심각" || s === "Critical" || s === "重大" ? "sev-critical"
    : s === "보통" || s === "Medium" || s === "中" ? "sev-medium" : "sev-low";
  let issuesHtml = "";
  for (const issue of issues) {
    const sev = issue.severity ?? "낮음";
    issuesHtml += `<div class="issue-item">
      <span class="issue-severity ${sevClass(sev)}">${escapeHtml(sev)}</span>
      <span class="issue-screen">${escapeHtml(issue.screen || "")}</span>
      <div class="issue-text">${escapeHtml(issue.issue || "")}</div>
      ${issue.recommendation ? `<div class="issue-rec">→ ${escapeHtml(issue.recommendation)}</div>` : ""}
    </div>`;
  }
  $("tab-issues").innerHTML = issuesHtml || `<div class="empty">${t("report.noIssues")}</div>`;

  $("inputForm").style.display = "none";
  $("report").className = "report visible";
  // 개선안이 있으면 개선안 탭으로, 없으면 overview
  switchTab(quickWins.length > 0 || issues.some((i) => i.recommendation) ? "think" : "overview");

  renderFeedbackBar($("report"), "analysis", {
    frameName: selectedImages.map((img) => img.name).join(", "),
    score,
    issueCount: issues.length,
  });
}

// -------- Report rendering --------
function showReport(result: AnalysisResult) {
  hideLoading();
  // 단일 분석 모드에선 페이지네이션 숨김
  if (multiResults.length === 0) {
    $("multiPagination").style.display = "none";
  }

  $("reportScore").textContent = String(result.score ?? "-");

  const verdictEl = $("reportVerdict");
  verdictEl.textContent = result.verdict || "-";
  const passStr = t("report.verdict.pass");
  const partialStr = t("report.verdict.partial");
  const verdictClass =
    result.verdict === passStr || result.verdict === "Pass" || result.verdict === "合格"
      ? "verdict-pass"
      : result.verdict === partialStr || result.verdict === "Partial Pass" || result.verdict === "一部合格"
        ? "verdict-partial"
        : "verdict-fail";
  verdictEl.className = `verdict-badge ${verdictClass}`;

  $("reportSummary").textContent = result.summary || "";

  const strengthsHtml = (result.strengths || [])
    .map((s) => `<div class="strength-item">+ ${escapeHtml(s)}</div>`)
    .join("");
  $("reportStrengths").innerHTML =
    strengthsHtml || `<div class="empty">${t("report.noStrengths")}</div>`;

  const thinkHtml = (result.thinkAloud || [])
    .map(
      (th) => `
      <div class="think-wrap">
        <div class="think-screen">${escapeHtml(th.screen)}</div>
        <div class="think-aloud">&ldquo;${escapeHtml(th.thought)}&rdquo;</div>
      </div>`
    )
    .join("");
  $("reportThinkAloud").innerHTML =
    thinkHtml || `<div class="empty">${t("report.noThinkAloud")}</div>`;

  const sevClass = (s: string) =>
    s === "심각" || s === "Critical" || s === "重大" ? "sev-critical"
    : s === "보통" || s === "Medium" || s === "中" ? "sev-medium"
    : "sev-low";
  const issuesHtml = (result.issues || [])
    .map(
      (issue) => `
      <div class="issue-item">
        <span class="issue-severity ${sevClass(issue.severity)}">${escapeHtml(issue.severity)}</span>
        <span class="issue-screen">${escapeHtml(issue.screen || "")}</span>
        <div class="issue-text">${escapeHtml(issue.issue)}</div>
        <div class="issue-rec">→ ${escapeHtml(issue.recommendation)}</div>
      </div>`
    )
    .join("");
  $("reportIssues").innerHTML =
    issuesHtml || `<div class="empty">${t("report.noIssues")}</div>`;

  // 가설 검증 모드: Think Aloud 탭 레이블 복원
  document.querySelectorAll(".tab").forEach((el) => {
    if ((el as HTMLElement).dataset.tab === "think") el.textContent = t("tab.thinkAloud");
  });

  $("inputForm").style.display = "none";
  $("report").className = "report visible";

  // 피드백 바 추가
  renderFeedbackBar($("report"), "analysis", {
    frameName: selectedImages.map((img) => img.name).join(", "),
    score: result.score,
    issueCount: (result.issues || []).length,
  });
}

function switchTab(tab: string) {
  document.querySelectorAll(".tab").forEach((el) => {
    const name = (el as HTMLElement).dataset.tab;
    el.className = "tab" + (name === tab ? " active" : "");
  });
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.className = "tab-content";
  });
  const target = document.getElementById(`tab-${tab}`);
  if (target) target.className = "tab-content active";
}

function resetToInput() {
  selectedImages = [];
  lastWritingResults = [];
  // Legacy UI elements removed — no-op for DOM manipulation
}

// -------- Mode switching (stub — mode bar removed) --------
function switchMode(_mode: "analysis" | "writing" | "variants" | "live") {
  // No-op: mode bar removed from UI
}

// -------- UX Writing Check --------
function runWritingCheck() {
  checkFreeMode();

  hideError();
  showLoading();
  updateLoadingMsg(t("loading.writingFrame"));
  parent.postMessage({ pluginMessage: { type: "get-selection-for-writing" } }, "*");
}

function buildWritingUserPrompt(frame: ImageItem): string {
  let prompt = `이 UI 화면("${frame.name}")의 텍스트를 UX 라이팅 매뉴얼 기준으로 분석하세요.\n\n`;

  if (frame.texts && frame.texts.length > 0) {
    prompt += `## Figma에서 추출한 실제 텍스트 목록\n아래는 Figma 레이어에서 직접 추출한 정확한 텍스트입니다. 이미지의 텍스트를 OCR로 읽지 말고, 아래 텍스트를 기준으로 분석하세요.\n\n`;
    for (const t of frame.texts) {
      const meta: string[] = [];
      if (t.parentName) meta.push(`위치: ${t.parentName}`);
      if (t.fontSize) meta.push(`${t.fontSize}px`);
      if (t.fontWeight === "bold") meta.push("볼드");
      prompt += `- "${t.text}"${meta.length > 0 ? ` (${meta.join(", ")})` : ""}\n`;
    }
    prompt += `\n총 ${frame.texts.length}개 텍스트 노드.\n`;
  }

  prompt += `\n## 분석 순서 (이 순서대로 각 텍스트를 체크)
1. 해요체인가? (반말/합쇼체 → 해요체로)
2. 군더더기가 있는가? ("혹시", "잠깐", "한번", "지금 바로" 등)
3. CTA라면: 누르면 무엇이 일어나는지 예측 가능한가?
4. 한 문장에 메시지가 2개 이상 들어있는가?
5. 같은 단어가 화면에서 3회 이상 반복되는가?
6. 소리 내어 읽었을 때 자연스러운가?

기능 자체(게이미피케이션, 카드뽑기, 운세 등)는 평가하지 마세요. 문장 표현만 평가하세요.
suggestion은 원본과 비슷한 길이로, UI 공간을 벗어나지 않게 작성하세요.

JSON만 반환하세요.`;
  return prompt;
}

async function startWritingCheck(frames: ImageItem[]) {
  const apiKey = getApiKey();

  const systemPrompt = `당신은 야핏무브 UX 라이팅 전문가입니다. 야핏무브 UX 라이팅 매뉴얼(v1.0)에 근거하여 Figma 디자인 프레임의 모든 텍스트를 분석합니다.

## 절대 규칙 — 기획 판단 금지 (최우선)
당신은 **문장 표현의 품질만 평가**합니다. 기능/기획 자체에 대한 판단은 **절대 금지**입니다.
- 게이미피케이션, 운세, 카드뽑기, 랜덤보상, 이벤트, 챌린지 등 **모든 기능은 이미 확정된 기획**입니다.
- "이 기능이 4060에게 적합하지 않다", "건강 앱에 맞지 않다", "게이미피케이션이 사용자에게 혼란을 줄 수 있다" 같은 판단은 **하지 마세요.**
- "뽑기", "카드", "운세" 같은 단어가 있어도 기능 자체를 문제 삼지 마세요. 그 단어가 해요체인지, 명확한지, 군더더기가 없는지만 보세요.
- **위반 예시 (금지)**: "궁금한 카드를 뽑아주세요 → 게이미피케이션 요소가 4060에게 적합하지 않을 수 있음"
- **올바른 평가**: "궁금한 카드를 뽑아주세요 → '궁금한'이 군더더기. '카드를 선택해주세요'가 행동을 더 명확히 예측하게 함"

당신이 판단할 수 있는 것: 해요체 여부, 군더더기, CTA 명확성, 구어체, 단어 반복, 따뜻한 톤, 문장 길이.
당신이 판단할 수 없는 것: 기능의 적합성, 브랜드 방향성, 콘텐츠 전략, 제품 정체성.

## 제안 텍스트 작성 규칙
- suggestion은 **반드시 원본과 비슷한 길이**여야 합니다. 원본보다 2배 이상 길어지면 안 됩니다.
- UI 공간은 제한적입니다. 짧고 명확한 문장이 좋습니다.
- suggestion이 원본과 동일한 의미를 전달하되, 매뉴얼 원칙에 더 부합하도록 수정하세요.

## 타깃 사용자
야핏무브의 핵심 사용자는 **4060대 한국 여성**입니다. 이분들에게 화면 위의 글자는 매일 만나는 작은 대화입니다.

## 코어밸류 — 5가지 가치
1. **명확한(Clear)**: 4060 사용자가 한눈에 보고 무엇을 해야 할지 즉시 알 수 있어야 한다
2. **정중한(Respectful)**: 모든 문구는 해요체. 반말, 강요, 위협 없음. 가르치거나 재촉하지 않는다
3. **따뜻한(Warm)**: 격려하는 감정 표현을 환영. "잘하고 있어요", "내일 더 행복해질 거예요" 같은 표현
4. **깔끔한(Clean)**: 한 화면에 같은 단어/문장 반복하지 않는다. 군더더기를 뺀다
5. **정직한(Honest)**: 거짓 약속이나 과장 없음. 보상 액수는 확정 가능할 때만 명시

## 두두 캐릭터 원칙
두두는 시각적 마스코트다. **화자가 아니다.** 두두를 의인화해 말하게 하는 모든 표현은 금지.
- ✗ "두두가 마일리지 줄게" → ✓ "보너스 마일리지를 받았어요"
- ✗ "두두랑 같이 걸어볼래?" → ✓ "같이 걸어볼까요?"

## 8가지 라이팅 원칙 (문장 단위)

### 원칙1: 4060이 한눈에 이해할 수 있게 쓴다
화면을 보고 1~2초 안에 무엇이 가능한지 알 수 있어야 한다. **이 원칙이 다른 모든 원칙 위에 있다.**
- ✗ "본 서비스 이용 시 마일리지가 적립됩니다" → ✓ "광고를 보면 마일리지를 받아요"
- ✗ "보상 미수령 건이 있습니다" → ✓ "아직 받지 않은 보너스가 있어요"

### 원칙2: 다음 행동이 예측되는 문장을 쓴다
CTA는 누른 뒤 무엇이 일어날지 직접 말한다.
- ✗ "확인" → ✓ "마일리지 받기"
- ✗ "시작하기" → ✓ "잠자기 시간 정하기"
- ✗ "더 보기" → ✓ "오늘 받을 보너스 보기"

### 원칙3: 군더더기를 뺀다
뺐을 때 의미가 변하지 않는 단어는 빼야 한다.
금지 군더더기: "혹시", "잠깐", "한번", "지금 바로", "당장", "공짜", "열심히", "~하실 수 있는"

### 원칙4: 한 문장에 한 메시지를 담는다
여러 정보를 한 문장에 욱여넣으면 4060 사용자에게 부담스럽다.

### 원칙5: 따뜻한 감정으로 격려한다
사실만 건조하게 적시하지 않는다. 격려, 응원, 기대감을 준다.
- ✗ "오늘 5,034걸음을 걸었어요" → ✓ "오늘도 잘하고 있어요"

### 원칙6: 입으로 말할 수 있는 문장을 쓴다
소리 내어 읽었을 때 어색하면 다시 쓴다. 한자어, 문어체, 긴 호흡 문장 금지.
- ✗ "보상 지급이 완료되었습니다" → ✓ "보너스 마일리지를 받았어요"

### 원칙7: 권유하되 강요하지 않는다
손실 회피는 야핏무브의 핵심 메커니즘이나 표현이 공격적이지 않게 한다.

### 원칙8: 모두가 이해할 수 있는 말을 쓴다
외래어, 줄임말, 인터넷 밈은 거리감을 만든다.
야핏무브 내부 용어(에너지, 두두, 마일리지, 마일리지샵, 보너스 마일리지)는 허용.

## 제품 라이팅 원칙 (화면 단위)
- 한 화면, 하나의 핵심 메시지
- 같은 단어를 한 화면에서 반복하지 않는다 (동일 명사 3회 이상 = 정리되지 않은 인상)
- 원페이지 원액션: 타이틀 1줄 + CTA 1개만 봤을 때 행동할 수 있어야 한다

## 심각도 기준
- **critical**: 사용자가 오해하거나 행동하지 못하는 텍스트
- **warning**: 개선하면 전환율/만족도가 올라가는 텍스트
- **info**: 더 나은 대안이 있는 텍스트

## principle 값 (반드시 아래 중 하나)
"한눈에 이해", "행동 예측", "군더더기 제거", "한 문장 한 메시지", "따뜻한 격려", "구어체", "권유/비강요", "쉬운 말", "두두 원칙", "원페이지 원액션", "단어 반복 금지", "해요체", "정직한 표현"

## 응답 형식
반드시 아래 JSON 형식으로 응답하세요. JSON 외 다른 텍스트를 포함하지 마세요.

{
  "summary": "전체 UX 라이팅에 대한 1-2문장 요약",
  "score": 0-100,
  "issues": [
    {
      "location": "텍스트가 위치한 UI 요소",
      "original": "원본 텍스트",
      "suggestion": "개선된 텍스트",
      "reason": "어떤 원칙을 위반했는지 + 왜 변경해야 하는지",
      "severity": "critical | warning | info",
      "principle": "위 principle 값 중 하나"
    }
  ],
  "strengths": ["매뉴얼 기준으로 잘 작성된 텍스트에 대한 칭찬"],
  "screenLevel": {
    "hasOneKeyMessage": true/false,
    "hasWordRepetition": true/false,
    "repeatedWords": ["반복된 단어"],
    "ctaCount": 0,
    "ctaClarity": "CTA가 행동을 예측하게 하는지 평가"
  }
}`;

  try {
    const allResults: WritingCheckResult[] = [];

    for (let i = 0; i < frames.length; i++) {
      updateLoadingMsg(freeMode
        ? t("writing.frameAnalyzingFree", { i: i + 1, n: frames.length })
        : t("writing.frameAnalyzing", { i: i + 1, n: frames.length }));

      const userContent = [
        {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/png", data: frames[i].base64 },
        },
        {
          type: "text" as const,
          text: buildWritingUserPrompt(frames[i]),
        },
      ];

      let result;

      if (freeMode) {
        result = await callFreeMode("writing", {
          systemPrompt,
          content: [{ role: "user", content: userContent }],
          frameName: frames[i].name,
        });
      } else {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: getSelectedModel(),
            max_tokens: 4096,
            temperature: 0.2,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userContent }],
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429 || status === 401) {
            freeMode = true;
            $("freeModeBanner").className = "free-mode-banner visible";
            result = await callFreeMode("writing", {
              systemPrompt,
              content: [{ role: "user", content: userContent }],
              frameName: frames[i].name,
            });
          } else {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.error?.message || t("error.apiFail", { status }));
          }
        } else {
          const data = await response.json();
          const raw: string = data.content?.[0]?.text ?? "";
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          result = JSON.parse(cleaned);
        }
      }

      allResults.push({ ...result, frameName: frames[i].name, figmaNodeId: frames[i].nodeId });
    }

    showWritingReport(allResults);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("error.analysisFail", { msg }));
  }
}

function showWritingReport(results: WritingCheckResult[]) {
  hideLoading();
  $("inputForm").style.display = "none";
  $("writingForm").style.display = "none";

  // Reset applied state
  appliedFixes = new Set();

  const container = $("writingReport");

  let html = "";

  for (let fi = 0; fi < results.length; fi++) {
    const result = results[fi];
    const scoreClass = result.score >= 80 ? "score-good" : result.score >= 60 ? "score-ok" : "score-bad";
    const hasNodeId = !!result.figmaNodeId;
    const hasIssues = result.issues && result.issues.length > 0;

    html += `
      <div class="writing-frame-result">
        <div class="score-row">
          <span class="score-num ${scoreClass}">${result.score}</span>
          <span class="writing-frame-name">${escapeHtml(result.frameName)}</span>
        </div>
        <div class="summary">${escapeHtml(result.summary)}</div>
    `;

    // "전체 적용" button per frame
    if (hasNodeId && hasIssues) {
      html += `<button class="fix-all-btn" data-fix-all="${fi}">${t("writing.applyAllFixes")}</button>`;
    }

    // Screen-level checks
    if (result.screenLevel) {
      const sl = result.screenLevel;
      html += `<div class="section-label">${t("writing.screenCheck")}</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">`;
      html += `<span class="issue-severity ${sl.hasOneKeyMessage ? "sev-low" : "sev-critical"}" style="font-size:10px">${sl.hasOneKeyMessage ? t("writing.oneKey") : t("writing.multiKey")}</span>`;
      html += `<span class="issue-severity ${!sl.hasWordRepetition ? "sev-low" : "sev-medium"}" style="font-size:10px">${!sl.hasWordRepetition ? t("writing.noRepeat") : t("writing.repeat", { words: sl.repeatedWords.map(w => escapeHtml(w)).join(", ") })}</span>`;
      html += `<span class="issue-severity sev-low" style="font-size:10px">${t("writing.ctaCount", { n: sl.ctaCount })}</span>`;
      html += `</div>`;
      if (sl.ctaClarity) {
        html += `<div style="font-size:11px;color:#666;margin-bottom:12px">${escapeHtml(sl.ctaClarity)}</div>`;
      }
    }

    // Strengths
    if (result.strengths && result.strengths.length > 0) {
      html += `<div class="section-label">${t("writing.goodPoints")}</div>`;
      for (const s of result.strengths) {
        html += `<div class="strength-item">✓ ${escapeHtml(s)}</div>`;
      }
    }

    // Issues
    if (hasIssues) {
      html += `<div class="section-label" style="margin-top:12px">${t("writing.improvements", { n: result.issues.length })}</div>`;
      for (let ii = 0; ii < result.issues.length; ii++) {
        const issue = result.issues[ii];
        const sevClass = issue.severity === "critical" ? "sev-critical" : issue.severity === "warning" ? "sev-medium" : "sev-low";
        const sevLabel = issue.severity === "critical" ? t("writing.sev.critical") : issue.severity === "warning" ? t("writing.sev.warning") : t("writing.sev.info");
        html += `
          <div class="writing-issue">
            <div class="writing-issue-header">
              <span class="issue-severity ${sevClass}">${escapeHtml(sevLabel)}</span>
              <span class="issue-screen">${escapeHtml(issue.location)}</span>
              <span class="writing-principle">${escapeHtml(issue.principle)}</span>
              ${hasNodeId ? `<span class="fix-badge" data-fix-badge="${fi}-${ii}">${t("writing.pending")}</span>` : ""}
            </div>
            <div class="writing-compare">
              <div class="writing-before">
                <span class="writing-label">${t("writing.current")}</span>
                <span class="writing-text-del">${escapeHtml(issue.original)}</span>
              </div>
              <div class="writing-after">
                <span class="writing-label writing-label-good">${t("writing.suggestion")}</span>
                <span class="writing-text-new">${escapeHtml(issue.suggestion)}</span>
              </div>
            </div>
            <div class="writing-reason">${escapeHtml(issue.reason)}</div>
          </div>
        `;
      }
    }

    html += `</div>`;
  }

  container.innerHTML = html;
  container.className = "writing-report visible";

  // Attach click handlers for "전체 적용" buttons
  container.querySelectorAll(".fix-all-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const frameIdx = parseInt((btn as HTMLElement).dataset.fixAll || "0", 10);
      applyFixesForFrame(frameIdx);
    });
  });

  // Store results for export
  lastWritingResults = results;

  // Show action buttons
  $("writingActions").style.display = "block";

  // 피드백 바 추가
  const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;
  renderFeedbackBar(container, "writing", {
    frameName: results.map((r) => r.frameName).join(", "),
    score: avgScore,
    issueCount: totalIssues,
  });
}

// -------- Loading / error helpers --------
function showLoading() {
  // No-op: loading indicator removed — chat streaming shows progress
}
function hideLoading() {
  // No-op
}
function updateLoadingMsg(_msg: string) {
  // No-op
}
function showError(msg: string) {
  const el = $("errorMsg");
  el.textContent = msg;
  el.className = "error-msg visible";
}
function hideError() {
  $("errorMsg").className = "error-msg";
}

// -------- Export functions --------

function writingResultsToCSV(results: WritingCheckResult[]): string {
  const BOM = "\uFEFF";
  const header = ["프레임", "위치", "심각도", "원칙", "현재 문구 (Don't)", "제안 문구 (Do)", "사유"].join(",");
  const rows: string[] = [];

  for (const frame of results) {
    if (frame.issues.length === 0) {
      rows.push([csvEsc(frame.frameName), "", "", "", "", "", "이슈 없음"].join(","));
      continue;
    }
    for (const issue of frame.issues) {
      rows.push([
        csvEsc(frame.frameName),
        csvEsc(issue.location),
        issue.severity === "critical" ? "심각" : issue.severity === "warning" ? "주의" : "참고",
        csvEsc(issue.principle),
        csvEsc(issue.original),
        csvEsc(issue.suggestion),
        csvEsc(issue.reason),
      ].join(","));
    }
  }

  return BOM + header + "\n" + rows.join("\n");
}

function csvEsc(value: string): string {
  if (!value) return "";
  return `"${value.replace(/"/g, '""')}"`;
}

function exportWritingCSV() {
  if (lastWritingResults.length === 0) return;
  const csv = writingResultsToCSV(lastWritingResults);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ux-writing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToSimulo() {
  if (lastWritingResults.length === 0) return;

  // 결과를 압축된 JSON으로 변환 (필수 필드만)
  const compact = {
    fk: lastFileKey,
    frames: lastWritingResults.map((frame) => ({
      f: frame.frameName,
      n: frame.figmaNodeId || "",
      s: frame.score,
      i: frame.issues.map((issue) => ({
        l: issue.location,
        o: issue.original,
        g: issue.suggestion,
        r: issue.reason,
        v: issue.severity,
        p: issue.principle,
      })),
    })),
  };

  const json = JSON.stringify(compact);
  const encoded = btoa(unescape(encodeURIComponent(json)));

  // JSON을 클립보드에도 복사 (수동 import 대안)
  try { navigator.clipboard.writeText(json); } catch { /* sandbox에서 실패 가능 */ }

  // URL hash로 데이터 전달
  const baseUrl = getSimuloBaseUrl();
  const url = `${baseUrl}/ux-writing?tab=checklist#import=${encoded}`;

  // Figma 플러그인 iframe에서는 window.open이 차단됨
  // plugin sandbox의 figma.openExternal()을 통해 외부 URL 열기
  parent.postMessage({ pluginMessage: { type: "open-external", url } }, "*");

  // 알림
  updateLoadingMsg(t("loading.simuloExport"));
  $("loading").className = "loading visible";
  setTimeout(() => { $("loading").className = "loading"; }, 1500);
}

function getSimuloBaseUrl(): string {
  const custom = $<HTMLInputElement>("simuloUrl").value.trim();
  return custom || "https://simulo.vercel.app";
}

// -------- Auto-fix helpers --------

function applyFixesForFrame(frameIdx: number) {
  const result = lastWritingResults[frameIdx];
  if (!result || !result.figmaNodeId) return;

  const fixes = result.issues.map((issue) => ({
    original: issue.original,
    suggestion: issue.suggestion,
  }));

  if (fixes.length === 0) return;

  // Store pending frame index for fix-result handler
  (window as unknown as Record<string, number>).__pendingFixFrameIdx = frameIdx;

  // Show loading indicator
  const btn = document.querySelector(`[data-fix-all="${frameIdx}"]`) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("writing.applying");
  }

  parent.postMessage({
    pluginMessage: {
      type: "apply-writing-fixes",
      nodeId: result.figmaNodeId,
      fixes,
    },
  }, "*");
}

function updateFixButtons(frameIdx: number) {
  const result = lastWritingResults[frameIdx];
  if (!result) return;

  // Update "전체 적용" button
  const allBtn = document.querySelector(`[data-fix-all="${frameIdx}"]`) as HTMLButtonElement | null;
  if (allBtn) {
    allBtn.disabled = true;
    allBtn.textContent = t("writing.applyComplete");
    allBtn.classList.add("fix-applied");
  }

  // Update individual issue badges
  for (let i = 0; i < result.issues.length; i++) {
    const badge = document.querySelector(`[data-fix-badge="${frameIdx}-${i}"]`);
    if (badge) {
      badge.textContent = t("writing.applied");
      badge.className = "fix-badge fix-applied";
    }
  }
}

// -------- A/B Variant Generation --------
async function runVariantGeneration() {
  const original = $<HTMLInputElement>("variantOriginal")?.value?.trim();
  const goal = $<HTMLSelectElement>("variantGoal")?.value;

  if (!original) {
    showError(t("error.noVariantText"));
    return;
  }

  const apiKey = $<HTMLInputElement>("apiKey")?.value?.trim();
  const simuloUrl = ($<HTMLInputElement>("simuloUrl")?.value?.trim()) || "https://simulo.vercel.app";

  hideError();
  const variantsLoadingEl = $("variantsLoading");
  variantsLoadingEl.textContent = t("loading.variantsGen");
  variantsLoadingEl.style.display = "block";
  $("variantsResult").style.display = "none";
  $<HTMLButtonElement>("runVariantsBtn").disabled = true;

  try {
    const res = await fetch(`${simuloUrl}/api/plugin/generate-variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original, goal, apiKey }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "서버 오류" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json() as {
      original: string;
      goalLabel: string;
      variants: { text: string; reason: string }[];
    };

    renderVariants(data.original, data.goalLabel, data.variants);
  } catch (e) {
    showError(e instanceof Error ? e.message : t("error.variantFail"));
  } finally {
    $("variantsLoading").style.display = "none";
    $<HTMLButtonElement>("runVariantsBtn").disabled = false;
  }
}

function renderVariants(
  original: string,
  goalLabel: string,
  variants: { text: string; reason: string }[],
) {
  const container = $("variantsResult");
  let html = `<div style="font-size:11px;color:#666;margin-bottom:10px;">${t("variants.goalPrefix")}<span style="color:#93c5fd">${goalLabel}</span></div>`;

  for (const v of variants) {
    html += `
      <div class="variant-card" data-text="${v.text.replace(/"/g, "&quot;")}">
        <div class="variant-text">${v.text}</div>
        <div class="variant-reason">${v.reason}</div>
        <button class="variant-apply-btn" data-text="${v.text.replace(/"/g, "&quot;")}">${t("btn.applyToFigma")}</button>
      </div>`;
  }

  container.innerHTML = html;
  container.style.display = "block";

  container.querySelectorAll(".variant-apply-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const replacement = (btn as HTMLElement).dataset.text || "";
      if (!pendingVariantNodeId) {
        showError(t("error.variantApplyFail"));
        return;
      }
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).textContent = t("btn.applying");
      parent.postMessage({
        pluginMessage: {
          type: "apply-variant",
          nodeId: pendingVariantNodeId,
          original,
          replacement,
        },
      }, "*");
      setTimeout(() => {
        (btn as HTMLButtonElement).textContent = t("btn.applied");
      }, 800);
    });
  });
}

// -------- Feedback system --------

function renderFeedbackBar(
  container: HTMLElement,
  mode: "analysis" | "writing",
  context: { frameName?: string; score?: number; issueCount?: number },
) {
  // 기존 피드백 바 제거
  const existing = container.querySelector(".feedback-bar");
  if (existing) existing.remove();

  const bar = document.createElement("div");
  bar.className = "feedback-bar";
  bar.innerHTML = `
    <div class="feedback-prompt">${t("feedback.prompt")}</div>
    <div class="feedback-btns">
      <button class="feedback-btn" data-rating="good">${t("feedback.good")}</button>
      <button class="feedback-btn" data-rating="bad">${t("feedback.bad")}</button>
    </div>
    <div class="feedback-comment" id="feedbackComment-${mode}">
      <textarea placeholder="${t("feedback.placeholder")}"></textarea>
      <button class="feedback-submit">${t("feedback.submit")}</button>
    </div>
    <div class="feedback-done" style="display:none">${t("feedback.done")}</div>
  `;
  container.appendChild(bar);

  let selectedRating: "good" | "bad" | null = null;
  const btns = bar.querySelectorAll(".feedback-btn");
  const commentBox = bar.querySelector(".feedback-comment") as HTMLElement;
  const doneMsg = bar.querySelector(".feedback-done") as HTMLElement;

  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const rating = (btn as HTMLElement).dataset.rating as "good" | "bad";
      selectedRating = rating;

      // 버튼 상태 업데이트
      btns.forEach((b) => b.className = "feedback-btn");
      btn.className = `feedback-btn selected-${rating}`;

      if (rating === "good") {
        // 좋아요는 바로 전송
        commentBox.classList.remove("visible");
        submitFeedback(mode, "good", undefined, context);
        bar.querySelector(".feedback-btns")?.remove();
        bar.querySelector(".feedback-prompt")?.remove();
        commentBox.style.display = "none";
        doneMsg.style.display = "block";
      } else {
        // 아쉬워요는 코멘트 입력 표시
        commentBox.classList.add("visible");
      }
    });
  });

  // 코멘트 전송
  const submitBtn = bar.querySelector(".feedback-submit") as HTMLButtonElement;
  const textarea = bar.querySelector("textarea") as HTMLTextAreaElement;
  submitBtn.addEventListener("click", () => {
    if (!selectedRating) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "전송 중...";
    submitFeedback(mode, selectedRating, textarea.value.trim(), context);
    setTimeout(() => {
      bar.querySelector(".feedback-btns")?.remove();
      bar.querySelector(".feedback-prompt")?.remove();
      commentBox.style.display = "none";
      doneMsg.style.display = "block";
    }, 300);
  });
}

async function submitFeedback(
  type: "analysis" | "writing",
  rating: "good" | "bad",
  comment: string | undefined,
  context: { frameName?: string; score?: number; issueCount?: number },
) {
  const baseUrl = getSimuloBaseUrl();
  try {
    await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, rating, comment, context }),
    });
  } catch {
    // 피드백 전송 실패는 무시 (UX 차단하지 않음)
  }
}

// -------- Free mode (Simulo backend proxy) --------
async function callFreeMode(
  mode: "analysis" | "writing",
  payload: { systemPrompt: string; content: unknown; frameName?: string },
): Promise<AnalysisResult | WritingCheckResult> {
  const baseUrl = getSimuloBaseUrl();
  const response = await fetch(`${baseUrl}/api/analyze-free`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      systemPrompt: payload.systemPrompt,
      content: payload.content,
      frameName: payload.frameName,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || t("error.freeFail", { status: response.status }));
  }

  const data = await response.json();
  return data.result;
}

// -------- Google Sheets export --------

function updateSheetsButtonState() {
  const btn = $<HTMLButtonElement>("exportSheetsBtn");
  if (!btn) return;
  btn.textContent = googleTokens ? t("export.sheets") : t("export.sheetsConnect");
}

function generateSessionId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function startGoogleAuth(): Promise<boolean> {
  const baseUrl = getSimuloBaseUrl();
  const sessionId = generateSessionId();

  // Open auth URL in external browser
  parent.postMessage({
    pluginMessage: { type: "open-external", url: `${baseUrl}/api/google/auth?plugin_session=${sessionId}` },
  }, "*");

  showFixToast(t("google.connectHint"), "success");

  // Poll for tokens
  return new Promise<boolean>((resolve) => {
    let attempts = 0;
    const maxAttempts = 60; // 2s * 60 = 2분 타임아웃

    if (googleAuthPollTimer) clearInterval(googleAuthPollTimer);

    googleAuthPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (googleAuthPollTimer) clearInterval(googleAuthPollTimer);
        googleAuthPollTimer = null;
        showFixToast(t("google.timeout"), "error");
        resolve(false);
        return;
      }

      try {
        const res = await fetch(`${baseUrl}/api/google/token-check?session=${sessionId}`);
        const data = await res.json();
        if (data.status === "ready" && data.tokens) {
          if (googleAuthPollTimer) clearInterval(googleAuthPollTimer);
          googleAuthPollTimer = null;
          googleTokens = data.tokens;
          // Save to clientStorage
          parent.postMessage({
            pluginMessage: { type: "save-google-tokens", tokens: JSON.stringify(googleTokens) },
          }, "*");
          updateSheetsButtonState();
          showFixToast(t("google.connected"), "success");
          resolve(true);
        }
      } catch {
        // 네트워크 에러 무시, 계속 폴링
      }
    }, 2000);
  });
}

async function exportToGoogleSheets() {
  if (lastWritingResults.length === 0) return;

  // 인증 안 됐으면 인증 먼저
  if (!googleTokens) {
    const authenticated = await startGoogleAuth();
    if (!authenticated) return;
  }

  const btn = $<HTMLButtonElement>("exportSheetsBtn");
  btn.disabled = true;
  btn.textContent = t("loading.sheetsExport");

  const baseUrl = getSimuloBaseUrl();

  const sessions = [{
    createdAt: new Date().toISOString(),
    frames: lastWritingResults.map((r) => ({
      frameName: r.frameName,
      score: r.score,
      issues: r.issues.map((iss) => ({
        location: iss.location,
        original: iss.original,
        suggestion: iss.suggestion,
        reason: iss.reason,
        severity: iss.severity,
        principle: iss.principle,
      })),
    })),
  }];

  try {
    const res = await fetch(`${baseUrl}/api/google/sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: googleTokens?.access_token ?? "",
        refreshToken: googleTokens?.refresh_token ?? "",
        sessions,
        spreadsheetId: savedSpreadsheetId || undefined,
      }),
    });

    const data = await res.json();

    if (data.error === "google_token_expired") {
      // 토큰 만료 → 재인증
      googleTokens = null;
      parent.postMessage({ pluginMessage: { type: "save-google-tokens", tokens: "" } }, "*");
      updateSheetsButtonState();
      showFixToast(t("google.expired"), "error");
      btn.disabled = false;
      btn.textContent = t("export.sheetsConnect");
      return;
    }

    if (data.error) {
      throw new Error(data.error);
    }

    // 성공: spreadsheetId 저장 (다음번에 append)
    if (data.spreadsheetId) {
      savedSpreadsheetId = data.spreadsheetId;
      parent.postMessage({
        pluginMessage: { type: "save-spreadsheet-id", spreadsheetId: data.spreadsheetId },
      }, "*");
    }

    // 시트 열기
    if (data.url) {
      parent.postMessage({ pluginMessage: { type: "open-external", url: data.url } }, "*");
    }

    const label = data.appended ? t("export.sheetsAppended") : t("export.sheetsCreated");
    showFixToast(t("export.sheetsSuccess", { label }), "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : t("loading.sheetsExport");
    showFixToast(t("export.sheetsFail", { msg }), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = googleTokens ? t("export.sheets") : t("export.sheetsConnect");
  }
}

function showFixToast(message: string, type: "success" | "error") {
  // Remove existing toast
  const existing = document.querySelector(".fix-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `fix-toast fix-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fix-toast-hide");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ──────────────── 채팅 인터페이스 함수 ────────────────

function chatId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function addMsg(msg: ChatMessage) {
  chatMessages.push(msg);
  renderMessages();
  saveChatHistory();
}

function saveChatHistory() {
  try {
    const toSave = chatMessages
      .filter((m) => !m.streaming)
      .slice(-15);
    localStorage.setItem("simulo_chat_history", JSON.stringify(toSave));
  } catch { /* quota exceeded or unavailable */ }
}

function loadChatHistory(): ChatMessage[] {
  try {
    const saved = localStorage.getItem("simulo_chat_history");
    if (saved) {
      const parsed = JSON.parse(saved) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* parse error */ }
  return [];
}

function clearChatHistory() {
  try { localStorage.removeItem("simulo_chat_history"); } catch {}
}

function updateMsg(id: string, patch: Partial<ChatMessage>) {
  const idx = chatMessages.findIndex((m) => m.id === id);
  if (idx !== -1) chatMessages[idx] = { ...chatMessages[idx], ...patch };
  renderMessages();
  saveChatHistory();
}

function renderMessages() {
  const container = $("chatMessages");
  const emptyState = $("emptyState");
  if (!container) return;

  if (chatMessages.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }
  if (emptyState) emptyState.classList.add("hidden");
  container.classList.remove("hidden");
  container.innerHTML = chatMessages.map(renderMsgHTML).join("");

  // Attach event listeners
  container.querySelectorAll(".chat-label-chip:not(.disabled)").forEach((chip) => {
    (chip as HTMLElement).addEventListener("click", () => {
      handleIntentLabel((chip as HTMLElement).dataset.cat!);
    });
  });
  container.querySelectorAll(".chat-followup-btn:not(.disabled)").forEach((btn) => {
    (btn as HTMLElement).addEventListener("click", () => {
      const catId = (btn as HTMLElement).dataset.cat!;
      const idx = parseInt((btn as HTMLElement).dataset.idx!);
      const tree = FOLLOW_UP_TREE[catId];
      if (tree) handleFollowUpClick(catId, tree.options[idx]);
    });
  });
  container.querySelectorAll(".chat-action-btn").forEach((btn) => {
    (btn as HTMLElement).addEventListener("click", () => {
      handleChatAction((btn as HTMLElement).dataset.action!);
    });
  });
  container.querySelectorAll(".mini-finding").forEach((finding) => {
    finding.addEventListener("click", () => finding.classList.toggle("mini-finding-collapsed"));
  });

  container.scrollTop = container.scrollHeight;
}

function renderMsgHTML(msg: ChatMessage): string {
  const cls = msg.role === "user" ? "chat-msg-user" : msg.role === "system" ? "chat-msg-system" : "chat-msg-bot";
  let inner = "";
  if (msg.streaming && !msg.content) {
    inner = `<div class="typing-indicator"><span class="typing-dot-plugin"></span><span class="typing-dot-plugin"></span><span class="typing-dot-plugin"></span></div>`;
  } else {
    inner = `<div class="chat-bubble${msg.streaming ? " streaming-cursor" : ""}">${escapeHtml(msg.content)}</div>`;
  }

  if (msg.labels) {
    inner += `<div class="chat-labels">${msg.labels.map((l) =>
      `<button class="chat-label-chip" data-cat="${l.id}">${escapeHtml(l.name)}</button>`
    ).join("")}</div>`;
  }

  if (msg.followUps && msg.followUps.length > 0) {
    const catId = contextStack.selectedCategory ?? "";
    inner += `<div class="chat-followups">${msg.followUps.map((o, i) =>
      `<button class="chat-followup-btn" data-idx="${i}" data-cat="${catId}">${escapeHtml(o.label)}</button>`
    ).join("")}</div>`;
  }

  if (msg.miniReport) inner += renderMiniReportHTML(msg.miniReport);

  if (msg.actions && msg.actions.length > 0) {
    inner += `<div class="chat-actions">${msg.actions.map((a) =>
      `<button class="chat-action-btn${a.primary ? " primary" : ""}" data-action="${a.id}">${escapeHtml(a.label)}</button>`
    ).join("")}</div>`;
  }

  return `<div class="chat-msg ${cls}">${inner}</div>`;
}

function renderMiniReportHTML(report: LiveMiniReport): string {
  const sevCls = ["sev-0", "sev-1", "sev-2", "sev-3", "sev-4"];
  const findings = report.findings.map((f) => {
    const s = Math.min(4, Math.max(0, f.severity));
    return `<div class="mini-finding mini-finding-collapsed">
      <div class="mini-finding-header">
        <div class="sev-dot ${sevCls[s]}"></div>
        <span class="mini-finding-criterion">${escapeHtml(f.criterion)}</span>
        <span class="mini-finding-oneliner">${escapeHtml(f.oneLineFinding)}</span>
      </div>
      <div class="mini-finding-detail">${escapeHtml(f.detail)}</div>
      <div class="mini-finding-fix"><span class="mini-finding-fix-label">수정</span>${escapeHtml(f.fix)}</div>
    </div>`;
  }).join("");
  return `<div class="mini-report">
    <div class="mini-report-summary">${escapeHtml(report.quickSummary)}</div>
    ${findings}
    ${report.nextQuestion ? `<div style="font-size:11px;color:#555;margin-top:2px;">💬 ${escapeHtml(report.nextQuestion)}</div>` : ""}
  </div>`;
}

function handleFramesSelected(frames: FrameInfo[]) {
  // Abort any in-progress analysis and clean up streaming message
  if (chatAbortController) {
    chatAbortController.abort();
    // Remove any dangling streaming message
    chatMessages = chatMessages.filter((m) => !m.streaming);
    chatAnalyzing = false;
  }

  // Reset chips for the new conversation
  chipsHidden = false;
  showHintChips();

  // Capture previous session state before reset
  const hadPreviousResult = contextStack.results.length > 0;
  const previousIntent = contextStack.intent;

  chatMessages = [];
  contextStack = {
    frames,
    frameMode: frames.length > 1 ? null : "single",
    intent: null, subContext: null,
    persona: null, pipeline: [],
    results: [],
    conversationHistory: [], lastReport: null, selectedCategory: null,
  };
  chatAnalyzing = false;

  const initialLabels = getLabelsForState(contextStack);

  if (frames.length === 1) {
    addMsg({ id: chatId(), role: "system", content: `"${frames[0].nodeName}" 선택됨` });
    if (hadPreviousResult && previousIntent) {
      addMsg({
        id: chatId(), role: "bot",
        content: "새 프레임이에요. 이전 분석을 이어갈까요?",
        labels: [
          { id: `__continue-${previousIntent}`, name: "이어서 분석" },
          { id: "__new-start", name: "새로 시작" },
        ],
      });
    } else {
      addMsg({ id: chatId(), role: "bot", content: "이 화면에서 뭘 해볼까요?", labels: initialLabels });
    }
  } else if (frames.length === 2) {
    const names = frames.map((f) => f.nodeName).join(", ");
    addMsg({ id: chatId(), role: "system", content: `${frames.length}개 프레임 선택됨: ${names}` });
    addMsg({
      id: chatId(), role: "bot",
      content: `${frames.length}개 화면을 선택했네요.`,
      labels: [
        { id: "mode-compare",  name: "Before/After 비교" },
        { id: "mode-flow",     name: "플로우로 분석" },
        { id: "mode-separate", name: "각각 따로 분석" },
      ],
    });
  } else {
    const names = frames.map((f) => f.nodeName).join(", ");
    addMsg({ id: chatId(), role: "system", content: `${frames.length}개 프레임 선택됨: ${names}` });
    addMsg({
      id: chatId(), role: "bot",
      content: `${frames.length}개 화면을 선택했네요. 어떻게 볼까요?`,
      labels: [
        { id: "mode-flow",     name: "플로우로 분석" },
        { id: "mode-separate", name: "각각 따로 분석" },
      ],
    });
  }
}

function handleFramesDeselected() {
  if (contextStack.frames.length > 0) {
    contextStack.frames = [];
  }
}

function handleTooManyFrames(count: number) {
  chatMessages = [];
  clearChatHistory();
  contextStack.frames = [];
  renderMessages();
  addMsg({
    id: chatId(), role: "bot",
    content: `${count}개는 너무 많아요. 핵심 프레임 1~5개를 선택해주세요.`,
    labels: [],
  });
}

function handleIntentLabel(labelId: string) {
  if (chatAnalyzing) return;

  // "다른 프레임 보기" special label
  if (labelId === "__new-frame") {
    addMsg({ id: chatId(), role: "bot", content: "Figma에서 다른 프레임을 선택해주세요.", labels: [] });
    return;
  }

  // 이전 분석 이어서 / 새로 시작
  if (labelId.startsWith("__continue-")) {
    const prevIntent = labelId.replace("__continue-", "");
    contextStack.intent = prevIntent;
    contextStack.selectedCategory = INTENT_TO_CATEGORY[prevIntent] ?? "scan";
    contextStack.pipeline = [prevIntent];
    document.querySelectorAll(".chat-label-chip").forEach((c) => c.classList.add("disabled"));
    addMsg({ id: chatId(), role: "user", content: "이어서 분석" });
    startChatAnalysis(contextStack.selectedCategory, "");
    return;
  }

  if (labelId === "__new-start") {
    document.querySelectorAll(".chat-label-chip").forEach((c) => c.classList.add("disabled"));
    addMsg({ id: chatId(), role: "user", content: "새로 시작" });
    addMsg({
      id: chatId(), role: "bot",
      content: "이 화면에서 뭘 해볼까요?",
      labels: getLabelsForState(contextStack),
    });
    return;
  }

  // Frame mode selection
  if (labelId.startsWith("mode-")) {
    const mode = labelId.replace("mode-", "") as "compare" | "flow" | "separate";
    contextStack.frameMode = mode;
    document.querySelectorAll(".chat-label-chip").forEach((c) => c.classList.add("disabled"));
    const modeNames: Record<string, string> = {
      compare: "Before/After 비교",
      flow: "플로우로 분석",
      separate: "각각 따로 분석",
    };
    addMsg({ id: chatId(), role: "user", content: modeNames[mode] ?? mode });
    addMsg({ id: chatId(), role: "bot", content: "어떤 부분을 집중적으로 볼까요?", labels: getLabelsForState(contextStack) });
    return;
  }

  if (!contextStack.frames.length) return;
  document.querySelectorAll(".chat-label-chip").forEach((c) => c.classList.add("disabled"));

  // Set intent
  contextStack.intent = labelId;
  contextStack.selectedCategory = INTENT_TO_CATEGORY[labelId] ?? labelId;
  contextStack.pipeline = [labelId];

  // Get label display name
  const allLabels = getLabelsForState({ ...contextStack, intent: null, results: [] });
  const name = allLabels.find((l) => l.id === labelId)?.name ?? labelId;
  addMsg({ id: chatId(), role: "user", content: name });

  // Check for follow-up tree
  const followUpKey = labelId === "copy-rewrite" ? "writing"
    : labelId === "usability" ? "usability"
    : labelId === "visual" ? "visual"
    : labelId === "cta" ? "cta"
    : null;

  if (followUpKey && FOLLOW_UP_TREE[followUpKey]) {
    const tree = FOLLOW_UP_TREE[followUpKey];
    addMsg({ id: chatId(), role: "bot", content: tree.question, followUps: tree.options });
  } else {
    startChatAnalysis(contextStack.selectedCategory ?? "scan", "");
  }
}

function handleFollowUpClick(catId: string, option: { id: string; label: string; contextValue: string }) {
  if (chatAnalyzing) return;
  document.querySelectorAll(".chat-followup-btn").forEach((b) => b.classList.add("disabled"));
  contextStack.subContext = option.contextValue;
  addMsg({ id: chatId(), role: "user", content: option.label });
  // catId is the follow-up tree key; map to category
  const category = INTENT_TO_CATEGORY[contextStack.intent ?? catId] ?? catId;
  startChatAnalysis(category, option.contextValue);
}

function compactConversationHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): typeof history {
  if (history.length <= 10) return history;
  const firstTwo = history.slice(0, 2);
  const recent = history.slice(-8);
  const omitted = Math.floor((history.length - 10) / 2);
  return [
    ...firstTwo,
    { role: "user", content: `[이전 대화 요약: ${omitted}번의 분석 생략됨]` },
    ...recent,
  ];
}

const ANALYSIS_TIMEOUT_MS = 60_000; // 60s

async function startChatAnalysis(_categoryId: string, followUpContext: string) {
  if (!contextStack.frames.length) return;
  chatAnalyzing = true;

  const msgId = chatId();
  addMsg({ id: msgId, role: "bot", content: "", streaming: true });

  // Artificial delay for "thinking" feel (400~700ms)
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

  chatAbortController = new AbortController();
  const timeoutId = setTimeout(() => chatAbortController?.abort(), ANALYSIS_TIMEOUT_MS);
  const apiKey = getApiKey();
  const baseUrl = getSimuloBaseUrl();

  // Build OCR context from all selected frames
  const framesWithText = contextStack.frames.filter((f) => f.texts?.length > 0);
  const baseOcrCtx = framesWithText.length > 0
    ? buildFigmaOcrContext(
        framesWithText.map((f) => ({ name: f.nodeName, base64: f.imageBase64, texts: f.texts }))
      )
    : undefined;
  const figmaOcrCtx = contextStack.intent === "typography-hierarchy"
    ? (baseOcrCtx ?? "") + buildTypographyWeightContext(contextStack.frames)
    : baseOcrCtx;

  // Resolve subContext: combine stored subContext + followUpContext
  const resolvedSubCtx = [contextStack.subContext, followUpContext]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: chatAbortController.signal,
      body: JSON.stringify({
        frames: contextStack.frames.map((f) => ({
          nodeId: f.nodeId,
          nodeName: f.nodeName,
          imageBase64: f.imageBase64,
        })),
        intent: contextStack.intent ?? "full-scan",
        subContext: resolvedSubCtx,
        conversationHistory: compactConversationHistory(contextStack.conversationHistory),
        userMessage: followUpContext || "",
        apiKey: apiKey || undefined,
        ocrContext: figmaOcrCtx,
        persona: contextStack.persona?.promptContext || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      const errMsg = res.status === 401
        ? "API 키가 유효하지 않아요. 설정에서 확인해주세요."
        : res.status === 429
        ? "요청이 너무 많아요. 잠시 후 다시 시도해주세요."
        : err?.error ?? "분석 중 오류가 발생했습니다.";
      updateMsg(msgId, {
        content: errMsg, streaming: false,
        actions: [{ id: "retry", label: "↺ 다시 시도" }],
      });
      chatAnalyzing = false;
      return;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    const streamStart = Date.now();

    // Loading message rotation
    const loadingMsgs: Record<string, string[]> = {
      "full-scan": ["화면을 살펴보고 있어요...", "4축 관점으로 집중 분석 중...", "개선 포인트를 정리하고 있어요..."],
      "copy-rewrite": ["현재 카피를 분석하고 있어요...", "여러 톤으로 변형을 만드는 중...", "가장 효과적인 카피를 고르고 있어요..."],
      "ab-variant": ["현재 화면의 이슈를 파악하고...", "가설 기반으로 변형을 설계하는 중...", "예상 효과를 추정하고 있어요..."],
      "competitor-compare": ["야핏무브 화면을 먼저 분석하고...", "경쟁사 화면과 나란히 비교하는 중...", "격차를 정리하고 있어요..."],
      "state-audit": ["화면 상태들을 점검하고 있어요...", "에러·빈·로딩 상태 누락 여부 확인 중...", "커버리지 결과를 정리하고 있어요..."],
      "text-consistency": ["화면별 텍스트를 비교하고 있어요...", "같은 개념의 다른 표현을 찾는 중...", "불일치 항목을 정리하고 있어요..."],
      "typography-hierarchy": ["텍스트 시각 가중치를 계산하고 있어요...", "의미 카테고리를 분류하는 중...", "위계 역전 패턴을 찾고 있어요..."],
    };
    const msgs = loadingMsgs[_categoryId] ?? ["분석하고 있어요..."];
    const getLoadMsg = () => msgs[Math.min(Math.floor((Date.now() - streamStart) / 3500), msgs.length - 1)];

    updateMsg(msgId, { content: getLoadMsg(), streaming: true });
    const loadingTimer = setInterval(() => {
      if (!accumulated) updateMsg(msgId, { content: getLoadMsg(), streaming: true });
    }, 3500);

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data) as { text?: string; error?: string };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) accumulated += parsed.text;
        } catch { /* partial JSON ok */ }
      }
    }
    clearInterval(loadingTimer);

    let miniReport: LiveMiniReport | null = null;
    try {
      const m = accumulated.match(/\{[\s\S]*\}/);
      if (m) miniReport = JSON.parse(m[0]) as LiveMiniReport;
    } catch { /* ignore parse error */ }

    contextStack.lastReport = miniReport;
    contextStack.results.push({
      intent: contextStack.intent ?? "full-scan",
      pipeline: contextStack.pipeline,
      output: miniReport,
      timestamp: Date.now(),
    });

    // Fire-and-forget: save session to DB
    if (miniReport && contextStack.frames[0]) {
      const sessionPayload = {
        frameId:      contextStack.frames[0].nodeId || contextStack.frames[0].nodeName,
        frameName:    contextStack.frames[0].nodeName,
        intent:       contextStack.intent ?? "full-scan",
        quickSummary: miniReport.quickSummary,
        findings:     miniReport.findings,
      };
      fetch(`${baseUrl}/api/chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload),
      }).catch(() => { /* best-effort, ignore errors */ });
    }

    const completedResults = contextStack.results.filter(r => r.output).length;
    updateMsg(msgId, {
      content: miniReport?.quickSummary ?? accumulated.slice(0, 60),
      streaming: false,
      miniReport,
      actions: [
        completedResults >= 2
          ? { id: "copy-all", label: "📋 전체 리포트 복사", primary: true }
          : { id: "comment",  label: "📋 결과 복사", primary: true },
        { id: "rescan", label: "↩ 다시 분석" },
      ],
      labels: getLabelsForState(contextStack),
    });
    contextStack.conversationHistory = [
      ...contextStack.conversationHistory,
      { role: "user", content: `${contextStack.frames[0]?.nodeName ?? "프레임"} — ${contextStack.intent ?? "scan"} 분석` },
      { role: "assistant", content: accumulated },
    ];
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      // Timeout vs user-triggered abort
      const isTimeout = chatMessages.find((m) => m.id === msgId)?.streaming;
      if (isTimeout) {
        updateMsg(msgId, {
          content: "응답이 너무 오래 걸려요. 다시 시도해주세요.",
          streaming: false,
          actions: [{ id: "retry", label: "↺ 다시 시도" }],
        });
      } else {
        // User-triggered (frame change): silently remove the streaming msg
        chatMessages = chatMessages.filter((m) => m.id !== msgId);
        renderMessages();
      }
      return;
    }
    const isNetworkError = (err as Error)?.message?.includes("fetch") || (err as Error)?.message?.includes("network");
    updateMsg(msgId, {
      content: isNetworkError
        ? "서버 연결 실패. 인터넷 연결을 확인해주세요."
        : "오류: " + String(err),
      streaming: false,
      actions: [{ id: "retry", label: "↺ 다시 시도" }],
    });
  } finally {
    clearTimeout(timeoutId);
    chatAnalyzing = false;
  }
}

function handleChatAction(action: string) {
  if (action === "retry") {
    if (!contextStack.frames.length || !contextStack.intent) return;
    // Remove the error message and retry
    chatMessages = chatMessages.filter((m) => m.role !== "bot" || (!m.actions?.some((a) => a.id === "retry")));
    renderMessages();
    startChatAnalysis(contextStack.selectedCategory ?? "scan", contextStack.subContext ?? "");
    return;
  }

  if (action === "rescan") {
    if (!contextStack.frames.length) return;
    chatMessages = chatMessages.slice(0, 1);
    contextStack.intent = null;
    contextStack.selectedCategory = null;
    contextStack.conversationHistory = [];
    contextStack.lastReport = null;
    contextStack.pipeline = [];
    contextStack.results = [];
    chatAnalyzing = false;
    addMsg({ id: chatId(), role: "bot", content: "이 화면에서 뭘 해볼까요?", labels: getLabelsForState(contextStack) });
  } else if (action === "comment") {
    if (!contextStack.lastReport) return;
    const sevEmoji = ["✅", "💡", "⚠️", "🔴", "🚨"];
    const commentText = contextStack.lastReport.findings
      .map((f) => `${sevEmoji[Math.min(4, f.severity)]} [${f.criterion}] ${f.oneLineFinding}\n→ ${f.fix}`)
      .join("\n\n");
    const frameName = contextStack.frames[0]?.nodeName ?? "선택된 프레임";
    const fullComment = `📊 Simulo 분석 — ${frameName}\n${contextStack.lastReport.quickSummary}\n\n${commentText}`;
    navigator.clipboard.writeText(fullComment).catch(() => {});
    // CTA success feedback
    const commentBtns = document.querySelectorAll('.chat-action-btn[data-action="comment"]');
    commentBtns.forEach((btn) => {
      btn.classList.add("success");
      (btn as HTMLElement).textContent = "✓ 복사됨";
      setTimeout(() => { btn.classList.remove("success"); (btn as HTMLElement).textContent = "📋 결과 복사"; }, 1500);
    });
    showLiveCommentPopup(fullComment);
  } else if (action === "copy-all") {
    const sevEmoji = ["✅", "💡", "⚠️", "🔴", "🚨"];
    const intentLabel: Record<string, string> = {
      "full-scan": "🔍 전체 스캔",
      "accessibility": "♿ 접근성",
      "copy-rewrite": "✍️ 카피 리라이팅",
      "ab-variant": "🔀 A/B 변형",
      "analyze-axis": "📊 축 분석",
      "competitor-compare": "🔎 경쟁사 비교",
      "suggestion": "💡 개선 제안",
    };
    const frameName = contextStack.frames[0]?.nodeName ?? "선택된 프레임";
    const lines: string[] = [
      `# Simulo 분석 리포트 — ${frameName}`,
      `생성: ${new Date().toLocaleString("ko-KR")}`,
      "",
    ];
    for (const turn of contextStack.results) {
      if (!turn.output) continue;
      lines.push(`## ${intentLabel[turn.intent] ?? turn.intent}`);
      lines.push(turn.output.quickSummary);
      lines.push("");
      for (const f of turn.output.findings) {
        const e = sevEmoji[Math.min(4, f.severity)];
        lines.push(`${e} **[${f.criterion}]** ${f.oneLineFinding}`);
        lines.push(`→ ${f.fix}`);
      }
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    showFixToast("📋 리포트 복사됨", "success");
  }
}

async function handleChatInput(text: string) {
  if (!text.trim() || chatAnalyzing) return;
  hideHintChips();

  if (!contextStack.frames.length) {
    addMsg({ id: chatId(), role: "bot", content: "먼저 Figma에서 프레임을 선택해주세요." });
    return;
  }

  addMsg({ id: chatId(), role: "user", content: text });

  // Direction change: reset intent, keep frame + history
  if (isDirectionChange(text)) {
    contextStack.intent = null;
    contextStack.subContext = null;
    contextStack.pipeline = [];
  }

  // 페르소나 감지 (intent와 독립)
  const detectedPersona = detectPersonaFromText(text);
  if (detectedPersona) {
    contextStack.persona = detectedPersona;
  }

  // 1단계: keyword 즉시 감지
  const kwResult = detectIntentByKeyword(text);
  if (kwResult) {
    applyIntentAndAnalyze(kwResult, text);
    return;
  }

  // 2단계: Haiku 폴백 (로딩 표시)
  const thinkingId = chatId();
  addMsg({ id: thinkingId, role: "bot", content: "...", streaming: true });

  const haikuResult = await detectIntentByHaiku(text);
  chatMessages = chatMessages.filter((m) => m.id !== thinkingId);
  renderMessages();

  applyIntentAndAnalyze(haikuResult, text);
}

function applyIntentAndAnalyze(result: IntentDetectionResult, originalText: string) {
  contextStack.intent = result.intent;
  if (result.axis) contextStack.subContext = `axis:${result.axis}${result.subContext ? ` ${result.subContext}` : ""}`;
  else if (result.subContext) contextStack.subContext = result.subContext;

  const category = INTENT_TO_CATEGORY[result.intent] ?? "scan";
  contextStack.selectedCategory = category;
  contextStack.pipeline = [result.intent];

  startChatAnalysis(category, originalText);
}

function resetChat() {
  chatAbortController?.abort();
  chatMessages = [];
  clearChatHistory();
  contextStack.intent = null;
  contextStack.subContext = null;
  contextStack.selectedCategory = null;
  contextStack.conversationHistory = [];
  contextStack.lastReport = null;
  contextStack.pipeline = [];
  contextStack.results = [];
  chipsHidden = false;
  showHintChips();
  renderMessages();

  if (contextStack.frames.length > 0) {
    addMsg({ id: chatId(), role: "system", content: "대화를 새로 시작합니다." });
    addMsg({
      id: chatId(), role: "bot",
      content: "이 화면에서 뭘 해볼까요?",
      labels: getLabelsForState(contextStack),
    });
  }
}

function showLiveCommentPopup(text: string) {
  const existing = document.getElementById("liveCommentPopup");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "liveCommentPopup";
  overlay.className = "live-comment-overlay";

  const box = document.createElement("div");
  box.className = "live-comment-box";
  box.innerHTML = `
    <div class="live-comment-title">📋 분석 결과 복사됨</div>
    <div class="live-comment-desc">아래 내용이 클립보드에 복사되었습니다.<br>Figma 프레임에 <strong>직접 붙여넣기</strong>하거나 팀에 공유하세요.</div>
    <textarea class="live-comment-text" readonly>${escapeHtml(text)}</textarea>
    <button class="live-comment-close btn-primary" style="margin-top:10px;">확인</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => { overlay.classList.add("live-comment-hide"); setTimeout(() => overlay.remove(), 200); };
  overlay.querySelector(".live-comment-close")?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}
