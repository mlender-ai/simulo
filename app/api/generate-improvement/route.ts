// app/api/generate-improvement/route.ts
//
// Request:
//   Option A (client-side data): { analysis: { score, issues, thumbnailUrls, analysisOptions }, options, roundNumber }
//   Option B (DB lookup):        { analysisId, options, roundNumber }
//
// Response: { html, changes, provider, roundNumber }

import { NextRequest, NextResponse } from "next/server";
import type { DesireAlignment } from "@/lib/storage";

interface ImprovementOptions {
  criticalOnly: boolean;
  desireAlignment: boolean;
  restructureLayout: boolean;
  targetScore: number | null;
}

interface AnalysisData {
  score: number;
  issues: unknown;
  thumbnailUrls: string[];
  analysisOptions: unknown;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { analysisId, analysis: clientAnalysis, options, roundNumber } = body as {
    analysisId?: string;
    analysis?: AnalysisData;
    options: ImprovementOptions;
    roundNumber: number;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  // Resolve analysis data: prefer client-sent, fallback to DB
  let analysis: AnalysisData | null = null;

  if (clientAnalysis && typeof clientAnalysis.score === "number" && Array.isArray(clientAnalysis.thumbnailUrls)) {
    analysis = clientAnalysis;
  } else if (analysisId && process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db");
      analysis = await prisma.analysis.findUnique({
        where: { id: analysisId },
        select: { score: true, issues: true, analysisOptions: true, thumbnailUrls: true },
      });
    } catch (err) {
      console.error("[generate-improvement] DB error:", err);
    }
  }

  if (!analysis) {
    return NextResponse.json(
      { error: "분석 데이터를 찾을 수 없습니다. analysisId 또는 analysis 객체를 전달하세요." },
      { status: 400 }
    );
  }

  // Extract fields
  const issues = (analysis.issues ?? []) as {
    severity: string;
    issue: string;
    recommendation?: string;
    desireType?: string;
  }[];

  const analysisOptions = analysis.analysisOptions as
    | { result?: { desireAlignment?: DesireAlignment } }
    | null
    | undefined;
  const desire: DesireAlignment | null =
    analysisOptions?.result?.desireAlignment ?? null;

  const originalImage = analysis.thumbnailUrls[0] ?? null;

  // Generate improvement
  const { generateImprovement } = await import("@/lib/improvement");

  try {
    const result = await generateImprovement({
      originalImage,
      issues,
      desire,
      options,
      score: analysis.score,
      roundNumber,
    });

    return NextResponse.json({
      html: result.html,
      changes: result.changes,
      provider: "opus-4.6" as const,
      roundNumber,
    });
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string; error?: { message?: string } };
    console.error("[generate-improvement] generation error:", error.message);
    if (error.status) console.error("[generate-improvement] API status:", error.status);

    return NextResponse.json(
      {
        error: "개선안 생성 실패",
        detail: error.message,
        anthropicStatus: error.status,
      },
      { status: error.status || 500 }
    );
  }
}
