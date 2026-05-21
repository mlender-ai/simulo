import { NextRequest, NextResponse } from "next/server";
import type { AnalysisMode, AnalysisOptions, ModelTier, AnalysisPerspectiveInput } from "@/lib/claude";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import { preprocessImages } from "@/lib/imagePreprocess";
import { extractTextFromImages, validateOCRResults, formatOCRForPrompt } from "@/lib/ocr";
import { resolvePlugin } from "./registry";
import { validateHandlerOutput } from "./outputSchema";
import { validateImages, validateFigmaInputs, validateFlowSteps, logPreflightWarnings } from "@/lib/preflight";
import { parseFrameworkResponse } from "@/lib/frameworks";
import { validateFrameworkIds } from "@/lib/prompts/heuristic";

// Note: ANTHROPIC_API_KEY presence is validated at request time via resolveApiKey()

export const maxDuration = 120;

type ProgressCallback = (step: string, detail?: string) => void;

export async function POST(request: NextRequest) {
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

  if (wantsStream) {
    return handleStreamingAnalysis(request);
  }

  return handleAnalysis(request);
}

async function handleStreamingAnalysis(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  const progress: ProgressCallback = async (step, detail) => {
    try { await sendEvent("progress", { step, detail }); } catch { /* client disconnected */ }
  };

  // Run analysis in background, piping events
  (async () => {
    try {
      const result = await runAnalysisPipeline(request, progress);
      // runAnalysisPipeline may return NextResponse (early error) or plain object (success)
      if (result instanceof Response) {
        const body = await result.json();
        if (body.error) {
          await sendEvent("error", { error: body.error });
        } else {
          await sendEvent("result", body);
        }
      } else {
        // Strip base64 image data from SSE to reduce payload size (200KB+ → ~2KB)
        const lightResult = { ...result as Record<string, unknown> };
        delete lightResult.thumbnailUrls;
        // Also strip thumbnailUrl from individual issues
        if (Array.isArray(lightResult.issues)) {
          lightResult.issues = (lightResult.issues as Record<string, unknown>[]).map(
            ({ thumbnailUrl, ...issue }) => { void thumbnailUrl; return issue; }
          );
        }
        await sendEvent("result", lightResult);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      await sendEvent("error", { error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleAnalysis(request: NextRequest) {
  try {
    const result = await runAnalysisPipeline(request);
    // runAnalysisPipeline may return NextResponse (early error) or plain object (success)
    if (result instanceof Response) return result;
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze] ===== ERROR =====");
    let message = "Analysis failed";
    let status = 500;
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      console.error("[analyze] status:", err.status, "| message:", err.message);
      if (err.status && typeof err.status === "number") status = err.status;
      if (err.message && typeof err.message === "string") message = err.message;
      if (err.error && typeof err.error === "object") {
        const innerError = err.error as Record<string, unknown>;
        if (innerError.message) message = `${status} ${JSON.stringify(err.error)}`;
      }
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status });
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noopProgress: ProgressCallback = (_step, _detail) => {};

async function runAnalysisPipeline(request: NextRequest, onProgress: ProgressCallback = noopProgress) {
    const body = await request.json();
    const {
      images: rawImages,
      videos,
      hypothesis,
      targetUser,
      task,
      projectTag,
      inputType,
      locale,
      apiKey,
      model,
      flowSteps,
      figmaToken,
      figmaFileKey,
      figmaFrameIds,
      ours,
      competitors,
      comparisonFocus,
      comparisonType: rawComparisonType,
      screenDescription,
      analysisPerspective,
      mode: rawMode,
      analysisOptions: rawAnalysisOptions,
      ocrReview,
      previousAnalysisId,
      roundNumber: rawRoundNumber,
      isImprovement: rawIsImprovement,
      url: rawUrl,
      productMode: rawProductMode,
      domain: rawDomain,
      domainFocuses: rawDomainFocuses,
      frameworks: rawFrameworks,
      focusKeyword: rawFocusKeyword,
    } = body;

    const productMode: "yafit" | "general" = rawProductMode === "general" ? "general" : "yafit";
    const domain: string | undefined = typeof rawDomain === "string" && rawDomain ? rawDomain : undefined;
    const domainFocuses: string[] | undefined = Array.isArray(rawDomainFocuses) && rawDomainFocuses.length > 0 ? rawDomainFocuses as string[] : undefined;

    const images: string[] = Array.isArray(rawImages) ? rawImages : [];

    const url: string | undefined = typeof rawUrl === "string" ? rawUrl : undefined;

    // ── Pre-flight validation ──
    if (inputType === "figma") {
      const pf = validateFigmaInputs(figmaToken, figmaFileKey, figmaFrameIds);
      logPreflightWarnings(pf.warnings, "figma");
      if (!pf.ok) {
        return NextResponse.json({ error: pf.errors[0].message, details: pf.errors }, { status: 400 });
      }
    } else if (inputType === "flow") {
      const pf = validateFlowSteps(flowSteps);
      logPreflightWarnings(pf.warnings, "flow");
      if (!pf.ok) {
        return NextResponse.json({ error: pf.errors[0].message, details: pf.errors }, { status: 400 });
      }
    } else if (inputType === "url") {
      if (!url) {
        return NextResponse.json({ error: "URL이 필요합니다" }, { status: 400 });
      }
    } else if (inputType !== "comparison") {
      const pf = validateImages(images);
      logPreflightWarnings(pf.warnings, "image");
      if (!pf.ok) {
        return NextResponse.json({ error: pf.errors[0].message, details: pf.errors }, { status: 400 });
      }
    }

    // ── OCR pipeline (Skip for comparison/figma) ──
    await onProgress("입력 검증 완료", `${inputType || "image"} 모드`);

    let ocrContext: string | undefined;
    // 서버 키만 사용하는 경우 (무료 모드) OCR 스킵 — Vercel Hobby 10초 제한 대응
    const usingServerKey = !apiKey && !!process.env.ANTHROPIC_API_KEY;
    const shouldRunOCR = !usingServerKey && inputType !== "comparison" && inputType !== "figma" && inputType !== "url" && images.length > 0;
    if (shouldRunOCR) {
      try {
        let finalOCR;
        if (ocrReview && Array.isArray(ocrReview) && ocrReview.length > 0) {
          console.log("[analyze] Using client-reviewed OCR results:", ocrReview.length, "screens");
          finalOCR = ocrReview;
        } else {
          await onProgress("화면 텍스트 추출 중", `${images.length}개 이미지 OCR 분석`);
          console.log("[analyze] Pass 1: Preprocessing", images.length, "images");
          const processedImages = await preprocessImages(images);
          console.log("[analyze] Pass 2: OCR extraction with claude-opus-4-7");
          const rawOCR = await extractTextFromImages(processedImages, apiKey || process.env.ANTHROPIC_API_KEY, productMode);
          finalOCR = validateOCRResults(rawOCR, productMode);
        }
        ocrContext = formatOCRForPrompt(finalOCR, locale || "ko");
        await onProgress("텍스트 추출 완료", `${ocrContext.length}자 컨텍스트 확보`);
        console.log("[analyze] OCR context ready:", ocrContext.slice(0, 120));
      } catch (ocrErr) {
        console.warn("[analyze] OCR pass failed (non-fatal):", ocrErr);
      }
    }

    const mode: AnalysisMode = rawMode === "usability" ? "usability" : "hypothesis";
    const analysisOptions: AnalysisOptions = mode === "usability"
      ? {
          usability: true,
          desireAlignment: rawAnalysisOptions?.desireAlignment ?? true,
          competitorComparison: rawAnalysisOptions?.competitorComparison ?? false,
          accessibility: rawAnalysisOptions?.accessibility ?? false,
          frameworks: validateFrameworkIds(rawFrameworks),
        }
      : {
          desireAlignment: rawAnalysisOptions?.desireAlignment ?? false,
          competitorComparison: rawAnalysisOptions?.competitorComparison ?? false,
          accessibility: rawAnalysisOptions?.accessibility ?? false,
          frameworks: validateFrameworkIds(rawFrameworks),
        };

    const effectiveTargetUser: string = mode === "usability"
      ? (targetUser?.trim() || (productMode === "yafit" ? "40-60대 한국 여성 (야핏무브 핵심 타깃)" : "일반 사용자"))
      : (targetUser as string);

    if (mode === "hypothesis" && (!hypothesis || !targetUser)) {
      return NextResponse.json(
        { error: "Hypothesis and target user are required" },
        { status: 400 }
      );
    }

    const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY;
    console.log("[analyze] inputType:", inputType || "image", "| key prefix:", effectiveKey?.slice(0, 10) || "(none)", "| model:", model || "haiku");

    const baseParams = {
      hypothesis,
      targetUser: effectiveTargetUser,
      task,
      locale,
      apiKey,
      model: model as ModelTier | undefined,
      mode,
      analysisOptions,
      screenDescription,
      productDescriptionImages: Array.isArray(body.productDescriptionImages) && body.productDescriptionImages.length > 0
        ? body.productDescriptionImages as string[]
        : undefined,
      analysisPerspective: analysisPerspective as AnalysisPerspectiveInput | undefined,
      ocrContext,
      productMode,
      domain,
      domainFocuses,
      focusKeyword: typeof rawFocusKeyword === "string" && rawFocusKeyword.trim() ? rawFocusKeyword.trim() : undefined,
    };

    // ── Route to input-type handler via plugin registry ──
    const comparisonType: "competitor" | "variant" = rawComparisonType === "variant" ? "variant" : "competitor";

    const plugin = resolvePlugin({
      images,
      videos,
      inputType,
      url,
      flowSteps,
      figmaToken,
      figmaFileKey,
      figmaFrameIds,
      ours,
      competitors,
      comparisonFocus,
    });

    if (!plugin) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    console.log("[analyze] Dispatching to plugin:", plugin.id);
    await onProgress("AI 분석 시작", `${plugin.id} 핸들러 실행 중`);
    const handlerResult = await plugin.handle(baseParams, {
      images,
      videos,
      inputType,
      url,
      flowSteps,
      figmaToken,
      figmaFileKey,
      figmaFrameIds,
      ours,
      competitors,
      comparisonFocus,
      comparisonType,
    });

    const { result, thumbnailUrls, savedFlowSteps, isComparison, comparisonData } = handlerResult;
    await onProgress("AI 분석 완료", "리포트 구성 중");

    // ── Output schema validation ──
    const validation = validateHandlerOutput(result, isComparison);
    if (!validation.ok) {
      console.warn(`[analyze] Handler "${plugin.id}" output schema mismatch:`, validation.errors);
      // Non-fatal: log but proceed — the report page handles missing fields gracefully
    }

    const r = result;

    // ── Normalize top-level fields ──
    let topLevel: {
      verdict: string;
      score: number;
      taskSuccessLikelihood?: string;
      taskSuccessReason?: string;
      summary: string;
      strengths?: string[];
      thinkAloud?: unknown[];
      issues?: unknown[];
      scoreBreakdown?: unknown;
      verdictReason?: string;
      flowAnalysis?: unknown;
      adFriction?: unknown;
      evidenceFor?: string[];
      evidenceAgainst?: string[];
      confidence?: string;
      confidenceReason?: string;
    };

    if (isComparison) {
      const products = (Array.isArray(r.products) ? r.products : []) as Array<{
        productName: string;
        verdict: string;
        score: number;
        summary?: string;
      }>;
      const comparison = (r.comparison ?? {}) as { winnerReason?: string };
      const ourProduct = products[0] || { productName: "", verdict: "Partial", score: 0, summary: "" };
      topLevel = {
        verdict: String(ourProduct.verdict ?? "Partial"),
        score: Number(ourProduct.score ?? 0),
        summary: comparison.winnerReason || String(ourProduct.summary ?? ""),
        strengths: [],
        thinkAloud: [],
        issues: [],
      };
    } else {
      const issuesWithImages = Array.isArray(r.issues)
        ? (r.issues as Array<{ screenIndex?: number; heatZone?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown; label?: unknown } | null; [key: string]: unknown }>).map((issue) => {
            // Normalize heatZone coordinates: clamp to [0,100] and enforce minimum size
            let heatZone = issue.heatZone ?? null;
            if (heatZone && typeof heatZone === "object") {
              const x = Math.max(0, Math.min(Number(heatZone.x ?? 0), 97));
              const y = Math.max(0, Math.min(Number(heatZone.y ?? 0), 97));
              const width = Math.max(4, Math.min(Number(heatZone.width ?? 4), 100 - x));
              const height = Math.max(3, Math.min(Number(heatZone.height ?? 3), 100 - y));
              heatZone = { ...heatZone, x, y, width, height };
            }
            return {
              ...issue,
              heatZone,
              thumbnailUrl:
                typeof issue.screenIndex === "number" && thumbnailUrls[issue.screenIndex]
                  ? thumbnailUrls[issue.screenIndex]
                  : null,
            };
          })
        : (r.issues as unknown[]);

      if (mode === "usability") {
        topLevel = {
          verdict: String(r.grade ?? "개선 필요"),
          score: Number(r.score ?? 0),
          summary: String(r.summary ?? ""),
          strengths: r.strengths as string[] | undefined,
          thinkAloud: [],
          issues: issuesWithImages,
          scoreBreakdown: r.scoreBreakdown,
        };
      } else {
        topLevel = {
          verdict: String(r.verdict ?? "Partial"),
          score: Number(r.score ?? 0),
          taskSuccessLikelihood: r.taskSuccessLikelihood as string | undefined,
          taskSuccessReason: r.taskSuccessReason as string | undefined,
          summary: String(r.summary ?? ""),
          strengths: r.strengths as string[] | undefined,
          thinkAloud: r.thinkAloud as unknown[] | undefined,
          issues: issuesWithImages,
          scoreBreakdown: r.scoreBreakdown,
          verdictReason: r.verdictReason as string | undefined,
          flowAnalysis: r.flowAnalysis,
          adFriction: r.adFriction,
          evidenceFor: r.evidenceFor as string[] | undefined,
          evidenceAgainst: r.evidenceAgainst as string[] | undefined,
          confidence: r.confidence as string | undefined,
          confidenceReason: r.confidenceReason as string | undefined,
        };
      }
    }

    const usabilityResultBundle = mode === "usability"
      ? {
          options: analysisOptions,
          result: {
            grade: r.grade ?? null,
            quickWins: r.quickWins ?? [],
            desireAlignment: r.desireAlignment ?? null,
            accessibility4050: r.accessibility4050 ?? null,
            retentionRisk: r.retentionRisk ?? null,
          },
        }
      : null;

    const roundNumber = typeof rawRoundNumber === "number" ? rawRoundNumber : 1;
    const isImprovement = rawIsImprovement === true;

    // ── Framework heuristic results (opt-in) ──
    const activeFrameworks = analysisOptions.frameworks ?? [];
    const frameworkResults = activeFrameworks.length > 0
      ? parseFrameworkResponse(
          typeof r._rawText === "string" ? r._rawText : JSON.stringify(r),
          activeFrameworks,
        )
      : [];

    const analysis = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      hypothesis: mode === "usability" ? "" : hypothesis,
      targetUser: effectiveTargetUser,
      task: task || null,
      projectTag: projectTag || null,
      inputType: inputType || "image",
      mode,
      previousAnalysisId: previousAnalysisId || null,
      roundNumber,
      isImprovement,
      verdict: topLevel.verdict,
      score: topLevel.score,
      taskSuccessLikelihood: topLevel.taskSuccessLikelihood,
      taskSuccessReason: topLevel.taskSuccessReason,
      summary: topLevel.summary,
      strengths: topLevel.strengths,
      thinkAloud: topLevel.thinkAloud,
      issues: topLevel.issues,
      thumbnailUrls,
      ...(topLevel.scoreBreakdown ? { scoreBreakdown: topLevel.scoreBreakdown } : {}),
      ...(topLevel.verdictReason ? { verdictReason: topLevel.verdictReason } : {}),
      ...(topLevel.flowAnalysis ? { flowAnalysis: topLevel.flowAnalysis } : {}),
      ...(topLevel.adFriction ? { adFriction: topLevel.adFriction } : {}),
      ...(topLevel.evidenceFor ? { evidenceFor: topLevel.evidenceFor } : {}),
      ...(topLevel.evidenceAgainst ? { evidenceAgainst: topLevel.evidenceAgainst } : {}),
      ...(topLevel.confidence ? { confidence: topLevel.confidence } : {}),
      ...(topLevel.confidenceReason ? { confidenceReason: topLevel.confidenceReason } : {}),
      ...(savedFlowSteps ? { flowSteps: savedFlowSteps } : {}),
      ...(isComparison ? { isComparison: true, comparisonData } : {}),
      ...(frameworkResults.length > 0 ? { frameworkResults } : {}),
      ...(mode === "usability"
        ? {
            analysisOptions: usabilityResultBundle,
            grade: r.grade ?? null,
            quickWins: r.quickWins ?? [],
            desireAlignment: r.desireAlignment ?? null,
            accessibility4050: r.accessibility4050 ?? null,
            retentionRisk: r.retentionRisk ?? null,
          }
        : {}),
    };

    await onProgress("리포트 생성 완료", `점수: ${topLevel.score}`);
    console.log("[analyze] Success! Verdict:", topLevel.verdict, "Score:", topLevel.score);

    // ── Persist to DB (non-blocking — don't delay response) ──
    if (process.env.DATABASE_URL) {
      import("@/lib/db").then(({ prisma }) =>
        prisma.analysis.create({
          data: {
            id: analysis.id,
            createdAt: new Date(analysis.createdAt),
            hypothesis: analysis.hypothesis,
            targetUser: analysis.targetUser,
            task: analysis.task,
            projectTag: analysis.projectTag,
            inputType: analysis.inputType,
            mode: analysis.mode,
            analysisOptions: usabilityResultBundle
              ? (usabilityResultBundle as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            verdict: analysis.verdict,
            score: analysis.score,
            taskSuccessLikelihood: analysis.taskSuccessLikelihood,
            taskSuccessReason: analysis.taskSuccessReason,
            summary: analysis.summary,
            strengths: (analysis.strengths as string[] | undefined) ?? [],
            thinkAloud: (analysis.thinkAloud as object[] | undefined) ?? [],
            issues: (analysis.issues as object[] | undefined) ?? [],
            thumbnailUrls: analysis.thumbnailUrls,
            scoreBreakdown: isComparison ? Prisma.JsonNull : ((r.scoreBreakdown as Prisma.InputJsonValue) ?? Prisma.JsonNull),
            verdictReason: isComparison ? null : ((r.verdictReason as string) ?? null),
            flowAnalysis: isComparison ? Prisma.JsonNull : ((r.flowAnalysis as Prisma.InputJsonValue) ?? Prisma.JsonNull),
            flowSteps: savedFlowSteps ? (savedFlowSteps as Prisma.InputJsonValue) : Prisma.JsonNull,
            isComparison,
            comparisonData: (comparisonData as object) ?? null,
            previousAnalysisId: analysis.previousAnalysisId,
            roundNumber: analysis.roundNumber,
            isImprovement: analysis.isImprovement,
          },
        })
        .then(() => console.log("[analyze] Saved to DB:", analysis.id))
        .catch((dbErr: unknown) => console.error("[analyze] DB save failed (non-fatal):", dbErr))
      );
    }

    return analysis;
}
