import { NextRequest, NextResponse } from "next/server";
import { analyzeWithClaude, analyzeFlowWithClaude, analyzeComparisonWithClaude } from "@/lib/claude";
import type { ComparisonProduct, AnalysisMode, AnalysisOptions } from "@/lib/claude";
import { v4 as uuidv4 } from "uuid";
import { Prisma } from "@prisma/client";

interface VideoFrame { base64: string; name: string; timestamp: number; index: number; }
interface UploadedVideo { fileName: string; duration: number; frameCount: number; interval: number; frames: VideoFrame[]; }

console.log("[analyze] ENV ANTHROPIC_API_KEY prefix:", process.env.ANTHROPIC_API_KEY?.slice(0, 8) || "(not set)");

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
    } = body;

    // Merge video frames into images array
    const videoFrameImages: string[] = Array.isArray(videos)
      ? (videos as UploadedVideo[]).flatMap((v) => v.frames.map((f) => f.base64))
      : [];
    const images: string[] = [...(Array.isArray(rawImages) ? rawImages : []), ...videoFrameImages];
    const hasVideos = videoFrameImages.length > 0;

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

    const effectiveTargetUser = mode === "usability"
      ? (targetUser?.trim() || "40-50대 한국 여성 (야핏무브 핵심 타깃)")
      : targetUser;

    if (mode === "hypothesis") {
      if (!hypothesis || !targetUser) {
        return NextResponse.json(
          { error: "Hypothesis and target user are required" },
          { status: 400 }
        );
      }
    }

    const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY;
    console.log("[analyze] Request received | inputType:", inputType || "image");
    console.log("[analyze] Effective key prefix:", effectiveKey?.slice(0, 10) || "(none)", "| Model:", model || "haiku");

    let result;
    let thumbnailUrls: string[] = [];
    let savedFlowSteps = undefined;
    let isComparison = false;
    let comparisonData: unknown = null;

    if (inputType === "comparison" && ours && Array.isArray(competitors)) {
      // Merge video frames into each product's images
      const mergeProductMedia = (p: { productName: string; images: string[]; videos?: UploadedVideo[]; description?: string }): ComparisonProduct => ({
        productName: p.productName,
        description: p.description,
        images: [
          ...(p.images ?? []),
          ...(p.videos ?? []).flatMap((v) => v.frames.map((f) => f.base64)),
        ],
      });

      const oursWithFrames = mergeProductMedia(ours as { productName: string; images: string[]; videos?: UploadedVideo[]; description?: string });
      const competitorsWithFrames = (competitors as Array<{ productName: string; images: string[]; videos?: UploadedVideo[]; description?: string }>).map(mergeProductMedia);

      if (!oursWithFrames.productName || oursWithFrames.images.length === 0) {
        return NextResponse.json(
          { error: "Our product requires productName and at least one image or video" },
          { status: 400 }
        );
      }
      if (competitorsWithFrames.length === 0) {
        return NextResponse.json(
          { error: "At least one competitor is required" },
          { status: 400 }
        );
      }
      for (const c of competitorsWithFrames) {
        if (!c.productName || c.images.length === 0) {
          return NextResponse.json(
            { error: "Each competitor requires productName and at least one image or video" },
            { status: 400 }
          );
        }
      }

      console.log(
        "[analyze] Comparison analysis | ours:",
        oursWithFrames.productName,
        "| competitors:",
        competitorsWithFrames.map((c) => c.productName).join(", ")
      );

      result = await analyzeComparisonWithClaude({
        ours: oursWithFrames,
        competitors: competitorsWithFrames,
        hypothesis,
        targetUser: effectiveTargetUser,
        comparisonFocus,
        locale,
        apiKey,
        model,
        analysisPerspective,
        mode,
        analysisOptions,
      });

      isComparison = true;
      comparisonData = { ...(result as Record<string, unknown>), mode };
      thumbnailUrls = [
        ...oursWithFrames.images.map((b64) => `data:image/png;base64,${b64}`),
        ...competitorsWithFrames.flatMap((c) =>
          c.images.map((b64) => `data:image/png;base64,${b64}`)
        ),
      ];
    } else if (inputType === "figma" && figmaToken && figmaFileKey && figmaFrameIds?.length > 0) {
      console.log("[analyze] Figma analysis with", figmaFrameIds.length, "frames");

      const ids = figmaFrameIds.join(",");
      const imgRes = await fetch(
        `https://api.figma.com/v1/images/${figmaFileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
        { headers: { "X-Figma-Token": figmaToken } }
      );

      if (!imgRes.ok) {
        const status = imgRes.status;
        return NextResponse.json({ error: `Figma image fetch failed (${status})` }, { status });
      }

      const imgData = await imgRes.json();
      const imageUrls: string[] = figmaFrameIds
        .map((id: string) => imgData.images?.[id])
        .filter(Boolean);

      if (imageUrls.length === 0) {
        return NextResponse.json({ error: "Failed to get frame images from Figma" }, { status: 500 });
      }

      const base64Images: string[] = [];
      for (const url of imageUrls) {
        const imgFetch = await fetch(url);
        const buffer = Buffer.from(await imgFetch.arrayBuffer());
        base64Images.push(buffer.toString("base64"));
      }

      console.log("[analyze] Fetched", base64Images.length, "Figma frame images");

      result = await analyzeWithClaude({
        images: base64Images,
        hypothesis,
        targetUser: effectiveTargetUser,
        task,
        locale,
        apiKey,
        model,
        mode,
        analysisOptions,
        screenDescription,
      });
      thumbnailUrls = imageUrls;
    } else if (inputType === "flow" && flowSteps && flowSteps.length >= 2) {
      console.log("[analyze] Flow analysis with", flowSteps.length, "steps");
      result = await analyzeFlowWithClaude({
        flowSteps,
        hypothesis,
        targetUser: effectiveTargetUser,
        task,
        locale,
        apiKey,
        model,
        mode,
        analysisOptions,
        screenDescription,
      });
      thumbnailUrls = flowSteps.map((s: { image: string }) => `data:image/png;base64,${s.image}`);
      savedFlowSteps = flowSteps.map((s: { stepNumber: number; stepName: string }) => ({
        stepNumber: s.stepNumber,
        stepName: s.stepName,
        image: "",
      }));
    } else {
      if (!images || images.length === 0) {
        return NextResponse.json(
          { error: "At least one image is required" },
          { status: 400 }
        );
      }
      console.log("[analyze] Image analysis with", images.length, "images (includes video frames:", videoFrameImages.length, ")");
      const videoContext = hasVideos
        ? "\n\nSome of the provided screens are extracted frames from a video recording of actual app usage. Frame names include timestamps (e.g. '프레임 1 (0:02)'). When analyzing video frames: note the temporal sequence of user interactions, identify moments where the user appears to pause or struggle, compare early frames vs later frames for flow continuity, and flag any frames showing loading states, error states, or unexpected transitions."
        : "";
      result = await analyzeWithClaude({
        images,
        hypothesis,
        targetUser: effectiveTargetUser,
        task,
        locale,
        apiKey,
        model,
        mode,
        analysisOptions,
        screenDescription: (screenDescription || "") + videoContext,
      });
      thumbnailUrls = images.map((b64: string) => `data:image/png;base64,${b64}`);
    }

    // For comparison: derive top-level summary/verdict/score from the winning product
    // so history cards and list views keep working with existing fields.
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
    };

    // Cast to a loose shape so field access is typed throughout this block
    const r = result as Record<string, unknown>;

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
        // Comparison analyses don't have top-level issues/strengths/thinkAloud —
        // always set to empty arrays so storage.save() never crashes on .map()
        strengths: [],
        thinkAloud: [],
        issues: [],
      };
    } else {
      // Map each issue's screenIndex to the corresponding thumbnail URL
      const issuesWithImages = Array.isArray(r.issues)
        ? (r.issues as Array<{ screenIndex?: number; [key: string]: unknown }>).map((issue) => ({
            ...issue,
            thumbnailUrl:
              typeof issue.screenIndex === "number" && thumbnailUrls[issue.screenIndex]
                ? thumbnailUrls[issue.screenIndex]
                : null,
          }))
        : (r.issues as unknown[]);

      if (mode === "usability") {
        // Usability mode has no verdict/taskSuccess/thinkAloud/verdictReason.
        // Map grade into the verdict slot so history cards keep working.
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
        };
      }
    }

    // For usability mode, bundle user-selected options + non-column result fields
    // into analysisOptions (single JSON column per the schema addition in Step 7).
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

    const analysis = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      hypothesis: mode === "usability" ? "" : hypothesis,
      targetUser: effectiveTargetUser,
      task: task || null,
      projectTag: projectTag || null,
      inputType: inputType || "image",
      mode,
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

    // Persist to DB if configured
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
            flowSteps: savedFlowSteps ?? null,
            isComparison,
            comparisonData: (comparisonData as object) ?? null,
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
