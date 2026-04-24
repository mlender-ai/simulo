import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isDbConfigured } = await import("@/lib/db");

    if (!isDbConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const { prisma } = await import("@/lib/db");
    const analysis = await prisma.analysis.findUnique({
      where: { id: params.id },
    });

    if (!analysis) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = {
      ...analysis,
      createdAt: analysis.createdAt.toISOString(),
      thinkAloud: (analysis.thinkAloud as { screen: string; thought: string }[]) ?? [],
      issues: (analysis.issues as unknown[]) ?? [],
      strengths: analysis.strengths ?? [],
    };

    const { generateMarkdown } = await import("@/lib/export/generateMarkdown");
    const md = generateMarkdown(data as never);

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="simulo-report-${params.id}.md"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("[export/md] Error:", error);
    return NextResponse.json({ error: "Markdown generation failed" }, { status: 500 });
  }
}
