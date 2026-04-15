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

    const { generateDOCXBuffer } = await import("@/lib/export/generateDOCX");
    const buffer = await generateDOCXBuffer(data as never);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="simulo-report-${params.id}.docx"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("[export/docx] Error:", error);
    return NextResponse.json({ error: "DOCX generation failed" }, { status: 500 });
  }
}
