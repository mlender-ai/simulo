import { analyzeWithClaude } from "@/lib/claude";
import type { HandlerResult, BaseHandlerParams } from "./types";

interface FigmaHandlerParams extends BaseHandlerParams {
  figmaToken: string;
  figmaFileKey: string;
  figmaFrameIds: string[];
}

export async function handleFigmaAnalysis(params: FigmaHandlerParams): Promise<HandlerResult> {
  const { figmaToken, figmaFileKey, figmaFrameIds, hypothesis, targetUser, task, locale, apiKey, model, mode, analysisOptions, screenDescription } = params;

  const ids = figmaFrameIds.join(",");
  const imgRes = await fetch(
    `https://api.figma.com/v1/images/${figmaFileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
    { headers: { "X-Figma-Token": figmaToken } }
  );

  if (!imgRes.ok) {
    const status = imgRes.status;
    throw Object.assign(new Error(`Figma image fetch failed (${status})`), { status });
  }

  const imgData = await imgRes.json();
  const imageUrls: string[] = figmaFrameIds
    .map((id) => imgData.images?.[id])
    .filter(Boolean);

  if (imageUrls.length === 0) {
    throw Object.assign(new Error("Failed to get frame images from Figma"), { status: 500 });
  }

  const base64Images: string[] = [];
  for (const url of imageUrls) {
    const imgFetch = await fetch(url);
    const buffer = Buffer.from(await imgFetch.arrayBuffer());
    base64Images.push(buffer.toString("base64"));
  }

  const result = await analyzeWithClaude({
    images: base64Images,
    hypothesis,
    targetUser,
    task,
    locale,
    apiKey,
    model,
    mode,
    analysisOptions,
    screenDescription,
  });

  return {
    result: result as Record<string, unknown>,
    thumbnailUrls: imageUrls,
    isComparison: false,
    comparisonData: null,
  };
}
