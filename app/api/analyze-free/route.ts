import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 서버 사이드 Anthropic API 프록시 — 무료 모드용
// 플러그인에서 API 키가 없거나 초과 시 이 엔드포인트를 통해 분석
export async function POST(req: NextRequest) {
  try {
    const { mode, systemPrompt, content, frameName } = await req.json();

    if (!mode || !systemPrompt || !content) {
      return NextResponse.json(
        { error: "mode, systemPrompt, content는 필수입니다." },
        { status: 400 },
      );
    }

    // 무료 모드는 항상 Haiku (가장 저렴한 모델)
    const model = MODELS.haiku;

    const messages =
      Array.isArray(content) && content[0]?.role
        ? content
        : [{ role: "user" as const, content }];

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      temperature: mode === "writing" ? 0.2 : undefined,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages,
    });

    const raw = response.content?.[0]?.type === "text" ? response.content[0].text : "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);

    // writing 모드일 때 frameName 추가
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
