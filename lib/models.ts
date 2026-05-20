export type ModelTier = "haiku" | "sonnet";

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
} as const satisfies Record<ModelTier, string>;

export function resolveModel(tier?: string): string {
  return MODELS[(tier as ModelTier) ?? "haiku"] ?? MODELS.haiku;
}
