import { NextRequest, NextResponse } from "next/server";
import { resolveAnalysis } from "@/lib/export/resolveAnalysis";

async function handle(id: string, inlined?: unknown) {
  const data = await resolveAnalysis(id, inlined);
  if (!data) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const { generateMarkdown } = await import("@/lib/export/generateMarkdown");
  const md = generateMarkdown(data);

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="simulo-report-${id}.md"`,
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return await handle(params.id);
  } catch (error) {
    console.error("[export/md] Error:", error);
    return NextResponse.json({ error: "Markdown generation failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    return await handle(params.id, body.analysisData);
  } catch (error) {
    console.error("[export/md] Error:", error);
    return NextResponse.json({ error: "Markdown generation failed" }, { status: 500 });
  }
}
