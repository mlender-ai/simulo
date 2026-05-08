"use client";

import { useReducer, useRef, useCallback, useEffect } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { getProductMode } from "@/lib/productMode";
import type { PanelState, ScreenResult, ImproveResult, GenerateOptions } from "./types";

// ── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "GENERATE_START"; total: number }
  | { type: "GENERATE_SCREEN_START"; screenLabel: string }
  | { type: "GENERATE_SCREEN_DONE" }
  | { type: "GENERATE_COMPLETE"; screenResults: ScreenResult[] }
  | { type: "REANALYZE_START" }
  | { type: "REANALYZE_COMPLETE"; improvedAnalysis: AnalysisResult; screenResults: ScreenResult[] }
  | { type: "ERROR"; message: string; prev: PanelState["status"] }
  | { type: "CANCEL" }
  | { type: "RESET" };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: PanelState, action: Action): PanelState {
  switch (action.type) {
    case "GENERATE_START":
      return { status: "generating", total: action.total, done: 0, screenLabel: "" };

    case "GENERATE_SCREEN_START":
      if (state.status !== "generating") return state;
      return { ...state, screenLabel: action.screenLabel };

    case "GENERATE_SCREEN_DONE":
      if (state.status !== "generating") return state;
      return { ...state, done: state.done + 1 };

    case "GENERATE_COMPLETE":
      return { status: "variants", screenResults: action.screenResults };

    case "REANALYZE_START":
      return { status: "reanalyzing" };

    case "REANALYZE_COMPLETE":
      return {
        status: "comparison",
        screenResults: action.screenResults,
        improvedAnalysis: action.improvedAnalysis,
      };

    case "ERROR":
      return { status: "error", prev: action.prev, message: action.message };

    case "CANCEL":
      return { status: "idle" };

    case "RESET":
      return { status: "idle" };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useImprovementMachine(
  originalAnalysis: AnalysisResult,
  roundNumber: number,
  onNextRound?: (newRound: number) => void,
) {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  // Mutex: blocks concurrent generate/reanalyze calls
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Generate single screen variants ────────────────────────────────────────

  const generateForScreen = useCallback(
    async (screenIndex: number, opts: GenerateOptions, signal?: AbortSignal): Promise<ImproveResult[]> => {
      const results: ImproveResult[] = [];
      for (let i = 0; i < opts.variantCount; i++) {
        const res = await fetch("/api/generate-improvement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            analysisId: originalAnalysis.id,
            analysis: {
              score: originalAnalysis.score,
              issues: originalAnalysis.issues,
              thumbnailUrls: originalAnalysis.thumbnailUrls,
              analysisOptions: originalAnalysis.analysisOptions,
            },
            options: {
              criticalOnly: opts.optCriticalOnly,
              desireAlignment: opts.optDesireAlignment,
              restructureLayout: opts.optRestructureLayout,
              targetScore: opts.targetScore,
              variantIndex: i,
            },
            screenIndex,
            description: opts.description.trim() || undefined,
            referenceImages: opts.referenceImages.length > 0 ? opts.referenceImages : undefined,
            roundNumber,
            productMode: getProductMode(),
            apiKey: localStorage.getItem("simulo_anthropic_key") || undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || `시안 ${i + 1} 생성 실패 (${res.status})`);
        }
        const data: ImproveResult = await res.json();
        results.push(data);
        dispatch({ type: "GENERATE_SCREEN_DONE" });
      }
      return results;
    },
    [originalAnalysis, roundNumber],
  );

  // ── Generate (single or all screens) ───────────────────────────────────────

  const generate = useCallback(
    async (opts: GenerateOptions) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const ac = new AbortController();
      abortRef.current = ac;

      const thumbnailUrls = originalAnalysis.thumbnailUrls ?? [];
      const screensToGenerate: number[] =
        opts.selectedScreenMode === "all"
          ? thumbnailUrls.map((_, i) => i)
          : [opts.selectedScreenMode as number];

      const total = screensToGenerate.length * opts.variantCount;
      dispatch({ type: "GENERATE_START", total });

      const newScreenResults: ScreenResult[] = [];

      for (const screenIndex of screensToGenerate) {
        const label = thumbnailUrls.length > 1 ? `화면 ${screenIndex + 1}` : "화면";
        dispatch({ type: "GENERATE_SCREEN_START", screenLabel: label });
        try {
          const variants = await generateForScreen(screenIndex, opts, ac.signal);
          newScreenResults.push({ screenIndex, screenLabel: label, variants });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            busyRef.current = false;
            abortRef.current = null;
            return;
          }
          dispatch({
            type: "ERROR",
            message: err instanceof Error ? err.message : `${label} 생성 실패`,
            prev: "generating",
          });
          busyRef.current = false;
          abortRef.current = null;
          return;
        }
      }

      dispatch({ type: "GENERATE_COMPLETE", screenResults: newScreenResults });
      busyRef.current = false;
      abortRef.current = null;
    },
    [originalAnalysis, generateForScreen],
  );

  // ── Re-analyze ─────────────────────────────────────────────────────────────

  const reanalyze = useCallback(
    async (capturedImage: string, screenResults: ScreenResult[]) => {
      if (busyRef.current) return;
      busyRef.current = true;
      dispatch({ type: "REANALYZE_START" });

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
        dispatch({ type: "REANALYZE_COMPLETE", improvedAnalysis: improved, screenResults });
      } catch (err) {
        dispatch({
          type: "ERROR",
          message: err instanceof Error ? err.message : "재분석 실패",
          prev: "reanalyzing",
        });
      } finally {
        busyRef.current = false;
      }
    },
    [originalAnalysis, roundNumber],
  );

  // ── Cancel ──────────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    dispatch({ type: "CANCEL" });
  }, []);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Reset (다시 / 다음 라운드) ─────────────────────────────────────────────

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const nextRound = useCallback(() => {
    dispatch({ type: "RESET" });
    onNextRound?.(roundNumber + 1);
  }, [onNextRound, roundNumber]);

  return { state, generate, reanalyze, cancel, reset, nextRound, isBusy: busyRef };
}
