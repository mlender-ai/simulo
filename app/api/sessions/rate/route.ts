import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const { sessionId, rating } = await req.json();
  if (!sessionId || typeof rating !== "number" || rating < 1 || rating > 5) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { rating },
  });
  return Response.json({ ok: true });
}
