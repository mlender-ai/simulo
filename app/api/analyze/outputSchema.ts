/**
 * Output schema validation for analysis handlers.
 *
 * Every handler must return JSON that conforms to this schema.
 * The route validates handler output before building the final response,
 * catching schema mismatches early instead of letting them surface
 * as undefined-access errors in the report page.
 */

import { z } from "zod";

const HeatZoneSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
}).optional().nullable();

const IssueSchema = z.object({
  screen: z.string().optional(),
  screenIndex: z.number().optional(),
  desireType: z.enum(["utility", "healthPride", "lossAversion", "general"]).optional(),
  severity: z.string(),
  issue: z.string(),
  recommendation: z.string(),
  retentionImpact: z.string().optional(),
  backfireRisk: z.enum(["High", "Medium", "Low", "None"]).optional(),
  backfireReason: z.string().nullable().optional(),
  alternative: z.string().nullable().optional(),
  relevanceToHypothesis: z.enum(["High", "Medium", "Low"]).optional(),
  heatZone: HeatZoneSchema,
}).passthrough();

const ScoreBreakdownEntrySchema = z.object({
  score: z.number(),
  reason: z.string(),
});

const ScoreBreakdownSchema = z.object({
  clarity: ScoreBreakdownEntrySchema,
  flow: ScoreBreakdownEntrySchema,
  feedback: ScoreBreakdownEntrySchema,
  efficiency: ScoreBreakdownEntrySchema,
}).optional();

/**
 * Base schema that all non-comparison handler outputs must satisfy.
 * Uses `.passthrough()` so extra fields (desireAlignment, retentionRisk, etc.)
 * are preserved without causing validation errors.
 */
export const AnalysisOutputSchema = z.object({
  score: z.number(),
  summary: z.string(),
  issues: z.array(IssueSchema).optional().default([]),
  strengths: z.array(z.string()).optional().default([]),
  scoreBreakdown: ScoreBreakdownSchema,
  // Hypothesis mode fields
  verdict: z.string().optional(),
  verdictReason: z.string().optional(),
  taskSuccessLikelihood: z.string().optional(),
  taskSuccessReason: z.string().optional(),
  thinkAloud: z.array(z.object({ screen: z.string(), thought: z.string() })).optional(),
  evidenceFor: z.array(z.string()).optional(),
  evidenceAgainst: z.array(z.string()).optional(),
  confidence: z.enum(["High", "Medium", "Low"]).optional(),
  confidenceReason: z.string().optional(),
  // Usability mode fields
  grade: z.string().optional(),
  quickWins: z.array(z.unknown()).optional(),
  // Flow fields
  flowAnalysis: z.array(z.unknown()).optional(),
}).passthrough();

/**
 * Comparison output has a different top-level structure.
 */
export const ComparisonOutputSchema = z.object({
  products: z.array(z.object({
    productName: z.string(),
    score: z.number(),
    verdict: z.string().optional(),
    summary: z.string().optional(),
  }).passthrough()),
  comparison: z.object({
    winner: z.string(),
    winnerReason: z.string().optional(),
    ourProductPosition: z.string().optional(),
    keyDifferences: z.array(z.unknown()).optional(),
    topPriorities: z.array(z.string()).optional(),
    comparisonTable: z.array(z.unknown()).optional(),
  }).passthrough(),
}).passthrough();

export interface ValidationResult {
  ok: boolean;
  errors: { field: string; message: string }[];
}

/**
 * Validate handler output against the appropriate schema.
 * Returns { ok: true } if valid, or { ok: false, errors } with details.
 */
export function validateHandlerOutput(
  output: Record<string, unknown>,
  isComparison: boolean,
): ValidationResult {
  const schema = isComparison ? ComparisonOutputSchema : AnalysisOutputSchema;
  const parsed = schema.safeParse(output);

  if (parsed.success) {
    return { ok: true, errors: [] };
  }

  const errors = parsed.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return { ok: false, errors };
}
