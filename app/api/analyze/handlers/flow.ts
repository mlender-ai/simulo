import { analyzeFlowWithClaude } from "@/lib/claude";
import type { HandlerResult, BaseHandlerParams } from "./types";

interface FlowStep {
  stepNumber: number;
  stepName: string;
  image: string;
}

interface FlowHandlerParams extends BaseHandlerParams {
  flowSteps: FlowStep[];
}

export async function handleFlowAnalysis(params: FlowHandlerParams): Promise<HandlerResult> {
  const { flowSteps, hypothesis, targetUser, task, locale, apiKey, model, mode, analysisOptions, screenDescription, ocrContext, productMode } = params;

  const result = await analyzeFlowWithClaude({
    flowSteps,
    hypothesis,
    targetUser,
    task,
    locale,
    apiKey,
    model,
    mode,
    analysisOptions,
    screenDescription,
    ocrContext,
    productMode,
  });

  return {
    result: result as Record<string, unknown>,
    thumbnailUrls: flowSteps.map((s) => `data:image/png;base64,${s.image}`),
    savedFlowSteps: flowSteps.map((s) => ({
      stepNumber: s.stepNumber,
      stepName: s.stepName,
      image: "",
    })),
    isComparison: false,
    comparisonData: null,
  };
}
