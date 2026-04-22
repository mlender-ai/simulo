// app/api/generate-improvement/route.ts
// ⚠️ Claude Design API 출시 시 이 파일만 교체
//
// 안정적인 Request/Response 인터페이스:
//
// Request:  { analysisId, options: { criticalOnly, desireAlignment, restructureLayout, targetScore }, roundNumber }
// Response: { html, changes, provider, roundNumber, ...extendedComparisonData }
//
// 내부 구현(generator)만 opusGenerator → claudeDesignGenerator로 교체하면 됨.

import { NextRequest, NextResponse } from "next/server";
import type { DesireAlignment } from "@/lib/storage";

type PrismaAnalysis = {
  score: number;
  issues: unknown;
  analysisOptions: unknown;
  thumbnailUrls: string[];
};

interface ImprovementOptions {
  criticalOnly: boolean;
  desireAlignment: boolean;
  restructureLayout: boolean;
  targetScore: number | null;
}

interface ImprovementRequest {
  analysisId: string;
  options: ImprovementOptions;
  roundNumber: number;
}

export async function POST(req: NextRequest) {
  const { analysisId, options, roundNumber }: ImprovementRequest = await req.json();

  if (!analysisId) {
    return NextResponse.json({ error: "analysisId is required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  // 1. DB에서 분석 결과 조회
  let analysis: PrismaAnalysis | null = null;

  try {
    const { prisma } = await import("@/lib/db");
    analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { score: true, issues: true, analysisOptions: true, thumbnailUrls: true },
    });
  } catch (err) {
    console.error("[generate-improvement] DB error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!analysis) {
    return NextResponse.json({ error: "분석을 찾을 수 없습니다" }, { status: 404 });
  }

  // 2. 타입 정리
  const issues = (analysis.issues ?? []) as {
    severity: string;
    issue: string;
    recommendation?: string;
    desireType?: string;
  }[];

  // desireAlignment는 analysisOptions.result 안에 저장됨
  const analysisOptions = analysis.analysisOptions as
    | { result?: { desireAlignment?: DesireAlignment } }
    | null
    | undefined;
  const desire: DesireAlignment | null =
    analysisOptions?.result?.desireAlignment ?? null;

  const originalImage = analysis.thumbnailUrls[0] ?? null;

  // 3. 개선안 생성 — IMPROVEMENT_MODEL env var로 provider 전환 (lib/improvement/index.ts)
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
      provider: "opus-4.7" as const,
      roundNumber,
    });
  } catch (err) {
    console.error("[generate-improvement] generation error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
