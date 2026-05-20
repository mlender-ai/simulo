import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";
import { buildReviewAnalysisPrompt } from "@/lib/prompts/review-analysis";
import { parseReviewCSV } from "@/lib/store-research";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// POST /api/competitors/[id]/reviews — upload review CSV and analyze
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { csvText, platform = "android" } = await req.json();

    if (!csvText) {
      return NextResponse.json({ error: "csvText required" }, { status: 400 });
    }

    const competitor = await prisma.competitor.findUniqueOrThrow({
      where: { id: params.id },
    });

    const reviews = parseReviewCSV(csvText);
    if (reviews.length === 0) {
      return NextResponse.json({ error: "No reviews parsed" }, { status: 400 });
    }

    const prompt = buildReviewAnalysisPrompt(competitor.name, reviews);

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    let analysisResult: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysisResult = JSON.parse(jsonMatch[0]);
    } catch {
      analysisResult = { raw: rawText };
    }

    const snapshot = await prisma.storeSnapshot.create({
      data: {
        competitorId: params.id,
        platform,
        rating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
        ratingCount: reviews.length,
        reviews: reviews as unknown as object[],
        updateNotes: [],
        analysisResult: analysisResult as object,
      },
    });

    return NextResponse.json({
      id: snapshot.id,
      reviewCount: reviews.length,
      analysisResult,
    });
  } catch (error) {
    console.error("[competitor reviews]", error);
    return NextResponse.json({ error: "Review analysis failed" }, { status: 500 });
  }
}
