import type { AnalysisResult } from "@/lib/storage";
import type { HeatmapIssue } from "@/components/HeatmapViewer";

export function groupIssuesByScreen(
  issues: AnalysisResult["issues"] | undefined,
  thumbnailUrls: string[]
): Map<number, HeatmapIssue[]> {
  const map = new Map<number, HeatmapIssue[]>();
  (issues ?? []).forEach((issue, i) => {
    const screenIdx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
    if (!map.has(screenIdx)) map.set(screenIdx, []);
    map.get(screenIdx)!.push({
      index: i,
      severity: issue.severity,
      desireType: issue.desireType,
      issue: issue.issue,
      recommendation: issue.recommendation,
      retentionImpact: issue.retentionImpact,
      heatZone: issue.heatZone ?? null,
    });
  });
  thumbnailUrls.forEach((_, idx) => {
    if (!map.has(idx)) map.set(idx, []);
  });
  return map;
}

export function countIssuesPerScreen(issues: AnalysisResult["issues"] | undefined): Map<number, { total: number; critical: number }> {
  const map = new Map<number, { total: number; critical: number }>();
  (issues ?? []).forEach((issue) => {
    const idx = typeof issue.screenIndex === "number" ? issue.screenIndex : 0;
    if (!map.has(idx)) map.set(idx, { total: 0, critical: 0 });
    const entry = map.get(idx)!;
    entry.total++;
    if (issue.severity === "Critical" || (issue.severity as string) === "심각") entry.critical++;
  });
  return map;
}
