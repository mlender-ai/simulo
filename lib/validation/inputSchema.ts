import { z } from "zod";
import type { InputTab, AnalysisMode } from "@/components/InputSection";

export const hypothesisModeSchema = z.object({
  mode: z.literal("hypothesis"),
  hypothesis: z.string().min(1, "필수 항목입니다"),
  targetUser: z.string().min(1, "필수 항목입니다"),
});

export const usabilityModeSchema = z.object({
  mode: z.literal("usability"),
  hypothesis: z.string().optional(),
  targetUser: z.string().optional(),
});

export const analysisModeSchema = z.discriminatedUnion("mode", [
  hypothesisModeSchema,
  usabilityModeSchema,
]);

export type AnalysisModeInput = z.infer<typeof analysisModeSchema>;

export type FieldErrors = Partial<Record<"hypothesis" | "targetUser", string>>;

export function validateContextFields(
  mode: AnalysisMode,
  hypothesis: string,
  targetUser: string
): FieldErrors {
  if (mode !== "hypothesis") return {};

  const result = hypothesisModeSchema.safeParse({ mode, hypothesis, targetUser });
  if (result.success) return {};

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof FieldErrors;
    errors[field] = issue.message;
  }
  return errors;
}

export function isInputTabReady(
  tab: InputTab,
  images: string[],
  videos: unknown[],
  flowSteps: { image: string }[]
): boolean {
  switch (tab) {
    case "image":
      return images.length > 0 || videos.length > 0;
    case "flow":
      return flowSteps.length > 0 && flowSteps.some((s) => s.image);
    case "figma":
    case "comparison":
    case "url":
      return true;
    default:
      return false;
  }
}
