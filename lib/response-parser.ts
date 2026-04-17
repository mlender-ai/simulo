import { z } from "zod";

// ──────────────────────────────────────────────
// JSON Text Extraction & Sanitization
// ──────────────────────────────────────────────

/**
 * Find the first { or [ and extract everything up to its matching closing bracket.
 * Handles nested structures, strings, and escape sequences correctly.
 */
export function extractJsonObject(text: string): string {
  const start = text.search(/[{[]/);
  if (start === -1) return text;

  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    if (ch === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  // No matching close found — return from start to end (truncated case)
  return text.slice(start);
}

/**
 * Sanitize a JSON string to fix common issues from LLM output:
 * - Unescaped control characters (newlines, tabs) inside string values
 * - Pipe-separated type annotations copied verbatim from the schema
 *   e.g. "dropOffRisk": "High" | "Medium" | "Low"  →  "High"
 */
export function sanitizeJsonText(text: string): string {
  let result = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; result += ch; continue; }
    if (ch === "\\" && inStr) { esc = true; result += ch; continue; }
    if (ch === '"') { inStr = !inStr; result += ch; continue; }
    if (inStr) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }
    result += ch;
  }

  // Fix schema literals leaked into values: "value" | "other" | "another"
  result = result.replace(/"([^"]+)"\s*\|\s*"[^"]+(?:"\s*\|\s*"[^"]+)*"/g, '"$1"');

  return result;
}

/**
 * Attempt to recover a truncated JSON object by closing unclosed brackets/braces.
 * Tries progressively more aggressive truncation until a valid parse succeeds.
 */
export function recoverTruncatedJson(text: string): unknown | null {
  const sanitized = sanitizeJsonText(text);

  function tryClose(input: string): unknown | null {
    let s = input;
    let inStr = false;
    let esc = false;
    const stack: string[] = [];

    for (const ch of s) {
      if (esc) { esc = false; continue; }
      if (ch === "\\" && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }

    if (inStr) s += '"';
    s = s.replace(/[,:\s]+$/, "");
    while (stack.length) s += stack.pop();

    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  // Attempt 1: close as-is
  let result = tryClose(sanitized);
  if (result) return result;

  // Attempt 2: truncate at the last comma outside a string and close
  let lastSafeComma = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === ",") lastSafeComma = i;
  }

  if (lastSafeComma > 0) {
    result = tryClose(sanitized.slice(0, lastSafeComma));
    if (result) return result;
  }

  // Attempt 3: find the last complete key-value pair
  for (const pattern of ["},", "],", "}"]) {
    const idx = sanitized.lastIndexOf(pattern);
    if (idx > 0) {
      result = tryClose(sanitized.slice(0, idx + 1));
      if (result) return result;
    }
  }

  console.error("[response-parser] JSON recovery failed after all attempts");
  return null;
}

// ──────────────────────────────────────────────
// Zod Schemas
// ──────────────────────────────────────────────

const HeatZoneSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
}).nullable().optional();

const DesireAlignmentSchema = z.object({
  utility: z.object({ score: z.number(), comment: z.string().default("") }),
  healthPride: z.object({ score: z.number(), comment: z.string().default("") }),
  lossAversion: z.object({ score: z.number(), comment: z.string().default("") }),
}).optional();

const ScoreBreakdownSchema = z.object({
  clarity: z.object({ score: z.number(), reason: z.string().default("") }),
  flow: z.object({ score: z.number(), reason: z.string().default("") }),
  feedback: z.object({ score: z.number(), reason: z.string().default("") }),
  efficiency: z.object({ score: z.number(), reason: z.string().default("") }),
}).optional();

const RetentionRiskSchema = z.object({
  d1Risk: z.string(),
  d7Risk: z.string(),
  mainRiskReason: z.string().default(""),
}).optional();

const IssueSchema = z.object({
  screen: z.string(),
  screenIndex: z.number().optional(),
  desireType: z.enum(["utility", "healthPride", "lossAversion", "general"]).optional(),
  severity: z.enum(["Critical", "Medium", "Low"]).catch("Medium"),
  issue: z.string(),
  recommendation: z.string().default(""),
  retentionImpact: z.string().optional(),
  heatZone: HeatZoneSchema,
}).passthrough();

const ThinkAloudSchema = z.object({
  screen: z.string(),
  thought: z.string(),
});

const AdFrictionSchema = z.object({
  adDensity: z.string().default(""),
  rewardClarityBeforeAd: z.string().default(""),
  skipAvailability: z.string().default(""),
  recoverySteps: z.string().default(""),
  cumulativeFatigue: z.string().default(""),
  patienceFloorStep: z.string().nullable().default(null),
  patienceFloorReason: z.string().default(""),
}).optional();

// Standard single/flow analysis response
export const AnalysisResponseSchema = z.object({
  verdict: z.enum(["Pass", "Partial", "Fail"]).catch("Partial"),
  score: z.number().min(0).max(100).catch(0),
  summary: z.string().default(""),
  verdictReason: z.string().optional(),
  taskSuccessLikelihood: z.enum(["High", "Medium", "Low"]).optional(),
  taskSuccessReason: z.string().optional(),
  strengths: z.array(z.string()).default([]),
  thinkAloud: z.array(ThinkAloudSchema).default([]),
  issues: z.array(IssueSchema).default([]),
  moneyLoopStage: z.string().optional(),
  topPriorities: z.array(z.string()).default([]),
  retentionRisk: RetentionRiskSchema,
  desireAlignment: DesireAlignmentSchema,
  scoreBreakdown: ScoreBreakdownSchema,
  // Flow-specific
  flowAnalysis: z.array(z.object({
    step: z.number(),
    stepName: z.string(),
    dropOffRisk: z.string(),
    reason: z.string().default(""),
  })).optional(),
  adFriction: AdFrictionSchema,
}).passthrough();

const Accessibility4050Schema = z.object({
  visualFriendliness: z.object({ score: z.number(), evidence: z.string().default("") }),
  linguisticFriendliness: z.object({ score: z.number(), evidence: z.string().default("") }),
}).default({ visualFriendliness: { score: 0, evidence: "" }, linguisticFriendliness: { score: 0, evidence: "" } });

const ComparisonProductSchema = z.object({
  productName: z.string(),
  verdict: z.enum(["Pass", "Partial", "Fail"]).catch("Partial"),
  score: z.number().min(0).max(100).catch(0),
  summary: z.string().default(""),
  desireAlignment: DesireAlignmentSchema,
  accessibility4050: Accessibility4050Schema,
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  thinkAloud: z.array(ThinkAloudSchema).default([]),
  issues: z.array(z.object({
    screen: z.string(),
    desireType: z.enum(["utility", "healthPride", "lossAversion", "general"]).optional(),
    severity: z.enum(["Critical", "Medium", "Low"]).catch("Medium"),
    issue: z.string(),
    recommendation: z.string().default(""),
  })).default([]),
}).passthrough();

const ComparisonTableRowSchema = z.object({
  aspect: z.string(),
  scores: z.array(z.object({
    productName: z.string(),
    score: z.number().min(0).max(10).catch(0),
    note: z.string().default(""),
  })).default([]),
  winner: z.string().default(""),
}).passthrough();

export const ComparisonResponseSchema = z.object({
  products: z.array(ComparisonProductSchema).default([]),
  comparison: z.object({
    winner: z.string().default(""),
    winnerReason: z.string().default(""),
    ourProductPosition: z.string().default(""),
    accessibilityGap: z.string().optional(),
    keyDifferences: z.array(z.object({
      aspect: z.string(),
      ours: z.string(),
      competitor: z.string(),
    })).default([]),
    topPriorities: z.array(z.string()).default([]),
    comparisonTable: z.array(ComparisonTableRowSchema).default([]),
  }).default({ winner: "", winnerReason: "", ourProductPosition: "", keyDifferences: [], topPriorities: [], comparisonTable: [] }),
  mode: z.string().optional(),
}).passthrough();

// ──────────────────────────────────────────────
// Usability (mode=usability) schemas
// ──────────────────────────────────────────────

const UsabilityDesireAlignmentSchema = z.object({
  utility: z.object({ score: z.number(), comment: z.string().default("") }),
  healthPride: z.object({ score: z.number(), comment: z.string().default("") }),
  lossAversion: z.object({ score: z.number(), comment: z.string().default("") }),
}).optional();

const UsabilityAccessibility4050Schema = z.object({
  score: z.number().default(0),
  fontReadability: z.string().default(""),
  touchTargetSize: z.string().default(""),
  languageFriendliness: z.string().default(""),
  visualComplexity: z.string().default(""),
}).optional();

const QuickWinSchema = z.object({
  issue: z.string(),
  fix: z.string().default(""),
  effort: z.string().catch("중간"),
  impact: z.string().catch("중간"),
}).passthrough();

const UsabilityIssueSchema = z.object({
  screen: z.string().default(""),
  screenIndex: z.number().optional(),
  severity: z.string().catch("보통"),
  desireType: z.enum(["utility", "healthPride", "lossAversion", "general"]).optional(),
  issue: z.string(),
  recommendation: z.string().default(""),
  heatZone: HeatZoneSchema,
}).passthrough();

const UsabilityRetentionRiskSchema = z.object({
  d1Risk: z.string().default("보통"),
  d7Risk: z.string().default("보통"),
  mainRiskReason: z.string().default(""),
}).optional();

export const UsabilityResponseSchema = z.object({
  score: z.number().min(0).max(100).catch(0),
  grade: z.string().catch("개선 필요"),
  summary: z.string().default(""),
  scoreBreakdown: ScoreBreakdownSchema,
  desireAlignment: UsabilityDesireAlignmentSchema,
  accessibility4050: UsabilityAccessibility4050Schema,
  strengths: z.array(z.string()).default([]),
  quickWins: z.array(QuickWinSchema).default([]),
  issues: z.array(UsabilityIssueSchema).default([]),
  retentionRisk: UsabilityRetentionRiskSchema,
}).passthrough();

// Flow-builder node/edge/integration schemas
export const FlowNodeResultSchema = z.object({
  dropOffRisk: z.string().default("보통"),
  dropOffPercent: z.number().min(0).max(100).catch(50),
  stayPercent: z.number().min(0).max(100).catch(50),
  desireScore: z.object({
    utility: z.number().catch(5),
    healthPride: z.number().catch(5),
    lossAversion: z.number().catch(5),
  }).default({ utility: 5, healthPride: 5, lossAversion: 5 }),
  mainReason: z.string().default(""),
  frictionPoints: z.array(z.string()).default([]),
}).passthrough();

export const FlowEdgeResultSchema = z.object({
  transitionSmooth: z.boolean().catch(true),
  dropOffAtTransition: z.number().min(0).max(100).catch(10),
  reason: z.string().default(""),
  recommendation: z.string().default(""),
}).passthrough();

export const FlowIntegrationResultSchema = z.object({
  totalDropOffRisk: z.string().default("보통"),
  estimatedCompletionRate: z.number().min(0).max(100).catch(50),
  biggestDropOffNodeId: z.string().nullable().optional(),
  biggestDropOffNode: z.string().nullable().optional(),
  criticalPath: z.array(z.string()).default([]),
  overallSummary: z.string().default(""),
}).passthrough();

// ──────────────────────────────────────────────
// Unified Parse Function
// ──────────────────────────────────────────────

export interface ParseOptions {
  /** The stop_reason from the API response, used for logging */
  stopReason?: string | null;
  /** Maximum parse recovery attempts before throwing */
  maxAttempts?: number;
}

/**
 * Parse and validate a Claude API response against a Zod schema.
 *
 * Steps:
 * 1. Strip markdown fences, extract JSON object
 * 2. Sanitize common LLM issues
 * 3. JSON.parse with truncation recovery
 * 4. Validate + coerce via Zod schema (safe defaults for missing fields)
 */
export function parseClaudeResponse<T extends z.ZodTypeAny>(
  raw: string,
  schema: T,
  options: ParseOptions = {},
): z.infer<T> {
  const { stopReason } = options;

  // Step 1: Strip markdown fences and extract JSON
  let cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  cleaned = extractJsonObject(cleaned);

  // Step 2: Sanitize
  cleaned = sanitizeJsonText(cleaned);

  console.log("[response-parser] Cleaned response (first 100 chars):", cleaned.slice(0, 100));
  console.log("[response-parser] Response length:", cleaned.length, "| stop_reason:", stopReason);

  // Step 3: JSON.parse with recovery
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.warn("[response-parser] JSON parse failed (stop_reason:", stopReason, "). Attempting recovery...");
    const parseErr = e as Error & { message: string };
    console.warn("[response-parser] Parse error:", parseErr.message);
    const posMatch = parseErr.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      console.warn("[response-parser] Context around error:", JSON.stringify(cleaned.slice(Math.max(0, pos - 40), pos + 60)));
    }
    const recovered = recoverTruncatedJson(cleaned);
    if (recovered) {
      console.log("[response-parser] JSON recovery succeeded");
      parsed = recovered;
    } else {
      throw e;
    }
  }

  // Step 4: Validate with Zod (safeParse for graceful coercion)
  const result = schema.safeParse(parsed);
  if (result.success) {
    console.log("[response-parser] Schema validation passed");
    return result.data;
  }

  // Zod validation failed — log issues but return the coerced data anyway
  // since .catch() and .default() in the schema handle most missing fields
  console.warn(
    "[response-parser] Schema validation had issues:",
    result.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  );

  // Fall back: return parsed data as-is (the schema defaults won't apply,
  // but the data is still parseable JSON). Apply manual backfills.
  return parsed as z.infer<T>;
}
