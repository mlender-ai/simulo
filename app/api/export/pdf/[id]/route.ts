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

    // Dynamic import to avoid bundling jspdf on all pages
    const { generatePDF } = await import("@/lib/export/generatePDF");
    const doc = generatePDF(data as never);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="simulo-report-${params.id}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("[export/pdf] Error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
