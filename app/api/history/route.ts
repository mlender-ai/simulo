import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ analyses: [], source: "no-db" });
  }

  try {
    const { prisma } = await import("@/lib/db");
    const rows = await prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        hypothesis: true,
        targetUser: true,
        task: true,
        projectTag: true,
        inputType: true,
        verdict: true,
        score: true,
        taskSuccessLikelihood: true,
        taskSuccessReason: true,
        summary: true,
        strengths: true,
        thinkAloud: true,
        issues: true,
        thumbnailUrls: true,
        scoreBreakdown: true,
        verdictReason: true,
        flowAnalysis: true,
        flowSteps: true,
        mode: true,
        analysisOptions: true,
        isImprovement: true,
        previousAnalysisId: true,
        roundNumber: true,
      },
    });

    const analyses = rows.map((r: { createdAt: Date; [key: string]: unknown }) => {
      const bundle = r.analysisOptions as
        | { options?: unknown; result?: Record<string, unknown> }
        | null
        | undefined;
      const usabilityResult = r.mode === "usability" && bundle?.result ? bundle.result : {};
      return {
        ...r,
        createdAt: r.createdAt.toISOString(),
        ...usabilityResult,
      };
    });

    return NextResponse.json({ analyses, source: "db" });
  } catch (error) {
    console.error("[history] DB error:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
