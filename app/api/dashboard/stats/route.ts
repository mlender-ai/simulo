import { NextResponse } from "next/server";

export type Period = "7d" | "30d" | "90d" | "all";

function getCutoff(period: Period): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function getPrevCutoff(period: Period): { start: Date | null; end: Date } | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

interface IssueItem {
  issue?: string;
  severity?: string;
  screen?: string;
  heatZone?: { label?: string };
  [key: string]: unknown;
}

function extractDesireScores(row: {
  mode: string;
  analysisOptions?: unknown;
  scoreBreakdown?: unknown;
}): { utility: number; healthPride: number; lossAversion: number } | null {
  // usability mode: desireAlignment is inside analysisOptions.result
  if (row.mode === "usability" && row.analysisOptions) {
    const bundle = row.analysisOptions as {
      result?: {
        desireAlignment?: {
          utility?: { score?: number };
          healthPride?: { score?: number };
          lossAversion?: { score?: number };
        };
      };
    };
    const da = bundle?.result?.desireAlignment;
    if (da?.utility?.score !== undefined) {
      return {
        utility: da.utility.score ?? 5,
        healthPride: da.healthPride?.score ?? 5,
        lossAversion: da.lossAversion?.score ?? 5,
      };
    }
  }
  // hypothesis mode: desire scores not separately stored in DB
  return null;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      totalAnalyses: 0,
      prevTotalAnalyses: 0,
      avgScore: 0,
      prevAvgScore: 0,
      avgDesire: { utility: 0, healthPride: 0, lossAversion: 0 },
      resolvedIssueRate: 0,
      scoreTimeline: [],
      topIssues: [],
      keywords: [],
      desireTimeline: [],
      projectTags: [],
    });
  }

  let period: Period = "30d";
  let projectTag: string | undefined;

  try {
    const body = await req.json();
    period = body.period ?? "30d";
    projectTag = body.projectTag || undefined;
  } catch {
    // use defaults
  }

  try {
    const { prisma } = await import("@/lib/db");

    const cutoff = getCutoff(period);
    const prevRange = getPrevCutoff(period);

    const baseWhere = {
      isComparison: false,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      ...(projectTag ? { projectTag } : {}),
    };

    const prevWhere =
      prevRange
        ? {
            isComparison: false,
            createdAt: { gte: prevRange.start ?? new Date(0), lt: prevRange.end },
            ...(projectTag ? { projectTag } : {}),
          }
        : null;

    const [rows, prevRows, allTags] = await Promise.all([
      prisma.analysis.findMany({
        where: baseWhere,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          hypothesis: true,
          projectTag: true,
          score: true,
          issues: true,
          mode: true,
          analysisOptions: true,
          isImprovement: true,
          previousAnalysisId: true,
        },
      }),
      prevWhere
        ? prisma.analysis.findMany({
            where: prevWhere,
            select: { score: true },
          })
        : Promise.resolve([]),
      prisma.analysis.findMany({
        where: { isComparison: false },
        select: { projectTag: true },
        distinct: ["projectTag"],
      }),
    ]);

    // ── Basic metrics ──
    const totalAnalyses = rows.length;
    const prevTotalAnalyses = prevRows.length;
    const avgScore = avg(rows.map((r) => r.score));
    const prevAvgScore = avg(prevRows.map((r: { score: number }) => r.score));

    // ── Desire alignment ──
    const desireRows = rows
      .map((r) => extractDesireScores(r as { mode: string; analysisOptions?: unknown; scoreBreakdown?: unknown }))
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const avgDesire = {
      utility: avg(desireRows.map((d) => d.utility)),
      healthPride: avg(desireRows.map((d) => d.healthPride)),
      lossAversion: avg(desireRows.map((d) => d.lossAversion)),
    };

    // ── Resolved issue rate ──
    // improvement analysis exists for the original → original issue is "resolved"
    const improvedIds = new Set(
      rows.filter((r) => r.isImprovement && r.previousAnalysisId).map((r) => r.previousAnalysisId!)
    );
    const nonImprovementAnalyses = rows.filter((r) => !r.isImprovement);
    const resolvedIssueRate =
      nonImprovementAnalyses.length > 0
        ? Math.round((improvedIds.size / nonImprovementAnalyses.length) * 100)
        : 0;

    // ── Score timeline ──
    const scoreTimeline = rows.map((r) => ({
      date: r.createdAt.toISOString().split("T")[0],
      score: r.score,
      projectTag: r.projectTag ?? null,
      analysisId: r.id,
      hypothesis: r.hypothesis.slice(0, 60),
    }));

    // ── Desire timeline ──
    const desireTimeline = rows
      .map((r) => {
        const d = extractDesireScores(r as { mode: string; analysisOptions?: unknown; scoreBreakdown?: unknown });
        if (!d) return null;
        return {
          date: r.createdAt.toISOString().split("T")[0],
          utility: d.utility,
          healthPride: d.healthPride,
          lossAversion: d.lossAversion,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // ── Top issues ──
    const issueMap: Record<
      string,
      { pattern: string; count: number; severitySum: number; screens: Set<string> }
    > = {};

    for (const row of rows) {
      const issues = (row.issues as IssueItem[] | null) ?? [];
      for (const issue of issues) {
        if (!issue.issue) continue;
        // Group by first 40 chars (normalized)
        const key = issue.issue.trim().slice(0, 40).toLowerCase();
        if (!issueMap[key]) {
          issueMap[key] = {
            pattern: issue.issue.trim(),
            count: 0,
            severitySum: 0,
            screens: new Set(),
          };
        }
        issueMap[key].count++;
        issueMap[key].severitySum +=
          issue.severity === "Critical" ? 3 : issue.severity === "Medium" ? 2 : 1;
        if (row.projectTag) issueMap[key].screens.add(row.projectTag);
      }
    }

    const topIssues = Object.values(issueMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => {
        const avg = entry.severitySum / entry.count;
        return {
          pattern: entry.pattern,
          count: entry.count,
          avgSeverity: avg > 2.5 ? "Critical" : avg > 1.5 ? "Medium" : "Low",
          screens: Array.from(entry.screens),
        };
      });

    // ── Keywords from hypothesis text ──
    const allText = rows.map((r) => r.hypothesis).join(" ");
    const freqMap: Record<string, number> = {};
    for (const word of allText.split(/\s+/)) {
      const w = word.replace(/[^\uAC00-\uD7A3\w]/g, "").trim();
      if (w.length < 2) continue;
      freqMap[w] = (freqMap[w] ?? 0) + 1;
    }
    const keywords = Object.entries(freqMap)
      .filter(([, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // ── Project tags ──
    const projectTags = allTags
      .map((t) => t.projectTag)
      .filter((tag): tag is string => tag !== null);

    return NextResponse.json({
      totalAnalyses,
      prevTotalAnalyses,
      avgScore,
      prevAvgScore,
      avgDesire,
      resolvedIssueRate,
      scoreTimeline,
      topIssues,
      keywords,
      desireTimeline,
      projectTags,
    });
  } catch (error) {
    console.error("[dashboard/stats]", error);
    return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
  }
}
