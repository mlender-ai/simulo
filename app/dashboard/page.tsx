"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { storage, type AnalysisResult } from "@/lib/storage";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

// ─── Types ───────────────────────────────────────────────
type Period = "7d" | "30d" | "90d" | "all";

interface ScorePoint {
  date: string;
  score: number;
  projectTag: string | null;
  analysisId: string;
  hypothesis: string;
}

interface DesirePoint {
  date: string;
  utility: number;
  healthPride: number;
  lossAversion: number;
}

interface IssuePattern {
  pattern: string;
  count: number;
  avgSeverity: "Critical" | "Medium" | "Low";
  screens: string[];
}

interface KeywordEntry {
  word: string;
  count: number;
}

interface DashboardStats {
  totalAnalyses: number;
  prevTotalAnalyses: number;
  avgScore: number;
  prevAvgScore: number;
  avgDesire: { utility: number; healthPride: number; lossAversion: number };
  resolvedIssueRate: number;
  scoreTimeline: ScorePoint[];
  topIssues: IssuePattern[];
  keywords: KeywordEntry[];
  desireTimeline: DesirePoint[];
  projectTags: string[];
}

interface Trend {
  type: "positive" | "negative" | "neutral";
  insight: string;
  evidence: string;
}

interface ProductSuggestion {
  priority: "높음" | "보통" | "낮음";
  area: string;
  suggestion: string;
  basedOn: string;
  expectedImpact: string;
}

interface Insights {
  summary: string;
  trends: Trend[];
  blindSpots: string[];
  productSuggestions: ProductSuggestion[];
  nextAnalysisSuggestions: string[];
}

// ─── Scoring benchmarks ──────────────────────────────────
const SCORE_TARGET = 70; // 목표 기준점 (차트 기준선)

interface Grade {
  label: string;
  color: string;
  bg: string;
  border: string;
}

function getScoreGrade(score: number): Grade {
  if (score >= 90) return { label: "우수", color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.25)" };
  if (score >= 70) return { label: "양호", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)" };
  if (score >= 50) return { label: "개선 필요", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" };
  return { label: "미흡", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)" };
}

function getDesireStatus(score: number): { label: string; color: string } {
  if (score >= 7) return { label: "양호", color: "#34d399" };
  if (score >= 5) return { label: "보통", color: "#f59e0b" };
  return { label: "개선 필요", color: "#ef4444" };
}

/** +/- 2점 이하는 유지로 간주 */
function getTrendLabel(current: number, prev: number): { label: string; color: string } | null {
  if (prev === 0) return null;
  const diff = current - prev;
  if (diff > 2) return { label: "개선 중", color: "#34d399" };
  if (diff < -2) return { label: "하락 주의", color: "#ef4444" };
  return { label: "유지", color: "#888" };
}

function getResolvedRateStatus(rate: number): { label: string; color: string; desc: string } {
  if (rate === 0) return { label: "재분석 없음", color: "#888", desc: "개선 분석을 실행하면 이슈 해결률이 집계됩니다" };
  if (rate < 30) return { label: "낮음", color: "#ef4444", desc: "발견된 이슈 대비 개선 실행이 부족합니다" };
  if (rate < 70) return { label: "보통", color: "#f59e0b", desc: "일부 이슈가 재분석으로 해결되고 있습니다" };
  return { label: "활발", color: "#34d399", desc: "발견한 이슈를 지속적으로 개선하고 있습니다" };
}

// ─── Chart line colors per project tag ───────────────────
const LINE_COLORS = [
  "#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa",
  "#fb923c", "#38bdf8", "#4ade80",
];

// ─── Helpers ─────────────────────────────────────────────
function Delta({ current, prev, unit = "" }: { current: number; prev: number; unit?: string }) {
  if (prev === 0 && current === 0) return null;
  const diff = current - prev;
  if (diff === 0) return <span className="text-xs text-[var(--muted)]">—</span>;
  const color = diff > 0 ? "text-emerald-400" : "text-red-400";
  const arrow = diff > 0 ? "↑" : "↓";
  return (
    <span className={`text-xs font-mono ${color}`}>
      {diff > 0 ? "+" : ""}{diff.toFixed(unit === "점" ? 1 : 0)}{unit} {arrow}
    </span>
  );
}

function MiniBar({ value, max = 10, color, threshold }: { value: number; max?: number; color: string; threshold?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const thresholdPct = threshold !== undefined ? Math.min(100, (threshold / max) * 100) : null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden relative">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
        {thresholdPct !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/30"
            style={{ left: `${thresholdPct}%` }}
          />
        )}
      </div>
      <span className="text-xs font-mono text-white w-6 text-right">{value}</span>
    </div>
  );
}

function GradeBadge({ score }: { score: number }) {
  const grade = getScoreGrade(score);
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ color: grade.color, background: grade.bg, border: `1px solid ${grade.border}` }}
    >
      {grade.label}
    </span>
  );
}

function DesireStatusDot({ score }: { score: number }) {
  const { color } = getDesireStatus(score);
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: color }}
    />
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    Critical: "text-red-400 bg-red-400/10 border-red-400/20",
    Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    Low: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  };
  const label: Record<string, string> = { Critical: "심각", Medium: "보통", Low: "낮음" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${map[severity] ?? map.Low}`}>
      {label[severity] ?? severity}
    </span>
  );
}

// ─── Custom Tooltip for score chart ──────────────────────
function ScoreTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScorePoint; value: number }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-[#1a1a1a] border border-[var(--border)] rounded-md p-3 text-xs max-w-[220px]">
      <div className="text-[var(--muted)] mb-1">{p.date}</div>
      <div className="text-white font-semibold mb-1">점수 {payload[0].value}</div>
      <div className="text-[var(--muted)] leading-snug line-clamp-3">{p.hypothesis}</div>
    </div>
  );
}

const EMPTY_STATS: DashboardStats = {
  totalAnalyses: 0, prevTotalAnalyses: 0,
  avgScore: 0, prevAvgScore: 0,
  avgDesire: { utility: 0, healthPride: 0, lossAversion: 0 },
  resolvedIssueRate: 0,
  scoreTimeline: [], topIssues: [], keywords: [], desireTimeline: [],
  projectTags: [],
};

function computeStatsFromLocal(analyses: AnalysisResult[], period: Period): DashboardStats {
  const now = Date.now();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
  const cutoff = days ? now - days * 86400000 : null;
  const prevCutoff = days ? now - days * 2 * 86400000 : null;

  const filtered = analyses.filter((a) => {
    if (a.isComparison) return false;
    if (!cutoff) return true;
    return new Date(a.createdAt).getTime() >= cutoff;
  });
  const prev = analyses.filter((a) => {
    if (a.isComparison) return false;
    if (!prevCutoff || !cutoff) return false;
    const t = new Date(a.createdAt).getTime();
    return t >= prevCutoff && t < cutoff;
  });

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  // Desire scores (usability mode only)
  const desireRows = filtered
    .map((a) => {
      const da = a.analysisOptions?.result?.desireAlignment ?? a.desireAlignment;
      if (!da?.utility) return null;
      return { utility: da.utility.score, healthPride: da.healthPride.score, lossAversion: da.lossAversion.score };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // Resolved issue rate
  const improvedIds = new Set(
    filtered.filter((a) => a.isImprovement && a.previousAnalysisId).map((a) => a.previousAnalysisId!)
  );
  const nonImprove = filtered.filter((a) => !a.isImprovement);

  // Score timeline
  const scoreTimeline: ScorePoint[] = filtered.map((a) => ({
    date: a.createdAt.split("T")[0],
    score: a.score,
    projectTag: a.projectTag ?? null,
    analysisId: a.id,
    hypothesis: a.hypothesis.slice(0, 60),
  }));

  // Desire timeline
  const desireTimeline: DesirePoint[] = filtered
    .map((a) => {
      const da = a.analysisOptions?.result?.desireAlignment ?? a.desireAlignment;
      if (!da?.utility) return null;
      return {
        date: a.createdAt.split("T")[0],
        utility: da.utility.score,
        healthPride: da.healthPride.score,
        lossAversion: da.lossAversion.score,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  // Top issues
  const issueMap: Record<string, { pattern: string; count: number; sevSum: number; screens: Set<string> }> = {};
  for (const a of filtered) {
    for (const issue of a.issues ?? []) {
      const key = issue.issue.trim().slice(0, 40).toLowerCase();
      if (!issueMap[key]) issueMap[key] = { pattern: issue.issue.trim(), count: 0, sevSum: 0, screens: new Set() };
      issueMap[key].count++;
      issueMap[key].sevSum += issue.severity === "Critical" ? 3 : issue.severity === "Medium" ? 2 : 1;
      if (a.projectTag) issueMap[key].screens.add(a.projectTag);
    }
  }
  const topIssues = Object.values(issueMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e) => {
      const s = e.sevSum / e.count;
      return { pattern: e.pattern, count: e.count, avgSeverity: (s > 2.5 ? "Critical" : s > 1.5 ? "Medium" : "Low") as IssuePattern["avgSeverity"], screens: Array.from(e.screens) };
    });

  // Keywords
  const allText = filtered.map((a) => a.hypothesis).join(" ");
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

  const projectTags = Array.from(new Set(analyses.map((a) => a.projectTag).filter((t): t is string => !!t)));

  return {
    totalAnalyses: filtered.length,
    prevTotalAnalyses: prev.length,
    avgScore: avg(filtered.map((a) => a.score)),
    prevAvgScore: avg(prev.map((a) => a.score)),
    avgDesire: {
      utility: avg(desireRows.map((d) => d.utility)),
      healthPride: avg(desireRows.map((d) => d.healthPride)),
      lossAversion: avg(desireRows.map((d) => d.lossAversion)),
    },
    resolvedIssueRate: nonImprove.length > 0 ? Math.round((improvedIds.size / nonImprove.length) * 100) : 0,
    scoreTimeline,
    topIssues,
    keywords,
    desireTimeline,
    projectTags,
  };
}

// ─── Main Component ───────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30d");
  const [projectTag, setProjectTag] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsCached, setInsightsCached] = useState(false);
  const [insightsInsufficient, setInsightsInsufficient] = useState(false);
  const [expandedIssueIdx, setExpandedIssueIdx] = useState<number | null>(null);

  // Active score lines
  const [activeLines, setActiveLines] = useState({
    score: true,
    utility: false,
    healthPride: false,
    lossAversion: false,
  });

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    setInsights(null);
    setInsightsInsufficient(false);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, projectTag: projectTag || undefined }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        setStatsError(`API 오류 (${res.status})`);
        return;
      }
      const data: DashboardStats = await res.json();

      // DB에 데이터가 없으면 localStorage fallback
      if (data.totalAnalyses === 0) {
        const local = storage.getAll();
        const filtered = projectTag ? local.filter((a) => a.projectTag === projectTag) : local;
        if (filtered.length > 0) {
          setStats(computeStatsFromLocal(filtered, period));
          return;
        }
      }
      setStats(data);
    } catch (err) {
      // fetch 자체가 실패하면 localStorage만으로 집계
      const local = storage.getAll();
      const filtered = projectTag ? local.filter((a) => a.projectTag === projectTag) : local;
      if (filtered.length > 0) {
        setStats(computeStatsFromLocal(filtered, period));
        return;
      }
      const msg = err instanceof Error && err.name === "AbortError"
        ? "요청 시간 초과 (10초)"
        : "데이터를 불러올 수 없습니다";
      setStatsError(msg);
    } finally {
      setLoadingStats(false);
    }
  }, [period, projectTag]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const generateInsights = async () => {
    if (!stats) return;
    setLoadingInsights(true);
    try {
      const res = await fetch("/api/dashboard/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, period, projectTag: projectTag || undefined }),
      });
      const data = await res.json();
      setInsights(data.insights as Insights);
      setInsightsCached(data.cached);
      setInsightsInsufficient(data.insufficient ?? false);
    } catch {
      // ignore
    } finally {
      setLoadingInsights(false);
    }
  };

  // ── Score timeline: merge by date across project tags ──
  const timelineByDate: Record<string, Record<string, number>> = {};
  const allProjectTags = new Set<string>();
  stats.scoreTimeline.forEach((p) => {
    const tag = p.projectTag ?? "기타";
    allProjectTags.add(tag);
    if (!timelineByDate[p.date]) timelineByDate[p.date] = {};
    // Average if multiple on same date+tag
    if (timelineByDate[p.date][tag] !== undefined) {
      timelineByDate[p.date][tag] = Math.round((timelineByDate[p.date][tag] + p.score) / 2);
    } else {
      timelineByDate[p.date][tag] = p.score;
    }
  });

  // For desire overlay lines, merge by date
  const desireByDate: Record<string, { utility?: number; healthPride?: number; lossAversion?: number }> = {};
  stats.desireTimeline.forEach((p) => {
    if (!desireByDate[p.date]) desireByDate[p.date] = {};
    desireByDate[p.date] = { utility: p.utility, healthPride: p.healthPride, lossAversion: p.lossAversion };
  });

  // Combined chart data (sorted by date)
  const chartDates = Array.from(
    new Set([
      ...Object.keys(timelineByDate),
      ...Object.keys(desireByDate),
    ])
  ).sort();

  const chartData = chartDates.map((date) => {
    const scores = timelineByDate[date] ?? {};
    const desire = desireByDate[date] ?? {};
    const scoreAvg =
      Object.keys(scores).length > 0
        ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length)
        : undefined;
    return {
      date,
      score: scoreAvg,
      utility: desire.utility !== undefined ? desire.utility * 10 : undefined,
      healthPride: desire.healthPride !== undefined ? desire.healthPride * 10 : undefined,
      lossAversion: desire.lossAversion !== undefined ? desire.lossAversion * 10 : undefined,
      ...scores,
    };
  });

  // ── Radar data ──
  const radarData = [
    { axis: "효능감", value: stats.avgDesire.utility * 10 },
    { axis: "성취·과시", value: stats.avgDesire.healthPride * 10 },
    { axis: "손실회피", value: stats.avgDesire.lossAversion * 10 },
  ];

  // keywords top 10
  const topKeywords = stats.keywords.slice(0, 10);
  const maxKwCount = topKeywords[0]?.count ?? 1;

  const PERIODS: { key: Period; label: string }[] = [
    { key: "7d", label: "최근 7일" },
    { key: "30d", label: "30일" },
    { key: "90d", label: "90일" },
    { key: "all", label: "전체" },
  ];

  const tags = stats.projectTags;

  // ── Score card ──
  const lowestDesireKey =
    stats.avgDesire.utility > 0 || stats.avgDesire.healthPride > 0 || stats.avgDesire.lossAversion > 0
      ? (["utility", "healthPride", "lossAversion"] as const).reduce((a, b) =>
          stats.avgDesire[a] < stats.avgDesire[b] ? a : b
        )
      : null;

  const desireLabels: Record<string, string> = {
    utility: "효능감",
    healthPride: "성취·과시",
    lossAversion: "손실회피",
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">대시보드</h1>
          <p className="text-sm text-[var(--muted)]">누적 분석 데이터 기반 패턴 및 인사이트</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex items-center gap-1 bg-white/5 rounded-md p-1">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  period === key
                    ? "bg-white/15 text-white"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <select
              value={projectTag}
              onChange={(e) => setProjectTag(e.target.value)}
              className="bg-white/5 border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="">전체 프로젝트</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center h-64 text-[var(--muted)] text-sm">
            데이터 집계 중...
          </div>
        ) : statsError ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-sm text-red-400">{statsError}</p>
            <p className="text-xs text-[var(--muted)]">DATABASE_URL 환경변수 또는 서버 연결을 확인하세요</p>
            <button
              onClick={fetchStats}
              className="px-4 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-white/5 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* ── 상태 요약 배너 ── */}
            {stats.totalAnalyses > 0 && (() => {
              const grade = getScoreGrade(stats.avgScore);
              const trend = getTrendLabel(stats.avgScore, stats.prevAvgScore);
              return (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg mb-6 text-sm"
                  style={{ background: grade.bg, border: `1px solid ${grade.border}` }}
                >
                  <span style={{ color: grade.color }} className="font-semibold shrink-0">
                    현재 상태: {grade.label}
                  </span>
                  <span className="text-[var(--muted)]">·</span>
                  <span className="text-[var(--muted)]">
                    평균 <span className="text-white font-mono">{stats.avgScore}</span>점
                    {trend && (
                      <>
                        {" "}—{" "}
                        <span style={{ color: trend.color }}>{trend.label}</span>
                      </>
                    )}
                  </span>
                  {stats.avgScore < SCORE_TARGET && (
                    <>
                      <span className="text-[var(--muted)]">·</span>
                      <span className="text-[var(--muted)]">
                        목표까지{" "}
                        <span className="text-white font-mono">
                          {(SCORE_TARGET - stats.avgScore).toFixed(1)}점
                        </span>{" "}
                        남음
                      </span>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ── Section 1: Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Card A: 총 분석 횟수 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-2">총 분석 횟수</div>
                <div className="text-3xl font-bold font-mono mb-1">{stats.totalAnalyses}</div>
                <div className="text-xs text-[var(--muted)] mb-2">건</div>
                <Delta current={stats.totalAnalyses} prev={stats.prevTotalAnalyses} unit="건" />
                {stats.prevTotalAnalyses > 0 && (() => {
                  const trend = getTrendLabel(stats.totalAnalyses, stats.prevTotalAnalyses);
                  return trend ? (
                    <span className="text-[10px] ml-1" style={{ color: trend.color }}>
                      {trend.label}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Card B: 평균 사용성 점수 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-2">평균 사용성 점수</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold font-mono">{stats.avgScore}</span>
                  <span className="text-xs text-[var(--muted)]">/ 100</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <GradeBadge score={stats.avgScore} />
                  <span className="text-[10px] text-[var(--muted)]">목표 {SCORE_TARGET}점</span>
                </div>
                {/* Progress bar toward target */}
                <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (stats.avgScore / 100) * 100)}%`,
                      background: getScoreGrade(stats.avgScore).color,
                    }}
                  />
                </div>
                <Delta current={stats.avgScore} prev={stats.prevAvgScore} unit="점" />
                {stats.prevAvgScore > 0 && (() => {
                  const trend = getTrendLabel(stats.avgScore, stats.prevAvgScore);
                  return trend ? (
                    <span className="text-[10px] ml-1" style={{ color: trend.color }}>
                      {trend.label}
                    </span>
                  ) : null;
                })()}
              </div>

              {/* Card C: 욕망 충족도 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-3">욕망 충족도 평균</div>
                <div className="space-y-2.5">
                  {([
                    { key: "utility" as const, label: "효능감", color: "#60a5fa" },
                    { key: "healthPride" as const, label: "성취·과시", color: "#a78bfa" },
                    { key: "lossAversion" as const, label: "손실회피", color: "#f97316" },
                  ]).map(({ key, label, color }) => {
                    const val = stats.avgDesire[key];
                    const status = getDesireStatus(val);
                    return (
                      <div key={key}>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <div className="flex items-center gap-1.5">
                            <DesireStatusDot score={val} />
                            <span className="text-[var(--muted)]">{label}</span>
                          </div>
                          <span style={{ color: status.color }} className="font-medium">
                            {val > 0 ? status.label : "—"}
                          </span>
                        </div>
                        <MiniBar value={val} color={color} threshold={7} />
                      </div>
                    );
                  })}
                </div>
                {lowestDesireKey && stats.avgDesire[lowestDesireKey] > 0 && (
                  <div className="mt-2 text-[10px] text-amber-400">
                    ↓ {desireLabels[lowestDesireKey]} 집중 개선 필요
                  </div>
                )}
                <div className="mt-1.5 text-[10px] text-[var(--muted)]">
                  ┃ = 목표 기준 (7/10)
                </div>
              </div>

              {/* Card D: 해결된 이슈 비율 */}
              {(() => {
                const rateStatus = getResolvedRateStatus(stats.resolvedIssueRate);
                return (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                    <div className="text-xs text-[var(--muted)] mb-2">이슈 해결률</div>
                    <div className="flex items-center justify-center my-2">
                      <div className="relative w-16 h-16">
                        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke={rateStatus.color}
                            strokeWidth="3"
                            strokeDasharray={`${stats.resolvedIssueRate} ${100 - stats.resolvedIssueRate}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono">
                          {stats.resolvedIssueRate}%
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          color: rateStatus.color,
                          background: `${rateStatus.color}15`,
                          border: `1px solid ${rateStatus.color}30`,
                        }}
                      >
                        {rateStatus.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-center text-[var(--muted)] mt-2 leading-snug">
                      {rateStatus.desc}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Section 2: 점수 추이 차트 ── */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h2 className="text-sm font-semibold">점수 추이</h2>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      { key: "score", label: "사용성 점수", color: "#60a5fa" },
                      { key: "utility", label: "효능감", color: "#818cf8" },
                      { key: "healthPride", label: "성취·과시", color: "#a78bfa" },
                      { key: "lossAversion", label: "손실회피", color: "#f97316" },
                    ] as const
                  ).map(({ key, label, color }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={activeLines[key]}
                        onChange={(e) =>
                          setActiveLines((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                        className="accent-blue-500"
                      />
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-[var(--muted)] text-sm">
                  분석 데이터가 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div style={{ minWidth: Math.max(400, chartData.length * 40) }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#666" }}
                          tickFormatter={(v: string) => v.slice(5)}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10, fill: "#666" }}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                        />
                        <Tooltip content={<ScoreTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

                        {/* 등급 구간 기준선 */}
                        <ReferenceLine
                          y={90}
                          stroke="rgba(52,211,153,0.2)"
                          strokeDasharray="4 4"
                          label={{ value: "우수 90", position: "insideTopRight", fontSize: 9, fill: "rgba(52,211,153,0.5)" }}
                        />
                        <ReferenceLine
                          y={SCORE_TARGET}
                          stroke="rgba(96,165,250,0.4)"
                          strokeDasharray="6 3"
                          label={{ value: `목표 ${SCORE_TARGET}`, position: "insideTopRight", fontSize: 9, fill: "rgba(96,165,250,0.7)" }}
                        />
                        <ReferenceLine
                          y={50}
                          stroke="rgba(239,68,68,0.2)"
                          strokeDasharray="4 4"
                          label={{ value: "미흡 50", position: "insideTopRight", fontSize: 9, fill: "rgba(239,68,68,0.4)" }}
                        />

                        {/* Per-tag score lines */}
                        {Array.from(allProjectTags).map((tag, i) => (
                          <Line
                            key={tag}
                            type="monotone"
                            dataKey={tag}
                            name={tag}
                            stroke={LINE_COLORS[i % LINE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            hide={!activeLines.score}
                          />
                        ))}

                        {/* If no project tags, use score line */}
                        {allProjectTags.size === 0 && (
                          <Line
                            type="monotone"
                            dataKey="score"
                            name="사용성 점수"
                            stroke="#60a5fa"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            hide={!activeLines.score}
                          />
                        )}

                        {activeLines.utility && (
                          <Line
                            type="monotone"
                            dataKey="utility"
                            name="효능감 (×10)"
                            stroke="#818cf8"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="4 2"
                            connectNulls
                          />
                        )}
                        {activeLines.healthPride && (
                          <Line
                            type="monotone"
                            dataKey="healthPride"
                            name="성취·과시 (×10)"
                            stroke="#a78bfa"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="4 2"
                            connectNulls
                          />
                        )}
                        {activeLines.lossAversion && (
                          <Line
                            type="monotone"
                            dataKey="lossAversion"
                            name="손실회피 (×10)"
                            stroke="#f97316"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="4 2"
                            connectNulls
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section 3 & 4: Issues + Keywords (side by side on large) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Section 3: 반복 이슈 TOP */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold">반복 이슈 TOP {stats.topIssues.length}</h2>
                  {(() => {
                    const urgentCount = stats.topIssues.filter(
                      (i) => i.avgSeverity === "Critical" && i.count >= 2
                    ).length;
                    return urgentCount > 0 ? (
                      <span className="text-[10px] px-2 py-1 rounded-md font-medium"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                        ⚡ 즉각 조치 {urgentCount}건
                      </span>
                    ) : null;
                  })()}
                </div>
                {stats.topIssues.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">분석 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topIssues.map((issue, idx) => (
                      <div key={idx}>
                        <button
                          onClick={() =>
                            setExpandedIssueIdx(expandedIssueIdx === idx ? null : idx)
                          }
                          className="w-full text-left"
                        >
                          <div className="flex items-start gap-3 py-2 hover:bg-white/5 rounded-md px-2 transition-colors">
                            <span className="font-mono text-[10px] text-[var(--muted)] w-4 pt-0.5 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-white leading-snug">{issue.pattern}</span>
                                <SeverityBadge severity={issue.avgSeverity} />
                                {issue.avgSeverity === "Critical" && issue.count >= 3 && (
                                  <span className="text-[10px] text-red-400 font-medium">즉각 조치</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                {/* 빈도 임팩트 바 */}
                                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden max-w-[60px]">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, (issue.count / (stats.topIssues[0]?.count || 1)) * 100)}%`,
                                      background: issue.avgSeverity === "Critical" ? "#ef4444" :
                                                  issue.avgSeverity === "Medium" ? "#f59e0b" : "#666",
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-[var(--muted)]">{issue.count}회</span>
                                {issue.screens.length > 0 && (
                                  <span className="text-xs text-[var(--muted)]">
                                    · {issue.screens.slice(0, 2).join(", ")}
                                    {issue.screens.length > 2 && ` 외 ${issue.screens.length - 2}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[var(--muted)] text-xs shrink-0 pt-0.5">
                              {expandedIssueIdx === idx ? "▴" : "▾"}
                            </span>
                          </div>
                        </button>

                        {expandedIssueIdx === idx && (
                          <div className="ml-7 mt-1 mb-2 px-2">
                            <button
                              onClick={() => router.push(`/history?q=${encodeURIComponent(issue.pattern.slice(0, 20))}`)}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              관련 분석 보기 →
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: 키워드 빈도 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
                <h2 className="text-sm font-semibold mb-4">자주 쓰는 가설 키워드</h2>
                {topKeywords.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">분석 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-2.5">
                    {topKeywords.map(({ word, count }) => {
                      const pct = Math.round((count / maxKwCount) * 100);
                      return (
                        <div key={word} className="flex items-center gap-3">
                          <span className="text-sm text-white w-20 truncate shrink-0">{word}</span>
                          <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden relative">
                            <div
                              className="h-full bg-blue-500/40 rounded transition-all"
                              style={{ width: `${pct}%` }}
                            />
                            <div
                              className="absolute inset-0 h-full rounded transition-all mix-blend-screen"
                              style={{
                                width: `${pct}%`,
                                background: "linear-gradient(90deg, #3b82f640, #60a5fa60)",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono text-[var(--muted)] w-8 text-right shrink-0">
                            {count}회
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 5: 욕망 레이더 차트 ── */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 mb-6">
              <h2 className="text-sm font-semibold mb-4">욕망 충족도 레이더</h2>
              {(stats.avgDesire.utility > 0 || stats.avgDesire.healthPride > 0 || stats.avgDesire.lossAversion > 0) ? (
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-full md:w-64 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#ffffff15" />
                        <PolarAngleAxis
                          dataKey="axis"
                          tick={{ fontSize: 11, fill: "#999" }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 100]}
                          tick={{ fontSize: 9, fill: "#666" }}
                          tickCount={4}
                        />
                        <Radar
                          name="욕망 충족도"
                          dataKey="value"
                          stroke="#60a5fa"
                          fill="#60a5fa"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-5">
                    {[
                      { key: "utility", label: "효능감", desc: "보상이 명확하게 인식되는가", color: "#60a5fa" },
                      { key: "healthPride", label: "성취·과시", desc: "성취감 전달 및 공유 욕구 자극", color: "#a78bfa" },
                      { key: "lossAversion", label: "손실회피", desc: "오늘 안 하면 손해라는 인식", color: "#f97316" },
                    ].map(({ key, label, desc, color }) => {
                      const val = stats.avgDesire[key as keyof typeof stats.avgDesire];
                      const status = getDesireStatus(val);
                      const isLowest = lowestDesireKey === key;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                              <span className={`font-medium ${isLowest ? "text-amber-400" : "text-white"}`}>
                                {label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{
                                  color: status.color,
                                  background: `${status.color}15`,
                                  border: `1px solid ${status.color}30`,
                                }}
                              >
                                {val > 0 ? status.label : "데이터 없음"}
                              </span>
                              <span className="font-mono text-white">{val} / 10</span>
                            </div>
                          </div>
                          {/* 진행 바 + 목표선 */}
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1 relative">
                            <div className="h-full rounded-full transition-all" style={{ width: `${(val / 10) * 100}%`, background: color }} />
                            {/* 목표 7점 기준선 */}
                            <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: "70%" }} />
                          </div>
                          <div className="flex justify-between">
                            <p className="text-[10px] text-[var(--muted)]">{desc}</p>
                            {val < 7 && val > 0 && (
                              <p className="text-[10px] text-amber-400">
                                목표까지 {(7 - val).toFixed(1)}점
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-0.5 bg-white/40" /> 목표 기준 (7/10)</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-full bg-emerald-400/50" /> 양호 7+</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-full bg-amber-400/50" /> 보통 5-6</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2 h-1.5 rounded-full bg-red-400/50" /> 개선 필요 5미만</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  욕망 충족도 분석이 포함된 사용성 분석 데이터가 없습니다.
                  사용성 분석 시 욕망 충족도 분석 옵션을 활성화하면 여기서 확인할 수 있습니다.
                </p>
              )}
            </div>

            {/* ── Section 6: AI 인사이트 ── */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold">AI 인사이트 & 역제안</h2>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    데이터 기반 제품 개선 방향을 Claude가 분석합니다
                  </p>
                </div>
                <button
                  onClick={generateInsights}
                  disabled={loadingInsights || stats.totalAnalyses < 3}
                  className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingInsights ? "분석 중..." : "인사이트 생성하기"}
                </button>
              </div>

              {stats.totalAnalyses < 3 && !loadingInsights && (
                <div className="border border-dashed border-[var(--border)] rounded-lg py-8 flex flex-col items-center justify-center text-[var(--muted)]">
                  <p className="text-sm">분석 {3 - stats.totalAnalyses}개를 더 완료하면 인사이트를 생성할 수 있습니다</p>
                  <p className="text-xs mt-1">현재 {stats.totalAnalyses}개 · 최소 3개 필요</p>
                </div>
              )}
              {stats.totalAnalyses >= 3 && !insights && !loadingInsights && (
                <div className="border border-dashed border-[var(--border)] rounded-lg py-10 flex flex-col items-center justify-center text-[var(--muted)]">
                  <span className="text-2xl mb-2">✦</span>
                  <p className="text-sm">버튼을 눌러 AI 인사이트를 생성하세요</p>
                  <p className="text-xs mt-1">24시간 동안 캐시되어 재사용됩니다</p>
                </div>
              )}

              {loadingInsights && (
                <div className="py-10 flex items-center justify-center text-[var(--muted)] text-sm">
                  Claude가 데이터를 분석 중입니다...
                </div>
              )}

              {insights && (
                <div className="space-y-6">
                  {insightsCached && (
                    <div className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                      <span>캐시됨</span>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="text-sm text-white/80 leading-relaxed border-l-2 border-white/20 pl-4">
                    {insights.summary}
                  </div>

                  {/* Trends */}
                  {insights.trends?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        트렌드
                      </h3>
                      <div className="space-y-2">
                        {insights.trends.map((trend, i) => (
                          <div
                            key={i}
                            className={`flex gap-3 p-3 rounded-md border ${
                              trend.type === "positive"
                                ? "border-emerald-500/20 bg-emerald-500/5"
                                : trend.type === "negative"
                                ? "border-red-500/20 bg-red-500/5"
                                : "border-[var(--border)] bg-white/3"
                            }`}
                          >
                            <div
                              className={`w-0.5 self-stretch rounded-full shrink-0 ${
                                trend.type === "positive"
                                  ? "bg-emerald-500"
                                  : trend.type === "negative"
                                  ? "bg-red-500"
                                  : "bg-zinc-600"
                              }`}
                            />
                            <div>
                              <p className="text-sm text-white">{trend.insight}</p>
                              <p className="text-xs text-[var(--muted)] mt-1">{trend.evidence}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blind Spots */}
                  {insights.blindSpots?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        아직 분석하지 않은 영역
                      </h3>
                      <div className="space-y-2">
                        {insights.blindSpots.map((spot, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 p-3 rounded-md border border-amber-500/20 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors"
                            onClick={() => router.push("/")}
                          >
                            <span className="text-amber-400 shrink-0 mt-0.5">💡</span>
                            <p className="text-sm text-white/80">{spot}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product Suggestions */}
                  {insights.productSuggestions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        제품 개선 제안
                      </h3>
                      <div className="space-y-3">
                        {insights.productSuggestions.map((sug, i) => {
                          const borderColor =
                            sug.priority === "높음"
                              ? "#ef4444"
                              : sug.priority === "보통"
                              ? "#f59e0b"
                              : "#666";
                          return (
                            <div
                              key={i}
                              className="p-4 rounded-md border border-[var(--border)] bg-white/3"
                              style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded border"
                                  style={{
                                    color: borderColor,
                                    borderColor: `${borderColor}33`,
                                    background: `${borderColor}11`,
                                  }}
                                >
                                  {sug.priority}
                                </span>
                                <span className="text-sm font-semibold text-white">{sug.area}</span>
                              </div>
                              <p className="text-sm text-white/80 mb-2">{sug.suggestion}</p>
                              <p className="text-xs text-[var(--muted)] mb-1">
                                <span className="text-white/40">근거</span> {sug.basedOn}
                              </p>
                              <p className="text-xs text-emerald-400/80">
                                <span className="text-white/40">예상 임팩트</span> {sug.expectedImpact}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => router.push("/")}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  이 영역 분석하기 →
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Next Analysis Suggestions */}
                  {insights.nextAnalysisSuggestions?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                        다음으로 분석해보세요
                      </h3>
                      <div className="space-y-2">
                        {insights.nextAnalysisSuggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => router.push("/")}
                            className="w-full text-left flex items-center gap-3 p-3 rounded-md border border-[var(--border)] hover:bg-white/5 transition-colors group"
                          >
                            <span className="text-[var(--muted)] group-hover:text-blue-400 transition-colors">→</span>
                            <span className="text-sm text-white/80">{suggestion}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
