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

    return NextResponse.json({
      ...row,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[report] DB error:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
