import { analyzeWithClaude } from "@/lib/claude";
import type { HandlerResult, BaseHandlerParams, UploadedVideo } from "./types";

interface ImageHandlerParams extends BaseHandlerParams {
  images: string[];
  videos?: UploadedVideo[];
}

export async function handleImageAnalysis(params: ImageHandlerParams): Promise<HandlerResult> {
  const { images, videos, hypothesis, targetUser, task, locale, apiKey, model, mode, analysisOptions, screenDescription, ocrContext } = params;

  const videoFrameImages: string[] = Array.isArray(videos)
    ? videos.flatMap((v) => v.frames.map((f) => f.base64))
    : [];
  const allImages = [...images, ...videoFrameImages];
  const hasVideos = videoFrameImages.length > 0;

  const videoContext = hasVideos
    ? "\n\nSome of the provided screens are extracted frames from a video recording of actual app usage. Frame names include timestamps (e.g. '프레임 1 (0:02)'). When analyzing video frames: note the temporal sequence of user interactions, identify moments where the user appears to pause or struggle, compare early frames vs later frames for flow continuity, and flag any frames showing loading states, error states, or unexpected transitions."
    : "";

  const result = await analyzeWithClaude({
    images: allImages,
    hypothesis,
    targetUser,
    task,
    locale,
    apiKey,
    model,
    mode,
    analysisOptions,
    screenDescription: (screenDescription || "") + videoContext,
    ocrContext,
    productMode: params.productMode,
  });

  return {
    result: result as Record<string, unknown>,
    thumbnailUrls: allImages.map((b64) => `data:image/png;base64,${b64}`),
    isComparison: false,
    comparisonData: null,
  };
}
