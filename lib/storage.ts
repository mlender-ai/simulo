import { v4 as uuidv4 } from "uuid";

export interface FlowStep {
  stepNumber: number;
  stepName: string;
  image: string;
}

export interface FlowAnalysisEntry {
  step: number;
  stepName: string;
  dropOffRisk: string;
  reason: string;
}

export interface DesireScore {
  score: number;
  comment: string;
}

export interface DesireAlignment {
  utility: DesireScore;
  healthPride: DesireScore;
  lossAversion: DesireScore;
}

export interface HeatZone {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface RetentionRisk {
  d1Risk: string;
  d7Risk: string;
  mainRiskReason: string;
}

export interface Accessibility4050 {
  visualFriendliness: { score: number; evidence: string };
  linguisticFriendliness: { score: number; evidence: string };
}

export interface AdFriction {
  adDensity: string;
  rewardClarityBeforeAd: string;
  skipAvailability: string;
  recoverySteps: string;
  cumulativeFatigue: string;
  patienceFloorStep: string | null;
  patienceFloorReason: string;
}

export interface ComparisonProductResult {
  productName: string;
  verdict: "Pass" | "Partial" | "Fail";
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  desireAlignment?: DesireAlignment;
  accessibility4050?: Accessibility4050;
  thinkAloud: { screen: string; thought: string }[];
  issues: {
    screen: string;
    desireType?: "utility" | "healthPride" | "lossAversion" | "general";
    severity: "Critical" | "Medium" | "Low";
    issue: string;
    recommendation: string;
  }[];
}

export interface ComparisonResult {
  products: ComparisonProductResult[];
  comparison: {
    winner: string;
    winnerReason: string;
    ourProductPosition: string;
    accessibilityGap?: string;
    keyDifferences: { aspect: string; ours: string; competitor: string }[];
    topPriorities: string[];
  };
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  hypothesis: string;
  targetUser: string;
  task: string | null;
  projectTag: string | null;
  inputType: string;
  verdict: "Pass" | "Partial" | "Fail";
  score: number;
  taskSuccessLikelihood: "High" | "Medium" | "Low";
  taskSuccessReason: string;
  summary: string;
  strengths: string[];
  thinkAloud: { screen: string; thought: string }[];
  issues: {
    screen: string;
    screenIndex?: number;
    desireType?: "utility" | "healthPride" | "lossAversion" | "general";
    severity: "Critical" | "Medium" | "Low";
    issue: string;
    recommendation: string;
    retentionImpact?: string;
    heatZone?: HeatZone | null;
    thumbnailUrl?: string | null;
  }[];
  thumbnailUrls: string[];
  flowSteps?: FlowStep[];
  flowAnalysis?: FlowAnalysisEntry[];
  scoreBreakdown?: {
    clarity: { score: number; reason: string };
    flow: { score: number; reason: string };
    feedback: { score: number; reason: string };
    efficiency: { score: number; reason: string };
  };
  verdictReason?: string;
  moneyLoopStage?: string;
  desireAlignment?: DesireAlignment;
  retentionRisk?: RetentionRisk;
  topPriorities?: string[];
  adFriction?: AdFriction;
  isComparison?: boolean;
  comparisonData?: ComparisonResult;
}

const STORAGE_KEY = "simulo_analyses";
// Sentinel stored in place of stripped base64 image data
export const STRIPPED_IMAGE = "__stripped__";

/**
 * Remove base64 image data before persisting to localStorage.
 * thumbnailUrls and issues[].thumbnailUrl hold full data: URLs which can
 * be several MB each — far exceeding the 5 MB localStorage quota on flows
 * with multiple steps. We replace them with a sentinel so the UI knows
 * the image is unavailable rather than crashing.
 */
function stripImages(analysis: AnalysisResult): AnalysisResult {
  return {
    ...analysis,
    thumbnailUrls: analysis.thumbnailUrls.map((url) =>
      url.startsWith("data:") ? STRIPPED_IMAGE : url
    ),
    issues: analysis.issues.map((issue) => ({
      ...issue,
      thumbnailUrl:
        issue.thumbnailUrl && issue.thumbnailUrl.startsWith("data:")
          ? STRIPPED_IMAGE
          : issue.thumbnailUrl,
    })),
  };
}

function getAll(): AnalysisResult[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AnalysisResult[];
  } catch {
    return [];
  }
}

function save(analysis: AnalysisResult): void {
  const stripped = stripImages(analysis);
  const all = getAll();
  all.unshift(stripped);

  // Try to persist, evicting oldest entries if quota is exceeded
  let payload = JSON.stringify(all);
  let attempts = 0;
  while (attempts < all.length) {
    try {
      localStorage.setItem(STORAGE_KEY, payload);
      return; // success
    } catch (e) {
      if (
        e instanceof DOMException &&
        (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        // Drop the oldest entry and retry
        all.pop();
        payload = JSON.stringify(all);
        attempts++;
      } else {
        throw e;
      }
    }
  }
  // If we still can't save (e.g. single entry too large), store only the latest
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stripped]));
  } catch {
    console.error("[storage] Unable to persist analysis — localStorage quota exceeded even for single item.");
  }
}

function getById(id: string): AnalysisResult | null {
  return getAll().find((a) => a.id === id) ?? null;
}

function generateId(): string {
  return uuidv4();
}

export const storage = { getAll, save, getById, generateId };
