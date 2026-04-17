export const VERDICT_COLORS: Record<string, string> = {
  Pass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Partial: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Fail: "text-red-400 bg-red-400/10 border-red-400/20",
};

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: "text-red-400 bg-red-400/10 border-red-400/20",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "심각": "text-red-400 bg-red-400/10 border-red-400/20",
  "보통": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  "낮음": "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export const GRADE_BADGE: Record<string, { bg: string; color: string }> = {
  "우수": { bg: "#14532d", color: "#86efac" },
  "양호": { bg: "#1e3a5f", color: "#93c5fd" },
  "개선 필요": { bg: "#431407", color: "#fdba74" },
  "미흡": { bg: "#450a0a", color: "#fca5a5" },
};

export function gradeFromScore(score: number): string {
  if (score >= 90) return "우수";
  if (score >= 70) return "양호";
  if (score >= 50) return "개선 필요";
  return "미흡";
}

export const EFFORT_IMPACT_COLORS: Record<string, string> = {
  "낮음": "text-emerald-400",
  "중간": "text-amber-400",
  "높음": "text-red-400",
  Low: "text-emerald-400",
  Medium: "text-amber-400",
  High: "text-red-400",
};

export const LIKELIHOOD_COLORS: Record<string, string> = {
  High: "text-emerald-400",
  Medium: "text-amber-400",
  Low: "text-red-400",
};

export const DESIRE_TYPE_BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  utility: { bg: "#1e3a2a", color: "#86efac", label: "💡 효능감" },
  healthPride: { bg: "#1e2a3a", color: "#93c5fd", label: "🏃 성취" },
  lossAversion: { bg: "#3a1e2a", color: "#f0abfc", label: "⚡ 손실회피" },
  general: { bg: "#1a1a1a", color: "#888", label: "🔧 일반" },
};

const MONEY_LOOP_STAGE_COLORS: Record<string, string> = {
  "유입": "#334155",
  "Acquisition": "#334155",
  "온보딩": "#1e3a5f",
  "온보딩 & 첫 보상 경험": "#1e3a5f",
  "Onboarding": "#1e3a5f",
  "Onboarding & First Reward": "#1e3a5f",
  "기능참여": "#1a3a2a",
  "기능 참여 & 광고 시청": "#1a3a2a",
  "광고시청": "#1a3a2a",
  "Feature Engagement": "#1a3a2a",
  "Feature Engagement & Ad Viewing": "#1a3a2a",
  "마일리지지급": "#3a2a1a",
  "마일리지 지급": "#3a2a1a",
  "Ad Revenue": "#3a2a1a",
  "Mileage Payout": "#3a2a1a",
  "리텐션": "#2a1a3a",
  "Retention": "#2a1a3a",
};

export function getMoneyLoopColor(stage: string): string {
  for (const [key, color] of Object.entries(MONEY_LOOP_STAGE_COLORS)) {
    if (stage.includes(key)) return color;
  }
  return "#334155";
}

export const RETENTION_RISK_BADGE: Record<string, { bg: string; color: string }> = {
  "높음": { bg: "#450a0a", color: "#fca5a5" },
  "High": { bg: "#450a0a", color: "#fca5a5" },
  "보통": { bg: "#431407", color: "#fdba74" },
  "Medium": { bg: "#431407", color: "#fdba74" },
  "낮음": { bg: "#14532d", color: "#86efac" },
  "Low": { bg: "#14532d", color: "#86efac" },
};

export const DROP_OFF_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  High: { text: "text-red-400", border: "border-l-red-500", bg: "bg-red-400/5" },
  Medium: { text: "text-amber-400", border: "border-l-amber-500", bg: "bg-amber-400/5" },
  Low: { text: "text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-400/5" },
  "높음": { text: "text-red-400", border: "border-l-red-500", bg: "bg-red-400/5" },
  "보통": { text: "text-amber-400", border: "border-l-amber-500", bg: "bg-amber-400/5" },
  "낮음": { text: "text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-400/5" },
};

export const HEATMAP_STORAGE_KEY = "simulo_heatmap_on";
