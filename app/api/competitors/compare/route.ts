import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import { buildCompetitorComparePrompt } from "@/lib/prompts/competitor";
import type { FrameworkResult } from "@/lib/frameworks";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// GET /api/competitors/compare?ids=id1,id2&ourAnalysisId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
    const ourAnalysisId = searchParams.get("ourAnalysisId");

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }

    const competitorAnalyses = await prisma.competitorAnalysis.findMany({
      where: { id: { in: ids } },
      include: { competitor: true },
    });

    if (competitorAnalyses.length === 0) {
      return NextResponse.json({ error: "No analyses found" }, { status: 404 });
    }

    let ourFrameworkResults: FrameworkResult[] = [];
    if (ourAnalysisId) {
      const ourAnalysis = await prisma.analysis.findUnique({
        where: { id: ourAnalysisId },
      });
      if (ourAnalysis?.analysisOptions) {
        const opts = ourAnalysis.analysisOptions as { result?: { frameworkResults?: FrameworkResult[] } };
        ourFrameworkResults = opts.result?.frameworkResults ?? [];
      }
    }

    const comparisons = await Promise.all(
      competitorAnalyses.map(async (ca) => {
        const compResults = (ca.results as { frameworkResults?: FrameworkResult[] })?.frameworkResults ?? [];

        if (ourFrameworkResults.length === 0 || compResults.length === 0) {
          return {
            competitorId: ca.competitorId,
            competitorName: ca.competitor.name,
            analysisId: ca.id,
            results: ca.results,
            comparison: null,
          };
        }

        const prompt = buildCompetitorComparePrompt(
          ourFrameworkResults,
          compResults,
          ca.competitor.name
        );

        const response = await anthropic.messages.create({
          model: MODELS.haiku,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });

        let comparison: Record<string, unknown> = {};
        const rawText =
          response.content[0].type === "text" ? response.content[0].text : "";
        try {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) comparison = JSON.parse(jsonMatch[0]);
        } catch {
          comparison = {};
        }

        return {
          competitorId: ca.competitorId,
          competitorName: ca.competitor.name,
          analysisId: ca.id,
          results: ca.results,
          comparison,
        };
      })
    );

    return NextResponse.json({ comparisons });
  } catch (error) {
    console.error("[competitors compare]", error);
    return NextResponse.json({ error: "Compare failed" }, { status: 500 });
  }
}
