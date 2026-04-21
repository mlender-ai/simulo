// ──────────────────────────────────────────────
// lib/claude.ts — Claude API call layer for Simulo
//
// System prompts and the buildUsabilityPrompt builder live in lib/prompts.ts.
// This file is responsible only for constructing API requests and parsing responses.
// ──────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import type { FlowStep } from "./storage";
import {
  parseClaudeResponse,
  AnalysisResponseSchema,
  ComparisonResponseSchema,
  UsabilityResponseSchema,
} from "./response-parser";
import { buildSystemPrompt } from "./prompts";

export type AnalysisMode = "hypothesis" | "usability";

// Re-export so existing imports from "@/lib/claude" keep working
export type { AnalysisOptions } from "./prompts";

export type ModelTier = "haiku" | "sonnet";

const MODEL_MAP: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};

// ──────────────────────────────────────────────
// Param interfaces
// ──────────────────────────────────────────────

interface AnalyzeParams {
  images: string[];
  hypothesis?: string;
  targetUser: string;
  task?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
  mode?: AnalysisMode;
  analysisOptions?: import("./prompts").AnalysisOptions;
  screenDescription?: string;
  ocrContext?: string;
}

interface FlowAnalyzeParams {
  flowSteps: FlowStep[];
  hypothesis?: string;
  targetUser: string;
  task?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
  mode?: AnalysisMode;
  analysisOptions?: import("./prompts").AnalysisOptions;
  screenDescription?: string;
  ocrContext?: string;
}

export interface ComparisonProduct {
  productName: string;
  images: string[]; // base64
  description?: string;
}

export interface AnalysisPerspectiveInput {
  usability: boolean;
  desire: boolean;
  comparison: boolean;
  accessibility: boolean;
}

interface ComparisonAnalyzeParams {
  ours: ComparisonProduct;
  competitors: ComparisonProduct[];
  hypothesis?: string;
  targetUser?: string;
  comparisonFocus?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
  analysisPerspective?: AnalysisPerspectiveInput;
  mode?: AnalysisMode;
  analysisOptions?: import("./prompts").AnalysisOptions;
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

/**
 * Retry an async operation with exponential backoff.
 * Retries on JSON parse errors and 5xx API errors, up to maxAttempts times.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  label = "claude",
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof SyntaxError || // JSON parse failure
        (err instanceof Error && /parse|JSON|truncat/i.test(err.message)) ||
        (err instanceof Anthropic.APIError && err.status >= 500);

      if (!isRetryable || attempt === maxAttempts) break;

      const delay = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
      console.warn(`[${label}] Attempt ${attempt} failed — retrying in ${delay}ms...`, (err as Error).message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

function getClient(apiKey?: string) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set. 설정 페이지에서 API 키를 입력해주세요.");
  }
  return { client: new Anthropic({ apiKey: key }), key };
}

function targetUserLine(targetUser: string, isKo: boolean): string {
  return targetUser?.trim()
    ? (isKo ? `타깃 유저: ${targetUser}` : `Target User: ${targetUser}`)
    : (isKo ? "타깃 유저: (미지정 — 시스템 기본값 사용)" : "Target User: (unspecified — use system default)");
}

function screenDescLine(screenDescription: string | undefined, isKo: boolean): string {
  const desc = screenDescription?.trim();
  if (!desc) return "";
  return isKo ? `화면 설명: ${desc}\n` : `Screen description: ${desc}\n`;
}

function ocrContextLine(ocrContext: string | undefined): string {
  const ctx = ocrContext?.trim();
  if (!ctx) return "";
  return `\n${ctx}\n`;
}

// ──────────────────────────────────────────────
// Public API functions
// ──────────────────────────────────────────────

export async function analyzeWithClaude(params: AnalyzeParams) {
  const { client, key } = getClient(params.apiKey);
  const isKo = params.locale === "ko";
  const modelId = MODEL_MAP[params.model || "haiku"];
  const isUsability = params.mode === "usability";

  const imageContent: Anthropic.Messages.ImageBlockParam[] = params.images.map((base64) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
  }));

  const tul = targetUserLine(params.targetUser, isKo);
  const sdl = screenDescLine(params.screenDescription, isKo);
  const ocl = ocrContextLine(params.ocrContext);

  const userPrompt = isUsability
    ? (isKo
        ? `${tul}\n${sdl}${ocl}${params.images.length}개 화면의 사용성을 가설 없이 종합 평가하고 JSON 반환.`
        : `${tul}\n${sdl}${ocl}Evaluate overall usability of ${params.images.length} screen(s) without a hypothesis. Return JSON.`)
    : (isKo
        ? `가설: ${params.hypothesis}\n${tul}\n${params.task ? `태스크: ${params.task}` : "태스크: 가설에서 추론"}\n${sdl}${ocl}${params.images.length}개 화면 분석 후 JSON 반환.`
        : `Hypothesis: ${params.hypothesis}\n${tul}\n${params.task ? `Task: ${params.task}` : "Task: Infer from hypothesis"}\n${sdl}${ocl}Analyze ${params.images.length} screen(s), return JSON.`);

  const systemPrompt = buildSystemPrompt({
    mode: params.mode || "hypothesis",
    analysisOptions: params.analysisOptions,
    targetUser: params.targetUser,
    inputShape: "single",
    locale: params.locale || "en",
  });

  console.log("[claude] Calling API with model:", modelId, "| key prefix:", key.slice(0, 10), "| mode:", params.mode || "hypothesis");

  const schema = isUsability ? UsabilityResponseSchema : AnalysisResponseSchema;
  return withRetry(async () => {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: [...imageContent, { type: "text", text: userPrompt }] }],
    });

    console.log("[claude] API response received. Stop reason:", response.stop_reason, "| usage:", JSON.stringify(response.usage));

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

    console.log("[claude] Raw response (last 200 chars):", textBlock.text.slice(-200));
    return parseClaudeResponse(textBlock.text, schema, { stopReason: response.stop_reason });
  }, 3, "analyzeWithClaude");
}

export async function analyzeFlowWithClaude(params: FlowAnalyzeParams) {
  const { client, key } = getClient(params.apiKey);
  const isKo = params.locale === "ko";
  const modelId = MODEL_MAP[params.model || "haiku"];
  const isUsability = params.mode === "usability";

  const content: Anthropic.Messages.ContentBlockParam[] = [];
  for (const step of params.flowSteps) {
    content.push({
      type: "text" as const,
      text: isKo ? `[단계 ${step.stepNumber}: ${step.stepName}]` : `[Step ${step.stepNumber}: ${step.stepName}]`,
    });
    content.push({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/png" as const, data: step.image },
    });
  }

  const tul = targetUserLine(params.targetUser, isKo);
  const sdl = screenDescLine(params.screenDescription, isKo);
  const ocl = ocrContextLine(params.ocrContext);

  const userPrompt = isUsability
    ? (isKo
        ? `${tul}\n${sdl}${ocl}위 ${params.flowSteps.length}단계 플로우의 사용성을 가설 없이 종합 평가하고 JSON 반환.`
        : `${tul}\n${sdl}${ocl}Evaluate the ${params.flowSteps.length}-step flow for overall usability without a hypothesis. Return JSON.`)
    : (isKo
        ? `가설: ${params.hypothesis}\n${tul}\n${params.task ? `태스크: ${params.task}` : "태스크: 가설에서 추론"}\n${sdl}위 ${params.flowSteps.length}단계 유저 플로우를 분석하고 JSON 반환.`
        : `Hypothesis: ${params.hypothesis}\n${tul}\n${params.task ? `Task: ${params.task}` : "Task: Infer from hypothesis"}\n${sdl}${ocl}Analyze the ${params.flowSteps.length}-step user flow above and return JSON.`);

  content.push({ type: "text" as const, text: userPrompt });

  const systemPrompt = buildSystemPrompt({
    mode: params.mode || "hypothesis",
    analysisOptions: params.analysisOptions,
    targetUser: params.targetUser,
    inputShape: "flow",
    locale: params.locale || "en",
  });

  console.log("[claude] Calling Flow API with model:", modelId, "| key prefix:", key.slice(0, 10), "| steps:", params.flowSteps.length, "| mode:", params.mode || "hypothesis");

  const schema = isUsability ? UsabilityResponseSchema : AnalysisResponseSchema;
  return withRetry(async () => {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    });

    console.log("[claude] Flow API response received. Stop reason:", response.stop_reason);

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

    return parseClaudeResponse(textBlock.text, schema, { stopReason: response.stop_reason });
  }, 3, "analyzeFlowWithClaude");
}

export async function analyzeComparisonWithClaude(params: ComparisonAnalyzeParams) {
  const { client, key } = getClient(params.apiKey);
  const isKo = params.locale === "ko";
  // Comparison always uses Sonnet — more reliable cross-product scoring
  const modelId = MODEL_MAP[params.model || "sonnet"];

  const content: Anthropic.Messages.ContentBlockParam[] = [];

  const descriptionBlock = (desc: string | undefined): string => {
    const trimmed = (desc || "").trim();
    return isKo
      ? `[제품 컨텍스트: ${trimmed || "제공된 설명 없음. 이미지만으로 판단."}]`
      : `[Product context: ${trimmed || "No description provided. Judge from images only."}]`;
  };

  // Our product first
  content.push({
    type: "text" as const,
    text: isKo ? `=== 자사 제품: ${params.ours.productName} ===` : `=== Our product: ${params.ours.productName} ===`,
  });
  content.push({ type: "text" as const, text: descriptionBlock(params.ours.description) });
  params.ours.images.forEach((base64, i) => {
    content.push({
      type: "text" as const,
      text: isKo ? `[자사: ${params.ours.productName} / 화면 ${i + 1}]` : `[Ours: ${params.ours.productName} / Screen ${i + 1}]`,
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
      text: isKo ? `=== 경쟁사: ${comp.productName} ===` : `=== Competitor: ${comp.productName} ===`,
    });
    content.push({ type: "text" as const, text: descriptionBlock(comp.description) });
    comp.images.forEach((base64, i) => {
      content.push({
        type: "text" as const,
        text: isKo ? `[경쟁사: ${comp.productName} / 화면 ${i + 1}]` : `[Competitor: ${comp.productName} / Screen ${i + 1}]`,
      });
      content.push({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
      });
    });
  }

  const focusLine = params.comparisonFocus
    ? (isKo ? `비교 기준: ${params.comparisonFocus}` : `Comparison focus: ${params.comparisonFocus}`)
    : "";

  const contextInstruction = isKo
    ? `각 제품 앞에는 가능한 경우 [제품 컨텍스트: ...] 설명이 제공됩니다. 버튼·기능의 실제 동작 방식을 이 설명으로 파악한 뒤 평가하세요. 설명이 없으면 "제공된 설명 없음"으로 표시되며, 그 경우에는 이미지만으로 판단하고 평가의 한계를 명시하세요. 설명이나 이미지에서 확인되지 않는 기능은 추측하지 마세요.`
    : `Each product is preceded by a [Product context: ...] description when available. Use it to understand how buttons and features actually work before evaluating. If none is provided (marked "No description provided"), analyze from images only and note the limitation. Do NOT assume functionality that is not visible or described.`;

  const perspective = params.analysisPerspective;
  const perspectiveLines: string[] = [];
  if (perspective) {
    if (isKo) {
      perspectiveLines.push(`분석 관점 설정:`);
      perspectiveLines.push(`- 사용성 전반: 포함 (필수)`);
      perspectiveLines.push(`- 욕망 충족도(desireAlignment): ${perspective.desire ? "포함" : "제외 — 해당 필드를 비우거나 null로 설정"}`);
      perspectiveLines.push(`- 경쟁사 비교(comparison): ${perspective.comparison ? "포함" : "제외"}`);
      perspectiveLines.push(`- 4050 접근성(accessibility4050): ${perspective.accessibility ? "포함" : "제외 — 해당 필드를 비우거나 null로 설정"}`);
      perspectiveLines.push(`제외된 관점은 JSON에서 해당 필드를 비우거나 null로 설정하세요.`);
    } else {
      perspectiveLines.push(`Analysis perspectives:`);
      perspectiveLines.push(`- Overall usability: included (required)`);
      perspectiveLines.push(`- Desire fulfillment (desireAlignment): ${perspective.desire ? "included" : "excluded — leave the field empty or null"}`);
      perspectiveLines.push(`- Competitor comparison: ${perspective.comparison ? "included" : "excluded"}`);
      perspectiveLines.push(`- 40-50s accessibility (accessibility4050): ${perspective.accessibility ? "included" : "excluded — leave the field empty or null"}`);
      perspectiveLines.push(`For excluded perspectives, leave those fields empty or null in the JSON.`);
    }
  }
  const perspectiveBlock = perspectiveLines.join("\n");

  const isUsabilityCompare = params.mode === "usability";
  const defaultTarget = isKo ? "4050 한국 여성, 야핏무브 핵심 타깃" : "40-50s Korean women, core YafitMove users";
  const effectiveTarget = params.targetUser?.trim() || defaultTarget;
  const competitorNames = params.competitors.map((c) => c.productName).join(", ");

  const userPrompt = isUsabilityCompare
    ? (isKo
        ? `모드: 사용성 비교 분석 (가설 없음)\n타깃 유저: ${effectiveTarget}\n${focusLine}\n${contextInstruction}\n자사 제품(${params.ours.productName})과 경쟁사(${competitorNames})를 동일 사용성 루브릭으로 비교 평가.\n특정 가설 검증이 아니라 각 제품의 사용성 품질과 4050 여성 타깃 적합도를 비교 판단하세요.\nJSON 반환.`
        : `Mode: Usability comparison (no hypothesis)\nTarget User: ${effectiveTarget}\n${focusLine}\n${contextInstruction}\nCompare our product (${params.ours.productName}) vs competitors (${competitorNames}) using a consistent usability rubric.\nJudge overall usability quality and 4050 target fit per product instead of validating a hypothesis. Return JSON.`)
    : (isKo
        ? `가설: ${params.hypothesis}\n타깃 유저: ${params.targetUser}\n${focusLine}\n${contextInstruction}\n${perspectiveBlock}\n자사 제품(${params.ours.productName})과 경쟁사(${competitorNames})를 동일 가설로 비교 분석 후 JSON 반환.`
        : `Hypothesis: ${params.hypothesis}\nTarget User: ${params.targetUser}\n${focusLine}\n${contextInstruction}\n${perspectiveBlock}\nCompare our product (${params.ours.productName}) vs competitors (${competitorNames}) against the same hypothesis. Return JSON.`);

  content.push({ type: "text" as const, text: userPrompt });

  const totalImages = params.ours.images.length + params.competitors.reduce((sum, c) => sum + c.images.length, 0);
  console.log("[claude] Calling Comparison API with model:", modelId, "| key prefix:", key.slice(0, 10), "| products:", 1 + params.competitors.length, "| total images:", totalImages);

  return withRetry(async () => {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 16384,
      system: buildSystemPrompt({
        mode: params.mode || "hypothesis",
        analysisOptions: params.analysisOptions,
        targetUser: params.targetUser,
        inputShape: "comparison",
        hasCompetitor: true,
        locale: params.locale || "en",
      }),
      messages: [{ role: "user", content }],
    });

    console.log("[claude] Comparison API response received. Stop reason:", response.stop_reason, "| usage:", JSON.stringify(response.usage));

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

    console.log("[claude] Comparison raw response (last 200 chars):", textBlock.text.slice(-200));
    return parseClaudeResponse(textBlock.text, ComparisonResponseSchema, { stopReason: response.stop_reason });
  }, 3, "analyzeComparisonWithClaude");
}
