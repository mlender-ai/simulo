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

// ─── IndexedDB image store ───────────────────────────────────────────
// Images are stored separately in IndexedDB (quota ~hundreds of MB)
// so localStorage only holds lightweight text data.

const IDB_NAME = "simulo_images";
const IDB_STORE = "thumbnails";
const IDB_VERSION = 1;

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save thumbnail URLs to IndexedDB, keyed by analysis id */
async function saveImages(id: string, thumbnailUrls: string[]): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(thumbnailUrls, id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[storage] IndexedDB saveImages failed:", e);
  }
}

/** Load thumbnail URLs from IndexedDB */
async function loadImages(id: string): Promise<string[] | null> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[storage] IndexedDB loadImages failed:", e);
    return null;
  }
}

/** Delete image data when analysis is removed */
async function deleteImages(id: string): Promise<void> {
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
  } catch {
    // non-critical
  }
}

// ─── localStorage helpers ────────────────────────────────────────────

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
  // 1. Store images in IndexedDB (async, fire-and-forget)
  if (analysis.thumbnailUrls?.some((u) => u.startsWith("data:"))) {
    saveImages(analysis.id, analysis.thumbnailUrls);
  }

  // 2. Strip images and persist text data to localStorage
  const stripped = stripImages(analysis);
  const all = getAll();
  all.unshift(stripped);

  let payload = JSON.stringify(all);
  let attempts = 0;
  while (attempts < all.length) {
    try {
      localStorage.setItem(STORAGE_KEY, payload);
      return;
    } catch (e) {
      if (
        e instanceof DOMException &&
        (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        all.pop();
        payload = JSON.stringify(all);
        attempts++;
      } else {
        throw e;
      }
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stripped]));
  } catch {
    console.error("[storage] Unable to persist analysis — localStorage quota exceeded.");
  }
}

function getById(id: string): AnalysisResult | null {
  return getAll().find((a) => a.id === id) ?? null;
}

/**
 * Load analysis by ID with images hydrated from IndexedDB.
 * Call this instead of getById when you need thumbnails.
 */
async function getByIdWithImages(id: string): Promise<AnalysisResult | null> {
  const analysis = getById(id);
  if (!analysis) return null;

  // Hydrate images from IndexedDB
  const images = await loadImages(id);
  if (images && images.length > 0) {
    analysis.thumbnailUrls = images;
    // Also restore issue thumbnailUrls
    if (analysis.issues) {
      analysis.issues = analysis.issues.map((issue) => {
        if (issue.thumbnailUrl === STRIPPED_IMAGE && typeof issue.screenIndex === "number" && images[issue.screenIndex]) {
          return { ...issue, thumbnailUrl: images[issue.screenIndex] };
        }
        return issue;
      });
    }
  }

  return analysis;
}

function generateId(): string {
  return uuidv4();
}

export const storage = { getAll, save, getById, getByIdWithImages, generateId, deleteImages };
