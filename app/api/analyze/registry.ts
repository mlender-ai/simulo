/**
 * Analysis Mode Plugin Registry
 *
 * Each plugin is self-describing: it declares what inputs it requires,
 * validates whether those inputs are present, and handles the analysis.
 * The route dispatches to the first plugin whose `accepts()` returns true.
 *
 * To add a new analysis mode: implement AnalysisPlugin and register it below.
 */

import type { BaseHandlerParams, HandlerResult, UploadedVideo } from "./handlers/types";

// ── Plugin contract ───────────────────────────────────────────────────────────

export interface AnalysisPlugin {
  /** Short machine-readable key, e.g. "comparison" */
  id: string;
  /** Human-readable description shown in logs */
  description: string;
  /** Input fields this plugin consumes (informational, used for debugging) */
  requiredInputs: string[];
  /**
   * Return true if this plugin should handle the incoming request body.
   * Checked in registry order; first match wins.
   */
  accepts(body: AnalysisRequestBody): boolean;
  /** Execute the analysis and return a HandlerResult */
  handle(params: BaseHandlerParams, body: AnalysisRequestBody): Promise<HandlerResult>;
}

// ── Shared request body shape ─────────────────────────────────────────────────

export interface AnalysisRequestBody {
  images?: string[];
  videos?: UploadedVideo[];
  inputType?: string;
  url?: string;
  flowSteps?: { stepNumber: number; stepName: string; image: string }[];
  figmaToken?: string;
  figmaFileKey?: string;
  figmaFrameIds?: string[];
  ours?: unknown;
  competitors?: unknown[];
  comparisonFocus?: string;
  [key: string]: unknown;
}

// ── Plugin implementations ────────────────────────────────────────────────────

const comparisonPlugin: AnalysisPlugin = {
  id: "comparison",
  description: "경쟁사 비교 분석 — ours + competitors 배열 필요",
  requiredInputs: ["inputType=comparison", "ours", "competitors[]"],
  accepts(body) {
    return (
      body.inputType === "comparison" &&
      body.ours != null &&
      Array.isArray(body.competitors)
    );
  },
  async handle(params, body) {
    const { handleComparisonAnalysis } = await import("./handlers/comparison");
    return handleComparisonAnalysis({
      ...params,
      ours: body.ours as never,
      competitors: body.competitors as never[],
      comparisonFocus: body.comparisonFocus,
    });
  },
};

const figmaPlugin: AnalysisPlugin = {
  id: "figma",
  description: "Figma 프레임 분석 — figmaToken + figmaFileKey + figmaFrameIds 필요",
  requiredInputs: ["inputType=figma", "figmaToken", "figmaFileKey", "figmaFrameIds[]"],
  accepts(body) {
    return (
      body.inputType === "figma" &&
      typeof body.figmaToken === "string" &&
      typeof body.figmaFileKey === "string" &&
      Array.isArray(body.figmaFrameIds) &&
      body.figmaFrameIds.length > 0
    );
  },
  async handle(params, body) {
    const { handleFigmaAnalysis } = await import("./handlers/figma");
    console.log("[registry] Figma analysis with", (body.figmaFrameIds as string[]).length, "frames");
    return handleFigmaAnalysis({
      ...params,
      figmaToken: body.figmaToken as string,
      figmaFileKey: body.figmaFileKey as string,
      figmaFrameIds: body.figmaFrameIds as string[],
    });
  },
};

const flowPlugin: AnalysisPlugin = {
  id: "flow",
  description: "플로우 분석 — flowSteps 2개 이상 필요",
  requiredInputs: ["inputType=flow", "flowSteps[2+]"],
  accepts(body) {
    return (
      body.inputType === "flow" &&
      Array.isArray(body.flowSteps) &&
      body.flowSteps.length >= 2
    );
  },
  async handle(params, body) {
    const { handleFlowAnalysis } = await import("./handlers/flow");
    console.log("[registry] Flow analysis with", (body.flowSteps!).length, "steps");
    return handleFlowAnalysis({ ...params, flowSteps: body.flowSteps! });
  },
};

const urlPlugin: AnalysisPlugin = {
  id: "url",
  description: "URL 라이브 분석 — 스크린샷 캡처 후 이미지 분석",
  requiredInputs: ["inputType=url", "url"],
  accepts(body) {
    return body.inputType === "url" && typeof body.url === "string" && body.url.length > 0;
  },
  async handle(params, body) {
    const { handleUrlAnalysis } = await import("./handlers/url");
    console.log("[registry] URL analysis:", body.url);
    return handleUrlAnalysis({ ...params, url: body.url as string });
  },
};

const imagePlugin: AnalysisPlugin = {
  id: "image",
  description: "이미지/영상 분석 — images 1개 이상 필요 (기본 폴백)",
  requiredInputs: ["images[1+]"],
  accepts(body) {
    return Array.isArray(body.images) && body.images.length > 0;
  },
  async handle(params, body) {
    const { handleImageAnalysis } = await import("./handlers/image");
    console.log("[registry] Image analysis with", (body.images!).length, "images");
    return handleImageAnalysis({
      ...params,
      images: body.images!,
      videos: body.videos,
    });
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Ordered list of plugins. The first plugin whose `accepts()` returns true wins.
 * More specific plugins (comparison, figma, flow) must come before the generic image plugin.
 */
const PLUGINS: AnalysisPlugin[] = [
  comparisonPlugin,
  figmaPlugin,
  flowPlugin,
  urlPlugin,
  imagePlugin,
];

/**
 * Find the plugin that should handle the given request body.
 * Returns null if no plugin matches — the caller should return a 400.
 */
export function resolvePlugin(body: AnalysisRequestBody): AnalysisPlugin | null {
  for (const plugin of PLUGINS) {
    if (plugin.accepts(body)) return plugin;
  }
  return null;
}

/** List all registered plugin IDs and their descriptions (useful for debugging) */
export function listPlugins(): { id: string; description: string; requiredInputs: string[] }[] {
  return PLUGINS.map(({ id, description, requiredInputs }) => ({ id, description, requiredInputs }));
}
