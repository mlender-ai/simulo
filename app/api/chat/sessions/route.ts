// app/api/chat/sessions/route.ts
// Saves a completed chat analysis session to DB (fire-and-forget from plugin)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

interface SessionPayload {
  frameId: string;
  frameName: string;
  intent?: string;
  quickSummary?: string;
  findings?: Array<{
    criterion: string;
    severity: number;
    oneLineFinding: string;
    detail: string;
    fix: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SessionPayload;

    if (!body.frameId || !body.frameName) {
      return Response.json({ error: "frameId, frameName required" }, { status: 400 });
    }

    const session = await prisma.chatSession.create({
      data: {
        frameId:      body.frameId,
        frameName:    body.frameName,
        intent:       body.intent ?? null,
        quickSummary: body.quickSummary ?? null,
        findings:     body.findings ?? [],
      },
    });

    return Response.json({ id: session.id });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
