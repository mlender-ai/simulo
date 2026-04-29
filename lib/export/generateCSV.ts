import type { AnalysisResult } from "@/lib/storage";

function escapeCell(val: string | null | undefined): string {
  const s = String(val ?? "");
  // RFC 4180: wrap in quotes if contains comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function row(cells: (string | null | undefined)[]): string {
  return cells.map(escapeCell).join(",");
}

export function generateCSV(data: AnalysisResult): string {
  // UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";

  const headers = ["번호", "화면", "심각도", "이슈", "권장사항", "역효과 위험", "가설 관련도"];

  const issues = data.issues ?? [];
  const rows = issues.map((issue, i) =>
    row([
      String(i + 1),
      issue.screen ?? "",
      issue.severity ?? "",
      issue.issue ?? "",
      issue.recommendation ?? "",
      issue.backfireRisk ?? "",
      issue.relevanceToHypothesis ?? "",
    ])
  );

  const lines = [row(headers), ...rows];
  return BOM + lines.join("\r\n");
}
