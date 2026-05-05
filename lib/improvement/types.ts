export interface ImproveResult {
  html: string;
  changes: string[];
  provider?: string;
}

export interface ScreenResult {
  screenIndex: number;
  screenLabel: string;
  variants: ImproveResult[];
}

export type PanelState =
  | { status: "idle" }
  | { status: "generating"; total: number; done: number; screenLabel: string }
  | { status: "reanalyzing" }
  | { status: "variants"; screenResults: ScreenResult[] }
  | { status: "comparison"; screenResults: ScreenResult[]; improvedAnalysis: import("@/lib/storage").AnalysisResult }
  | { status: "error"; prev: PanelState["status"]; message: string };

export interface GenerateOptions {
  variantCount: number;
  selectedScreenMode: "all" | number;
  optCriticalOnly: boolean;
  optDesireAlignment: boolean;
  optRestructureLayout: boolean;
  targetScore: number;
  description: string;
  referenceImages: string[];
}
