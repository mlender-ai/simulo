/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FigmaFrame {
  id: string;
  name: string;
  pageName: string;
}

interface WritingIssue {
  location: string;
  original: string;
  suggestion: string;
  reason: string;
  severity: "critical" | "warning" | "info";
  principle: string;
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

  // Load saved Figma token
  useEffect(() => {
    const saved = localStorage.getItem("simulo_figma_token");
    if (saved) setFigmaToken(saved);
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
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UX 라이팅 체크 실패");
    } finally {
      setChecking(false);
    }
  }, [inputMode, figmaToken, figmaFileKey, selectedFrameIds, uploadedImages]);

  const canRun = inputMode === "figma"
    ? figmaStatus === "validated" && selectedFrameIds.length > 0
    : uploadedImages.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-semibold mb-1">UX 라이팅 체커</h1>
        <p className="text-sm text-[var(--muted)]">
          Figma 프레임 또는 이미지의 모든 텍스트를 분석하여 UX 라이팅 개선점을 찾습니다
        </p>
      </div>

      {/* Results view */}
      {results && results.length > 0 ? (
        <ResultsView
          results={results}
          activeFrameIdx={activeFrameIdx}
          onFrameChange={setActiveFrameIdx}
          onReset={() => setResults(null)}
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
    </div>
  );
}

// ── Results Component ──────────────────────────────────────────────────────────

function ResultsView({
  results,
  activeFrameIdx,
  onFrameChange,
  onReset,
}: {
  results: WritingCheckResult[];
  activeFrameIdx: number;
  onFrameChange: (idx: number) => void;
  onReset: () => void;
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
                    <p className="text-[10px] text-[var(--muted)] uppercase mb-1">현재</p>
                    <p className="text-sm text-white/60 line-through decoration-white/20">
                      {issue.original}
                    </p>
                  </div>
                  <div className="bg-black/20 rounded-md p-3">
                    <p className="text-[10px] text-emerald-400/60 uppercase mb-1">제안</p>
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
              .map((issue) => `[${issue.location}]\n현재: ${issue.original}\n제안: ${issue.suggestion}\n이유: ${issue.reason}`)
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
