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

export interface ComparisonProductResult {
  productName: string;
  verdict: "Pass" | "Partial" | "Fail";
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  thinkAloud: { screen: string; thought: string }[];
  issues: {
    screen: string;
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
    severity: "Critical" | "Medium" | "Low";
    issue: string;
    recommendation: string;
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
  isComparison?: boolean;
  comparisonData?: ComparisonResult;
}

const STORAGE_KEY = "simulo_analyses";

function getAll(): AnalysisResult[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as AnalysisResult[];
}

function save(analysis: AnalysisResult): void {
  const all = getAll();
  all.unshift(analysis);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function getById(id: string): AnalysisResult | null {
  return getAll().find((a) => a.id === id) ?? null;
}

function generateId(): string {
  return uuidv4();
}

export const storage = { getAll, save, getById, generateId };
