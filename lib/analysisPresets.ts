const STORAGE_KEY = "simulo_analysis_presets";

export interface AnalysisPreset {
  id: string;
  name: string;
  hypothesis: string;
  targetUser: string;
  task: string;
  projectTag: string;
  mode: "hypothesis" | "usability";
  analysisPerspective: Record<string, boolean>;
}

export function loadPresets(): AnalysisPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnalysisPreset[]) : [];
  } catch {
    return [];
  }
}

export function savePreset(preset: Omit<AnalysisPreset, "id">): AnalysisPreset {
  const presets = loadPresets();
  const newPreset: AnalysisPreset = { ...preset, id: Date.now().toString() };
  presets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return newPreset;
}

export function deletePreset(id: string): void {
  const presets = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}
