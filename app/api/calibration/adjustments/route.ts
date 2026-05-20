import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeCalibrationTrend, buildCalibrationDirective } from "@/lib/prompt-calibration";
import type { CalibrationRecord, SeverityLevel } from "@/lib/calibration";

// GET /api/calibration/adjustments — get current calibration adjustments
export async function GET() {
  try {
    const rawRecords = await prisma.calibrationRecord.findMany({
      orderBy: { calibratedAt: "desc" },
      take: 500,
    });

    const records: CalibrationRecord[] = rawRecords.map((r) => ({
      id: r.id,
      analysisId: r.analysisId,
      criterionId: r.criterionId,
      predictedSeverity: r.predictedSeverity as SeverityLevel,
      actualMetric: r.actualMetric,
      actualValue: r.actualValue,
      accuracy: r.accuracy as CalibrationRecord["accuracy"],
      deviation: r.deviation,
      calibratedAt: r.calibratedAt,
    }));

    const adjustments = analyzeCalibrationTrend(records);
    const directive = buildCalibrationDirective(adjustments);

    // Summary stats
    const totalRecords = records.length;
    const accurateCount = records.filter((r) => r.accuracy === "accurate").length;
    const overCount = records.filter((r) => r.accuracy === "overestimated").length;
    const underCount = records.filter((r) => r.accuracy === "underestimated").length;

    return NextResponse.json({
      adjustments,
      directive,
      stats: {
        total: totalRecords,
        accurate: accurateCount,
        overestimated: overCount,
        underestimated: underCount,
        accuracyRate: totalRecords > 0 ? accurateCount / totalRecords : null,
      },
    });
  } catch (error) {
    console.error("[calibration adjustments]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
