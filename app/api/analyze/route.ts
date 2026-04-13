import { NextRequest, NextResponse } from "next/server";
import { analyzeWithClaude, analyzeFlowWithClaude, analyzeComparisonWithClaude } from "@/lib/claude";
import type { ComparisonProduct } from "@/lib/claude";
import { v4 as uuidv4 } from "uuid";

console.log("[analyze] ENV ANTHROPIC_API_KEY prefix:", process.env.ANTHROPIC_API_KEY?.slice(0, 8) || "(not set)");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      images,
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
    } = body;

    if (!hypothesis || !targetUser) {
      return NextResponse.json(
        { error: "Hypothesis and target user are required" },
        { status: 400 }
      );
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
      if (!ours.productName || !Array.isArray(ours.images) || ours.images.length === 0) {
        return NextResponse.json(
          { error: "Our product requires productName and at least one image" },
          { status: 400 }
        );
      }
      if (competitors.length === 0) {
        return NextResponse.json(
          { error: "At least one competitor is required" },
          { status: 400 }
        );
      }
      for (const c of competitors as ComparisonProduct[]) {
        if (!c.productName || !Array.isArray(c.images) || c.images.length === 0) {
          return NextResponse.json(
            { error: "Each competitor requires productName and at least one image" },
            { status: 400 }
          );
        }
      }

      console.log(
        "[analyze] Comparison analysis | ours:",
        ours.productName,
        "| competitors:",
        competitors.map((c: ComparisonProduct) => c.productName).join(", ")
      );

      result = await analyzeComparisonWithClaude({
        ours: ours as ComparisonProduct,
        competitors: competitors as ComparisonProduct[],
        hypothesis,
        targetUser,
        comparisonFocus,
        locale,
        apiKey,
        model,
      });

      isComparison = true;
      comparisonData = result;
      thumbnailUrls = [
        ...(ours.images as string[]).map((b64: string) => `data:image/png;base64,${b64}`),
        ...competitors.flatMap((c: ComparisonProduct) =>
          c.images.map((b64: string) => `data:image/png;base64,${b64}`)
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
        targetUser,
        task,
        locale,
        apiKey,
        model,
      });
      thumbnailUrls = imageUrls;
    } else if (inputType === "flow" && flowSteps && flowSteps.length >= 2) {
      console.log("[analyze] Flow analysis with", flowSteps.length, "steps");
      result = await analyzeFlowWithClaude({
        flowSteps,
        hypothesis,
        targetUser,
        task,
        locale,
        apiKey,
        model,
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
      console.log("[analyze] Image analysis with", images.length, "images");
      result = await analyzeWithClaude({
        images,
        hypothesis,
        targetUser,
        task,
        locale,
        apiKey,
        model,
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
    };

    if (isComparison) {
      const products = (result.products || []) as Array<{
        productName: string;
        verdict: string;
        score: number;
        summary?: string;
      }>;
      const ourProduct = products[0] || { productName: "", verdict: "Partial", score: 0, summary: "" };
      topLevel = {
        verdict: ourProduct.verdict,
        score: ourProduct.score,
        summary: result.comparison?.winnerReason || ourProduct.summary || "",
      };
    } else {
      // Map each issue's screenIndex to the corresponding thumbnail URL
      const issuesWithImages = Array.isArray(result.issues)
        ? result.issues.map((issue: { screenIndex?: number; [key: string]: unknown }) => ({
            ...issue,
            thumbnailUrl:
              typeof issue.screenIndex === "number" && thumbnailUrls[issue.screenIndex]
                ? thumbnailUrls[issue.screenIndex]
                : null,
          }))
        : result.issues;

      topLevel = {
        verdict: result.verdict,
        score: result.score,
        taskSuccessLikelihood: result.taskSuccessLikelihood,
        taskSuccessReason: result.taskSuccessReason,
        summary: result.summary,
        strengths: result.strengths,
        thinkAloud: result.thinkAloud,
        issues: issuesWithImages,
        scoreBreakdown: result.scoreBreakdown,
        verdictReason: result.verdictReason,
        flowAnalysis: result.flowAnalysis,
      };
    }

    const analysis = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      hypothesis,
      targetUser,
      task: task || null,
      projectTag: projectTag || null,
      inputType: inputType || "image",
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
      ...(savedFlowSteps ? { flowSteps: savedFlowSteps } : {}),
      ...(isComparison ? { isComparison: true, comparisonData } : {}),
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
            verdict: analysis.verdict,
            score: analysis.score,
            taskSuccessLikelihood: analysis.taskSuccessLikelihood,
            taskSuccessReason: analysis.taskSuccessReason,
            summary: analysis.summary,
            strengths: (analysis.strengths as string[] | undefined) ?? [],
            thinkAloud: (analysis.thinkAloud as object[] | undefined) ?? [],
            issues: (analysis.issues as object[] | undefined) ?? [],
            thumbnailUrls: analysis.thumbnailUrls,
            scoreBreakdown: isComparison ? null : (result.scoreBreakdown ?? null),
            verdictReason: isComparison ? null : (result.verdictReason ?? null),
            flowAnalysis: isComparison ? null : (result.flowAnalysis ?? null),
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
