import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userText, conversationSummary } = body as {
    userText: string;
    conversationSummary?: string;
  };

  if (!userText?.trim()) {
    return NextResponse.json({ intent: "full-scan", confidence: 0.3 });
  }

  const prompt = `사용자가 Figma 플러그인에서 디자인 프레임을 선택한 뒤 다음과 같이 말했습니다:
"${userText}"

이전 대화:
${conversationSummary || "(없음)"}

아래 intent 중 가장 적합한 것 1개를 선택하세요.

- full-scan: 화면 전체 종합 분석
- analyze-axis: 특정 관점(광고, 적립, 재방문, 교환) 분석
- copy-rewrite: 화면 텍스트/카피 개선
- ab-variant: A/B 테스트 변형 생성
- competitor-compare: 경쟁사 비교
- suggestion: 구체적 개선안 요청
- flow-analysis: 여러 화면 흐름 분석
- compound: 2개 이상 동시 요청

JSON만 응답:
{"intent":"...","axis":"ad-buffer|earning-motivation|retention-trigger|exchange-trust|null","subContext":"추출된 맥락 또는 null","confidence":0.0}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({
      intent: parsed.intent || "full-scan",
      axis: parsed.axis !== "null" ? parsed.axis : undefined,
      subContext: parsed.subContext !== "null" ? parsed.subContext : undefined,
      confidence: parsed.confidence ?? 0.5,
    });
  } catch {
    return NextResponse.json({ intent: "full-scan", confidence: 0.3 });
  }
}
