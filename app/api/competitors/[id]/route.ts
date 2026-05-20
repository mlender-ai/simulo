import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE /api/competitors/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.competitor.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// GET /api/competitors/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const competitor = await prisma.competitor.findUniqueOrThrow({
      where: { id: params.id },
      include: { analyses: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json(competitor);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
