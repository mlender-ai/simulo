import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import {
  buildEconomySimPrompt,
  type EconomyVariables,
} from "@/lib/prompts/economy-sim";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { currentVars, proposedVars } = (await req.json()) as {
      currentVars: EconomyVariables;
      proposedVars: EconomyVariables;
    };

    if (!currentVars || !proposedVars) {
      return NextResponse.json(
        { error: "currentVars and proposedVars required" },
        { status: 400 }
      );
    }

    const prompt = buildEconomySimPrompt(currentVars, proposedVars);

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    let result: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {
      result = { raw: rawText };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[economy simulate]", error);
    return NextResponse.json(
      { error: "Economy simulation failed" },
      { status: 500 }
    );
  }
}
