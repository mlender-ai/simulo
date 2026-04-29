import { NextRequest, NextResponse } from "next/server";
import { resolveAnalysis } from "@/lib/export/resolveAnalysis";

async function handle(id: string, inlined?: unknown) {
  const data = await resolveAnalysis(id, inlined);
  if (!data) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const { generateCSV } = await import("@/lib/export/generateCSV");
  const csv = generateCSV(data);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="simulo-issues-${id}.csv"`,
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
    console.error("[export/csv] Error:", error);
    return NextResponse.json({ error: "CSV generation failed" }, { status: 500 });
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
    console.error("[export/csv] Error:", error);
    return NextResponse.json({ error: "CSV generation failed" }, { status: 500 });
  }
}
