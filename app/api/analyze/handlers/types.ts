import type { AnalysisMode, AnalysisOptions, ModelTier, AnalysisPerspectiveInput } from "@/lib/claude";

export interface VideoFrame {
  base64: string;
  name: string;
  timestamp: number;
  index: number;
}

export interface UploadedVideo {
  fileName: string;
  duration: number;
  frameCount: number;
  interval: number;
  frames: VideoFrame[];
}

export interface HandlerResult {
  result: Record<string, unknown>;
  thumbnailUrls: string[];
  savedFlowSteps?: { stepNumber: number; stepName: string; image: string }[];
  isComparison: boolean;
  comparisonData: unknown;
}

export interface BaseHandlerParams {
  hypothesis?: string;
  targetUser: string;
  task?: string;
  locale?: string;
  apiKey?: string;
  model?: ModelTier;
  mode: AnalysisMode;
  analysisOptions: AnalysisOptions;
  screenDescription?: string;
  analysisPerspective?: AnalysisPerspectiveInput;
  ocrContext?: string;
  productMode?: "yafit" | "general";
}
