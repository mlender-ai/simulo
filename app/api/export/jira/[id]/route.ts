import { NextRequest, NextResponse } from "next/server";
import { resolveAnalysis } from "@/lib/export/resolveAnalysis";

async function handle(id: string, inlined?: unknown, format?: string | null) {
  const data = await resolveAnalysis(id, inlined);
  if (!data) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  if (format === "json") {
    const { generateJiraDrafts } = await import("@/lib/export/generateJira");
    const drafts = generateJiraDrafts(data);
    return NextResponse.json(drafts, {
      headers: {
        "Content-Disposition": `attachment; filename="simulo-jira-${id}.json"`,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  const { generateJiraMarkdown } = await import("@/lib/export/generateJira");
  const md = generateJiraMarkdown(data);

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="simulo-jira-${id}.md"`,
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const format = new URL(req.url).searchParams.get("format");
    return await handle(params.id, undefined, format);
  } catch (error) {
    console.error("[export/jira] Error:", error);
    return NextResponse.json({ error: "Jira export failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const format = new URL(req.url).searchParams.get("format");
    return await handle(params.id, body.analysisData, format);
  } catch (error) {
    console.error("[export/jira] Error:", error);
    return NextResponse.json({ error: "Jira export failed" }, { status: 500 });
  }
}
