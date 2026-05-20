import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import { buildUXWritingPrompt } from "@/lib/prompts/ux-writing";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const {
      issueContext,
      currentCopy,
      screenContext,
      tones,
    } = (await req.json()) as {
      issueContext: string;
      currentCopy?: string;
      screenContext: string;
      tones: string[];
      language?: string;
    };

    if (
      !issueContext ||
      !screenContext ||
      !Array.isArray(tones) ||
      tones.length === 0
    ) {
      return NextResponse.json(
        { error: "issueContext, screenContext, tones required" },
        { status: 400 }
      );
    }

    const prompt = buildUXWritingPrompt(
      issueContext,
      currentCopy,
      screenContext,
      tones
    );

    const response = await anthropic.messages.create({
      model: MODELS.haiku,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    let result: { variants?: unknown[] } = { variants: [] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {
      result = { variants: [] };
    }

    return NextResponse.json({ variants: result.variants ?? [] });
  } catch (error) {
    console.error("[ux-writing]", error);
    return NextResponse.json(
      { error: "UX writing generation failed" },
      { status: 500 }
    );
  }
}
