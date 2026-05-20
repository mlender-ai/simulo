import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateAccuracy,
  calculateDeviation,
  type SeverityLevel,
} from "@/lib/calibration";

// GET /api/calibration — list all records
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const criterionId = searchParams.get("criterionId");
    const analysisId = searchParams.get("analysisId");

    const records = await prisma.calibrationRecord.findMany({
      where: {
        ...(criterionId ? { criterionId } : {}),
        ...(analysisId ? { analysisId } : {}),
      },
      orderBy: { calibratedAt: "desc" },
      take: 200,
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error("[calibration GET]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/calibration — add a calibration record manually
export async function POST(req: NextRequest) {
  try {
    const { analysisId, criterionId, predictedSeverity, actualMetric, actualValue } =
      (await req.json()) as {
        analysisId: string;
        criterionId: string;
        predictedSeverity: SeverityLevel;
        actualMetric: string;
        actualValue: number;
      };

    if (!analysisId || !criterionId || predictedSeverity == null || actualValue == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const accuracy = calculateAccuracy(predictedSeverity, criterionId, actualValue);
    const deviation = calculateDeviation(predictedSeverity, criterionId, actualValue);

    const record = await prisma.calibrationRecord.create({
      data: {
        analysisId,
        criterionId,
        predictedSeverity,
        actualMetric,
        actualValue,
        accuracy,
        deviation,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("[calibration POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
