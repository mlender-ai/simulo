import { analyzeComparisonWithClaude } from "@/lib/claude";
import type { ComparisonProduct, AnalysisPerspectiveInput } from "@/lib/claude";
import type { HandlerResult, BaseHandlerParams, UploadedVideo } from "./types";

interface ComparisonProduct_ {
  productName: string;
  images: string[];
  videos?: UploadedVideo[];
  description?: string;
}

interface ComparisonHandlerParams extends BaseHandlerParams {
  ours: ComparisonProduct_;
  competitors: ComparisonProduct_[];
  comparisonFocus?: string;
  analysisPerspective?: AnalysisPerspectiveInput;
}

function mergeProductMedia(p: ComparisonProduct_): ComparisonProduct {
  return {
    productName: p.productName,
    description: p.description,
    images: [
      ...(p.images ?? []),
      ...(p.videos ?? []).flatMap((v) => v.frames.map((f) => f.base64)),
    ],
  };
}

export async function handleComparisonAnalysis(params: ComparisonHandlerParams): Promise<HandlerResult> {
  const { ours, competitors, comparisonFocus, hypothesis, targetUser, locale, apiKey, model, mode, analysisOptions, analysisPerspective } = params;

  const oursWithFrames = mergeProductMedia(ours);
  const competitorsWithFrames = competitors.map(mergeProductMedia);

  if (!oursWithFrames.productName || oursWithFrames.images.length === 0) {
    throw Object.assign(
      new Error("Our product requires productName and at least one image or video"),
      { status: 400 }
    );
  }
  if (competitorsWithFrames.length === 0) {
    throw Object.assign(new Error("At least one competitor is required"), { status: 400 });
  }
  for (const c of competitorsWithFrames) {
    if (!c.productName || c.images.length === 0) {
      throw Object.assign(
        new Error("Each competitor requires productName and at least one image or video"),
        { status: 400 }
      );
    }
  }

  console.log(
    "[analyze/comparison] ours:", oursWithFrames.productName,
    "| competitors:", competitorsWithFrames.map((c) => c.productName).join(", ")
  );

  const result = await analyzeComparisonWithClaude({
    ours: oursWithFrames,
    competitors: competitorsWithFrames,
    hypothesis,
    targetUser,
    comparisonFocus,
    locale,
    apiKey,
    model,
    analysisPerspective,
    mode,
    analysisOptions,
  });

  const r = result as Record<string, unknown>;
  const comparisonData = { ...r, mode };

  const thumbnailUrls = [
    ...oursWithFrames.images.map((b64) => `data:image/png;base64,${b64}`),
    ...competitorsWithFrames.flatMap((c) =>
      c.images.map((b64) => `data:image/png;base64,${b64}`)
    ),
  ];

  return {
    result: r,
    thumbnailUrls,
    isComparison: true,
    comparisonData,
  };
}
