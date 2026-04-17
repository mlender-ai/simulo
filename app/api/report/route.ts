import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  try {
    const { prisma } = await import("@/lib/db");
    const row = await prisma.analysis.findUnique({ where: { id } });

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // For usability mode, unpack analysisOptions.result so report UI can read
    // grade/quickWins/desireAlignment/accessibility4050/retentionRisk at the top level.
    const bundle = row.analysisOptions as
      | { options?: unknown; result?: Record<string, unknown> }
      | null
      | undefined;
    const usabilityResult = row.mode === "usability" && bundle?.result ? bundle.result : {};

    return NextResponse.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      ...usabilityResult,
    });
  } catch (error) {
    console.error("[report] DB error:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
