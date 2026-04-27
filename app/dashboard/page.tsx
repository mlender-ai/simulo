"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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

function MiniBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs font-mono text-white w-6 text-right">{value}</span>
    </div>
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

// ─── Main Component ───────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30d");
  const [projectTag, setProjectTag] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsCached, setInsightsCached] = useState(false);
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
    setInsights(null);
    try {
      const res = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, projectTag: projectTag || undefined }),
      });
      const data = await res.json();
      setStats(data);
    } catch {
      // ignore
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
    } catch {
      // ignore
    } finally {
      setLoadingInsights(false);
    }
  };

  // ── Score timeline: merge by date across project tags ──
  const timelineByDate: Record<string, Record<string, number>> = {};
  const allProjectTags = new Set<string>();
  (stats?.scoreTimeline ?? []).forEach((p) => {
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
  (stats?.desireTimeline ?? []).forEach((p) => {
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
    { axis: "효능감", value: (stats?.avgDesire.utility ?? 0) * 10 },
    { axis: "성취·과시", value: (stats?.avgDesire.healthPride ?? 0) * 10 },
    { axis: "손실회피", value: (stats?.avgDesire.lossAversion ?? 0) * 10 },
  ];

  // keywords top 10
  const topKeywords = (stats?.keywords ?? []).slice(0, 10);
  const maxKwCount = topKeywords[0]?.count ?? 1;

  const PERIODS: { key: Period; label: string }[] = [
    { key: "7d", label: "최근 7일" },
    { key: "30d", label: "30일" },
    { key: "90d", label: "90일" },
    { key: "all", label: "전체" },
  ];

  const tags = stats?.projectTags ?? [];

  // ── Score card ──
  const lowestDesireKey =
    stats && stats.avgDesire.utility > 0
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
        ) : (
          <>
            {/* ── Section 1: Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Card A: 총 분석 횟수 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-2">총 분석 횟수</div>
                <div className="text-3xl font-bold font-mono mb-1">{stats?.totalAnalyses ?? 0}</div>
                <div className="text-xs text-[var(--muted)] mb-1">건</div>
                {stats && (
                  <Delta current={stats.totalAnalyses} prev={stats.prevTotalAnalyses} unit="건" />
                )}
              </div>

              {/* Card B: 평균 사용성 점수 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-2">평균 사용성 점수</div>
                <div className="text-3xl font-bold font-mono mb-1">{stats?.avgScore ?? 0}</div>
                <div className="text-xs text-[var(--muted)] mb-1">/ 100</div>
                {stats && (
                  <Delta current={stats.avgScore} prev={stats.prevAvgScore} unit="점" />
                )}
              </div>

              {/* Card C: 욕망 충족도 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-3">욕망 충족도 평균</div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
                      <span>효능감</span>
                      {lowestDesireKey === "utility" && (
                        <span className="text-amber-400">최저</span>
                      )}
                    </div>
                    <MiniBar value={stats?.avgDesire.utility ?? 0} color="#60a5fa" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
                      <span>성취·과시</span>
                      {lowestDesireKey === "healthPride" && (
                        <span className="text-amber-400">최저</span>
                      )}
                    </div>
                    <MiniBar value={stats?.avgDesire.healthPride ?? 0} color="#a78bfa" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-[var(--muted)] mb-1">
                      <span>손실회피</span>
                      {lowestDesireKey === "lossAversion" && (
                        <span className="text-amber-400">최저</span>
                      )}
                    </div>
                    <MiniBar value={stats?.avgDesire.lossAversion ?? 0} color="#f97316" />
                  </div>
                </div>
                {lowestDesireKey && (
                  <div className="mt-2 text-[10px] text-amber-400">
                    ↓ {desireLabels[lowestDesireKey]} 가장 낮음
                  </div>
                )}
              </div>

              {/* Card D: 해결된 이슈 비율 */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
                <div className="text-xs text-[var(--muted)] mb-2">해결된 이슈 비율</div>
                <div className="flex items-center justify-center my-3">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff10" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#34d399" strokeWidth="3"
                        strokeDasharray={`${(stats?.resolvedIssueRate ?? 0)} ${100 - (stats?.resolvedIssueRate ?? 0)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono">
                      {stats?.resolvedIssueRate ?? 0}%
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-center text-[var(--muted)]">재분석으로 개선된 분석</div>
              </div>
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
                    <ResponsiveContainer width="100%" height={260}>
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
                <h2 className="text-sm font-semibold mb-4">반복 이슈 TOP {stats?.topIssues.length ?? 0}</h2>
                {(stats?.topIssues.length ?? 0) === 0 ? (
                  <p className="text-sm text-[var(--muted)]">분석 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {stats?.topIssues.map((issue, idx) => (
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
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-[var(--muted)]">{issue.count}회 발생</span>
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
              {stats && (stats.avgDesire.utility > 0 || stats.avgDesire.healthPride > 0 || stats.avgDesire.lossAversion > 0) ? (
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
                  <div className="flex-1 space-y-4">
                    {[
                      { key: "utility", label: "효능감", desc: "보상이 명확하게 인식되는가", color: "#60a5fa" },
                      { key: "healthPride", label: "성취·과시", desc: "성취감 전달 및 공유 욕구 자극", color: "#a78bfa" },
                      { key: "lossAversion", label: "손실회피", desc: "오늘 안 하면 손해라는 인식", color: "#f97316" },
                    ].map(({ key, label, desc, color }) => {
                      const val = stats.avgDesire[key as keyof typeof stats.avgDesire];
                      const isLowest = lowestDesireKey === key;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ background: color }}
                              />
                              <span className={`font-medium ${isLowest ? "text-amber-400" : "text-white"}`}>
                                {label} {isLowest && "⚠"}
                              </span>
                            </div>
                            <span className="font-mono text-white">{val} / 10</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(val / 10) * 100}%`, background: color }}
                            />
                          </div>
                          <p className="text-[10px] text-[var(--muted)]">{desc}</p>
                        </div>
                      );
                    })}
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
                  disabled={loadingInsights || !stats || stats.totalAnalyses === 0}
                  className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingInsights ? "분석 중..." : "인사이트 생성하기"}
                </button>
              </div>

              {!insights && !loadingInsights && (
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
