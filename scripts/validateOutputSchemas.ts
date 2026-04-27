/**
 * CI schema contract test for handler outputs.
 *
 * Validates representative sample outputs from each handler against the Zod
 * schemas in outputSchema.ts. Exits non-zero on any schema mismatch, catching
 * contract drift at CI time instead of at runtime in production.
 *
 * Run: npx tsx scripts/validateOutputSchemas.ts
 */

import { validateHandlerOutput } from "../app/api/analyze/outputSchema";

// ── Sample outputs ────────────────────────────────────────────────────

const HYPOTHESIS_SAMPLE = {
  score: 72,
  verdict: "Partial",
  verdictReason: "화면 흐름은 명확하나 CTA 가시성 부족",
  summary: "전반적으로 가설을 부분 지지하는 결과",
  taskSuccessLikelihood: "Medium",
  taskSuccessReason: "주요 동선은 잘 설계되었으나 중단 위험 구간 존재",
  thinkAloud: [{ screen: "홈", thought: "운동 시작 버튼을 찾고 있어요" }],
  evidenceFor: ["CTA 버튼이 중앙에 위치", "색상 대비 충분"],
  evidenceAgainst: ["하단 네비게이션 레이블 불명확"],
  confidence: "Medium",
  confidenceReason: "화면 수가 적어 전체 흐름 파악 한계",
  strengths: ["직관적인 레이아웃"],
  issues: [
    {
      screen: "홈",
      screenIndex: 0,
      severity: "Medium",
      issue: "CTA 가시성 부족",
      recommendation: "버튼 크기 16px 이상으로 확대",
      backfireRisk: "Low",
      relevanceToHypothesis: "High",
    },
  ],
};

const USABILITY_SAMPLE = {
  score: 68,
  grade: "개선 필요",
  summary: "전반적인 사용성 점검 결과",
  strengths: ["명확한 네비게이션"],
  issues: [
    {
      screen: "설정",
      severity: "Low",
      issue: "폰트 크기 작음",
      recommendation: "최소 14px 유지",
    },
  ],
  scoreBreakdown: {
    clarity: { score: 70, reason: "텍스트 명료도 양호" },
    flow: { score: 65, reason: "단계 간 전환 자연스러움" },
    feedback: { score: 60, reason: "오류 메시지 부재" },
    efficiency: { score: 75, reason: "탭 수 최소화" },
  },
  quickWins: [{ issue: "폰트 크기", fix: "14px로 확대", effort: "Low", impact: "Medium" }],
};

const COMPARISON_SAMPLE = {
  products: [
    { productName: "우리 앱", score: 72, verdict: "Partial", summary: "중간 수준" },
    { productName: "경쟁사 A", score: 85, verdict: "Pass", summary: "우수한 UX" },
  ],
  comparison: {
    winner: "경쟁사 A",
    winnerReason: "네비게이션이 훨씬 직관적",
    keyDifferences: [{ aspect: "네비게이션", ours: "복잡", competitor: "단순" }],
    topPriorities: ["네비게이션 단순화"],
  },
};

// ── Validation runner ─────────────────────────────────────────────────

interface Case {
  name: string;
  output: Record<string, unknown>;
  isComparison: boolean;
}

const CASES: Case[] = [
  { name: "hypothesis handler", output: HYPOTHESIS_SAMPLE, isComparison: false },
  { name: "usability handler", output: USABILITY_SAMPLE, isComparison: false },
  { name: "comparison handler", output: COMPARISON_SAMPLE, isComparison: true },
];

let failed = 0;

for (const { name, output, isComparison } of CASES) {
  const result = validateHandlerOutput(output, isComparison);
  if (result.ok) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}`);
    for (const err of result.errors) {
      console.error(`  field="${err.field}" → ${err.message}`);
    }
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} schema validation(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll ${CASES.length} schema contracts valid.`);
}
