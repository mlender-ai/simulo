import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import { buildCompetitorSystemPrompt } from "@/lib/prompts/competitor";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { competitorName, screenshots, frameworks = [] } = (await req.json()) as {
      competitorName: string;
      screenshots: string[]; // base64 images (can include video frames)
      frameworks?: string[];
    };

    void frameworks; // reserved for future use

    if (!competitorName || !screenshots || screenshots.length === 0) {
      return NextResponse.json(
        { error: "competitorName and screenshots required" },
        { status: 400 }
      );
    }

    const systemPrompt = buildCompetitorSystemPrompt(competitorName);

    const imageBlocks: Anthropic.ImageBlockParam[] = screenshots
      .slice(0, 10)
      .map((img: string) => {
        const base64 = img.replace(/^data:image\/\w+;base64,/, "");
        return {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
        };
      });

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `경쟁사 "${competitorName}"의 스크린샷 ${screenshots.length}장을 분석해주세요.

결과를 JSON 형식으로 반환하세요:
{
  "verdict": "Pass|Partial|Fail",
  "score": 0-100,
  "summary": "전체 평가 요약",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "benchmarkOpportunities": ["야핏무브가 배울 점1", "배울 점2"],
  "issues": [
    {"screen": "화면명", "severity": "Critical|Medium|Low", "issue": "발견된 문제", "recommendation": "개선 제안"}
  ],
  "vsYafit": {
    "theyWinAt": ["경쟁사가 우세한 점"],
    "yafitWinsAt": ["야핏무브가 우세한 점"],
    "copyThis": ["즉시 벤치마킹 가능한 요소"]
  }
}`,
            },
          ],
        },
      ],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    let result: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {
      result = { summary: rawText };
    }

    return NextResponse.json({
      competitorName,
      screenshotCount: screenshots.length,
      result,
    });
  } catch (error) {
    console.error("[quick-analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
