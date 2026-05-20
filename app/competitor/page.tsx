"use client";

import { useState } from "react";
import { MediaUploader, type UploadedVideo } from "@/components/MediaUploader";

interface QuickAnalysisResult {
  verdict?: "Pass" | "Partial" | "Fail";
  score?: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  benchmarkOpportunities?: string[];
  issues?: { screen: string; severity: string; issue: string; recommendation: string }[];
  vsYafit?: {
    theyWinAt?: string[];
    yafitWinsAt?: string[];
    copyThis?: string[];
  };
}

export default function CompetitorAnalyzePage() {
  const [name, setName] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const videoFrames = videos.flatMap((v) => v.frames.map((f) => f.base64));
  const allImages = [...images, ...videoFrames];
  const canAnalyze = name.trim().length > 0 && allImages.length > 0;

  async function analyze() {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/competitors/quick-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitorName: name.trim(),
          screenshots: allImages,
        }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const data = await res.json();
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setLoading(false);
    }
  }

  async function saveAsCompetitor() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const verdictColor: Record<string, string> = {
    Pass: "text-green-400 bg-green-900/30 border-green-800",
    Partial: "text-yellow-400 bg-yellow-900/30 border-yellow-800",
    Fail: "text-red-400 bg-red-900/30 border-red-800",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">경쟁사 독립 분석</h1>
          <p className="text-gray-400 mt-1 text-sm">
            경쟁사 앱의 스크린샷 또는 영상을 업로드하여 야핏무브와 동일한 기준으로 분석합니다.
          </p>
        </div>

        {/* Input form */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">경쟁사 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 머니워크, 돈이돼지, Sweatcoin"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              스크린샷 / 영상 업로드
            </label>
            <MediaUploader
              images={images}
              videos={videos}
              onImagesChange={setImages}
              onVideosChange={setVideos}
              maxImages={10}
              maxVideos={2}
              uploadZoneId="competitor-analyze"
              showError={false}
            />
          </div>

          {allImages.length > 0 && (
            <p className="text-xs text-gray-500">
              총 {allImages.length}장 준비됨
              {videoFrames.length > 0 &&
                ` (이미지 ${images.length}장 + 영상 프레임 ${videoFrames.length}장)`}
            </p>
          )}

          <button
            onClick={analyze}
            disabled={!canAnalyze || loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
          >
            {loading ? "분석 중..." : "분석 시작"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Verdict + score */}
            <div className="flex items-center gap-4">
              {result.verdict && (
                <span
                  className={`text-sm px-3 py-1 rounded border font-medium ${
                    verdictColor[result.verdict] ?? "text-gray-400"
                  }`}
                >
                  {result.verdict}
                </span>
              )}
              {result.score != null && (
                <span className="text-2xl font-bold font-mono text-white">
                  {result.score}
                  <span className="text-sm text-gray-500">/100</span>
                </span>
              )}
              {!saved && (
                <button
                  onClick={saveAsCompetitor}
                  disabled={saving}
                  className="ml-auto text-xs px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-300 rounded transition-colors"
                >
                  {saving ? "저장중..." : "경쟁사로 등록"}
                </button>
              )}
              {saved && (
                <span className="ml-auto text-xs text-green-400">경쟁사 등록됨</span>
              )}
            </div>

            {/* Summary */}
            {result.summary && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">요약</div>
                <p className="text-sm text-gray-200">{result.summary}</p>
              </div>
            )}

            {/* vs Yafit */}
            {result.vsYafit && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.vsYafit.theyWinAt && result.vsYafit.theyWinAt.length > 0 && (
                  <div className="bg-red-900/20 border border-red-900 rounded-lg p-4">
                    <div className="text-xs text-red-400 mb-2">경쟁사 우세</div>
                    <ul className="space-y-1">
                      {result.vsYafit.theyWinAt.map((item, i) => (
                        <li key={i} className="text-xs text-red-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.vsYafit.yafitWinsAt && result.vsYafit.yafitWinsAt.length > 0 && (
                  <div className="bg-green-900/20 border border-green-900 rounded-lg p-4">
                    <div className="text-xs text-green-400 mb-2">야핏무브 우세</div>
                    <ul className="space-y-1">
                      {result.vsYafit.yafitWinsAt.map((item, i) => (
                        <li key={i} className="text-xs text-green-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.vsYafit.copyThis && result.vsYafit.copyThis.length > 0 && (
                  <div className="bg-blue-900/20 border border-blue-900 rounded-lg p-4">
                    <div className="text-xs text-blue-400 mb-2">벤치마킹 포인트</div>
                    <ul className="space-y-1">
                      {result.vsYafit.copyThis.map((item, i) => (
                        <li key={i} className="text-xs text-blue-300">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.strengths && result.strengths.length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-2">강점</div>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-gray-300">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.weaknesses && result.weaknesses.length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-2">약점</div>
                  <ul className="space-y-1">
                    {result.weaknesses.map((w, i) => (
                      <li key={i} className="text-xs text-gray-300">
                        • {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Benchmark opportunities */}
            {result.benchmarkOpportunities && result.benchmarkOpportunities.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-2">야핏무브가 배울 점</div>
                <ul className="space-y-1">
                  {result.benchmarkOpportunities.map((o, i) => (
                    <li key={i} className="text-xs text-gray-300">
                      • {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {result.issues && result.issues.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-3">발견된 이슈</div>
                <div className="space-y-3">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="border-l-2 border-gray-700 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            issue.severity === "Critical"
                              ? "bg-red-900 text-red-300"
                              : issue.severity === "Medium"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.screen}</span>
                      </div>
                      <p className="text-xs text-gray-300">{issue.issue}</p>
                      <p className="text-xs text-blue-400 mt-1">→ {issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
