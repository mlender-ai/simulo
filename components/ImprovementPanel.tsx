"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { VersionComparison } from "@/components/VersionComparison";
import { getProductMode } from "@/lib/productMode";

interface ImprovementPanelProps {
  originalAnalysis: AnalysisResult;
  roundNumber: number;
  onNextRound?: (newRound: number) => void;
}

interface ImproveResult {
  html: string;
  changes: string[];
  provider?: string;
}

interface ScreenResult {
  screenIndex: number;
  screenLabel: string;
  variants: ImproveResult[];
}


type PanelState = "idle" | "generating" | "reanalyzing" | "variants" | "comparison";

const GENERATING_MESSAGES = [
  "이슈 목록을 정리하고 있습니다...",
  "욕망 지도를 반영 중...",
  "개선된 화면을 설계하고 있습니다...",
  "HTML로 렌더링 중...",
];

const REANALYZING_MESSAGES = [
  "개선된 화면을 캡처하고 있습니다...",
  "재분석을 시작합니다...",
  "이슈를 다시 평가하고 있습니다...",
  "욕망 충족도를 측정하고 있습니다...",
];

export function ImprovementPanel({
  originalAnalysis,
  roundNumber,
  onNextRound,
}: ImprovementPanelProps) {
  const thumbnailUrls = originalAnalysis.thumbnailUrls ?? [];
  const isMultiScreen = thumbnailUrls.length > 1;

  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [screenResults, setScreenResults] = useState<ScreenResult[]>([]);
  const [activeScreenIdx, setActiveScreenIdx] = useState(0);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [improvedAnalysis, setImprovedAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPng, setSavingPng] = useState(false);

  // ── Options ───────────────────────────────────────────────────────────────
  const [variantCount, setVariantCount] = useState(1);
  // "all" = generate for every screen; number = specific screen index (0-based)
  const [selectedScreenMode, setSelectedScreenMode] = useState<"all" | number>(0);
  const [optCriticalOnly, setOptCriticalOnly] = useState(false);
  const [optDesireAlignment, setOptDesireAlignment] = useState(true);
  const [optRestructureLayout, setOptRestructureLayout] = useState(false);
  const [targetScore, setTargetScore] = useState(
    Math.min(originalAnalysis.score + 15, 100)
  );
  const [description, setDescription] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  // Progress tracking during multi-variant / multi-screen generation
  const [generatingTotal, setGeneratingTotal] = useState(0);
  const [generatingDone, setGeneratingDone] = useState(0);
  const [generatingScreenLabel, setGeneratingScreenLabel] = useState("");

  // Mutex: prevents concurrent handleGenerate / handleReanalyze calls
  const operationRef = useRef(false);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isLoading = panelState === "generating" || panelState === "reanalyzing";
  const loadingMessages =
    panelState === "reanalyzing" ? REANALYZING_MESSAGES : GENERATING_MESSAGES;

  useEffect(() => {
    if (!isLoading) {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      return;
    }
    setLoadingMsgIdx(0);
    loadingIntervalRef.current = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length);
    }, 2000);
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [panelState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate variants for a single screen ─────────────────────────────────
  async function generateForScreen(screenIndex: number): Promise<ImproveResult[]> {
    const results: ImproveResult[] = [];
    for (let i = 0; i < variantCount; i++) {
      const res = await fetch("/api/generate-improvement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: originalAnalysis.id,
          analysis: {
            score: originalAnalysis.score,
            issues: originalAnalysis.issues,
            thumbnailUrls: originalAnalysis.thumbnailUrls,
            analysisOptions: originalAnalysis.analysisOptions,
          },
          options: {
            criticalOnly: optCriticalOnly,
            desireAlignment: optDesireAlignment,
            restructureLayout: optRestructureLayout,
            targetScore,
            variantIndex: i,
          },
          screenIndex,
          description: description.trim() || undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          roundNumber,
          productMode: getProductMode(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `시안 ${i + 1} 생성 실패 (${res.status})`);
      }
      const data: ImproveResult = await res.json();
      results.push(data);
      setGeneratingDone((prev) => prev + 1);
    }
    return results;
  }

  // ── Generate (single or all screens) ─────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    setPanelState("generating");
    setError(null);

    // Determine which screens to generate
    const screensToGenerate: number[] =
      selectedScreenMode === "all"
        ? thumbnailUrls.map((_, i) => i)
        : [selectedScreenMode as number];

    const totalOps = screensToGenerate.length * variantCount;
    setGeneratingTotal(totalOps);
    setGeneratingDone(0);

    const newScreenResults: ScreenResult[] = [];

    for (const screenIndex of screensToGenerate) {
      const label =
        thumbnailUrls.length > 1 ? `화면 ${screenIndex + 1}` : "화면";
      setGeneratingScreenLabel(label);
      try {
        const variants = await generateForScreen(screenIndex);
        newScreenResults.push({ screenIndex, screenLabel: label, variants });
      } catch (err) {
        console.error(`[improve] generate screen ${screenIndex}:`, err);
        setError(err instanceof Error ? err.message : `${label} 생성 실패`);
        break;
      }
    }

    if (newScreenResults.length > 0) {
      setScreenResults(newScreenResults);
      setActiveScreenIdx(0);
      setActiveVariantIdx(0);
      setPanelState("variants");
    } else {
      setPanelState("idle");
    }
    operationRef.current = false;
  }, [
    selectedScreenMode,
    variantCount,
    thumbnailUrls,
    optCriticalOnly,
    optDesireAlignment,
    optRestructureLayout,
    targetScore,
    description,
    referenceImages,
    originalAnalysis,
    roundNumber,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save active variant as PNG ────────────────────────────────────────────
  const handleSavePng = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setSavingPng(true);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise<void>((resolve) => {
        if (iframe.contentDocument?.readyState === "complete") { resolve(); return; }
        iframe.addEventListener("load", () => resolve(), { once: true });
      });
      const body = iframe.contentDocument?.body;
      if (!body) throw new Error("iframe 콘텐츠에 접근할 수 없습니다");
      const activeScreen = screenResults[activeScreenIdx];
      const dataUrl = await toPng(body, {
        quality: 0.95,
        backgroundColor: "#0f0f0f",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      const screenSuffix = activeScreen ? `-${activeScreen.screenLabel}` : "";
      a.download = `simulo-개선안-${originalAnalysis.id}${screenSuffix}-시안${activeVariantIdx + 1}.png`;
      a.click();
    } catch (err) {
      console.error("[improve] savePng:", err);
      setError(err instanceof Error ? err.message : "PNG 저장 실패");
    } finally {
      setSavingPng(false);
    }
  }, [activeScreenIdx, activeVariantIdx, screenResults, originalAnalysis.id]);

  // ── Re-analyze ────────────────────────────────────────────────────────────
  const handleReanalyze = useCallback(async () => {
    if (operationRef.current) return;
    const activeVariant = screenResults[activeScreenIdx]?.variants[activeVariantIdx];
    if (!activeVariant) return;
    operationRef.current = true;

    // Step 1: capture iframe BEFORE state change
    let capturedImage: string | null = null;
    try {
      const iframe = iframeRef.current;
      if (iframe) {
        await new Promise<void>((resolve) => {
          if (iframe.contentDocument?.readyState === "complete") { resolve(); return; }
          iframe.addEventListener("load", () => resolve(), { once: true });
          setTimeout(resolve, 5000);
        });
        const iframeBody = iframe.contentDocument?.body;
        if (iframeBody) {
          const { toPng } = await import("html-to-image");
          capturedImage = await toPng(iframeBody, {
            quality: 0.9,
            backgroundColor: "#0f0f0f",
          });
        }
      }
    } catch (captureErr) {
      console.warn("[improve] iframe capture failed:", captureErr);
    }

    if (!capturedImage) {
      setError("개선된 화면 캡처에 실패했습니다. 화면이 완전히 로드된 후 다시 시도해 주세요.");
      operationRef.current = false;
      return;
    }

    setPanelState("reanalyzing");
    setError(null);

    try {
      const base64Image = capturedImage.replace(/^data:image\/\w+;base64,/, "");
      const tag = originalAnalysis.projectTag
        ? `${originalAnalysis.projectTag} (개선 ${roundNumber}회차)`
        : `개선 ${roundNumber}회차`;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [base64Image],
          hypothesis: originalAnalysis.hypothesis,
          targetUser: originalAnalysis.targetUser,
          task: originalAnalysis.task,
          projectTag: tag,
          inputType: "image",
          mode: originalAnalysis.mode ?? "hypothesis",
          analysisOptions: (originalAnalysis.analysisOptions as object) ?? null,
          locale: "ko",
          previousAnalysisId: originalAnalysis.id,
          roundNumber: roundNumber + 1,
          isImprovement: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `재분석 실패 (${res.status})`);
      }
      const improved: AnalysisResult = await res.json();
      setImprovedAnalysis(improved);
      setPanelState("comparison");
    } catch (err) {
      console.error("[improve] reanalyze:", err);
      setError(err instanceof Error ? err.message : "재분석 실패");
      setPanelState("variants");
    } finally {
      operationRef.current = false;
    }
  }, [screenResults, activeScreenIdx, activeVariantIdx, originalAnalysis, roundNumber]);

  // ── Next round ────────────────────────────────────────────────────────────
  function handleNextRound() {
    setPanelState("idle");
    setScreenResults([]);
    setActiveScreenIdx(0);
    setActiveVariantIdx(0);
    setImprovedAnalysis(null);
    if (onNextRound) onNextRound(roundNumber + 1);
  }

  const activeScreenResult = screenResults[activeScreenIdx] ?? null;
  const activeVariant = activeScreenResult?.variants[activeVariantIdx] ?? null;

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (panelState === "idle") {
    return (
      <div className="h-full flex flex-col p-5 overflow-y-auto">
        <div className="mb-5">
          <p className="text-base font-medium text-white">✦ 개선안 생성</p>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">
            개선 라운드: {roundNumber}회차
          </p>
        </div>

        {/* Screen selector — only when multiple screens attached */}
        {isMultiScreen && (
          <div className="mb-5">
            <p className="text-xs font-medium text-white/60 mb-2">개선할 화면</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedScreenMode("all")}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  selectedScreenMode === "all"
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-[var(--border)]"
                }`}
              >
                전체 ({thumbnailUrls.length}개)
              </button>
              {thumbnailUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedScreenMode(i)}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    selectedScreenMode === i
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-[var(--border)]"
                  }`}
                >
                  화면 {i + 1}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/25 mt-1.5">
              {selectedScreenMode === "all"
                ? `${thumbnailUrls.length}개 화면 각각 개선안을 생성합니다`
                : `화면 ${(selectedScreenMode as number) + 1}의 개선안만 생성합니다`}
            </p>
          </div>
        )}

        {/* Variant count selector */}
        <div className="mb-5">
          <p className="text-xs font-medium text-white/60 mb-2">시안 개수</p>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setVariantCount(n)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  variantCount === n
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-[var(--border)]"
                }`}
              >
                {n}개
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/25 mt-1.5">
            {variantCount === 1 ? "1개의 개선 시안을 생성합니다" : `서로 다른 ${variantCount}개의 시안을 순차 생성합니다`}
          </p>
        </div>

        {/* Options */}
        <div className="mb-5">
          <p className="text-xs font-medium text-white/60 mb-2.5">개선 범위</p>
          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={optCriticalOnly}
                onChange={(e) => setOptCriticalOnly(e.target.checked)}
                className="mt-0.5 accent-white"
              />
              <span className="text-sm text-white/80">심각 이슈만 반영</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={optDesireAlignment}
                onChange={(e) => setOptDesireAlignment(e.target.checked)}
                className="mt-0.5 accent-white"
              />
              <span className="text-sm text-white/80">욕망 충족도 개선</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={optRestructureLayout}
                onChange={(e) => setOptRestructureLayout(e.target.checked)}
                className="mt-0.5 accent-white"
              />
              <div>
                <span className="text-sm text-white/80">레이아웃 구조 변경</span>
                {optRestructureLayout && (
                  <p className="text-xs text-amber-400/80 mt-1">
                    레이아웃이 크게 바뀔 수 있습니다
                  </p>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Target score */}
        <div className="mb-5">
          <p className="text-xs font-medium text-white/60 mb-2">
            목표 점수 <span className="text-white/30">(선택)</span>
          </p>
          <input
            type="number"
            min={originalAnalysis.score}
            max={100}
            value={targetScore}
            onChange={(e) =>
              setTargetScore(Math.min(100, Math.max(0, Number(e.target.value))))
            }
            placeholder="예: 85"
            className="w-full bg-white/5 border border-[var(--border)] rounded-md px-3 py-2 text-sm text-white mono outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="mb-5">
          <p className="text-xs font-medium text-white/60 mb-2">
            추가 지시사항 <span className="text-white/30">(선택)</span>
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: 버튼 색상을 브랜드 컬러에 맞게, CTA는 더 크고 명확하게..."
            rows={3}
            className="w-full bg-white/5 border border-[var(--border)] rounded-md px-3 py-2 text-sm text-white/80 outline-none focus:border-white/20 transition-colors resize-none placeholder:text-white/20"
          />
        </div>

        {/* Reference images */}
        <div className="mb-6">
          <p className="text-xs font-medium text-white/60 mb-2">
            레퍼런스 이미지 <span className="text-white/30">(선택)</span>
          </p>
          {referenceImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {referenceImages.map((src, idx) => (
                <div key={idx} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`레퍼런스 ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border border-[var(--border)]"
                  />
                  <button
                    onClick={() => setReferenceImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black border border-white/20 text-white/60 hover:text-white text-[10px] flex items-center justify-center leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer w-fit px-3 py-1.5 rounded-md border border-dashed border-white/20 hover:border-white/40 transition-colors">
            <span className="text-xs text-white/40 hover:text-white/60">+ 이미지 추가</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((file) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const result = ev.target?.result as string;
                    if (result) setReferenceImages((prev) => [...prev, result]);
                  };
                  reader.readAsDataURL(file);
                });
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          className="w-full py-2.5 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          {selectedScreenMode === "all" && isMultiScreen
            ? `전체 화면 개선안 생성 (${thumbnailUrls.length}개)`
            : variantCount === 1
            ? "개선안 생성하기"
            : `개선안 ${variantCount}개 생성하기`}
        </button>
        <p className="text-center text-[11px] text-white/25 mt-2">
          Simulo AI 기반 · 시안당 약 20-40초 소요
        </p>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
        <div className="w-5 h-5 border border-white/20 border-t-white/70 rounded-full animate-spin" />
        <p className="text-sm text-white/60 text-center">
          {loadingMessages[loadingMsgIdx]}
        </p>
        {panelState === "generating" && generatingTotal > 1 && (
          <div className="text-center space-y-0.5">
            {generatingScreenLabel && isMultiScreen && (
              <p className="text-[11px] text-white/40">{generatingScreenLabel} 처리 중</p>
            )}
            <p className="text-[11px] text-white/30 mono">
              {generatingDone} / {generatingTotal} 완료
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── VARIANTS ──────────────────────────────────────────────────────────────
  if (panelState === "variants" && screenResults.length > 0) {
    const multiScreen = screenResults.length > 1;
    const currentVariants = activeScreenResult?.variants ?? [];

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Screen tabs — only when multiple screens */}
        {multiScreen && (
          <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-[#1a1a1a]">
            {screenResults.map((sr, i) => (
              <button
                key={sr.screenIndex}
                onClick={() => { setActiveScreenIdx(i); setActiveVariantIdx(0); }}
                className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
                  activeScreenIdx === i
                    ? "bg-white/10 text-white border-b-2 border-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {sr.screenLabel}
              </button>
            ))}
            <button
              onClick={() => { setScreenResults([]); setActiveScreenIdx(0); setActiveVariantIdx(0); setError(null); setPanelState("idle"); }}
              className="ml-auto text-[11px] text-white/25 hover:text-white/50 transition-colors px-1"
            >
              ↺ 다시
            </button>
          </div>
        )}

        {/* Variant tab bar */}
        <div className={`flex items-center gap-1 px-4 ${multiScreen ? "pt-2" : "pt-4"} pb-0 border-b border-[#1a1a1a]`}>
          {currentVariants.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveVariantIdx(i)}
              className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
                activeVariantIdx === i
                  ? "bg-white/10 text-white border-b-2 border-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              시안 {i + 1}
            </button>
          ))}
          {!multiScreen && (
            <button
              onClick={() => { setScreenResults([]); setActiveScreenIdx(0); setActiveVariantIdx(0); setError(null); setPanelState("idle"); }}
              className="ml-auto text-[11px] text-white/25 hover:text-white/50 transition-colors px-1"
            >
              ↺ 다시
            </button>
          )}
        </div>

        {/* Changes summary */}
        {activeVariant && (
          <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0">
            <p className="text-[11px] font-medium text-white/50 mb-1.5">개선 내용</p>
            <ul className="space-y-0.5">
              {activeVariant.changes.map((c, i) => (
                <li key={i} className="text-[12px] text-[var(--muted)]">
                  • {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* iframe preview */}
        <div className="flex-1 overflow-hidden px-4 py-3">
          {activeVariant && (
            <iframe
              ref={iframeRef}
              key={`${activeScreenIdx}-${activeVariantIdx}`}
              srcDoc={activeVariant.html}
              className="w-full rounded-lg border border-[#222]"
              style={{ height: "100%", minHeight: 300 }}
              sandbox="allow-scripts allow-same-origin"
              title={`개선 시안 ${activeVariantIdx + 1}`}
            />
          )}
        </div>

        {/* Actions */}
        {error && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <div className="px-4 pb-4 flex gap-2 shrink-0">
          <button
            onClick={handleSavePng}
            disabled={savingPng}
            className="flex-1 py-2 rounded-md text-xs text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors disabled:opacity-50"
          >
            {savingPng ? "저장 중…" : "↓ PNG 저장"}
          </button>
          <button
            onClick={handleReanalyze}
            disabled={isLoading}
            className="flex-1 py-2 rounded-md text-xs text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            → 재분석
          </button>
        </div>
      </div>
    );
  }

  // ── COMPARISON ────────────────────────────────────────────────────────────
  if (panelState === "comparison" && improvedAnalysis) {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <VersionComparison
          original={originalAnalysis}
          improved={improvedAnalysis}
        />

        <div className="p-5 border-t border-[#1a1a1a] mt-auto">
          <button
            onClick={handleNextRound}
            className="w-full py-2.5 rounded-md text-sm text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
          >
            다음 라운드 개선 →
          </button>
          <p className="text-center text-[11px] text-white/25 mt-2">
            개선안을 바탕으로 {roundNumber + 1}회차 개선을 시작합니다
          </p>
        </div>
      </div>
    );
  }

  return null;
}
