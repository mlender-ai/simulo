import type { AnalysisResult } from "@/lib/storage";

/**
 * Resolve analysis data for export.
 * Priority: inlined body data > DB lookup.
 * DB lookup is skipped when DATABASE_URL is not set.
 */
export async function resolveAnalysis(
  id: string,
  inlined?: unknown
): Promise<AnalysisResult | null> {
  // 1. Use inlined data if provided (localStorage path — no DB needed)
  if (inlined && typeof inlined === "object") {
    const d = inlined as Record<string, unknown>;
    return {
      ...d,
      id: (d.id as string) ?? id,
      createdAt: (d.createdAt as string) ?? new Date().toISOString(),
      thinkAloud: (d.thinkAloud as AnalysisResult["thinkAloud"]) ?? [],
      issues: (d.issues as AnalysisResult["issues"]) ?? [],
      strengths: (d.strengths as string[]) ?? [],
    } as AnalysisResult;
  }

  // 2. DB lookup
  if (!process.env.DATABASE_URL) return null;

  const { prisma } = await import("@/lib/db");
  const analysis = await prisma.analysis.findUnique({ where: { id } });
  if (!analysis) return null;

  return {
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    thinkAloud: (analysis.thinkAloud as AnalysisResult["thinkAloud"]) ?? [],
    issues: (analysis.issues as AnalysisResult["issues"]) ?? [],
    strengths: analysis.strengths ?? [],
  } as unknown as AnalysisResult;
}
