import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";

export const maxDuration = 60;

export type VariantGoal =
  | "conversion"
  | "trust"
  | "concise"
  | "friendly"
  | "urgency"
  | "clarity";

const GOAL_LABELS: Record<VariantGoal, string> = {
  conversion: "전환율 높이기",
  trust: "신뢰 강화",
  concise: "더 간결하게",
  friendly: "더 친근하게",
  urgency: "긴급감 부여",
  clarity: "더 명확하게",
};

export interface TextVariant {
  text: string;
  reason: string;
}

export interface GenerateVariantsResponse {
  original: string;
  goal: VariantGoal;
  goalLabel: string;
  variants: TextVariant[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { original, goal, apiKey, locale = "ko" } = body as {
    original: string;
    goal: VariantGoal;
    apiKey?: string;
    locale?: string;
  };

  if (!original?.trim()) {
    return NextResponse.json({ error: "원본 텍스트가 필요합니다" }, { status: 400 });
  }
  if (!goal) {
    return NextResponse.json({ error: "목표를 선택해주세요" }, { status: 400 });
  }

  const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!effectiveKey) {
    return NextResponse.json({ error: "API 키가 설정되지 않았습니다" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: effectiveKey });

  const goalLabel = GOAL_LABELS[goal] ?? goal;
  const isKo = locale !== "en";

  const systemPrompt = isKo
    ? `당신은 UX 라이팅 전문가입니다. 주어진 텍스트를 지정된 목표에 맞게 변형합니다.
규칙:
- 반드시 해요체 사용
- 원본 의미 유지, 표현만 개선
- 각 변형은 실질적으로 달라야 함
- reason은 한 문장, 예상 효과 중심으로`
    : `You are a UX writing expert. Generate text variants for the given goal.
Rules:
- Preserve the original meaning
- Each variant must be meaningfully different
- reason should be one sentence focusing on expected impact`;

  const userPrompt = isKo
    ? `원본 텍스트: "${original}"
목표: ${goalLabel}

위 텍스트를 "${goalLabel}" 방향으로 개선한 변형 4개를 JSON으로 반환하세요.

형식:
{"variants": [{"text": "변형 텍스트", "reason": "한 줄 이유"}, ...]}`
    : `Original text: "${original}"
Goal: ${goalLabel}

Generate 4 variants of the above text toward the "${goalLabel}" goal. Return JSON only.

Format:
{"variants": [{"text": "variant text", "reason": "one-line reason"}, ...]}`;

  try {
    const message = await client.messages.create({
      model: MODELS.haiku,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "응답 파싱 실패" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as { variants: TextVariant[] };

    const result: GenerateVariantsResponse = {
      original,
      goal,
      goalLabel,
      variants: parsed.variants.slice(0, 5),
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "변형 생성 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
