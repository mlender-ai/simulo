import type { AnalysisResult } from "@/lib/storage";

export interface JiraDraft {
  summary: string;
  description: string;
  issueType: "Story" | "Task" | "Bug";
  priority: "Highest" | "High" | "Medium" | "Low";
  labels: string[];
}

function severityToPriority(severity: string): JiraDraft["priority"] {
  if (severity === "Critical") return "Highest";
  if (severity === "Medium") return "High";
  return "Medium";
}

export function generateJiraDrafts(analysis: AnalysisResult): JiraDraft[] {
  const drafts: JiraDraft[] = [];
  const date = new Date(analysis.createdAt).toLocaleDateString("ko-KR");
  const modeLabel = analysis.mode === "usability" ? "사용성" : analysis.isComparison ? "경쟁사비교" : "가설검증";

  // ── Issue-based tickets ──
  const issues = (analysis.issues ?? []) as Array<{
    screen?: string;
    severity: string;
    issue: string;
    recommendation: string;
    retentionImpact?: string;
  }>;

  for (const issue of issues) {
    const priority = severityToPriority(issue.severity);
    const labels = ["simulo", modeLabel, issue.severity.toLowerCase()];
    if (issue.screen) labels.push(issue.screen.replace(/\s+/g, "-").toLowerCase());

    const description = [
      `h2. 문제`,
      `${issue.issue}`,
      ``,
      `h2. 발견 화면`,
      `${issue.screen ?? "(미지정)"}`,
      ``,
      `h2. 권장 개선사항`,
      `${issue.recommendation}`,
      issue.retentionImpact ? `\nh2. 리텐션 영향\n${issue.retentionImpact}` : "",
      ``,
      `----`,
      `_Simulo 자동 생성 (${date}) — 분석 ID: ${analysis.id}_`,
      analysis.hypothesis ? `_가설: ${analysis.hypothesis}_` : "",
      `_타깃: ${analysis.targetUser}_`,
    ]
      .filter(Boolean)
      .join("\n");

    drafts.push({
      summary: `[Simulo/${modeLabel}] ${issue.severity === "Critical" ? "🔴 " : issue.severity === "Medium" ? "🟡 " : "🟢 "}${issue.issue.slice(0, 80)}`,
      description,
      issueType: issue.severity === "Critical" ? "Bug" : "Task",
      priority,
      labels,
    });
  }

  // ── Quick Wins as Stories ──
  const quickWins = (analysis.quickWins ?? []) as Array<{ title?: string; description?: string } | string>;
  for (const qw of quickWins) {
    const title = typeof qw === "string" ? qw : (qw.title ?? "Quick Win");
    const detail = typeof qw === "string" ? "" : (qw.description ?? "");

    drafts.push({
      summary: `[Simulo/Quick Win] ${title.slice(0, 80)}`,
      description: [
        `h2. 개요`,
        title,
        detail ? `\n${detail}` : "",
        ``,
        `----`,
        `_Simulo 자동 생성 (${date}) — 분석 ID: ${analysis.id}_`,
      ]
        .filter(Boolean)
        .join("\n"),
      issueType: "Story",
      priority: "High",
      labels: ["simulo", modeLabel, "quick-win"],
    });
  }

  return drafts;
}

/** Render Jira drafts as a human-readable Markdown document for copy-paste */
export function generateJiraMarkdown(analysis: AnalysisResult): string {
  const drafts = generateJiraDrafts(analysis);
  if (drafts.length === 0) {
    return "# Jira 드래프트\n\n발견된 이슈가 없습니다.";
  }

  const lines: string[] = [];
  lines.push(`# Jira 드래프트 — Simulo 분석 결과`);
  lines.push(`> 분석 ID: \`${analysis.id}\`  |  총 ${drafts.length}개 티켓`);
  lines.push("");
  lines.push("아래 내용을 Jira에 붙여넣기하거나 CSV로 임포트하세요.");
  lines.push("");

  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    lines.push(`---`);
    lines.push(`## 티켓 ${i + 1}`);
    lines.push("");
    lines.push(`| 필드 | 값 |`);
    lines.push(`|------|-----|`);
    lines.push(`| **제목** | ${d.summary} |`);
    lines.push(`| **유형** | ${d.issueType} |`);
    lines.push(`| **우선순위** | ${d.priority} |`);
    lines.push(`| **레이블** | ${d.labels.join(", ")} |`);
    lines.push("");
    lines.push(`### 설명`);
    lines.push("");
    // Convert Jira wiki markup to Markdown for display
    lines.push(d.description.replace(/^h2\. /gm, "#### ").replace(/^----$/gm, "---"));
    lines.push("");
  }

  return lines.join("\n");
}
