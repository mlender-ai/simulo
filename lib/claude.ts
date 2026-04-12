import Anthropic from "@anthropic-ai/sdk";
import type { FlowStep } from "./storage";

const YAFIT_CONTEXT = `Context: You are analyzing screens from YafitMove, a Korean fitness reward app where users earn mileage points through walking (1 mileage per 100 steps) and cycling (10 mileage per 1km). Users can spend mileage at affiliated stores nationwide. The app also has missions, a lucky store, booster features, and cycling-specific tools like route navigation and a custom speedometer. Keep this product context in mind when analyzing usability and simulating user behavior.`;

const SCORE_CRITERIA = `Score breakdown criteria:
- clarity (0-25): Are labels, buttons, and UI elements clearly understandable without prior knowledge?
- flow (0-25): Can the user complete the task without unexpected dead-ends or detours?
- feedback (0-25): Does the interface provide clear feedback, confirmations, or error prevention?
- efficiency (0-25): Can the user reach their goal with minimal steps and cognitive load?
The total score must equal the sum of the four breakdown scores.
verdictReason must state specifically which element or interaction caused the verdict. Do not use vague terms like 'some issues found'. Name the exact screen element or step.`;

const SYSTEM_PROMPT_EN = `${YAFIT_CONTEXT}

You are a UX analysis agent. Analyze design screens against the hypothesis and target user. Simulate user behavior. You must respond with pure JSON only. No markdown, no code blocks, no backticks. Just the raw JSON object.

${SCORE_CRITERIA}

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "string" },
    "flow": { "score": 0-25, "reason": "string" },
    "feedback": { "score": 0-25, "reason": "string" },
    "efficiency": { "score": 0-25, "reason": "string" }
  },
  "verdictReason": "string",
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "string",
  "summary": "2-3 sentences",
  "strengths": ["string"],
  "thinkAloud": [{"screen": "Screen N", "thought": "First-person thought"}],
  "issues": [{"screen": "Screen N", "severity": "Critical" | "Medium" | "Low", "issue": "string", "recommendation": "string"}]
}`;

const SYSTEM_PROMPT_KO = `${YAFIT_CONTEXT}

UX 분석 에이전트. 가설과 타깃 유저 기준으로 디자인 화면을 분석. 유저 행동을 시뮬레이션. JSON 키는 영문, 값은 한국어. 반드시 순수 JSON만 반환. 마크다운, 코드블록, 백틱 절대 사용 금지. Raw JSON 객체만 반환.

${SCORE_CRITERIA}

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "한국어" },
    "flow": { "score": 0-25, "reason": "한국어" },
    "feedback": { "score": 0-25, "reason": "한국어" },
    "efficiency": { "score": 0-25, "reason": "한국어" }
  },
  "verdictReason": "한국어",
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "한국어",
  "summary": "2-3문장 한국어",
  "strengths": ["한국어"],
  "thinkAloud": [{"screen": "화면 N", "thought": "1인칭 유저 사고"}],
  "issues": [{"screen": "화면 N", "severity": "Critical" | "Medium" | "Low", "issue": "한국어", "recommendation": "한국어"}]
}`;

const FLOW_SYSTEM_PROMPT_EN = `${YAFIT_CONTEXT}

You are analyzing a multi-step user flow from YafitMove. You will receive screenshots of each step in the user journey in order.

For each step, evaluate:
1. Whether the user clearly understands what to do next
2. Friction points or confusion that might cause drop-off
3. Whether information carries over logically from the previous step

In thinkAloud, simulate the user's inner monologue as they move through each step sequentially — one entry per step.
In issues, specify which step each issue belongs to.
Add a flowAnalysis array to your response.

${SCORE_CRITERIA}

Respond in pure JSON only. No markdown, no code blocks, no backticks. Just the raw JSON object.

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "string" },
    "flow": { "score": 0-25, "reason": "string" },
    "feedback": { "score": 0-25, "reason": "string" },
    "efficiency": { "score": 0-25, "reason": "string" }
  },
  "verdictReason": "string",
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "string",
  "summary": "2-3 sentences",
  "strengths": ["string"],
  "thinkAloud": [{"screen": "Step N: name", "thought": "First-person thought"}],
  "issues": [{"screen": "Step N: name", "severity": "Critical" | "Medium" | "Low", "issue": "string", "recommendation": "string"}],
  "flowAnalysis": [{"step": 1, "stepName": "string", "dropOffRisk": "High" | "Medium" | "Low", "reason": "string"}]
}`;

const FLOW_SYSTEM_PROMPT_KO = `${YAFIT_CONTEXT}

야핏무브의 멀티 스텝 유저 플로우를 분석합니다. 각 단계의 스크린샷이 순서대로 제공됩니다.

각 단계별로 평가:
1. 유저가 다음에 무엇을 해야 하는지 명확히 이해할 수 있는가
2. 이탈을 유발할 수 있는 마찰 포인트
3. 이전 단계에서 정보가 논리적으로 이어지는가

thinkAloud에서 유저가 각 단계를 순서대로 이동하면서 느끼는 내적 독백을 시뮬레이션 — 단계당 1개 항목.
issues에서 어떤 단계의 이슈인지 명시.
flowAnalysis 배열을 응답에 추가.

${SCORE_CRITERIA}

반드시 순수 JSON만 반환. 마크다운, 코드블록, 백틱 절대 사용 금지. Raw JSON 객체만 반환.

{
  "verdict": "Pass" | "Partial" | "Fail",
  "score": 0-100,
  "scoreBreakdown": {
    "clarity": { "score": 0-25, "reason": "한국어" },
    "flow": { "score": 0-25, "reason": "한국어" },
    "feedback": { "score": 0-25, "reason": "한국어" },
    "efficiency": { "score": 0-25, "reason": "한국어" }
  },
  "verdictReason": "한국어",
  "taskSuccessLikelihood": "High" | "Medium" | "Low",
  "taskSuccessReason": "한국어",
  "summary": "2-3문장 한국어",
  "strengths": ["한국어"],
  "thinkAloud": [{"screen": "단계 N: 이름", "thought": "1인칭 유저 사고"}],
  "issues": [{"screen": "단계 N: 이름", "severity": "Critical" | "Medium" | "Low", "issue": "한국어", "recommendation": "한국어"}],
  "flowAnalysis": [{"step": 1, "stepName": "한국어", "dropOffRisk": "높음" | "보통" | "낮음", "reason": "한국어"}]
}`;

const COMPARISON_SYSTEM_PROMPT_EN = `${YAFIT_CONTEXT}

You are a professional UX competitive analysis agent. You will receive screenshots from multiple products and compare them against the same hypothesis and target user profile.

For each product, evaluate independently first, then provide a comparative analysis.

Scoring MUST be consistent across products — use the same rubric so scores are directly comparable.

${SCORE_CRITERIA}

Respond in pure JSON only. No markdown, no code blocks, no backticks.

{
  "products": [
    {
      "productName": "string",
      "verdict": "Pass" | "Partial" | "Fail",
      "score": 0-100,
      "summary": "2 sentences",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "thinkAloud": [{ "screen": "string", "thought": "First-person" }],
      "issues": [{ "screen": "string", "severity": "Critical" | "Medium" | "Low", "issue": "string", "recommendation": "string" }]
    }
  ],
  "comparison": {
    "winner": "productName with highest score",
    "winnerReason": "2 sentences explaining why this product best fits the hypothesis",
    "ourProductPosition": "assessment of our product's relative position",
    "keyDifferences": [
      { "aspect": "comparison angle", "ours": "our assessment", "competitor": "competitor name: assessment" }
    ],
    "topPriorities": ["most urgent improvement for our product 1", "2", "3"]
  }
}`;

const COMPARISON_SYSTEM_PROMPT_KO = `${YAFIT_CONTEXT}

경쟁사 UX 비교 분석 에이전트. 여러 제품의 스크린샷을 받아 동일한 가설과 타깃 유저 기준으로 비교 분석합니다.

각 제품을 먼저 독립적으로 평가한 후, 비교 분석을 제공합니다.

채점은 제품 간 일관되게 — 같은 루브릭을 사용해 점수가 직접 비교 가능하도록.

${SCORE_CRITERIA}

JSON 키는 영문, 값은 한국어. 반드시 순수 JSON만 반환. 마크다운, 코드블록, 백틱 절대 사용 금지.

{
  "products": [
    {
      "productName": "제품명",
      "verdict": "Pass" | "Partial" | "Fail",
      "score": 0-100,
      "summary": "2문장 한국어",
      "strengths": ["한국어"],
      "weaknesses": ["한국어"],
      "thinkAloud": [{ "screen": "화면명", "thought": "1인칭 한국어" }],
      "issues": [{ "screen": "화면명", "severity": "Critical" | "Medium" | "Low", "issue": "한국어", "recommendation": "한국어" }]
    }
  ],
  "comparison": {
    "winner": "가장 높은 점수의 제품명",
    "winnerReason": "왜 이 제품이 가설 기준으로 가장 우수한지 2문장 한국어",
    "ourProductPosition": "자사 제품의 상대적 포지션 평가 한국어",
    "keyDifferences": [
      { "aspect": "비교 관점", "ours": "자사 평가", "competitor": "경쟁사명: 평가" }
    ],
    "topPriorities": ["자사 제품이 가장 시급하게 개선해야 할 것 1", "2", "3"]
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

function cleanAndParse(raw: string) {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  console.log("[claude] Cleaned response (first 100 chars):", cleaned.slice(0, 100));
  return JSON.parse(cleaned);
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
    max_tokens: 2048,
    system: isKo ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN,
    messages: [
      {
        role: "user",
        content: [...imageContent, { type: "text", text: userPrompt }],
      },
    ],
  });

  console.log("[claude] API response received. Stop reason:", response.stop_reason);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return cleanAndParse(textBlock.text);
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
    max_tokens: 3072,
    system: isKo ? FLOW_SYSTEM_PROMPT_KO : FLOW_SYSTEM_PROMPT_EN,
    messages: [{ role: "user", content }],
  });

  console.log("[claude] Flow API response received. Stop reason:", response.stop_reason);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return cleanAndParse(textBlock.text);
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
    max_tokens: 4096,
    system: isKo ? COMPARISON_SYSTEM_PROMPT_KO : COMPARISON_SYSTEM_PROMPT_EN,
    messages: [{ role: "user", content }],
  });

  console.log("[claude] Comparison API response received. Stop reason:", response.stop_reason);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return cleanAndParse(textBlock.text);
}
