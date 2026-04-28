// lib/improvement/index.ts
// Provider dispatch: IMPROVEMENT_MODEL env var로 generator 선택
//
// 현재:  IMPROVEMENT_MODEL=claude-opus-4-6  (또는 미설정 시 기본값)
// 향후:  IMPROVEMENT_MODEL=claude-design    → claudeDesignGenerator로 자동 전환

import type { GenerateImproveParams, GenerateImproveResult } from "./opusGenerator";
import { env } from "@/lib/env";

export async function generateImprovement(
  input: GenerateImproveParams
): Promise<GenerateImproveResult> {
  const provider = env.IMPROVEMENT_MODEL;

  if (provider === "claude-design") {
    // Claude Design API 전환 시 아래 파일 생성 후 주석 해제
    // const { generateImprovement } = await import("./claudeDesignGenerator");
    // return generateImprovement(input);
    throw new Error("claude-design provider is not yet implemented");
  }

  const { generateImprovement: opusGenerate } = await import("./opusGenerator");
  return opusGenerate(input);
}
