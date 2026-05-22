import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const LIVE_CATEGORIES: Record<string, { name: string; promptKo: string }> = {
  scan: {
    name: "전체 스캔",
    promptKo: "Nielsen 10가지 사용성 휴리스틱 기준으로 화면 전체를 종합 평가하세요.",
  },
  usability: {
    name: "사용성",
    promptKo: "사용자가 이 화면에서 목표를 달성하는 데 방해가 되는 요소를 집중 분석하세요.",
  },
  writing: {
    name: "UX 라이팅",
    promptKo: "헤드라인, 버튼 레이블, 안내문, 마이크로카피 등 텍스트 요소의 명확성과 설득력을 분석하세요.",
  },
  visual: {
    name: "시각 위계",
    promptKo: "레이아웃, 정보 계층, 색상 대비, 시각적 무게감, 가독성을 분석하세요.",
  },
  cta: {
    name: "전환/CTA",
    promptKo: "CTA 버튼의 명확성, 위치, 레이블, 전환 흐름의 마찰 요소를 분석하세요.",
  },
};

function buildSystemPrompt(categoryId: string, followUpContext: string, ocrContext?: string): string {
  const category = LIVE_CATEGORIES[categoryId] ?? LIVE_CATEGORIES.scan;
  const ocrBlock = ocrContext?.trim() ? `\n${ocrContext.trim()}\n` : "";
  const maxFindings = categoryId === "scan" ? 6 : 4;

  return `당신은 Simulo UX 분석 어시스턴트입니다. Figma 플러그인에서 선택된 단일 화면을 빠르고 정확하게 분석합니다.

⚠ 환각 금지: 화면에 실제로 보이는 UI 요소만 분석하세요. 없는 버튼·텍스트를 추론하거나 가정하지 마세요.
${ocrBlock}
분석 카테고리: ${category.name}
분석 지침: ${category.promptKo}
${followUpContext ? `\n분석 맥락: ${followUpContext}\n` : ""}
응답 형식 (반드시 순수 JSON, 마크다운 코드 블록 없음):
{
  "quickSummary": "핵심 발견 한 줄 (30자 이내)",
  "findings": [
    {
      "criterion": "평가 기준명",
      "severity": 0,
      "oneLineFinding": "발견 요약 20자 이내",
      "detail": "상세 설명 2~3문장. 화면에서 실제 보이는 요소를 근거로 명시.",
      "fix": "구체적 수정 방법: 어떤 요소를 어떻게 변경. 모호한 표현 금지."
    }
  ],
  "nextQuestion": null
}

severity: 0=우수, 1=참고, 2=개선필요, 3=심각, 4=치명적
findings: severity 높은 순, 최대 ${maxFindings}개.
반드시 순수 JSON만 반환. \`\`\`json 블록 절대 사용 금지.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      image,
      categoryId = "scan",
      followUpContext = "",
      conversationHistory = [],
      frameName = "선택된 프레임",
      apiKey: clientApiKey,
      ocrContext,
    } = body;

    if (!image) {
      return NextResponse.json({ error: "이미지가 없습니다" }, { status: 400 });
    }

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 키가 없습니다" }, { status: 401 });
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt = buildSystemPrompt(categoryId, followUpContext, ocrContext);

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: image },
          },
          {
            type: "text",
            text: `Figma 프레임 "${frameName}"을 분석해주세요.`,
          },
        ],
      },
    ];

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
