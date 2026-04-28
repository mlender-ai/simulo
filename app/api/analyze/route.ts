import { NextRequest, NextResponse } from "next/server";
import type { AnalysisMode, AnalysisOptions, ModelTier, AnalysisPerspectiveInput } from "@/lib/claude";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";
import { preprocessImages } from "@/lib/imagePreprocess";
import { extractTextFromImages, validateOCRResults, formatOCRForPrompt } from "@/lib/ocr";
import { resolvePlugin } from "./registry";
import { validateHandlerOutput } from "./outputSchema";
import { validateImages, validateFigmaInputs, validateFlowSteps, logPreflightWarnings } from "@/lib/preflight";

// Note: ANTHROPIC_API_KEY presence is validated at request time via resolveApiKey()

export async function POST(request: NextRequest) {
  try {
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
      screenDescription,
      analysisPerspective,
      mode: rawMode,
      analysisOptions: rawAnalysisOptions,
      ocrReview,
      previousAnalysisId,
      roundNumber: rawRoundNumber,
      isImprovement: rawIsImprovement,
      url: rawUrl,
    } = body;

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
    let ocrContext: string | undefined;
    const shouldRunOCR = inputType !== "comparison" && inputType !== "figma" && inputType !== "url" && images.length > 0;
    if (shouldRunOCR) {
      try {
        let finalOCR;
        if (ocrReview && Array.isArray(ocrReview) && ocrReview.length > 0) {
          console.log("[analyze] Using client-reviewed OCR results:", ocrReview.length, "screens");
          finalOCR = ocrReview;
        } else {
          console.log("[analyze] Pass 1: Preprocessing", images.length, "images");
          const processedImages = await preprocessImages(images);
          console.log("[analyze] Pass 2: OCR extraction with claude-opus-4-7");
          const rawOCR = await extractTextFromImages(processedImages, apiKey || process.env.ANTHROPIC_API_KEY);
          finalOCR = validateOCRResults(rawOCR);
        }
        ocrContext = formatOCRForPrompt(finalOCR, locale || "ko");
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
        }
      : {
          desireAlignment: rawAnalysisOptions?.desireAlignment ?? false,
          competitorComparison: rawAnalysisOptions?.competitorComparison ?? false,
          accessibility: rawAnalysisOptions?.accessibility ?? false,
        };

    const effectiveTargetUser: string = mode === "usability"
      ? (targetUser?.trim() || "40-60대 한국 여성 (야핏무브 핵심 타깃)")
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
      analysisPerspective: analysisPerspective as AnalysisPerspectiveInput | undefined,
      ocrContext,
    };

    // ── Route to input-type handler via plugin registry ──
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
    });

    const { result, thumbnailUrls, savedFlowSteps, isComparison, comparisonData } = handlerResult;

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

    // ── Persist to DB ──
    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db");
        await prisma.analysis.create({
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
        });
        console.log("[analyze] Saved to DB:", analysis.id);
      } catch (dbErr) {
        console.error("[analyze] DB save failed (non-fatal):", dbErr);
      }
    }

    console.log("[analyze] Success! Verdict:", topLevel.verdict, "Score:", topLevel.score);
    return NextResponse.json(analysis);
  } catch (error: unknown) {
    console.error("[analyze] ===== ERROR =====");
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      console.error("[analyze] status:", err.status, "| message:", err.message);
      console.error("[analyze] error:", JSON.stringify(err.error, null, 2));
    } else {
      console.error("[analyze] Raw error:", error);
    }

    let message = "Analysis failed";
    let status = 500;

    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
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
