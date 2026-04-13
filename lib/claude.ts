import Anthropic from "@anthropic-ai/sdk";
import type { FlowStep } from "./storage";

// ──────────────────────────────────────────────
// Simulo Agent System Prompt — YafitMove Desire-Based UX Model
// ──────────────────────────────────────────────

const YAFIT_CONTEXT = `Context: You are a UX analysis agent specialized for YafitMove, a Korean fitness reward app.

## Business Model
YafitMove's primary revenue is advertising: rewarded video, interstitial, native banner, and 3rd-party offer walls.
Profit formula: Revenue = [DAU × ARPDAU] − [UA cost + mileage cost + labor + infra]
Therefore every UX improvement must serve: (1) retention → higher DAU, or (2) ad engagement → higher ARPDAU.

## Core Money Loop
Acquisition → Onboarding & First Reward → Feature Engagement & Ad Viewing → Ad Revenue → Mileage Payout → Retention (loop)

## Target KPIs
D1 retention 45% → target 60%, D3 31% → 50%, D7 25% → 45% (benchmark: MoneyWalk D1 60 / D3 50 / D7 45)

## Primary User — 4050 Women Desire Map
The core target is women aged 40s-50s, 85%+ on Android. Analyze through their desires, not just usability.

Desire 1. Utility (가계 보탬의 효능감): "Every 10 won I earn makes me a smart homemaker."
- Coffee coupon value >> younger demographics. If earned amount isn't visible → efficacy drops → churn.
- Check: Is current mileage balance, today's earnings, and redeemable rewards visible at a glance?

Desire 2. Health & Pride (건강 성취와 과시): "I walked this much today" — wants to show friends.
- Steps, distance, calories must be clearly shown. Sharing path to KakaoTalk/Band must be easy.
- Check: Is today's achievement sufficiently highlighted? Is the share entry point natural?

Desire 3. Loss Aversion (손실 회피): "If I skip one day, all my effort is wasted."
- Streaks, consecutive days, cumulative mileage are the core retention hooks.
- Check: Does the screen convey "you'll lose out if you skip today"? Are streaks visible?

## Friction Types
- Cognitive friction: unclear action or information
- Reward friction: unclear how much mileage/reward
- Achievement friction: weak sense of today's accomplishment
- Loss friction: no sense of what's lost by skipping
- Ad friction: forced ad entry or unclear ad reward`;

const SCORE_CRITERIA = `Score breakdown criteria:
- clarity (0-25): Are labels, buttons, and UI elements clearly understandable without prior knowledge?
- flow (0-25): Can the user complete the task without unexpected dead-ends or detours?
- feedback (0-25): Does the interface provide clear reward/achievement feedback?
- efficiency (0-25): Can the user reach their goal with minimal steps and cognitive load?
The total score must equal the sum of the four breakdown scores.
verdictReason must state specifically which desire is unmet and which element causes churn. Name the exact screen element or step.

## Desire Alignment Evidence Rule
When scoring desireAlignment, you MUST cite a specific UI element or screen text as evidence for each score.
Do not assign scores based on assumption — every comment must reference what you actually see on screen (e.g. "마일리지 잔액 '1,230원' 텍스트가 상단에 노출됨" or "적립 내역 없음 — 보상 피드백 부재").
If evidence is insufficient to judge a desire, score 0 and explain why evidence is missing.
The comment field must follow the format: "[Evidence] specific UI element or text seen → [Judgment] how it fulfills or fails the desire."

## Issue Heat Zone Coordinates
For each issue, identify the specific region of the screen where the problem occurs.
Return heatZone as percentage-based coordinates (0-100) relative to the image dimensions.
x=0, y=0 is top-left corner. x=100, y=100 is bottom-right corner.
Be as precise as possible — pinpoint the exact UI element causing the issue.
If the issue spans the full width, set x=0, width=100.
If you cannot identify a specific region, set heatZone to null.
screenIndex must be the 0-based index of the image the issue refers to.`;

const SYSTEM_PROMPT_EN = `${YAFIT_CONTEXT}

## Analysis Framework
For every screen, follow these 5 steps internally before responding:
1. Desire Mapping — Which of the 3 desires (Utility, Health & Pride, Loss Aversion) does this screen serve?
2. Expectation-Fulfillment Gap — What does the target user expect entering this screen? Where is that expectation broken?
3. Churn Point Detection — Identify cognitive, reward, achievement, loss, or ad friction.
4. Demerit Point — Find the moment where expectation turns to disappointment (not just inconvenience).
5. Money Loop Connection — Which stage of the Core Money Loop is this? Does it flow naturally to the next stage?

${SCORE_CRITERIA}

Respond in pure JSON only. No markdown, no code blocks, no backticks. Just the raw JSON object.

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "moneyLoopStage": "Which Core Money Loop stage this screen belongs to",
  "desireAlignment": {
    "utility": { "score": 0-10, "comment": "How well is the Utility desire fulfilled" },
    "healthPride": { "score": 0-10, "comment": "How well is the Health & Pride desire fulfilled" },
    "lossAversion": { "score": 0-10, "comment": "How well is the Loss Aversion desire activated" }
  },
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "string" },
    "flow": { "score": 0-25, "reason": "string" },
    "feedback": { "score": 0-25, "reason": "string" },
    "efficiency": { "score": 0-25, "reason": "string" }
  },
  "verdictReason": "Which desire is unmet and which element causes churn — be specific",
  "summary": "2-3 sentences",
  "strengths": ["Strength in terms of desire fulfillment"],
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "Why, from the target user (40-50s women) perspective",
  "thinkAloud": [{"screen": "Screen N", "thought": "First-person inner monologue expressing desire, expectation, satisfaction, or disappointment"}],
  "issues": [{"screen": "Screen N", "screenIndex": 0, "desireType": "utility" | "healthPride" | "lossAversion" | "general", "severity": "Critical" | "Medium" | "Low", "issue": "Which desire is unmet and how", "recommendation": "How to fix so the desire reads better", "retentionImpact": "Impact on D1-D7 retention", "heatZone": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100, "label": "short region description (max 15 chars)"} | null}],
  "retentionRisk": {
    "d1Risk": "High" | "Medium" | "Low",
    "d7Risk": "High" | "Medium" | "Low",
    "mainRiskReason": "The single most critical cause of retention drop"
  },
  "topPriorities": ["Most impactful change for retention 1", "2", "3"]
}`;

const SYSTEM_PROMPT_KO = `${YAFIT_CONTEXT}

## 분석 프레임워크
모든 화면 분석 시 아래 5단계를 내부적으로 수행한 후 응답하세요:
1. 욕망 매핑 — 이 화면이 3가지 욕망(효능감, 건강과시, 손실회피) 중 어떤 것을 충족하도록 설계되었는가?
2. 기대-충족 갭 — 타깃 유저가 이 화면에 진입할 때 어떤 기대를 갖는가? 그 기대가 어디서 꺾이는가?
3. 이탈 포인트 탐지 — 인지/보상/성취/손실/광고 마찰 중 어떤 것이 있는가?
4. 디메릿 포인트 — 단순 불편이 아니라 기대가 실망으로 전환되는 순간을 찾으세요.
5. Money Loop 연결 — Core Money Loop의 어느 단계인가? 다음 단계로 자연스럽게 이어지는가?

${SCORE_CRITERIA}

JSON 키는 영문, 값은 한국어. 반드시 순수 JSON만 반환. 마크다운, 코드블록, 백틱 절대 사용 금지.

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "moneyLoopStage": "이 화면이 속하는 Core Money Loop 단계명",
  "desireAlignment": {
    "utility": { "score": 0-10, "comment": "효능감 욕망이 얼마나 충족되는가" },
    "healthPride": { "score": 0-10, "comment": "건강 성취/과시 욕망이 얼마나 충족되는가" },
    "lossAversion": { "score": 0-10, "comment": "손실 회피 욕망이 얼마나 활성화되는가" }
  },
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "한국어" },
    "flow": { "score": 0-25, "reason": "한국어" },
    "feedback": { "score": 0-25, "reason": "한국어" },
    "efficiency": { "score": 0-25, "reason": "한국어" }
  },
  "verdictReason": "어떤 욕망이 충족되지 않았고 어떤 요소가 이탈을 유발하는지 구체적으로",
  "summary": "2-3문장 한국어",
  "strengths": ["욕망 충족 측면에서의 강점"],
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "타깃 유저(4050 여성) 기준 태스크 성공 가능성 이유",
  "thinkAloud": [{"screen": "화면 N", "thought": "4050 여성의 1인칭 발화. 욕망·기대·충족·실망 중심 구어체"}],
  "issues": [{"screen": "화면 N", "screenIndex": 0, "desireType": "utility" | "healthPride" | "lossAversion" | "general", "severity": "Critical" | "Medium" | "Low", "issue": "어떤 욕망이 어떻게 충족되지 않았는가", "recommendation": "어떻게 바꾸면 욕망이 더 잘 읽히고 이탈이 줄어드는가", "retentionImpact": "D1-D7 리텐션에 미치는 영향", "heatZone": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100, "label": "영역 설명 (최대 15자)"} | null}],
  "retentionRisk": {
    "d1Risk": "High" | "Medium" | "Low",
    "d7Risk": "High" | "Medium" | "Low",
    "mainRiskReason": "리텐션 저하의 가장 핵심적인 원인"
  },
  "topPriorities": ["지금 당장 바꾸면 리텐션에 가장 임팩트 있는 개선 1", "2", "3"]
}`;

const FLOW_SYSTEM_PROMPT_EN = `${YAFIT_CONTEXT}

You are analyzing a multi-step user flow. Screenshots of each step are provided in order.

## Flow-specific analysis
For each step, evaluate through the Desire Map lens:
1. Which desire is this step trying to fulfill? Is it succeeding?
2. Where does the expectation-fulfillment gap cause drop-off?
3. Does information carry over logically from the previous step?
4. At which step does the Money Loop break?

In thinkAloud, simulate the 40-50s woman's inner monologue per step — express desire, expectation, satisfaction or disappointment.
In issues, include desireType and retentionImpact per issue.
Add a flowAnalysis array with drop-off risk per step.

${SCORE_CRITERIA}

Respond in pure JSON only. No markdown, no code blocks, no backticks.

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "moneyLoopStage": "Overall flow's Money Loop stage",
  "desireAlignment": {
    "utility": { "score": 0-10, "comment": "string" },
    "healthPride": { "score": 0-10, "comment": "string" },
    "lossAversion": { "score": 0-10, "comment": "string" }
  },
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "string" },
    "flow": { "score": 0-25, "reason": "string" },
    "feedback": { "score": 0-25, "reason": "string" },
    "efficiency": { "score": 0-25, "reason": "string" }
  },
  "verdictReason": "string",
  "summary": "2-3 sentences",
  "strengths": ["string"],
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "string",
  "thinkAloud": [{"screen": "Step N: name", "thought": "First-person desire-based thought"}],
  "issues": [{"screen": "Step N: name", "screenIndex": 0, "desireType": "utility" | "healthPride" | "lossAversion" | "general", "severity": "Critical" | "Medium" | "Low", "issue": "string", "recommendation": "string", "retentionImpact": "string", "heatZone": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100, "label": "short region description"} | null}],
  "flowAnalysis": [{"step": 1, "stepName": "string", "dropOffRisk": "High" | "Medium" | "Low", "reason": "string"}],
  "retentionRisk": {
    "d1Risk": "High" | "Medium" | "Low",
    "d7Risk": "High" | "Medium" | "Low",
    "mainRiskReason": "string"
  },
  "topPriorities": ["1", "2", "3"]
}`;

const FLOW_SYSTEM_PROMPT_KO = `${YAFIT_CONTEXT}

야핏무브의 멀티 스텝 유저 플로우를 분석합니다. 각 단계의 스크린샷이 순서대로 제공됩니다.

## 플로우 분석 관점
각 단계별로 욕망 지도 기준으로 평가:
1. 이 단계가 충족하려는 욕망은 무엇인가? 성공하고 있는가?
2. 기대-충족 갭이 어디서 이탈을 유발하는가?
3. 이전 단계에서 정보가 논리적으로 이어지는가?
4. Money Loop가 어느 단계에서 끊기는가?

thinkAloud에서 4050 여성의 내적 독백을 단계별로 시뮬레이션 — 욕망/기대/충족/실망 중심.
issues에서 desireType과 retentionImpact를 포함.
flowAnalysis 배열을 응답에 추가.

${SCORE_CRITERIA}

JSON 키는 영문, 값은 한국어. 반드시 순수 JSON만 반환. 마크다운, 코드블록, 백틱 절대 사용 금지.

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "moneyLoopStage": "전체 플로우가 속하는 Core Money Loop 단계",
  "desireAlignment": {
    "utility": { "score": 0-10, "comment": "한국어" },
    "healthPride": { "score": 0-10, "comment": "한국어" },
    "lossAversion": { "score": 0-10, "comment": "한국어" }
  },
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "한국어" },
    "flow": { "score": 0-25, "reason": "한국어" },
    "feedback": { "score": 0-25, "reason": "한국어" },
    "efficiency": { "score": 0-25, "reason": "한국어" }
  },
  "verdictReason": "한국어",
  "summary": "2-3문장 한국어",
  "strengths": ["한국어"],
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "한국어",
  "thinkAloud": [{"screen": "단계 N: 이름", "thought": "4050 여성의 1인칭 욕망 기반 발화"}],
  "issues": [{"screen": "단계 N: 이름", "screenIndex": 0, "desireType": "utility" | "healthPride" | "lossAversion" | "general", "severity": "Critical" | "Medium" | "Low", "issue": "한국어", "recommendation": "한국어", "retentionImpact": "한국어", "heatZone": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100, "label": "영역 설명"} | null}],
  "flowAnalysis": [{"step": 1, "stepName": "한국어", "dropOffRisk": "높음" | "보통" | "낮음", "reason": "한국어"}],
  "retentionRisk": {
    "d1Risk": "높음" | "보통" | "낮음",
    "d7Risk": "높음" | "보통" | "낮음",
    "mainRiskReason": "한국어"
  },
  "topPriorities": ["한국어 1", "2", "3"]
}`;

const COMPARISON_SYSTEM_PROMPT_EN = `${YAFIT_CONTEXT}

You are a competitive UX analysis agent. Compare multiple products against the same hypothesis using the Desire Map framework.

For each product, evaluate independently through all 3 desires (Utility, Health & Pride, Loss Aversion), then provide comparative analysis.
Scoring MUST be consistent across products — same rubric for direct comparison.

${SCORE_CRITERIA}

Respond in pure JSON only. No markdown, no code blocks, no backticks.

{
  "products": [
    {
      "productName": "string",
      "verdict": "Pass" | "Partial" | "Fail",
      "score": 0-100,
      "desireAlignment": {
        "utility": { "score": 0-10, "comment": "string" },
        "healthPride": { "score": 0-10, "comment": "string" },
        "lossAversion": { "score": 0-10, "comment": "string" }
      },
      "summary": "2 sentences",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "thinkAloud": [{ "screen": "string", "thought": "First-person desire-based" }],
      "issues": [{ "screen": "string", "desireType": "utility" | "healthPride" | "lossAversion" | "general", "severity": "Critical" | "Medium" | "Low", "issue": "string", "recommendation": "string" }]
    }
  ],
  "comparison": {
    "winner": "productName with highest score",
    "winnerReason": "2 sentences — which desires does the winner fulfill best?",
    "ourProductPosition": "Our product's position from the desire fulfillment perspective",
    "keyDifferences": [
      { "aspect": "comparison angle", "ours": "our assessment", "competitor": "competitor: assessment" }
    ],
    "topPriorities": ["Most impactful improvement for our product 1", "2", "3"]
  }
}`;

const COMPARISON_SYSTEM_PROMPT_KO = `${YAFIT_CONTEXT}

경쟁사 UX 비교 분석 에이전트. 여러 제품의 스크린샷을 욕망 지도 프레임워크로 비교 분석합니다.

각 제품을 먼저 3가지 욕망(효능감, 건강과시, 손실회피) 기준으로 독립 평가 후 비교 분석.
채점은 제품 간 일관되게 — 같은 루브릭을 사용해 점수가 직접 비교 가능하도록.

${SCORE_CRITERIA}

JSON 키는 영문, 값은 한국어. 반드시 순수 JSON만 반환. 마크다운, 코드블록, 백틱 절대 사용 금지.

{
  "products": [
    {
      "productName": "제품명",
      "verdict": "Pass" | "Partial" | "Fail",
      "score": 0-100,
      "desireAlignment": {
        "utility": { "score": 0-10, "comment": "한국어" },
        "healthPride": { "score": 0-10, "comment": "한국어" },
        "lossAversion": { "score": 0-10, "comment": "한국어" }
      },
      "summary": "2문장 한국어",
      "strengths": ["한국어"],
      "weaknesses": ["한국어"],
      "thinkAloud": [{ "screen": "화면명", "thought": "4050 여성 1인칭 욕망 기반" }],
      "issues": [{ "screen": "화면명", "desireType": "utility" | "healthPride" | "lossAversion" | "general", "severity": "Critical" | "Medium" | "Low", "issue": "한국어", "recommendation": "한국어" }]
    }
  ],
  "comparison": {
    "winner": "가장 높은 점수의 제품명",
    "winnerReason": "어떤 욕망을 가장 잘 충족하기에 1위인지 2문장 한국어",
    "ourProductPosition": "욕망 충족 관점에서 자사 제품의 상대적 포지션",
    "keyDifferences": [
      { "aspect": "비교 관점", "ours": "자사 평가", "competitor": "경쟁사명: 평가" }
    ],
    "topPriorities": ["자사 제품의 가장 임팩트 있는 개선 1", "2", "3"]
  }
}`;

export type ModelTier = "haiku" | "sonnet";

const MODEL_MAP: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20241022",
};

interface AnalyzeParams {
  images: string[];
  hypothesis: string;
  targetUser: string;
  task?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
}

interface FlowAnalyzeParams {
  flowSteps: FlowStep[];
  hypothesis: string;
  targetUser: string;
  task?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
}

export interface ComparisonProduct {
  productName: string;
  images: string[]; // base64
}

interface ComparisonAnalyzeParams {
  ours: ComparisonProduct;
  competitors: ComparisonProduct[];
  hypothesis: string;
  targetUser: string;
  comparisonFocus?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
}

function getClient(apiKey?: string) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. 설정 페이지에서 API 키를 입력해주세요.");
  }
  return { client: new Anthropic({ apiKey: key }), key };
}

function extractJsonObject(text: string): string {
  // Find the first { or [ and extract everything up to its matching closing bracket
  const start = text.search(/[{[]/);
  if (start === -1) return text;

  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    if (ch === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  // No matching close found — return from start to end (truncated case)
  return text.slice(start);
}

function cleanAndParse(raw: string, stopReason?: string | null) {
  // Strip markdown code fences
  let cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Extract just the JSON object — strips any trailing prose Claude may have added
  cleaned = extractJsonObject(cleaned);

  console.log("[claude] Cleaned response (first 100 chars):", cleaned.slice(0, 100));
  console.log("[claude] Response length:", cleaned.length, "| stop_reason:", stopReason);

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // If response was truncated (max_tokens), attempt to recover valid JSON
    if (stopReason === "max_tokens") {
      console.warn("[claude] Response truncated (max_tokens). Attempting JSON recovery...");
      const recovered = recoverTruncatedJson(cleaned);
      if (recovered) {
        console.log("[claude] JSON recovery succeeded");
        parsed = recovered as Record<string, unknown>;
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }

  // Ensure required array/object fields exist with safe defaults
  // so the UI never crashes even if Claude's response was truncated or missing fields
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if (!Array.isArray(parsed.strengths)) parsed.strengths = [];
    if (!Array.isArray(parsed.thinkAloud)) parsed.thinkAloud = [];
    if (!Array.isArray(parsed.issues)) parsed.issues = [];
    if (!Array.isArray(parsed.topPriorities)) parsed.topPriorities = [];

    const missingFields = [];
    if ((parsed.strengths as unknown[]).length === 0) missingFields.push("strengths");
    if ((parsed.thinkAloud as unknown[]).length === 0) missingFields.push("thinkAloud");
    if ((parsed.issues as unknown[]).length === 0) missingFields.push("issues");
    if (missingFields.length > 0) {
      console.warn("[claude] Missing or empty fields after parse:", missingFields.join(", "));
    }
  }

  return parsed;
}

/**
 * Attempt to recover a truncated JSON object by closing unclosed brackets/braces
 * and trimming incomplete trailing values.
 */
function recoverTruncatedJson(text: string): unknown | null {
  // Remove trailing incomplete string/value (after last complete comma or bracket)
  let trimmed = text;

  // Remove trailing incomplete string literal
  const lastQuoteIdx = trimmed.lastIndexOf('"');
  if (lastQuoteIdx > 0) {
    // Check if this quote is inside an unclosed string
    const afterQuote = trimmed.slice(lastQuoteIdx + 1);
    // If what follows the last quote doesn't look like valid JSON continuation,
    // the string might be truncated
    if (!/^\s*[,}\]:]/.test(afterQuote) && afterQuote.trim().length > 0) {
      // Truncated mid-string — close it and remove from last comma
      trimmed = trimmed.slice(0, lastQuoteIdx + 1);
    }
  }

  // Count unclosed brackets/braces and close them
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (const ch of trimmed) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openBraces++;
    if (ch === "}") openBraces--;
    if (ch === "[") openBrackets++;
    if (ch === "]") openBrackets--;
  }

  // If we're still inside a string, close it
  if (inString) trimmed += '"';

  // Remove trailing comma if present
  trimmed = trimmed.replace(/,\s*$/, "");

  // Close all unclosed brackets/braces
  for (let i = 0; i < openBrackets; i++) trimmed += "]";
  for (let i = 0; i < openBraces; i++) trimmed += "}";

  try {
    return JSON.parse(trimmed);
  } catch {
    // Second attempt: truncate to last valid comma and close
    const lastComma = trimmed.lastIndexOf(",");
    if (lastComma > 0) {
      let fallback = trimmed.slice(0, lastComma);
      // Recount and close
      openBraces = 0; openBrackets = 0; inString = false; escape = false;
      for (const ch of fallback) {
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") openBraces++;
        if (ch === "}") openBraces--;
        if (ch === "[") openBrackets++;
        if (ch === "]") openBrackets--;
      }
      if (inString) fallback += '"';
      for (let i = 0; i < openBrackets; i++) fallback += "]";
      for (let i = 0; i < openBraces; i++) fallback += "}";
      try {
        return JSON.parse(fallback);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function analyzeWithClaude(params: AnalyzeParams) {
  const { client, key } = getClient(params.apiKey);
  const isKo = params.locale === "ko";
  const modelId = MODEL_MAP[params.model || "haiku"];

  const imageContent: Anthropic.Messages.ImageBlockParam[] = params.images.map(
    (base64) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: base64,
      },
    })
  );

  const userPrompt = isKo
    ? `가설: ${params.hypothesis}
타깃 유저: ${params.targetUser}
${params.task ? `태스크: ${params.task}` : "태스크: 가설에서 추론"}
${params.images.length}개 화면 분석 후 JSON 반환.`
    : `Hypothesis: ${params.hypothesis}
Target User: ${params.targetUser}
${params.task ? `Task: ${params.task}` : "Task: Infer from hypothesis"}
Analyze ${params.images.length} screen(s), return JSON.`;

  console.log("[claude] Calling API with model:", modelId, "| key prefix:", key.slice(0, 10));

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    system: isKo ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN,
    messages: [
      {
        role: "user",
        content: [...imageContent, { type: "text", text: userPrompt }],
      },
    ],
  });

  console.log("[claude] API response received. Stop reason:", response.stop_reason, "| usage:", JSON.stringify(response.usage));

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  console.log("[claude] Raw response (last 200 chars):", textBlock.text.slice(-200));

  return cleanAndParse(textBlock.text, response.stop_reason);
}

export async function analyzeFlowWithClaude(params: FlowAnalyzeParams) {
  const { client, key } = getClient(params.apiKey);
  const isKo = params.locale === "ko";
  const modelId = MODEL_MAP[params.model || "haiku"];

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  for (const step of params.flowSteps) {
    content.push({
      type: "text" as const,
      text: isKo
        ? `[단계 ${step.stepNumber}: ${step.stepName}]`
        : `[Step ${step.stepNumber}: ${step.stepName}]`,
    });
    content.push({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: step.image,
      },
    });
  }

  const userPrompt = isKo
    ? `가설: ${params.hypothesis}
타깃 유저: ${params.targetUser}
${params.task ? `태스크: ${params.task}` : "태스크: 가설에서 추론"}
위 ${params.flowSteps.length}단계 유저 플로우를 분석하고 JSON 반환.`
    : `Hypothesis: ${params.hypothesis}
Target User: ${params.targetUser}
${params.task ? `Task: ${params.task}` : "Task: Infer from hypothesis"}
Analyze the ${params.flowSteps.length}-step user flow above and return JSON.`;

  content.push({ type: "text" as const, text: userPrompt });

  console.log("[claude] Calling Flow API with model:", modelId, "| key prefix:", key.slice(0, 10), "| steps:", params.flowSteps.length);

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    system: isKo ? FLOW_SYSTEM_PROMPT_KO : FLOW_SYSTEM_PROMPT_EN,
    messages: [{ role: "user", content }],
  });

  console.log("[claude] Flow API response received. Stop reason:", response.stop_reason);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return cleanAndParse(textBlock.text, response.stop_reason);
}

export async function analyzeComparisonWithClaude(params: ComparisonAnalyzeParams) {
  const { client, key } = getClient(params.apiKey);
  const isKo = params.locale === "ko";
  // Comparison always uses Sonnet — more reliable cross-product scoring
  const modelId = MODEL_MAP[params.model || "sonnet"];

  const content: Anthropic.Messages.ContentBlockParam[] = [];

  // Ours first
  content.push({
    type: "text" as const,
    text: isKo
      ? `=== 자사 제품: ${params.ours.productName} ===`
      : `=== Our product: ${params.ours.productName} ===`,
  });
  params.ours.images.forEach((base64, i) => {
    content.push({
      type: "text" as const,
      text: isKo
        ? `[자사: ${params.ours.productName} / 화면 ${i + 1}]`
        : `[Ours: ${params.ours.productName} / Screen ${i + 1}]`,
    });
    content.push({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
    });
  });

  // Each competitor
  for (const comp of params.competitors) {
    content.push({
      type: "text" as const,
      text: isKo
        ? `=== 경쟁사: ${comp.productName} ===`
        : `=== Competitor: ${comp.productName} ===`,
    });
    comp.images.forEach((base64, i) => {
      content.push({
        type: "text" as const,
        text: isKo
          ? `[경쟁사: ${comp.productName} / 화면 ${i + 1}]`
          : `[Competitor: ${comp.productName} / Screen ${i + 1}]`,
      });
      content.push({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
      });
    });
  }

  const focusLine = params.comparisonFocus
    ? isKo
      ? `비교 기준: ${params.comparisonFocus}`
      : `Comparison focus: ${params.comparisonFocus}`
    : "";

  const userPrompt = isKo
    ? `가설: ${params.hypothesis}
타깃 유저: ${params.targetUser}
${focusLine}
자사 제품(${params.ours.productName})과 경쟁사(${params.competitors.map((c) => c.productName).join(", ")})를 동일 가설로 비교 분석 후 JSON 반환.`
    : `Hypothesis: ${params.hypothesis}
Target User: ${params.targetUser}
${focusLine}
Compare our product (${params.ours.productName}) vs competitors (${params.competitors.map((c) => c.productName).join(", ")}) against the same hypothesis. Return JSON.`;

  content.push({ type: "text" as const, text: userPrompt });

  const totalImages =
    params.ours.images.length + params.competitors.reduce((sum, c) => sum + c.images.length, 0);
  console.log(
    "[claude] Calling Comparison API with model:",
    modelId,
    "| key prefix:",
    key.slice(0, 10),
    "| products:",
    1 + params.competitors.length,
    "| total images:",
    totalImages
  );

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 8192,
    system: isKo ? COMPARISON_SYSTEM_PROMPT_KO : COMPARISON_SYSTEM_PROMPT_EN,
    messages: [{ role: "user", content }],
  });

  console.log("[claude] Comparison API response received. Stop reason:", response.stop_reason);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return cleanAndParse(textBlock.text, response.stop_reason);
}
