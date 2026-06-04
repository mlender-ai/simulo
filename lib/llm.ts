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
}

export type Provider = "groq" | "anthropic";

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

// Groq 비전 지원 모델 (이미지 입력 가능한 유일 옵션)
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

/**
 * provider 결정 규칙:
 * 1. 사용자가 본인 Anthropic 키를 줬으면 → anthropic (그 키)
 * 2. GROQ_API_KEY 있으면 → groq
 * 3. ANTHROPIC_API_KEY(서버) 있으면 → anthropic
 */
export function resolveProvider(clientAnthropicKey?: string): {
  provider: Provider;
  apiKey: string;
} | null {
  if (clientAnthropicKey) {
    return { provider: "anthropic", apiKey: clientAnthropicKey };
  }
  if (process.env.GROQ_API_KEY) {
    return { provider: "groq", apiKey: process.env.GROQ_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY };
  }
  return null;
}

// ── Groq (OpenAI 호환) 스트리밍 ──────────────────────────────────────────────

async function* streamGroq(
  apiKey: string,
  p: StreamLLMParams
): AsyncGenerator<string> {
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  // Groq는 최대 5장, base64 4MB 제한
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

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages,
      max_tokens: p.maxTokens,
      temperature: 0.4,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${errBody.slice(0, 300)}`);
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
        if (json.error) throw new Error(json.error.message || "Groq error");
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
      "분석에 사용할 API 키가 없어요. GROQ_API_KEY 또는 ANTHROPIC_API_KEY를 설정해주세요."
    );
  }
  if (resolved.provider === "groq") {
    yield* streamGroq(resolved.apiKey, p);
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
