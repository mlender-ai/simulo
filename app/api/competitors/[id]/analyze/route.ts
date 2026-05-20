import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import { buildCompetitorSystemPrompt } from "@/lib/prompts/competitor";
import { parseFrameworkResponse } from "@/lib/frameworks";
import { validateFrameworkIds } from "@/lib/prompts/heuristic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// POST /api/competitors/[id]/analyze
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { screenshots, frameworks: rawFrameworks } = await req.json();

    if (!Array.isArray(screenshots) || screenshots.length === 0) {
      return NextResponse.json({ error: "screenshots required" }, { status: 400 });
    }

    const competitor = await prisma.competitor.findUniqueOrThrow({
      where: { id: params.id },
    });

    const frameworkIds = validateFrameworkIds(rawFrameworks);
    const systemPrompt = buildCompetitorSystemPrompt(competitor.name);

    // Build image content blocks
    const imageBlocks: Anthropic.ImageBlockParam[] = screenshots
      .slice(0, 8)
      .map((img: string) => {
        const base64 = img.replace(/^data:image\/\w+;base64,/, "");
        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: base64,
          },
        };
      });

    const frameworkInstructions =
      frameworkIds.length > 0
        ? `\n\n평가할 프레임워크 ID: ${frameworkIds.join(", ")}\n각 프레임워크를 {"frameworkResults": [...]} 형식으로 JSON 응답에 포함하세요.`
        : "";

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
              text: `경쟁사 "${competitor.name}"의 스크린샷을 분석해주세요.${frameworkInstructions}\n\n결과를 JSON 형식으로 반환하세요:
{
  "verdict": "Pass|Partial|Fail",
  "score": 0-100,
  "summary": "...",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "benchmarkOpportunities": ["..."],
  "issues": [{"screen": "...", "severity": "Critical|Medium|Low", "issue": "...", "recommendation": "..."}],
  "frameworkResults": [...]
}`,
            },
          ],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { summary: rawText };
    }

    const frameworkResults =
      frameworkIds.length > 0
        ? parseFrameworkResponse(rawText, frameworkIds)
        : [];

    const analysis = await prisma.competitorAnalysis.create({
      data: {
        competitorId: params.id,
        screenshots,
        frameworks: frameworkIds,
        results: { ...parsed, frameworkResults } as object,
      },
    });

    return NextResponse.json({
      id: analysis.id,
      competitorId: params.id,
      competitorName: competitor.name,
      results: analysis.results,
      createdAt: analysis.createdAt,
    });
  } catch (error) {
    console.error("[competitor analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
