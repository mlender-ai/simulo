/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  writingStorage,
  writingCheckToCSV,
  type WritingCheckFrame,
  type WritingCheckSession,
  type WritingIssue,
} from "@/lib/writingStorage";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FigmaFrame {
  id: string;
  name: string;
  pageName: string;
}

interface ScreenLevel {
  hasOneKeyMessage: boolean;
  hasWordRepetition: boolean;
  repeatedWords: string[];
  ctaCount: number;
  ctaClarity: string;
}

interface WritingCheckResult {
  summary: string;
  score: number;
  issues: WritingIssue[];
  strengths: string[];
  frameName: string;
  screenLevel?: ScreenLevel;
}

type InputMode = "figma" | "image";
type PageTab = "check" | "checklist";

// ── Severity helpers ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", label: "심각" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "주의" },
  info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "참고" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function UxWritingPage() {
  const [pageTab, setPageTab] = useState<PageTab>("check");

  // Input state
  const [inputMode, setInputMode] = useState<InputMode>("figma");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [figmaFileName, setFigmaFileName] = useState("");
  const [figmaFrames, setFigmaFrames] = useState<FigmaFrame[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);
  const [figmaStatus, setFigmaStatus] = useState<"idle" | "validating" | "validated" | "error">("idle");
  const [figmaError, setFigmaError] = useState("");

  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<WritingCheckResult[] | null>(null);
  const [error, setError] = useState("");
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);

  // Checklist state
  const [sessions, setSessions] = useState<WritingCheckSession[]>([]);

  // Load saved data + handle plugin import via hash fragment
  useEffect(() => {
    const saved = localStorage.getItem("simulo_figma_token");
    if (saved) setFigmaToken(saved);

    // URL 쿼리에서 tab 파라미터 처리
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "checklist") {
      setPageTab("checklist");
    }

    // hash fragment에서 플러그인 데이터 import 처리
    const hash = window.location.hash;
    if (hash.startsWith("#import=")) {
      try {
        const encoded = hash.slice("#import=".length);
        const json = decodeURIComponent(escape(atob(encoded)));
        const compact = JSON.parse(json) as { f: string; s: number; i: { l: string; o: string; g: string; r: string; v: string; p: string }[] }[];

        // 압축 형식을 정규 형식으로 변환
        const frames: WritingCheckFrame[] = compact.map((c) => ({
          frameName: c.f,
          score: c.s,
          summary: "",
          issues: c.i.map((i) => ({
            location: i.l,
            original: i.o,
            suggestion: i.g,
            reason: i.r,
            severity: i.v as "critical" | "warning" | "info",
            principle: i.p,
          })),
          strengths: [],
        }));

        writingStorage.save(frames);
        setPageTab("checklist");
        // hash 제거 (히스토리 변경 없이)
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch (e) {
        console.error("[ux-writing] import 실패:", e);
      }
    }

    setSessions(writingStorage.getAll());
  }, []);

  // ── Figma frame loading ──────────────────────────────────────────────────────

  const loadFrames = useCallback(async () => {
    if (!figmaToken || !figmaUrl) return;
    setFigmaStatus("validating");
    setFigmaError("");

    try {
      const res = await fetch("/api/figma-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl, figmaToken: figmaToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFigmaStatus("error");
        setFigmaError(data.error || "프레임 로딩 실패");
        return;
      }
      setFigmaFileKey(data.fileKey);
      setFigmaFileName(data.fileName);
      setFigmaFrames(data.frames);
      setSelectedFrameIds(data.frames.slice(0, 8).map((f: FigmaFrame) => f.id));
      setFigmaStatus("validated");
    } catch {
      setFigmaStatus("error");
      setFigmaError("네트워크 오류");
    }
  }, [figmaToken, figmaUrl]);

  const toggleFrame = (id: string) => {
    setSelectedFrameIds((prev) =>
      prev.includes(id)
        ? prev.filter((fid) => fid !== id)
        : prev.length < 8
          ? [...prev, id]
          : prev,
    );
  };

  // ── Image upload ─────────────────────────────────────────────────────────────

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const results: string[] = [...uploadedImages];
    let loaded = 0;
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        results.push(reader.result as string);
        loaded++;
        if (loaded === imageFiles.length) setUploadedImages(results);
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Run check ────────────────────────────────────────────────────────────────

  const runCheck = useCallback(async () => {
    setChecking(true);
    setError("");
    setResults(null);
    setActiveFrameIdx(0);

    try {
      const apiKey = localStorage.getItem("simulo_anthropic_key") || undefined;

      const payload: Record<string, unknown> = { apiKey };

      if (inputMode === "figma") {
        payload.figmaToken = figmaToken;
        payload.figmaFileKey = figmaFileKey;
        payload.figmaFrameIds = selectedFrameIds;
      } else {
        payload.images = uploadedImages;
      }

      const res = await fetch("/api/ux-writing-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `체크 실패 (${res.status})`);
      }

      const data = await res.json();
      const checkResults: WritingCheckResult[] = data.results;
      setResults(checkResults);

      // 자동 저장
      const saved = writingStorage.save(checkResults as WritingCheckFrame[]);
      setSessions(writingStorage.getAll());
      // eslint-disable-next-line no-console
      console.log("[ux-writing] 체크 결과 저장:", saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UX 라이팅 체크 실패");
    } finally {
      setChecking(false);
    }
  }, [inputMode, figmaToken, figmaFileKey, selectedFrameIds, uploadedImages]);

  const canRun = inputMode === "figma"
    ? figmaStatus === "validated" && selectedFrameIds.length > 0
    : uploadedImages.length > 0;

  // ── CSV download ─────────────────────────────────────────────────────────────

  const downloadCSV = useCallback((targetSessions: WritingCheckSession[]) => {
    const csv = writingCheckToCSV(targetSessions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ux-writing-checklist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const deleteSession = useCallback((id: string) => {
    writingStorage.deleteById(id);
    setSessions(writingStorage.getAll());
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold mb-1">UX 라이팅 체커</h1>
        <p className="text-sm text-[var(--muted)]">
          Figma 프레임 또는 이미지의 모든 텍스트를 분석하여 UX 라이팅 개선점을 찾습니다
        </p>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-[var(--border)] w-fit mb-6">
        <button
          onClick={() => setPageTab("check")}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
            pageTab === "check" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"
          }`}
        >
          체크하기
        </button>
        <button
          onClick={() => setPageTab("checklist")}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            pageTab === "checklist" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"
          }`}
        >
          체크리스트
          {sessions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              pageTab === "checklist" ? "bg-black/20" : "bg-white/10"
            }`}>
              {sessions.length}
            </span>
          )}
        </button>
      </div>

      {/* ═══ Check Tab ═══ */}
      {pageTab === "check" && (
        <>
          {/* Results view */}
          {results && results.length > 0 ? (
            <ResultsView
              results={results}
              activeFrameIdx={activeFrameIdx}
              onFrameChange={setActiveFrameIdx}
              onReset={() => setResults(null)}
              onExportCSV={() => {
                // 현재 결과만 CSV로 내보내기
                const tempSession: WritingCheckSession = {
                  id: "temp",
                  createdAt: new Date().toISOString(),
                  frames: results as WritingCheckFrame[],
                };
                downloadCSV([tempSession]);
              }}
            />
          ) : (
            <>
              {/* Input mode toggle */}
              <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-[var(--border)] w-fit mb-6">
                {(["figma", "image"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      inputMode === mode
                        ? "bg-white text-black"
                        : "text-[var(--muted)] hover:text-white"
                    }`}
                  >
                    {mode === "figma" ? "Figma 프레임" : "이미지 업로드"}
                  </button>
                ))}
              </div>

              {/* Figma input */}
              {inputMode === "figma" && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={figmaToken}
                      onChange={(e) => {
                        setFigmaToken(e.target.value);
                        setFigmaStatus("idle");
                      }}
                      placeholder="Figma Personal Access Token (figd_...)"
                      className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
                    />
                    {figmaToken && figmaToken === localStorage.getItem("simulo_figma_token") && (
                      <span className="text-xs text-emerald-400 shrink-0">설정에서 불러옴</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={figmaUrl}
                      onChange={(e) => {
                        setFigmaUrl(e.target.value);
                        setFigmaStatus("idle");
                      }}
                      placeholder="Figma 파일 URL (https://figma.com/file/...)"
                      className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
                    />
                    <button
                      onClick={loadFrames}
                      disabled={!figmaToken || !figmaUrl || figmaStatus === "validating"}
                      className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
                        figmaToken && figmaUrl && figmaStatus !== "validating"
                          ? "bg-white/10 text-white hover:bg-white/15"
                          : "bg-white/5 text-[var(--muted)] cursor-not-allowed"
                      }`}
                    >
                      {figmaStatus === "validating" ? "로딩 중..." : "프레임 불러오기"}
                    </button>
                  </div>

                  {figmaStatus === "error" && (
                    <div className="p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
                      {figmaError}
                    </div>
                  )}

                  {figmaStatus === "validated" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-emerald-400">✓</span>
                        <span className="text-[var(--muted)]">파일:</span>
                        <span className="font-medium">{figmaFileName}</span>
                        <span className="text-[var(--muted)]">— {figmaFrames.length}개 프레임</span>
                      </div>

                      {figmaFrames.length > 0 && (
                        <div>
                          <p className="text-xs text-[var(--muted)] mb-2">체크할 프레임 선택 (최대 8개)</p>
                          <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)]">
                            {figmaFrames.map((frame) => {
                              const checked = selectedFrameIds.includes(frame.id);
                              return (
                                <label
                                  key={frame.id}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                                    checked ? "bg-white/10" : "hover:bg-white/5"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleFrame(frame.id)}
                                    className="accent-white"
                                  />
                                  <div className="min-w-0">
                                    <span className="text-sm block truncate">{frame.name}</span>
                                    <span className="text-xs text-[var(--muted)]">{frame.pageName}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-xs text-[var(--muted)] mt-1.5">
                            {selectedFrameIds.length}/8 선택됨
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Image upload input */}
              {inputMode === "image" && (
                <div className="mb-6">
                  <div
                    onClick={() => uploadedImages.length === 0 && fileRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer border-[var(--border)] hover:border-white/20"
                  >
                    {uploadedImages.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-white/40 text-sm">체크할 화면 이미지를 클릭하여 업로드</p>
                        <p className="text-white/20 text-xs mt-1">PNG, JPG, WebP</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {uploadedImages.map((img, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={img}
                              alt={`screen-${i}`}
                              className="h-32 rounded border border-[var(--border)] object-cover"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedImages((prev) => prev.filter((_, idx) => idx !== i));
                              }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              x
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                          className="h-32 w-20 rounded border-2 border-dashed border-[var(--border)] hover:border-white/30 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors text-xl"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleImageUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Run button */}
              <button
                onClick={runCheck}
                disabled={!canRun || checking}
                className="w-full py-2.5 sm:py-3 rounded-md text-sm font-medium transition-colors bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-[var(--muted)] disabled:cursor-not-allowed"
              >
                {checking ? "분석 중..." : "UX 라이팅 체크 시작"}
              </button>

              {checking && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <div className="w-5 h-5 border border-white/20 border-t-white/70 rounded-full animate-spin" />
                  <p className="text-sm text-white/60">프레임의 텍스트를 분석하고 있습니다...</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ Checklist Tab ═══ */}
      {pageTab === "checklist" && (
        <ChecklistView
          sessions={sessions}
          onDelete={deleteSession}
          onExportCSV={downloadCSV}
          onRefresh={() => setSessions(writingStorage.getAll())}
        />
      )}
    </div>
  );
}

// ── Results Component ──────────────────────────────────────────────────────────

function ResultsView({
  results,
  activeFrameIdx,
  onFrameChange,
  onReset,
  onExportCSV,
}: {
  results: WritingCheckResult[];
  activeFrameIdx: number;
  onFrameChange: (idx: number) => void;
  onReset: () => void;
  onExportCSV: () => void;
}) {
  const active = results[activeFrameIdx];
  if (!active) return null;

  const criticalCount = active.issues.filter((i) => i.severity === "critical").length;
  const warningCount = active.issues.filter((i) => i.severity === "warning").length;
  const infoCount = active.issues.filter((i) => i.severity === "info").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          <span>&larr;</span>
          <span>다시 체크하기</span>
        </button>
        <button
          onClick={onExportCSV}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
        >
          CSV 내보내기
        </button>
      </div>

      {/* Frame tabs */}
      {results.length > 1 && (
        <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-[var(--border)] overflow-x-auto scrollbar-none">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => onFrameChange(i)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeFrameIdx === i
                  ? "bg-white text-black"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {r.frameName}
            </button>
          ))}
        </div>
      )}

      {/* Score card */}
      <div className="bg-white/[0.03] border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">
              {active.frameName}
            </p>
            <p className="text-sm text-white/80">{active.summary}</p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className={`text-3xl font-bold mono ${scoreColor(active.score)}`}>
              {active.score}
            </p>
            <p className="text-[10px] text-[var(--muted)] uppercase">Score</p>
          </div>
        </div>

        {/* Issue counts */}
        <div className="flex gap-3 text-xs">
          {criticalCount > 0 && (
            <span className="text-red-400">심각 {criticalCount}</span>
          )}
          {warningCount > 0 && (
            <span className="text-amber-400">주의 {warningCount}</span>
          )}
          {infoCount > 0 && (
            <span className="text-blue-400">참고 {infoCount}</span>
          )}
          {active.issues.length === 0 && (
            <span className="text-emerald-400">이슈 없음</span>
          )}
        </div>
      </div>

      {/* Screen-level checks */}
      {active.screenLevel && (
        <div className="bg-white/[0.03] border border-[var(--border)] rounded-lg p-4 space-y-3">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider">화면 단위 체크</p>
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2 py-1 rounded ${active.screenLevel.hasOneKeyMessage ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {active.screenLevel.hasOneKeyMessage ? "✓ 핵심 메시지 1개" : "✗ 핵심 메시지 복수"}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${!active.screenLevel.hasWordRepetition ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
              {!active.screenLevel.hasWordRepetition ? "✓ 단어 반복 없음" : `✗ 반복: ${active.screenLevel.repeatedWords.join(", ")}`}
            </span>
            <span className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">
              CTA {active.screenLevel.ctaCount}개
            </span>
          </div>
          {active.screenLevel.ctaClarity && (
            <p className="text-xs text-white/50">{active.screenLevel.ctaClarity}</p>
          )}
        </div>
      )}

      {/* Strengths */}
      {active.strengths.length > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-4">
          <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">잘 된 점</p>
          <ul className="space-y-1.5">
            {active.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/70">
                <span className="text-emerald-400 shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      {active.issues.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider">
            개선 사항 ({active.issues.length})
          </p>

          {active.issues.map((issue, i) => {
            const style = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
            return (
              <div
                key={i}
                className={`${style.bg} border ${style.border} rounded-lg p-4 space-y-3`}
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${style.text} ${style.bg}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{issue.location}</span>
                  <span className="text-[10px] text-white/30 ml-auto">{issue.principle}</span>
                </div>

                {/* Before → After */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-black/20 rounded-md p-3">
                    <p className="text-[10px] text-[var(--muted)] uppercase mb-1">Don&apos;t</p>
                    <p className="text-sm text-white/60 line-through decoration-white/20">
                      {issue.original}
                    </p>
                  </div>
                  <div className="bg-black/20 rounded-md p-3">
                    <p className="text-[10px] text-emerald-400/60 uppercase mb-1">Do</p>
                    <p className="text-sm text-white/90">{issue.suggestion}</p>
                  </div>
                </div>

                {/* Reason */}
                <p className="text-xs text-white/50">{issue.reason}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Copy all suggestions */}
      {active.issues.length > 0 && (
        <button
          onClick={() => {
            const text = active.issues
              .map((issue) => `[${issue.location}]\nDon't: ${issue.original}\nDo: ${issue.suggestion}\n이유: ${issue.reason}`)
              .join("\n\n");
            navigator.clipboard.writeText(text);
          }}
          className="w-full py-2 rounded-md text-xs text-[var(--muted)] hover:text-white border border-[var(--border)] hover:border-white/20 transition-colors"
        >
          모든 제안 복사
        </button>
      )}
    </div>
  );
}

// ── Checklist Component ────────────────────────────────────────────────────────

function ChecklistView({
  sessions,
  onDelete,
  onExportCSV,
  onRefresh,
}: {
  sessions: WritingCheckSession[];
  onDelete: (id: string) => void;
  onExportCSV: (sessions: WritingCheckSession[]) => void;
  onRefresh: () => void;
}) {
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  const handleImport = () => {
    setImportError("");
    try {
      // compact JSON 형식 또는 정규 형식 모두 지원
      const parsed = JSON.parse(importText.trim());
      let frames: WritingCheckFrame[];

      if (Array.isArray(parsed) && parsed[0]?.f !== undefined) {
        // compact format (from plugin)
        frames = parsed.map((c: { f: string; s: number; i: { l: string; o: string; g: string; r: string; v: string; p: string }[] }) => ({
          frameName: c.f,
          score: c.s,
          summary: "",
          issues: c.i.map((i) => ({
            location: i.l,
            original: i.o,
            suggestion: i.g,
            reason: i.r,
            severity: i.v as "critical" | "warning" | "info",
            principle: i.p,
          })),
          strengths: [],
        }));
      } else if (Array.isArray(parsed) && parsed[0]?.frameName !== undefined) {
        // full format
        frames = parsed;
      } else {
        throw new Error("올바른 형식이 아닙니다");
      }

      writingStorage.save(frames);
      onRefresh();
      setShowImport(false);
      setImportText("");
    } catch {
      setImportError("JSON 파싱 실패. 플러그인에서 복사한 데이터를 붙여넣어주세요.");
    }
  };

  if (sessions.length === 0 && !showImport) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--muted)] text-sm mb-2">저장된 체크리스트가 없습니다</p>
        <p className="text-white/30 text-xs mb-6">UX 라이팅 체크를 실행하면 결과가 자동으로 저장됩니다</p>
        <button
          onClick={() => setShowImport(true)}
          className="text-xs px-4 py-2 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
        >
          JSON으로 가져오기
        </button>
      </div>
    );
  }

  const totalIssues = sessions.reduce(
    (sum, s) => sum + s.frames.reduce((fs, f) => fs + f.issues.length, 0),
    0
  );
  const criticalTotal = sessions.reduce(
    (sum, s) => sum + s.frames.reduce((fs, f) => fs + f.issues.filter((i) => i.severity === "critical").length, 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Import panel */}
      {showImport && (
        <div className="border border-[var(--border)] rounded-lg p-4 space-y-3 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--muted)]">플러그인 결과 JSON을 붙여넣으세요</p>
            <button onClick={() => { setShowImport(false); setImportText(""); setImportError(""); }} className="text-xs text-[var(--muted)] hover:text-white">닫기</button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{"f":"프레임명","s":80,"i":[...]}]'
            className="w-full h-24 px-3 py-2 bg-white/[0.03] border border-[var(--border)] rounded-md text-xs font-mono focus:outline-none focus:border-white/30 resize-none"
          />
          {importError && <p className="text-xs text-red-400">{importError}</p>}
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            가져오기
          </button>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[var(--muted)]">{sessions.length}개 세션</span>
          <span className="text-[var(--muted)]">{totalIssues}개 이슈</span>
          {criticalTotal > 0 && (
            <span className="text-red-400">{criticalTotal}개 심각</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
            className="text-xs bg-white/[0.03] border border-[var(--border)] rounded-md px-2 py-1.5 text-[var(--muted)] focus:outline-none"
          >
            <option value="all">전체 심각도</option>
            <option value="critical">심각만</option>
            <option value="warning">주의만</option>
            <option value="info">참고만</option>
          </select>
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
          >
            가져오기
          </button>
          <button
            onClick={() => onExportCSV(sessions)}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
          >
            전체 CSV 내보내기
          </button>
        </div>
      </div>

      {/* Sessions */}
      {sessions.map((session) => {
        const isExpanded = !collapsedSessions.has(session.id);
        const sessionIssues = session.frames.flatMap((f) =>
          f.issues
            .filter((i) => severityFilter === "all" || i.severity === severityFilter)
            .map((issue) => ({ ...issue, frameName: f.frameName, score: f.score }))
        );
        const avgScore = session.frames.length > 0
          ? Math.round(session.frames.reduce((s, f) => s + f.score, 0) / session.frames.length)
          : 0;

        return (
          <div
            key={session.id}
            className="border border-[var(--border)] rounded-lg overflow-hidden"
          >
            {/* Session header */}
            <button
              onClick={() => setCollapsedSessions((prev) => {
                const next = new Set(prev);
                if (isExpanded) next.add(session.id);
                else next.delete(session.id);
                return next;
              })}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="mono text-[10px] text-white/30">
                  {isExpanded ? "▾" : "▸"}
                </span>
                <span className="text-sm text-white/80 truncate">
                  {session.frames.map((f) => f.frameName).join(", ")}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className={`mono text-sm font-medium ${scoreColor(avgScore)}`}>
                  {avgScore}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(session.createdAt).toLocaleDateString("ko-KR")}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {sessionIssues.length}건
                </span>
              </div>
            </button>

            {/* Expanded: issue table */}
            {isExpanded && (
              <div>
                {sessionIssues.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[var(--muted)]">
                    {severityFilter === "all" ? "이슈 없음" : `${severityFilter} 이슈 없음`}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t border-[var(--border)] bg-white/[0.02]">
                          <th className="text-left px-4 py-2 text-[var(--muted)] font-medium whitespace-nowrap">프레임</th>
                          <th className="text-left px-4 py-2 text-[var(--muted)] font-medium whitespace-nowrap">위치</th>
                          <th className="text-center px-3 py-2 text-[var(--muted)] font-medium whitespace-nowrap">심각도</th>
                          <th className="text-left px-4 py-2 text-[var(--muted)] font-medium whitespace-nowrap">원칙</th>
                          <th className="text-left px-4 py-2 text-red-400/60 font-medium whitespace-nowrap">Don&apos;t</th>
                          <th className="text-left px-4 py-2 text-emerald-400/60 font-medium whitespace-nowrap">Do</th>
                          <th className="text-left px-4 py-2 text-[var(--muted)] font-medium whitespace-nowrap">사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionIssues.map((issue, i) => {
                          const sev = SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info;
                          return (
                            <tr
                              key={i}
                              className="border-t border-[var(--border)] hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-4 py-2.5 text-white/70 whitespace-nowrap max-w-[120px] truncate">
                                {issue.frameName}
                              </td>
                              <td className="px-4 py-2.5 text-white/50 max-w-[100px] truncate">
                                {issue.location}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${sev.text} ${sev.bg}`}>
                                  {sev.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-white/40 whitespace-nowrap">
                                {issue.principle}
                              </td>
                              <td className="px-4 py-2.5 text-white/50 line-through decoration-white/20 max-w-[200px]">
                                {issue.original}
                              </td>
                              <td className="px-4 py-2.5 text-white/90 max-w-[200px]">
                                {issue.suggestion}
                              </td>
                              <td className="px-4 py-2.5 text-white/40 max-w-[200px]">
                                {issue.reason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Session actions */}
                <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-[var(--border)] bg-white/[0.01]">
                  <button
                    onClick={() => onExportCSV([session])}
                    className="text-[11px] px-2.5 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
                  >
                    CSV 내보내기
                  </button>
                  <button
                    onClick={() => {
                      const text = sessionIssues
                        .map((i) => `[${i.frameName} / ${i.location}]\nDon't: ${i.original}\nDo: ${i.suggestion}`)
                        .join("\n\n");
                      navigator.clipboard.writeText(text);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
                  >
                    복사
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("이 세션을 삭제하시겠습니까?")) {
                        onDelete(session.id);
                        onRefresh();
                      }
                    }}
                    className="text-[11px] px-2.5 py-1 rounded border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
