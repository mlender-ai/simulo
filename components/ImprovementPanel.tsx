"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { VersionComparison } from "@/components/VersionComparison";
import { useImprovementMachine } from "@/lib/improvement/useImprovementMachine";
import type { GenerateOptions, ScreenResult } from "@/lib/improvement/types";

interface ImprovementPanelProps {
  originalAnalysis: AnalysisResult;
  roundNumber: number;
  onNextRound?: (newRound: number) => void;
}

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

  const { state, generate, reanalyze, reset, nextRound } = useImprovementMachine(
    originalAnalysis,
    roundNumber,
    onNextRound,
  );

  // ── UI-only state (no business logic) ─────────────────────────────────────
  const [activeScreenIdx, setActiveScreenIdx] = useState(0);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [savingPng, setSavingPng] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Options
  const [variantCount, setVariantCount] = useState(1);
  const [selectedScreenMode, setSelectedScreenMode] = useState<"all" | number>(0);
  const [optCriticalOnly, setOptCriticalOnly] = useState(false);
  const [optDesireAlignment, setOptDesireAlignment] = useState(true);
  const [optRestructureLayout, setOptRestructureLayout] = useState(false);
  const [targetScore, setTargetScore] = useState(Math.min(originalAnalysis.score + 15, 100));
  const [description, setDescription] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Loading message rotation ───────────────────────────────────────────────
  const isLoading = state.status === "generating" || state.status === "reanalyzing";
  const loadingMessages = state.status === "reanalyzing" ? REANALYZING_MESSAGES : GENERATING_MESSAGES;

  useEffect(() => {
    if (!isLoading) return;
    setLoadingMsgIdx(0);
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset tab indices when new results arrive
  useEffect(() => {
    if (state.status === "variants" || state.status === "comparison") {
      setActiveScreenIdx(0);
      setActiveVariantIdx(0);
    }
  }, [state.status]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    const opts: GenerateOptions = {
      variantCount,
      selectedScreenMode,
      optCriticalOnly,
      optDesireAlignment,
      optRestructureLayout,
      targetScore,
      description,
      referenceImages,
    };
    generate(opts);
  }, [
    variantCount, selectedScreenMode, optCriticalOnly, optDesireAlignment,
    optRestructureLayout, targetScore, description, referenceImages, generate,
  ]);

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
      const screenResults = state.status === "variants" ? state.screenResults : [];
      const activeScreen = screenResults[activeScreenIdx];
      const dataUrl = await toPng(body, { quality: 0.95, backgroundColor: "#0f0f0f", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      const screenSuffix = activeScreen ? `-${activeScreen.screenLabel}` : "";
      a.download = `simulo-개선안-${originalAnalysis.id}${screenSuffix}-시안${activeVariantIdx + 1}.png`;
      a.click();
    } catch (err) {
      console.error("[improve] savePng:", err);
    } finally {
      setSavingPng(false);
    }
  }, [activeScreenIdx, activeVariantIdx, originalAnalysis.id, state]);

  const handleReanalyze = useCallback(async (screenResults: ScreenResult[]) => {
    const iframe = iframeRef.current;
    let capturedImage: string | null = null;

    try {
      if (iframe) {
        await new Promise<void>((resolve) => {
          if (iframe.contentDocument?.readyState === "complete") { resolve(); return; }
          iframe.addEventListener("load", () => resolve(), { once: true });
          setTimeout(resolve, 5000);
        });
        const iframeBody = iframe.contentDocument?.body;
        if (iframeBody) {
          const { toPng } = await import("html-to-image");
          capturedImage = await toPng(iframeBody, { quality: 0.9, backgroundColor: "#0f0f0f" });
        }
      }
    } catch (captureErr) {
      console.warn("[improve] iframe capture failed:", captureErr);
    }

    if (!capturedImage) {
      // 캡처 실패는 에러 상태로 전이하지 않고 사용자에게 직접 알림
      // (머신 상태를 오염시키지 않기 위해 alert 대신 별도 처리)
      alert("개선된 화면 캡처에 실패했습니다. 화면이 완전히 로드된 후 다시 시도해 주세요.");
      return;
    }

    reanalyze(capturedImage, screenResults);
  }, [reanalyze]);

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (state.status === "idle" || state.status === "error") {
    const errorMsg = state.status === "error" ? state.message : null;
    // error 상태에서 이전 상태가 generating이면 옵션 패널로 돌아옴
    // error 상태에서 이전 상태가 reanalyzing이면 variants로 복구
    // — 단, variants 데이터가 없으면 idle로 폴백

    return (
      <div className="h-full flex flex-col p-5 overflow-y-auto">
        <div className="mb-5">
          <p className="text-base font-medium text-white">✦ 개선안 생성</p>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">
            개선 라운드: {roundNumber}회차
          </p>
        </div>

        {/* Screen selector */}
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

        {/* Variant count */}
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
              <input type="checkbox" checked={optCriticalOnly} onChange={(e) => setOptCriticalOnly(e.target.checked)} className="mt-0.5 accent-white" />
              <span className="text-sm text-white/80">심각 이슈만 반영</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={optDesireAlignment} onChange={(e) => setOptDesireAlignment(e.target.checked)} className="mt-0.5 accent-white" />
              <span className="text-sm text-white/80">욕망 충족도 개선</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={optRestructureLayout} onChange={(e) => setOptRestructureLayout(e.target.checked)} className="mt-0.5 accent-white" />
              <div>
                <span className="text-sm text-white/80">레이아웃 구조 변경</span>
                {optRestructureLayout && (
                  <p className="text-xs text-amber-400/80 mt-1">레이아웃이 크게 바뀔 수 있습니다</p>
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
            onChange={(e) => setTargetScore(Math.min(100, Math.max(0, Number(e.target.value))))}
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
                  <img src={src} alt={`레퍼런스 ${idx + 1}`} className="w-16 h-16 object-cover rounded border border-[var(--border)]" />
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

        {errorMsg && (
          <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{errorMsg}</p>
            <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 mt-1 transition-colors">
              초기화
            </button>
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
  if (state.status === "generating" || state.status === "reanalyzing") {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-4">
        <div className="w-5 h-5 border border-white/20 border-t-white/70 rounded-full animate-spin" />
        <p className="text-sm text-white/60 text-center">
          {loadingMessages[loadingMsgIdx]}
        </p>
        {state.status === "generating" && state.total > 1 && (
          <div className="text-center space-y-0.5">
            {state.screenLabel && isMultiScreen && (
              <p className="text-[11px] text-white/40">{state.screenLabel} 처리 중</p>
            )}
            <p className="text-[11px] text-white/30 mono">
              {state.done} / {state.total} 완료
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── VARIANTS ──────────────────────────────────────────────────────────────
  if (state.status === "variants") {
    const { screenResults } = state;
    const multiScreen = screenResults.length > 1;
    const activeScreenResult = screenResults[activeScreenIdx] ?? null;
    const activeVariant = activeScreenResult?.variants[activeVariantIdx] ?? null;

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Screen tabs */}
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
              onClick={reset}
              className="ml-auto text-[11px] text-white/25 hover:text-white/50 transition-colors px-1"
            >
              ↺ 다시
            </button>
          </div>
        )}

        {/* Variant tabs */}
        <div className={`flex items-center gap-1 px-4 ${multiScreen ? "pt-2" : "pt-4"} pb-0 border-b border-[#1a1a1a]`}>
          {(activeScreenResult?.variants ?? []).map((_, i) => (
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
              onClick={reset}
              className="ml-auto text-[11px] text-white/25 hover:text-white/50 transition-colors px-1"
            >
              ↺ 다시
            </button>
          )}
        </div>

        {/* Changes */}
        {activeVariant && (
          <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0">
            <p className="text-[11px] font-medium text-white/50 mb-1.5">개선 내용</p>
            <ul className="space-y-0.5">
              {activeVariant.changes.map((c, i) => (
                <li key={i} className="text-[12px] text-[var(--muted)]">• {c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* iframe */}
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
        <div className="px-4 pb-4 flex gap-2 shrink-0">
          <button
            onClick={handleSavePng}
            disabled={savingPng}
            className="flex-1 py-2 rounded-md text-xs text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors disabled:opacity-50"
          >
            {savingPng ? "저장 중…" : "↓ PNG 저장"}
          </button>
          <button
            onClick={() => handleReanalyze(screenResults)}
            className="flex-1 py-2 rounded-md text-xs text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
          >
            → 재분석
          </button>
        </div>
      </div>
    );
  }

  // ── COMPARISON ────────────────────────────────────────────────────────────
  if (state.status === "comparison") {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <VersionComparison
          original={originalAnalysis}
          improved={state.improvedAnalysis}
        />
        <div className="p-5 border-t border-[#1a1a1a] mt-auto">
          <button
            onClick={nextRound}
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
