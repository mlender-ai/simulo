import { NextRequest, NextResponse } from "next/server";
import { completeLLM, type LLMImage } from "@/lib/llm";
import { MODELS } from "@/lib/models";

export const maxDuration = 120;

// 서버 사이드 LLM 프록시 — 무료 모드용
// 플러그인에서 API 키가 없거나 초과 시 이 엔드포인트를 통해 분석.
// provider 우선순위: GROQ_API_KEY → ANTHROPIC_API_KEY (lib/llm.ts)
type AnthropicBlock =
  | { type: "image"; source?: { data?: string; media_type?: string } }
  | { type: "text"; text?: string }
  | { role?: string; content?: unknown };

export async function POST(req: NextRequest) {
  try {
    const { mode, systemPrompt, content, frameName } = await req.json();

    if (!mode || !systemPrompt || !content) {
      return NextResponse.json(
        { error: "mode, systemPrompt, content는 필수입니다." },
        { status: 400 },
      );
    }

    // content(Anthropic content block 배열)에서 이미지/텍스트 추출
    const blocks: AnthropicBlock[] = Array.isArray(content)
      ? (content as AnthropicBlock[])
      : [{ type: "text", text: String(content) }];

    const images: LLMImage[] = [];
    let userText = "";
    for (const b of blocks) {
      if ("type" in b && b.type === "image" && b.source?.data) {
        images.push({
          base64: b.source.data,
          mimeType: b.source.media_type || "image/png",
        });
      } else if ("type" in b && b.type === "text" && b.text) {
        userText += b.text + "\n";
      }
    }
    if (!userText.trim()) userText = "위 화면을 분석해주세요.";

    const raw = await completeLLM({
      system: systemPrompt,
      history: [],
      images,
      userText,
      maxTokens: 4096,
      // Anthropic fallback 시 가장 저렴한 모델
      anthropicModel: MODELS.haiku,
    });

    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const result = JSON.parse(cleaned);

    if (mode === "writing" && frameName) {
      result.frameName = frameName;
    }

    return NextResponse.json({ result });
  } catch (e) {
    console.error("[analyze-free] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "무료 분석 실패" },
      { status: 500 },
    );
  }
}
