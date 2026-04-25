import { NextRequest, NextResponse } from "next/server";
import { resolveAnalysis } from "@/lib/export/resolveAnalysis";

async function handle(id: string, inlined?: unknown) {
  const data = await resolveAnalysis(id, inlined);
  if (!data) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const { generateDOCXBuffer } = await import("@/lib/export/generateDOCX");
  const buffer = await generateDOCXBuffer(data);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="simulo-report-${id}.docx"`,
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
    console.error("[export/docx] Error:", error);
    return NextResponse.json({ error: "DOCX generation failed" }, { status: 500 });
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
    console.error("[export/docx] Error:", error);
    return NextResponse.json({ error: "DOCX generation failed" }, { status: 500 });
  }
}
