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

const MAX_VARIANTS = 3;

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
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [variants, setVariants] = useState<ImproveResult[]>([]);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [improvedAnalysis, setImprovedAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPng, setSavingPng] = useState(false);

  // ── Options ───────────────────────────────────────────────────────────────
  const [variantCount, setVariantCount] = useState(1);
  const [optCriticalOnly, setOptCriticalOnly] = useState(false);
  const [optDesireAlignment, setOptDesireAlignment] = useState(true);
  const [optRestructureLayout, setOptRestructureLayout] = useState(false);
  const [targetScore, setTargetScore] = useState(
    Math.min(originalAnalysis.score + 15, 100)
  );

  // Progress tracking during multi-variant generation
  const [generatingCount, setGeneratingCount] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  // Mutex: prevents concurrent handleGenerate / handleReanalyze calls
  // (covers the window between click and panelState re-render)
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

  // ── Generate N variants sequentially ─────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    setPanelState("generating");
    setError(null);
    setGeneratingCount(variantCount);
    setGeneratedCount(0);

    const newVariants: ImproveResult[] = [];

    for (let i = 0; i < variantCount; i++) {
      try {
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
              variantIndex: i, // hint to API to generate distinct variants
            },
            roundNumber,
            productMode: getProductMode(),
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || `시안 ${i + 1} 생성 실패 (${res.status})`);
        }
        const data: ImproveResult = await res.json();
        newVariants.push(data);
        setGeneratedCount(i + 1);
      } catch (err) {
        console.error(`[improve] generate variant ${i + 1}:`, err);
        setError(err instanceof Error ? err.message : `시안 ${i + 1} 생성 실패`);
        // Continue with however many succeeded
        break;
      }
    }

    if (newVariants.length > 0) {
      setVariants(newVariants);
      setActiveVariantIdx(0);
      setPanelState("variants");
    } else {
      setPanelState("idle");
    }
    operationRef.current = false;
  }, [variantCount, optCriticalOnly, optDesireAlignment, optRestructureLayout, targetScore, originalAnalysis, roundNumber]);

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
      const dataUrl = await toPng(body, {
        quality: 0.95,
        backgroundColor: "#0f0f0f",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `simulo-개선안-${originalAnalysis.id}-시안${activeVariantIdx + 1}.png`;
      a.click();
    } catch (err) {
      console.error("[improve] savePng:", err);
      setError(err instanceof Error ? err.message : "PNG 저장 실패");
    } finally {
      setSavingPng(false);
    }
  }, [activeVariantIdx, originalAnalysis.id]);

  // ── Re-analyze ────────────────────────────────────────────────────────────
  const handleReanalyze = useCallback(async () => {
    // Mutex: captures the window between click and panelState → "reanalyzing"
    if (operationRef.current) return;
    const activeVariant = variants[activeVariantIdx];
    if (!activeVariant) return;
    operationRef.current = true;

    // ── Step 1: capture iframe BEFORE state change (iframe unmounts on reanalyzing state) ──
    let capturedImage: string | null = null;
    try {
      const iframe = iframeRef.current;
      if (iframe) {
        // Wait up to 5s for iframe to be fully loaded
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

    // ── Step 2: change state to loading AFTER capture ──
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
  }, [variants, activeVariantIdx, originalAnalysis, roundNumber]);

  // ── Next round ────────────────────────────────────────────────────────────
  function handleNextRound() {
    setPanelState("idle");
    setVariants([]);
    setActiveVariantIdx(0);
    setImprovedAnalysis(null);
    if (onNextRound) onNextRound(roundNumber + 1);
  }

  const activeVariant = variants[activeVariantIdx] ?? null;

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
        <div className="mb-6">
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

        {error && (
          <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          className="w-full py-2.5 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          {variantCount === 1 ? "개선안 생성하기" : `개선안 ${variantCount}개 생성하기`}
        </button>
        <p className="text-center text-[11px] text-white/25 mt-2">
          Opus 4.6 기반 · 시안당 약 20-40초 소요
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
        {panelState === "generating" && generatingCount > 1 && (
          <p className="text-[11px] text-white/30 mono">
            {generatedCount} / {generatingCount} 시안 완료
          </p>
        )}
      </div>
    );
  }

  // ── VARIANTS ──────────────────────────────────────────────────────────────
  if (panelState === "variants" && variants.length > 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Variant tab bar */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-[#1a1a1a]">
          {variants.map((_, i) => (
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
          <button
            onClick={() => { setVariants([]); setActiveVariantIdx(0); setError(null); setPanelState("idle"); }}
            className="ml-auto text-[11px] text-white/25 hover:text-white/50 transition-colors px-1"
          >
            ↺ 다시
          </button>
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
              key={activeVariantIdx}
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
