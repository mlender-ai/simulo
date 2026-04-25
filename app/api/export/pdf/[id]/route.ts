import { NextRequest, NextResponse } from "next/server";
import { resolveAnalysis } from "@/lib/export/resolveAnalysis";

async function handle(id: string, inlined?: unknown) {
  const data = await resolveAnalysis(id, inlined);
  if (!data) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const { generatePDF } = await import("@/lib/export/generatePDF");
  const doc = generatePDF(data);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="simulo-report-${id}.pdf"`,
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
    console.error("[export/pdf] Error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
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
    console.error("[export/pdf] Error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
