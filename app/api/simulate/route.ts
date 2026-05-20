import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import { buildSimulationPrompt } from "@/lib/prompts/simulation";
import type { FrameworkResult } from "@/lib/frameworks";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { originalResults, hypothesis, changeDescription, affectedScreens } =
      (await req.json()) as {
        originalResults: FrameworkResult[];
        hypothesis: string;
        changeDescription: string;
        affectedScreens?: string[];
      };

    if (!hypothesis || !changeDescription || !Array.isArray(originalResults)) {
      return NextResponse.json(
        { error: "hypothesis, changeDescription, originalResults required" },
        { status: 400 }
      );
    }

    const prompt = buildSimulationPrompt(originalResults, hypothesis, changeDescription);

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 3000,
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

    return NextResponse.json({
      before: originalResults,
      after: result.afterResults ?? [],
      delta: result.deltas ?? [],
      abTestWorth: result.abTestWorth ?? false,
      abTestRationale: result.abTestRationale ?? "",
      estimatedImpact: result.estimatedImpact ?? {},
      affectedScreens,
    });
  } catch (error) {
    console.error("[simulate]", error);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
