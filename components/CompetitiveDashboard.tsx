"use client";

import { useState, useEffect } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface Competitor {
  id: string;
  name: string;
  url?: string;
  createdAt: string;
  _count: { analyses: number; snapshots: number };
  analyses: CompetitorAnalysis[];
}

interface CompetitorAnalysis {
  id: string;
  competitorId: string;
  frameworks: string[];
  results: AnalysisResults;
  createdAt: string;
}

interface AnalysisResults {
  verdict?: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  benchmarkOpportunities?: string[];
  issues?: { screen: string; severity: string; issue: string; recommendation: string }[];
  frameworkResults?: FrameworkResult[];
}

interface FrameworkResult {
  frameworkId: string;
  frameworkName: string;
  overallScore: number;
}

export default function CompetitiveDashboard() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalyses, setSelectedAnalyses] = useState<CompetitorAnalysis[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCompetitors();
  }, []);

  async function fetchCompetitors() {
    try {
      const res = await fetch("/api/competitors");
      const data = await res.json();
      setCompetitors(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function addCompetitor() {
    if (!newName.trim()) return;
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), url: newUrl.trim() || undefined }),
    });
    setNewName("");
    setNewUrl("");
    setAddingNew(false);
    fetchCompetitors();
  }

  async function deleteCompetitor(id: string) {
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    fetchCompetitors();
  }

  function handleFileUpload(competitorId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingFor(competitorId);
    const promises = Array.from(files).slice(0, 8).map(
      (f) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(f);
        })
    );
    Promise.all(promises).then(async (screenshots) => {
      setAnalyzing(competitorId);
      setUploadingFor(null);
      try {
        await fetch(`/api/competitors/${competitorId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenshots, frameworks: [] }),
        });
        fetchCompetitors();
      } finally {
        setAnalyzing(null);
      }
    });
  }

  // Build radar chart data from selected analyses
  const radarData: { axis: string; [key: string]: string | number }[] = [];
  if (selectedAnalyses.length > 0) {
    const allFrameworks = new Set<string>();
    selectedAnalyses.forEach((a) =>
      (a.results.frameworkResults ?? []).forEach((f) => allFrameworks.add(f.frameworkId))
    );
    allFrameworks.forEach((fId) => {
      const entry: { axis: string; [key: string]: string | number } = { axis: fId };
      selectedAnalyses.forEach((a) => {
        const fr = (a.results.frameworkResults ?? []).find((f) => f.frameworkId === fId);
        const comp = competitors.find((c) => c.id === a.competitorId);
        if (comp) entry[comp.name] = fr?.overallScore ?? 0;
      });
      radarData.push(entry);
    });
  }

  const COLORS = ["#60a5fa", "#f59e0b", "#34d399", "#f87171"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">경쟁 인텔리전스</h2>
        <button
          onClick={() => setAddingNew(true)}
          className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          + 경쟁사 추가
        </button>
      </div>

      {/* Add competitor form */}
      {addingNew && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="경쟁사 이름 (예: 머니워크)"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="앱스토어 URL (선택)"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={addCompetitor}
              className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              추가
            </button>
            <button
              onClick={() => setAddingNew(false)}
              className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Competitor list */}
      {competitors.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          등록된 경쟁사가 없습니다. 위에서 추가하세요.
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-700 rounded-lg">
              <div className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium text-white">{c.name}</div>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-400 hover:underline"
                    >
                      {c.url}
                    </a>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    분석 {c._count.analyses}회 · 리뷰 {c._count.snapshots}회
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.analyses.length > 0 && (
                    <button
                      onClick={() => {
                        const analysis = c.analyses[0];
                        setSelectedAnalyses((prev) => {
                          const exists = prev.find((a) => a.competitorId === c.id);
                          if (exists) return prev.filter((a) => a.competitorId !== c.id);
                          return [...prev, analysis];
                        });
                      }}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        selectedAnalyses.some((a) => a.competitorId === c.id)
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "border-gray-600 text-gray-400 hover:border-gray-400"
                      }`}
                    >
                      비교
                    </button>
                  )}
                  <label className={`text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 hover:border-gray-400 cursor-pointer transition-colors ${analyzing === c.id ? "opacity-50" : ""}`}>
                    {analyzing === c.id ? "분석중..." : uploadingFor === c.id ? "업로드중..." : "스크린샷 분석"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={!!analyzing}
                      onChange={(e) => handleFileUpload(c.id, e.target.files)}
                    />
                  </label>
                  <button
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:border-gray-500"
                  >
                    {expandedId === c.id ? "접기" : "결과"}
                  </button>
                  <button
                    onClick={() => deleteCompetitor(c.id)}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* Expanded analysis results */}
              {expandedId === c.id && c.analyses.length > 0 && (
                <div className="border-t border-gray-700 p-4 space-y-3">
                  {c.analyses.slice(0, 3).map((a) => {
                    const r = a.results;
                    return (
                      <div key={a.id} className="text-sm space-y-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-mono ${
                              r.verdict === "Pass"
                                ? "bg-green-900 text-green-300"
                                : r.verdict === "Partial"
                                ? "bg-yellow-900 text-yellow-300"
                                : "bg-red-900 text-red-300"
                            }`}
                          >
                            {r.verdict}
                          </span>
                          {r.score != null && (
                            <span className="text-gray-300 font-mono text-xs">{r.score}/100</span>
                          )}
                          <span className="text-gray-500 text-xs">
                            {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        {r.summary && <p className="text-gray-400 text-xs">{r.summary}</p>}
                        {r.benchmarkOpportunities && r.benchmarkOpportunities.length > 0 && (
                          <div>
                            <div className="text-xs text-blue-400 mb-1">벤치마킹 기회</div>
                            <ul className="space-y-0.5">
                              {r.benchmarkOpportunities.map((o, i) => (
                                <li key={i} className="text-xs text-gray-400">• {o}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Radar comparison chart */}
      {radarData.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-white mb-4">프레임워크별 비교</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #374151", fontSize: 12 }}
              />
              <Legend />
              {selectedAnalyses.map((a, i) => {
                const comp = competitors.find((c) => c.id === a.competitorId);
                return comp ? (
                  <Radar
                    key={comp.id}
                    name={comp.name}
                    dataKey={comp.name}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.15}
                  />
                ) : null;
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
