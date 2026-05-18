import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session");
  if (!session) {
    return NextResponse.json({ error: "session 파라미터 필요" }, { status: 400 });
  }

  try {
    const { prisma } = await import("@/lib/db");
    const record = await prisma.pluginAuthSession.findUnique({
      where: { id: session },
    });

    if (!record) {
      return NextResponse.json({ status: "pending" });
    }

    // 토큰 반환 후 레코드 삭제 (일회용)
    await prisma.pluginAuthSession.delete({ where: { id: session } });

    const tokens = JSON.parse(record.tokens);
    return NextResponse.json({ status: "ready", tokens });
  } catch (err) {
    console.error("[token-check] Error:", err);
    return NextResponse.json({ status: "pending" });
  }
}
