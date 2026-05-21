"use client";

import { useRouter } from "next/navigation";

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

export interface Insights {
  summary: string;
  trends: Trend[];
  blindSpots: string[];
  productSuggestions: ProductSuggestion[];
  nextAnalysisSuggestions: string[];
}

interface InsightsPanelProps {
  totalAnalyses: number;
  insights: Insights | null;
  loadingInsights: boolean;
  insightsCached: boolean;
  onGenerate: () => void;
}

const MIN_ANALYSES = 3;

export function InsightsPanel({
  totalAnalyses,
  insights,
  loadingInsights,
  insightsCached,
  onGenerate,
}: InsightsPanelProps) {
  const router = useRouter();

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">AI 인사이트 &amp; 역제안</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            데이터 기반 제품 개선 방향을 Simulo가 분석합니다
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={loadingInsights || totalAnalyses < MIN_ANALYSES}
          className="shrink-0 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          {loadingInsights ? "분석 중..." : "인사이트 생성"}
        </button>
      </div>

      {totalAnalyses < MIN_ANALYSES && !loadingInsights && (
        <div className="border border-dashed border-[var(--border)] rounded-lg py-8 flex flex-col items-center justify-center text-[var(--muted)]">
          <p className="text-sm">분석 {MIN_ANALYSES - totalAnalyses}개를 더 완료하면 인사이트를 생성할 수 있습니다</p>
          <p className="text-xs mt-1">현재 {totalAnalyses}개 · 최소 {MIN_ANALYSES}개 필요</p>
        </div>
      )}

      {totalAnalyses >= MIN_ANALYSES && !insights && !loadingInsights && (
        <div className="border border-dashed border-[var(--border)] rounded-lg py-10 flex flex-col items-center justify-center text-[var(--muted)]">
          <span className="text-2xl mb-2">✦</span>
          <p className="text-sm">버튼을 눌러 AI 인사이트를 생성하세요</p>
          <p className="text-xs mt-1">24시간 동안 캐시되어 재사용됩니다</p>
        </div>
      )}

      {loadingInsights && (
        <div className="py-10 flex items-center justify-center text-[var(--muted)] text-sm">
          Simulo가 데이터를 분석 중입니다...
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
                      <div className="mt-3">
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
  );
}
