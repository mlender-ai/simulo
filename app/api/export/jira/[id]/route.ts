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

    const format = new URL(_request.url).searchParams.get("format");

    if (format === "json") {
      const { generateJiraDrafts } = await import("@/lib/export/generateJira");
      const drafts = generateJiraDrafts(data as never);
      return NextResponse.json(drafts, {
        headers: {
          "Content-Disposition": `attachment; filename="simulo-jira-${params.id}.json"`,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    const { generateJiraMarkdown } = await import("@/lib/export/generateJira");
    const md = generateJiraMarkdown(data as never);

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="simulo-jira-${params.id}.md"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("[export/jira] Error:", error);
    return NextResponse.json({ error: "Jira export failed" }, { status: 500 });
  }
}
