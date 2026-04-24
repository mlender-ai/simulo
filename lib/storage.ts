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

export interface ComparisonTableRow {
  aspect: string;
  scores: { productName: string; score: number; note: string }[];
  winner: string;
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
    comparisonTable?: ComparisonTableRow[];
  };
  mode?: AnalysisMode;
}

export interface UsabilityAccessibility {
  score: number;
  fontReadability: string;
  touchTargetSize: string;
  languageFriendliness: string;
  visualComplexity: string;
}

export interface QuickWin {
  issue: string;
  fix: string;
  effort: string;
  impact: string;
}

export type AnalysisMode = "hypothesis" | "usability";

export interface AnalysisOptionsBundle {
  options?: {
    usability?: boolean;
    desireAlignment?: boolean;
    competitorComparison?: boolean;
    accessibility?: boolean;
  };
  result?: {
    grade?: string;
    quickWins?: QuickWin[];
    desireAlignment?: DesireAlignment | null;
    accessibility4050?: UsabilityAccessibility | null;
    retentionRisk?: RetentionRisk | null;
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
  mode?: AnalysisMode;
  analysisOptions?: AnalysisOptionsBundle | null;
  // Usability-mode specific (also included inline by the API response for convenience)
  grade?: string;
  quickWins?: QuickWin[];
  accessibility4050?: UsabilityAccessibility | null;
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
    backfireRisk?: "High" | "Medium" | "Low" | "None";
    backfireReason?: string | null;
    alternative?: string | null;
    relevanceToHypothesis?: "High" | "Medium" | "Low";
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
  evidenceFor?: string[];
  evidenceAgainst?: string[];
  confidence?: "High" | "Medium" | "Low";
  confidenceReason?: string;
  verdictReason?: string;
  moneyLoopStage?: string;
  desireAlignment?: DesireAlignment;
  retentionRisk?: RetentionRisk;
  topPriorities?: string[];
  adFriction?: AdFriction;
  isComparison?: boolean;
  comparisonData?: ComparisonResult;
  previousAnalysisId?: string | null;
  roundNumber?: number;
  isImprovement?: boolean;
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
    // Guard against undefined — comparison analyses don't populate these fields
    thumbnailUrls: (analysis.thumbnailUrls ?? []).map((url) =>
      url.startsWith("data:") ? STRIPPED_IMAGE : url
    ),
    issues: (analysis.issues ?? []).map((issue) => ({
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
  // Defensive normalisation: ensure array fields are never undefined.
  // Comparison analyses intentionally omit top-level issues/strengths/thinkAloud —
  // normalise here so stripImages and any future consumer can always call .map() safely.
  const normalised: AnalysisResult = {
    ...analysis,
    thumbnailUrls: analysis.thumbnailUrls ?? [],
    issues: analysis.issues ?? [],
    strengths: analysis.strengths ?? [],
    thinkAloud: analysis.thinkAloud ?? [],
  };

  // 1. Store images in IndexedDB (async, fire-and-forget)
  if (normalised.thumbnailUrls.some((u) => u.startsWith("data:"))) {
    saveImages(normalised.id, normalised.thumbnailUrls);
  }

  // 2. Strip images and persist text data to localStorage
  const stripped = stripImages(normalised);
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

// ─── Storage quota monitoring ───────────────────────────────────────

export interface StorageUsage {
  /** localStorage bytes used by simulo */
  localStorageUsed: number;
  /** Total localStorage bytes used (all keys) */
  localStorageTotal: number;
  /** Estimated localStorage quota (browser-dependent, typically 5-10MB) */
  localStorageQuota: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Number of stored analyses */
  analysisCount: number;
  /** IndexedDB estimated size in bytes (0 if unavailable) */
  indexedDBUsed: number;
}

const LS_QUOTA_ESTIMATE = 5 * 1024 * 1024; // 5MB conservative estimate

function getStorageUsage(): StorageUsage {
  if (typeof window === "undefined") {
    return { localStorageUsed: 0, localStorageTotal: 0, localStorageQuota: LS_QUOTA_ESTIMATE, usagePercent: 0, analysisCount: 0, indexedDBUsed: 0 };
  }

  let totalBytes = 0;
  let simuloBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const value = localStorage.getItem(key) || "";
    const size = (key.length + value.length) * 2; // UTF-16
    totalBytes += size;
    if (key.startsWith("simulo")) simuloBytes += size;
  }

  const analyses = getAll();

  return {
    localStorageUsed: simuloBytes,
    localStorageTotal: totalBytes,
    localStorageQuota: LS_QUOTA_ESTIMATE,
    usagePercent: Math.round((totalBytes / LS_QUOTA_ESTIMATE) * 100),
    analysisCount: analyses.length,
    indexedDBUsed: 0, // filled async by getStorageUsageAsync
  };
}

async function getStorageUsageAsync(): Promise<StorageUsage> {
  const usage = getStorageUsage();

  // Try navigator.storage.estimate() for IndexedDB size
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage.indexedDBUsed = estimate.usage ?? 0;
    } catch {
      // not available
    }
  }

  return usage;
}

/** Returns true if localStorage usage exceeds the given threshold (default 80%) */
function isNearQuota(thresholdPercent = 80): boolean {
  const usage = getStorageUsage();
  return usage.usagePercent >= thresholdPercent;
}

/**
 * Delete a single analysis from localStorage and its images from IndexedDB.
 */
function deleteById(id: string): void {
  const all = getAll();
  const filtered = all.filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  deleteImages(id);
}

/**
 * Delete analyses older than the given number of days.
 * Returns the number of deleted entries.
 */
function deleteOlderThan(days: number): number {
  const all = getAll();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const keep: AnalysisResult[] = [];
  const remove: AnalysisResult[] = [];

  for (const a of all) {
    if (new Date(a.createdAt).getTime() < cutoff) {
      remove.push(a);
    } else {
      keep.push(a);
    }
  }

  if (remove.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
    for (const a of remove) {
      deleteImages(a.id);
    }
  }

  return remove.length;
}

/**
 * Clear all analysis data from localStorage and IndexedDB.
 */
async function clearAll(): Promise<number> {
  const all = getAll();
  const count = all.length;
  localStorage.removeItem(STORAGE_KEY);

  // Clear IndexedDB image store
  try {
    const db = await openImageDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-critical
  }

  return count;
}

export const storage = {
  getAll,
  save,
  getById,
  getByIdWithImages,
  generateId,
  deleteImages,
  deleteById,
  deleteOlderThan,
  clearAll,
  getStorageUsage,
  getStorageUsageAsync,
  isNearQuota,
};
