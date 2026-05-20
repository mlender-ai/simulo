import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { detectMediaType } from "@/lib/claude";
import { MODELS } from "@/lib/models";

export const maxDuration = 30;

const SYSTEM_PROMPT = `당신은 UX 전문가입니다. 주어진 UI 스크린샷을 보고 가장 중요한 UX 문제 3가지를 즉시 진단합니다.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

{
  "issues": [
    {
      "severity": "critical" | "warning" | "good",
      "title": "문제 요약 (15자 이내)",
      "detail": "구체적 설명 (30자 이내)"
    }
  ],
  "score": 0-100,
  "oneLiner": "이 화면의 핵심 인사이트 한 줄 (30자 이내)"
}

규칙:
- issues는 반드시 3개
- severity 기준: critical(사용자가 목표 달성 불가), warning(개선 시 전환율 상승), good(잘 된 점)
- 최소 1개는 critical 또는 warning이어야 한다
- good이 있으면 마지막에 배치
- 한국어로 작성`;

export async function POST(request: NextRequest) {
  try {
    const { image, apiKey } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "이미지가 필요합니다" }, { status: 400 });
    }

    const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!effectiveKey) {
      return NextResponse.json({ error: "API 키가 필요합니다" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: effectiveKey });
    const base64 = image.replace(/^data:image\/\w+;base64,/, "");

    const response = await client.messages.create({
      model: MODELS.haiku,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: detectMediaType(base64), data: base64 },
          },
          { type: "text", text: "이 UI 화면을 즉시 진단해주세요. JSON만 반환." },
        ],
      }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.type === "text" ? b.text : "")
      .join("");

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
    const parsed = JSON.parse((jsonMatch[1] ?? text).trim());

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "진단 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
