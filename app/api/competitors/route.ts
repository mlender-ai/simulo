import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/competitors — list all competitors
export async function GET() {
  try {
    const competitors = await prisma.competitor.findMany({
      include: {
        analyses: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { analyses: true, snapshots: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(competitors);
  } catch (error) {
    console.error("[competitors GET]", error);
    return NextResponse.json({ error: "Failed to fetch competitors" }, { status: 500 });
  }
}

// POST /api/competitors — register a competitor
export async function POST(req: NextRequest) {
  try {
    const { name, url, logoUrl } = await req.json();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const competitor = await prisma.competitor.create({
      data: { name, url: url ?? null, logoUrl: logoUrl ?? null },
    });
    return NextResponse.json(competitor, { status: 201 });
  } catch (error) {
    console.error("[competitors POST]", error);
    return NextResponse.json({ error: "Failed to create competitor" }, { status: 500 });
  }
}
