import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const config = await prisma.slackConfig.findFirst({ where: { isActive: true } });
    return NextResponse.json(config ?? null);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { webhookUrl } = (await req.json()) as { webhookUrl: string };
    if (!webhookUrl) return NextResponse.json({ error: "webhookUrl required" }, { status: 400 });

    // Deactivate existing configs
    await prisma.slackConfig.updateMany({ where: {}, data: { isActive: false } });

    const config = await prisma.slackConfig.create({ data: { webhookUrl } });
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("[slack POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
