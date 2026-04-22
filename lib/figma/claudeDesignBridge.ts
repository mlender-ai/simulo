// ──────────────────────────────────────────────────────────────────────────────
// lib/figma/claudeDesignBridge.ts
//
// Claude Design API 교체 준비용 브릿지 레이어.
//
// 현재: DESIGN_PROVIDER=rest-api → artifacts.ts의 SVG/Variables 방식 사용
// 전환: DESIGN_PROVIDER=claude-design → Claude Design API 클라이언트로 라우팅
//
// 사용처: /app/api/code-to-figma/figma/route.ts
// ──────────────────────────────────────────────────────────────────────────────

import type { DesignSpec } from "./artifacts";

// ─── Public interfaces ────────────────────────────────────────────────────────

export type OutputFormat = "figma" | "html" | "pptx";
export type DesignProvider = "rest-api" | "claude-design";

export interface DesignGeneratorInput {
  spec: DesignSpec;
  codebaseUrl?: string;
  figmaFileUrl?: string;
  figmaToken?: string;
  outputFormat: OutputFormat;
}

export interface DesignGeneratorOutput {
  figmaUrl?: string;
  html?: string;
  exportUrl?: string;
  provider: DesignProvider;
  /** SVG strings — populated by rest-api provider */
  svgs?: {
    tokens: string;
    components: string;
    flow: string;
    taxonomy: string;
  };
  /** Figma variables created — populated by rest-api provider */
  variables?: {
    created: number;
    errors: string[];
  };
  /** Errors from individual generation steps */
  errors?: string[];
}

// ─── Provider routing ─────────────────────────────────────────────────────────

/**
 * Main entry point. Routes to the correct design generation provider
 * based on the DESIGN_PROVIDER environment variable.
 *
 * DESIGN_PROVIDER=rest-api   (current default)
 *   → SVG artifacts + Figma Variables API
 *
 * DESIGN_PROVIDER=claude-design  (future)
 *   → Claude Design API — actual screen mock-ups, design system application,
 *     direct Figma export with much higher fidelity
 */
export async function generateDesign(
  input: DesignGeneratorInput,
): Promise<DesignGeneratorOutput> {
  const provider = (process.env.DESIGN_PROVIDER ?? "rest-api") as DesignProvider;

  console.log("[claudeDesignBridge] provider:", provider, "| outputFormat:", input.outputFormat);

  if (provider === "claude-design") {
    return generateWithClaudeDesign(input);
  }

  return generateWithRestApi(input);
}

// ─── REST API provider (current) ─────────────────────────────────────────────

async function generateWithRestApi(
  input: DesignGeneratorInput,
): Promise<DesignGeneratorOutput> {
  const { generateArtifacts } = await import("./artifacts");

  const fileKey = input.figmaFileUrl ? extractFileKey(input.figmaFileUrl) : undefined;

  const result = await generateArtifacts(input.spec, fileKey, input.figmaToken);

  return {
    provider: "rest-api",
    figmaUrl: input.figmaFileUrl,
    svgs: result.svgs,
    variables: result.variables,
    errors: result.variables.errors.length > 0 ? result.variables.errors : undefined,
  };
}

// ─── Claude Design API provider (stub — implement when API launches) ──────────

async function generateWithClaudeDesign(
  input: DesignGeneratorInput,
): Promise<DesignGeneratorOutput> {
  // ── TODO: Uncomment and implement when Claude Design API is available ────────
  //
  // const { ClaudeDesignClient } = await import('./claudeDesignClient')
  // const apiKey = process.env.CLAUDE_DESIGN_API_KEY
  // if (!apiKey) throw new Error('CLAUDE_DESIGN_API_KEY is not set')
  //
  // const client = new ClaudeDesignClient({ apiKey })
  // const result = await client.generate({
  //   spec: input.spec,
  //   codebaseUrl: input.codebaseUrl,
  //   outputFormat: input.outputFormat,
  //   figmaFileUrl: input.figmaFileUrl,
  // })
  //
  // return {
  //   provider: 'claude-design',
  //   figmaUrl: result.figmaUrl,
  //   html: result.html,
  //   exportUrl: result.exportUrl,
  // }
  // ─────────────────────────────────────────────────────────────────────────────

  throw new Error(
    "Claude Design API is not yet available. Set DESIGN_PROVIDER=rest-api to use the current SVG/Variables approach.",
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function extractFileKey(figmaUrl: string): string | undefined {
  return figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)?.[1];
}

/**
 * Returns a human-readable description of what each provider delivers.
 * Used in UI to explain current capabilities vs. future Claude Design API.
 */
export function getProviderCapabilities(provider: DesignProvider): {
  label: string;
  items: string[];
} {
  if (provider === "claude-design") {
    return {
      label: "Claude Design API",
      items: [
        "실제 화면 목업 자동 생성",
        "디자인 시스템 자동 적용",
        "Figma 직접 내보내기",
        "높은 완성도의 UI 렌더링",
      ],
    };
  }

  return {
    label: "REST API (현재)",
    items: [
      "SVG 스타일 가이드 · 플로우 다이어그램 생성",
      "Figma Variables로 디자인 토큰 등록",
      "컴포넌트 카탈로그 · 이벤트 택소노미 맵",
    ],
  };
}
