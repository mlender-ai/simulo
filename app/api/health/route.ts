import { NextResponse } from "next/server";

export async function GET() {
  // DB health check — only available when DATABASE_URL is configured
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      status: "ok",
      db: "not configured",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
