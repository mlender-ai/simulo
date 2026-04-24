import type { AnalysisResult } from "@/lib/storage";

function verdictEmoji(v: string): string {
  if (v === "Pass") return "✅";
  if (v === "Partial") return "⚠️";
  if (v === "Fail") return "❌";
  return "—";
}

function severityEmoji(s: string): string {
  if (s === "Critical") return "🔴";
  if (s === "Medium") return "🟡";
  if (s === "Low") return "🟢";
  return "•";
}

export function generateMarkdown(analysis: AnalysisResult): string {
  const lines: string[] = [];
  const date = new Date(analysis.createdAt).toLocaleDateString("ko-KR");
  const isUsability = analysis.mode === "usability";
  const isComparison = analysis.isComparison;

  // ── Header ──
  lines.push(`# Simulo 분석 리포트`);
  lines.push(`> 생성일: ${date}  |  모드: ${isUsability ? "사용성 분석" : isComparison ? "경쟁사 비교" : "가설 검증"}  |  ID: \`${analysis.id}\``);
  lines.push("");

  // ── Meta ──
  lines.push(`## 기본 정보`);
  lines.push("");
  if (analysis.hypothesis) lines.push(`- **가설**: ${analysis.hypothesis}`);
  lines.push(`- **타깃 유저**: ${analysis.targetUser}`);
  if (analysis.task) lines.push(`- **태스크**: ${analysis.task}`);
  if (analysis.projectTag) lines.push(`- **프로젝트 태그**: ${analysis.projectTag}`);
  if (analysis.inputType) lines.push(`- **입력 타입**: ${analysis.inputType}`);
  lines.push("");

  // ── Verdict / Score ──
  lines.push(`## 분석 결과`);
  lines.push("");
  lines.push(`| 항목 | 값 |`);
  lines.push(`|------|-----|`);
  lines.push(`| 판정 | ${verdictEmoji(analysis.verdict)} ${analysis.verdict} |`);
  lines.push(`| 점수 | **${analysis.score}점** |`);
  if (analysis.taskSuccessLikelihood) {
    lines.push(`| 태스크 성공 가능성 | ${analysis.taskSuccessLikelihood} |`);
  }
  if (isUsability && analysis.grade) {
    lines.push(`| 등급 | ${analysis.grade} |`);
  }
  lines.push("");

  // ── Summary ──
  if (analysis.summary) {
    lines.push(`## 요약`);
    lines.push("");
    lines.push(analysis.summary);
    lines.push("");
  }

  if (analysis.verdictReason) {
    lines.push(`## 판정 근거`);
    lines.push("");
    lines.push(analysis.verdictReason);
    lines.push("");
  }

  if (analysis.taskSuccessReason) {
    lines.push(`## 태스크 성공 근거`);
    lines.push("");
    lines.push(analysis.taskSuccessReason);
    lines.push("");
  }

  // ── Score Breakdown ──
  if (analysis.scoreBreakdown) {
    lines.push(`## 점수 세부 내역`);
    lines.push("");
    lines.push(`| 항목 | 점수 | 근거 |`);
    lines.push(`|------|------|------|`);
    const sb = analysis.scoreBreakdown;
    if (sb.clarity) lines.push(`| 명확성 | ${sb.clarity.score} | ${sb.clarity.reason} |`);
    if (sb.flow) lines.push(`| 흐름 | ${sb.flow.score} | ${sb.flow.reason} |`);
    if (sb.feedback) lines.push(`| 피드백 | ${sb.feedback.score} | ${sb.feedback.reason} |`);
    if (sb.efficiency) lines.push(`| 효율성 | ${sb.efficiency.score} | ${sb.efficiency.reason} |`);
    lines.push("");
  }

  // ── Strengths ──
  if (analysis.strengths?.length) {
    lines.push(`## 강점`);
    lines.push("");
    for (const s of analysis.strengths) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  // ── Issues ──
  if (analysis.issues?.length) {
    lines.push(`## 발견된 이슈`);
    lines.push("");
    for (const issue of analysis.issues as Array<{
      screen?: string;
      severity: string;
      issue: string;
      recommendation: string;
      retentionImpact?: string;
    }>) {
      lines.push(`### ${severityEmoji(issue.severity)} ${issue.issue}`);
      lines.push("");
      if (issue.screen) lines.push(`- **화면**: ${issue.screen}`);
      lines.push(`- **심각도**: ${issue.severity}`);
      lines.push(`- **권장 개선사항**: ${issue.recommendation}`);
      if (issue.retentionImpact) lines.push(`- **리텐션 영향**: ${issue.retentionImpact}`);
      lines.push("");
    }
  }

  // ── Quick Wins ──
  if (isUsability && analysis.quickWins?.length) {
    lines.push(`## Quick Wins`);
    lines.push("");
    for (const qw of analysis.quickWins as Array<{ title?: string; description?: string } | string>) {
      if (typeof qw === "string") {
        lines.push(`- ${qw}`);
      } else {
        if (qw.title) lines.push(`### ${qw.title}`);
        if (qw.description) lines.push(qw.description);
        lines.push("");
      }
    }
    lines.push("");
  }

  // ── Flow Analysis ──
  if (analysis.flowAnalysis?.length) {
    lines.push(`## 플로우 분석`);
    lines.push("");
    lines.push(`| 단계 | 화면 | 이탈 위험 | 근거 |`);
    lines.push(`|------|------|-----------|------|`);
    for (const f of analysis.flowAnalysis as Array<{
      step: number;
      stepName: string;
      dropOffRisk: string;
      reason: string;
    }>) {
      lines.push(`| ${f.step} | ${f.stepName} | ${f.dropOffRisk} | ${f.reason} |`);
    }
    lines.push("");
  }

  // ── Think Aloud ──
  if (analysis.thinkAloud?.length) {
    lines.push(`## Think-Aloud 시나리오`);
    lines.push("");
    for (const t of analysis.thinkAloud as Array<{ screen: string; thought: string }>) {
      lines.push(`**[${t.screen}]** ${t.thought}`);
      lines.push("");
    }
  }

  // ── Comparison ──
  if (isComparison && analysis.comparisonData) {
    const cd = analysis.comparisonData as {
      products?: Array<{ productName: string; verdict: string; score: number; summary?: string }>;
      comparison?: { winnerReason?: string };
    };
    lines.push(`## 경쟁사 비교`);
    lines.push("");
    if (cd.products?.length) {
      lines.push(`| 제품 | 판정 | 점수 |`);
      lines.push(`|------|------|------|`);
      for (const p of cd.products) {
        lines.push(`| ${p.productName} | ${verdictEmoji(p.verdict)} ${p.verdict} | ${p.score}점 |`);
      }
      lines.push("");
    }
    if (cd.comparison?.winnerReason) {
      lines.push(`### 종합 의견`);
      lines.push("");
      lines.push(cd.comparison.winnerReason);
      lines.push("");
    }
  }

  // ── Footer ──
  lines.push("---");
  lines.push(`*Simulo로 생성된 분석 리포트 — [simulo.ai](https://simulo.ai)*`);

  return lines.join("\n");
}
