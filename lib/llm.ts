// lib/llm.ts — LLM provider 추상화
// Groq(OpenAI 호환, 비전) 우선 + Anthropic fallback.
// 통일된 텍스트 청크 스트림(AsyncGenerator<string>)을 반환하여
// 호출부(route)는 provider를 신경 쓰지 않고 SSE로 흘려보낸다.

import Anthropic from "@anthropic-ai/sdk";

export interface LLMImage {
  base64: string;
  mimeType: string;
}

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamLLMParams {
  system: string;
  history: LLMMessage[];
  images: LLMImage[];
  userText: string;
  maxTokens: number;
  /** 사용자가 설정에서 등록한 본인 Anthropic 키 (있으면 최우선) */
  clientAnthropicKey?: string;
  /** Anthropic 사용 시 모델 (provider가 anthropic일 때만 의미) */
  anthropicModel: string;
  /** 순수 JSON 출력 강제 (Groq: response_format, Anthropic: prefill) */
  jsonMode?: boolean;
}

export type Provider = "openrouter" | "groq" | "anthropic";

const VALID_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
type MediaType = (typeof VALID_MEDIA_TYPES)[number];

function safeMime(m: string | undefined): MediaType {
  return VALID_MEDIA_TYPES.includes(m as MediaType) ? (m as MediaType) : "image/png";
}

// 비전 지원 모델
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
// OpenRouter 1순위 비전 모델 — Qwen2.5-VL 72B(무료). scout(17B) 대비 비전·지시준수·한국어 우위.
export const OPENROUTER_VISION_MODEL = "qwen/qwen2.5-vl-72b-instruct:free";
// 무료 모델 가용성 변동 대비 fallback 체인 (OpenRouter가 순서대로 라우팅)
const OPENROUTER_FALLBACKS = [
  "qwen/qwen2.5-vl-32b-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
];

interface CompatCfg {
  baseUrl: string;
  model: string;
  label: string;
  fallbackModels?: string[];
  extraHeaders?: Record<string, string>;
}

// OpenAI 호환 provider 설정 (OpenRouter, Groq 공유)
const OPENAI_COMPAT: Record<"openrouter" | "groq", CompatCfg> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: OPENROUTER_VISION_MODEL,
    fallbackModels: OPENROUTER_FALLBACKS,
    label: "OpenRouter",
    extraHeaders: {
      "HTTP-Referer": "https://simulo.vercel.app",
      "X-Title": "Simulo",
    },
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: GROQ_VISION_MODEL,
    label: "Groq",
  },
};

/**
 * provider 결정 규칙 (품질·비용 순):
 * 1. 사용자가 본인 Anthropic 키를 줬으면 → anthropic (그 키)
 * 2. OPENROUTER_API_KEY 있으면 → openrouter (무료·고품질 비전 Qwen-VL 72B)
 * 3. GROQ_API_KEY 있으면 → groq (무료·저품질 비전 scout, 폴백)
 * 4. ANTHROPIC_API_KEY(서버) 있으면 → anthropic
 */
export function resolveProvider(clientAnthropicKey?: string): {
  provider: Provider;
  apiKey: string;
} | null {
  if (clientAnthropicKey) {
    return { provider: "anthropic", apiKey: clientAnthropicKey };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return { provider: "openrouter", apiKey: process.env.OPENROUTER_API_KEY };
  }
  if (process.env.GROQ_API_KEY) {
    return { provider: "groq", apiKey: process.env.GROQ_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY };
  }
  return null;
}

// ── OpenAI 호환 스트리밍 (OpenRouter, Groq 공유) ──────────────────────────────

async function* streamOpenAICompat(
  which: "openrouter" | "groq",
  apiKey: string,
  p: StreamLLMParams
): AsyncGenerator<string> {
  const cfg = OPENAI_COMPAT[which];
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  // 최대 5장
  for (const img of p.images.slice(0, 5)) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${safeMime(img.mimeType)};base64,${img.base64}` },
    });
  }
  userContent.push({ type: "text", text: p.userText });

  const messages = [
    { role: "system", content: p.system },
    ...p.history,
    { role: "user", content: userContent },
  ];

  const baseBody: Record<string, unknown> = {
    model: cfg.model,
    // OpenRouter: 무료 모델 가용성 변동 대비 fallback 라우팅
    ...(cfg.fallbackModels
      ? { models: [cfg.model, ...cfg.fallbackModels] }
      : {}),
    messages,
    max_tokens: p.maxTokens,
    temperature: 0.4,
    stream: true,
  };

  async function call(withJsonMode: boolean): Promise<Response> {
    const body = withJsonMode
      ? { ...baseBody, response_format: { type: "json_object" } }
      : baseBody;
    return fetch(cfg.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(cfg.extraHeaders ?? {}),
      },
      body: JSON.stringify(body),
    });
  }

  // JSON mode + streaming은 provider별 지원 여부가 불확실 → 거부 시(400) JSON mode 빼고 재시도
  let res = await call(!!p.jsonMode);
  if (!res.ok && p.jsonMode && res.status === 400) {
    res = await call(false);
  }

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`${cfg.label} ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string };
        };
        if (json.error) throw new Error(json.error.message || `${cfg.label} error`);
        const text = json.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        /* 불완전 JSON — 다음 청크에서 이어붙임 */
      }
    }
  }
}

// ── Anthropic 스트리밍 ───────────────────────────────────────────────────────

async function* streamAnthropic(
  apiKey: string,
  p: StreamLLMParams
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey });
  const imageBlocks: Anthropic.ImageBlockParam[] = p.images
    .slice(0, 3)
    .map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: safeMime(img.mimeType),
        data: img.base64,
      },
    }));

  const userContent: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    { type: "text" as const, text: p.userText },
  ];

  const messages: Anthropic.MessageParam[] = [
    ...p.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent },
  ];

  const stream = await client.messages.stream({
    model: p.anthropicModel,
    max_tokens: p.maxTokens,
    system: p.system,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

/** provider를 자동 선택해 통일된 텍스트 청크 스트림을 반환 */
export async function* streamLLM(
  p: StreamLLMParams
): AsyncGenerator<string> {
  const resolved = resolveProvider(p.clientAnthropicKey);
  if (!resolved) {
    throw new Error(
      "분석에 사용할 API 키가 없어요. OPENROUTER_API_KEY, GROQ_API_KEY 또는 ANTHROPIC_API_KEY를 설정해주세요."
    );
  }
  if (resolved.provider === "openrouter" || resolved.provider === "groq") {
    yield* streamOpenAICompat(resolved.provider, resolved.apiKey, p);
  } else {
    yield* streamAnthropic(resolved.apiKey, p);
  }
}

/** 비스트리밍: 전체 텍스트를 모아서 반환 */
export async function completeLLM(p: StreamLLMParams): Promise<string> {
  let out = "";
  for await (const chunk of streamLLM(p)) out += chunk;
  return out;
}
