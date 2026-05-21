// Simulo Figma Plugin — UI logic (iframe side)
// Communicates with plugin sandbox via parent.postMessage.

import { t, setLang, getLang, type Lang } from "./i18n";

interface ExtractedText {
  text: string;
  parentName: string;
  fontSize: number | null;
  fontWeight: string | null;
}

interface ImageItem {
  name: string;
  nodeId?: string;
  base64: string;
  texts?: ExtractedText[];
}

interface AnalysisResult {
  verdict: string;
  score: number;
  summary: string;
  strengths?: string[];
  taskSuccessLikelihood?: string;
  thinkAloud?: { screen: string; thought: string }[];
  issues?: { screen: string; severity: string; issue: string; recommendation: string }[];
}

interface WritingIssue {
  location: string;
  original: string;
  suggestion: string;
  reason: string;
  severity: "critical" | "warning" | "info";
  principle: string;
}

interface ScreenLevel {
  hasOneKeyMessage: boolean;
  hasWordRepetition: boolean;
  repeatedWords: string[];
  ctaCount: number;
  ctaClarity: string;
}

interface WritingCheckResult {
  summary: string;
  score: number;
  issues: WritingIssue[];
  strengths: string[];
  frameName: string;
  figmaNodeId?: string;
  screenLevel?: ScreenLevel;
}

let selectedImages: ImageItem[] = [];
let currentMode: "analysis" | "writing" | "variants" = "analysis";
let pendingVariantNodeId: string | null = null;
let multiResults: (AnalysisResult & { _frameName?: string })[] = [];
let currentResultIndex = 0;
let pendingMultiAnalysis = false;
let analysisMode: "hypothesis" | "usability" = "hypothesis";
let lastWritingResults: WritingCheckResult[] = [];
let lastFileKey = "";
let appliedFixes = new Set<string>(); // "frameIdx-issueIdx" tracking
let freeMode = false; // API 키 없거나 초과 시 true
let googleTokens: { access_token: string; refresh_token: string; expiry_date?: number } | null = null;
let savedSpreadsheetId = "";
let googleAuthPollTimer: ReturnType<typeof setInterval> | null = null;

const MODEL_MAP = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-20250514",
} as const;

function getSelectedModel(): string {
  const sel = $<HTMLSelectElement>("modelSelect");
  return MODEL_MAP[(sel?.value as keyof typeof MODEL_MAP) || "haiku"];
}

function checkFreeMode() {
  const apiKey = getApiKey();
  freeMode = !apiKey;
  $("freeModeBanner").className = freeMode ? "free-mode-banner visible" : "free-mode-banner";
}

// -------- DOM helpers --------
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -------- Initialization --------
// -------- i18n helpers --------
function applyI18n() {
  // Settings panel
  $("settingsToggle").textContent = t("settings.toggle");
  const apiKeyLabel = document.querySelector("#settingsPanel label:first-of-type") as HTMLElement | null;
  if (apiKeyLabel) apiKeyLabel.textContent = t("settings.apiKeyLabel");
  const apiKeyHint = document.querySelector("#settingsPanel .settings-hint:first-of-type") as HTMLElement | null;
  if (apiKeyHint) apiKeyHint.textContent = t("settings.apiKeyHint");

  const modelLabel = document.querySelector("#settingsPanel label[for='modelSelect'], #settingsPanel label:nth-of-type(2)") as HTMLElement | null;
  const allLabels = document.querySelectorAll("#settingsPanel label");
  if (allLabels[1]) allLabels[1].textContent = t("settings.modelLabel");
  const haikuOpt = $<HTMLSelectElement>("modelSelect").options[0];
  if (haikuOpt) haikuOpt.text = t("settings.modelHaiku");
  const sonnetOpt = $<HTMLSelectElement>("modelSelect").options[1];
  if (sonnetOpt) sonnetOpt.text = t("settings.modelSonnet");
  const hints = document.querySelectorAll("#settingsPanel .settings-hint");
  if (hints[1]) hints[1].textContent = t("settings.modelHint");
  if (allLabels[2]) allLabels[2].textContent = t("settings.simuloUrlLabel");
  const labelSimuloUrl = $("labelSimuloUrl");
  if (labelSimuloUrl) labelSimuloUrl.textContent = t("settings.simuloUrlLabel");
  const hintSimuloUrl = $("hintSimuloUrl");
  if (hintSimuloUrl) hintSimuloUrl.textContent = t("settings.simuloUrlHint");
  const labelLang = $("labelLang");
  if (labelLang) labelLang.textContent = t("settings.langLabel");

  // Free mode banner
  $("freeModeBanner").textContent = t("freeMode.banner");

  // Mode tabs
  document.querySelectorAll(".mode-tab").forEach((el) => {
    const mode = (el as HTMLElement).dataset.mode;
    if (mode === "analysis") el.textContent = t("mode.analysis");
    else if (mode === "writing") el.textContent = t("mode.writing");
    else if (mode === "variants") el.textContent = t("mode.variants");
  });

  // Analysis mode sub-tabs
  document.querySelectorAll(".analysis-mode-tab").forEach((el) => {
    const mode = (el as HTMLElement).dataset.analysisMode;
    if (mode === "hypothesis") el.textContent = t("analysisMode.hypothesis");
    else if (mode === "usability") el.textContent = t("analysisMode.usability");
  });

  // Form labels & placeholders
  const hypothesisLabels = document.querySelectorAll("#hypothesisField label");
  if (hypothesisLabels[0]) hypothesisLabels[0].textContent = t("form.hypothesis");
  const hypothesisTA = $<HTMLTextAreaElement>("hypothesis");
  if (hypothesisTA) hypothesisTA.placeholder = t("form.hypothesisPlaceholder");
  const targetUserLabels = document.querySelectorAll("#inputForm > div:last-of-type label");
  if (targetUserLabels[0]) targetUserLabels[0].textContent = t("form.targetUser");
  const targetUserInput = $<HTMLInputElement>("targetUser");
  if (targetUserInput) targetUserInput.placeholder = t("form.targetUserPlaceholder");

  // Focus keyword field
  const labelFocusKeyword = $("labelFocusKeyword");
  if (labelFocusKeyword) labelFocusKeyword.textContent = t("form.focusKeyword");
  const focusKeywordInput = $<HTMLInputElement>("focusKeyword");
  if (focusKeywordInput) focusKeywordInput.placeholder = t("form.focusKeywordPlaceholder");
  const hintFocusKeyword = $("hintFocusKeyword");
  if (hintFocusKeyword) hintFocusKeyword.textContent = t("form.focusKeywordHint");

  // Flow button
  $("runFlowBtn").textContent = t("btn.flow");

  // Report back button
  $("resetBtn").textContent = t("btn.reset");
  $("writingResetBtn").textContent = t("btn.writingReset");

  // Report tabs
  document.querySelectorAll(".tab").forEach((el) => {
    const tab = (el as HTMLElement).dataset.tab;
    if (tab === "overview") el.textContent = t("tab.overview");
    else if (tab === "think") el.textContent = t("tab.thinkAloud");
    else if (tab === "issues") el.textContent = t("tab.issues");
  });

  // Loading default msg
  $("loadingMsg").textContent = t("loading.default");

  // Writing hint
  const writingHint = document.querySelector(".writing-hint") as HTMLElement | null;
  if (writingHint) writingHint.textContent = t("writing.hint");

  // Variants form
  const variantsHint = document.querySelector("#variantsForm .writing-hint") as HTMLElement | null;
  if (variantsHint) variantsHint.textContent = t("variants.hint");
  const variantLabels = document.querySelectorAll("#variantsForm label");
  if (variantLabels[0]) variantLabels[0].textContent = t("variants.original");
  if (variantLabels[1]) variantLabels[1].textContent = t("variants.goal");
  const variantOriginal = $<HTMLInputElement>("variantOriginal");
  if (variantOriginal) variantOriginal.placeholder = t("variants.originalPlaceholder");
  $("runVariantsBtn").textContent = t("btn.generateVariants");

  // Variant goal options
  const variantGoalSel = $<HTMLSelectElement>("variantGoal");
  if (variantGoalSel) {
    const vals = ["conversion", "trust", "concise", "friendly", "urgency", "clarity"];
    for (const opt of Array.from(variantGoalSel.options)) {
      if (vals.includes(opt.value)) opt.text = t(`variants.goal.${opt.value}`);
    }
  }

  // Export buttons
  $("exportCsvBtn").textContent = t("export.csv");
  $("exportSimuloBtn").textContent = t("export.simulo");

  // Re-apply dynamic state (selection bar + sheets button)
  const bar = $("selectionBar");
  const count = parseInt(bar.dataset.count || "0");
  const names = (bar.dataset.names || "").split(",").filter(Boolean);
  updateSelectionBar(count, names);
  updateSheetsButtonState();
}

window.addEventListener("DOMContentLoaded", () => {
  // Request saved API key, Simulo URL, language from plugin sandbox
  parent.postMessage({ pluginMessage: { type: "load-api-key" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-simulo-url" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-language" } }, "*");

  // Save API key on change + recheck free mode
  $("apiKey").addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    if (val) {
      parent.postMessage({ pluginMessage: { type: "save-api-key", key: val } }, "*");
    }
    checkFreeMode();
  });

  // Save model selection
  $("modelSelect").addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value;
    parent.postMessage({ pluginMessage: { type: "save-model", model: val } }, "*");
  });

  // Save Simulo URL on change
  $("simuloUrl").addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    parent.postMessage({ pluginMessage: { type: "save-simulo-url", url: val } }, "*");
  });

  // Language selector
  $("langSelect").addEventListener("change", (e) => {
    const lang = (e.target as HTMLSelectElement).value as Lang;
    setLang(lang);
    parent.postMessage({ pluginMessage: { type: "save-language", lang } }, "*");
    applyI18n();
  });

  $("settingsToggle").addEventListener("click", () => {
    $("settingsPanel").classList.toggle("visible");
  });

  $("runBtn").addEventListener("click", runAnalysis);
  $("runFlowBtn").addEventListener("click", runFlowAnalysis);
  $("runMultiBtn").addEventListener("click", runMultiAnalysis);
  $("runWritingBtn").addEventListener("click", runWritingCheck);
  $("runVariantsBtn").addEventListener("click", runVariantGeneration);
  $("resetBtn").addEventListener("click", () => { multiResults = []; currentResultIndex = 0; resetToInput(); });
  $("paginationPrev").addEventListener("click", () => { if (currentResultIndex > 0) showMultiReport(currentResultIndex - 1); });
  $("paginationNext").addEventListener("click", () => { if (currentResultIndex < multiResults.length - 1) showMultiReport(currentResultIndex + 1); });
  $("writingResetBtn").addEventListener("click", resetToInput);
  $("exportCsvBtn").addEventListener("click", exportWritingCSV);
  $("exportSimuloBtn").addEventListener("click", exportToSimulo);
  $("exportSheetsBtn").addEventListener("click", exportToGoogleSheets);

  // Load Google tokens from clientStorage
  parent.postMessage({ pluginMessage: { type: "load-google-tokens" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-spreadsheet-id" } }, "*");

  // Mode toggle
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = (tab as HTMLElement).dataset.mode as "analysis" | "writing" | "variants";
      if (mode) switchMode(mode);
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = (tab as HTMLElement).dataset.tab;
      if (name) switchTab(name);
    });
  });

  // Analysis mode sub-tabs (가설 검증 / 사용성 분석)
  document.querySelectorAll(".analysis-mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = (tab as HTMLElement).dataset.analysisMode as "hypothesis" | "usability";
      if (mode) switchAnalysisMode(mode);
    });
  });

  // Request initial file info + model
  parent.postMessage({ pluginMessage: { type: "get-file-info" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-model" } }, "*");

  // Initial free mode check (after API key loads)
  setTimeout(checkFreeMode, 500);
});

// -------- Messages from plugin sandbox --------
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "api-key-loaded") {
    const key = msg.key as string;
    if (key) {
      $<HTMLInputElement>("apiKey").value = key;
    }
    checkFreeMode();
  }

  if (msg.type === "simulo-url-loaded") {
    const url = msg.url as string;
    if (url) {
      $<HTMLInputElement>("simuloUrl").value = url;
    }
  }

  if (msg.type === "language-loaded") {
    const lang = (msg.lang as Lang) || "ko";
    setLang(lang);
    $<HTMLSelectElement>("langSelect").value = lang;
    applyI18n();
  }

  if (msg.type === "model-loaded") {
    const model = msg.model as string;
    if (model) {
      $<HTMLSelectElement>("modelSelect").value = model;
    }
  }

  if (msg.type === "selection-changed") {
    updateSelectionBar(msg.count, msg.names);
    // A/B 변형 모드: 단일 텍스트 노드 선택 시 자동으로 원본 텍스트 채우기
    if (currentMode === "variants" && msg.count === 1) {
      parent.postMessage({ pluginMessage: { type: "get-selected-text-node" } }, "*");
    }
  }

  if (msg.type === "variant-result") {
    if (msg.success) {
      // 적용 성공 피드백은 버튼 상태로만 표시
    } else {
      showError(msg.error || t("error.variantFail"));
    }
  }

  if (msg.type === "selected-text-node") {
    const inp = $<HTMLInputElement>("variantOriginal");
    if (inp && msg.text) {
      inp.value = msg.text as string;
      pendingVariantNodeId = (msg.nodeId as string) || null;
    }
  }

  if (msg.type === "file-info") {
    updateSelectionBar(msg.selectionCount, msg.names || []);
  }

  if (msg.type === "selection-ready") {
    selectedImages = msg.images as ImageItem[];
    if (pendingMultiAnalysis) {
      pendingMultiAnalysis = false;
      startMultiAnalysis();
    } else {
      startAnalysisWithImages();
    }
  }

  if (msg.type === "writing-selection-ready") {
    const frames = msg.frames as ImageItem[];
    lastFileKey = (msg.fileKey as string) || "";
    startWritingCheck(frames);
  }

  if (msg.type === "flow-selection-ready") {
    selectedImages = (msg.flowSteps as Array<{ stepNumber: number; stepName: string; base64: string }>).map((s) => ({
      name: s.stepName,
      base64: s.base64,
      texts: [],
    }));
    startFlowAnalysisWithImages();
  }

  if (msg.type === "fix-result") {
    const fixLoading = document.querySelector(".fix-loading") as HTMLElement | null;
    if (fixLoading) fixLoading.remove();

    if (msg.success) {
      // Mark all fixes for this frame as applied
      const appliedCount = msg.appliedCount as number;
      const totalFixes = msg.totalFixes as number;

      // Find the frame index from pending fix context
      const pendingFrameIdx = (window as unknown as Record<string, number>).__pendingFixFrameIdx;
      if (pendingFrameIdx !== undefined) {
        const result = lastWritingResults[pendingFrameIdx];
        if (result) {
          for (let i = 0; i < result.issues.length; i++) {
            appliedFixes.add(`${pendingFrameIdx}-${i}`);
          }
          // Update all buttons for this frame
          updateFixButtons(pendingFrameIdx);
        }
      }

      showFixToast(t("toast.fixApplied", { applied: appliedCount, total: totalFixes }), "success");
    } else {
      showFixToast(t("toast.fixFail", { msg: msg.error || "?" }), "error");
    }
  }

  if (msg.type === "google-tokens-loaded") {
    const raw = msg.tokens as string;
    if (raw) {
      try { googleTokens = JSON.parse(raw); } catch { googleTokens = null; }
    }
    updateSheetsButtonState();
  }

  if (msg.type === "spreadsheet-id-loaded") {
    savedSpreadsheetId = (msg.spreadsheetId as string) || "";
  }

  if (msg.type === "error") {
    hideLoading();
    showError(msg.message);
  }
};

// -------- Selection state --------
function updateSelectionBar(count: number, names: string[]) {
  const bar = $("selectionBar");
  bar.dataset.count = String(count);
  bar.dataset.names = names.join(",");

  const analysisBtn = $<HTMLButtonElement>("runBtn");
  const flowBtn = $<HTMLButtonElement>("runFlowBtn");
  const writingBtn = $<HTMLButtonElement>("runWritingBtn");
  const multiBtn = $<HTMLButtonElement>("runMultiBtn");

  if (count === 0) {
    bar.textContent = t("selection.empty");
    bar.className = "selection-bar";
    analysisBtn.disabled = true;
    analysisBtn.textContent = t("btn.noSelection");
    flowBtn.disabled = true;
    writingBtn.disabled = true;
    writingBtn.textContent = t("btn.noSelection");
    multiBtn.disabled = true;
    multiBtn.style.display = "none";
  } else {
    const preview = names.slice(0, 2).join(", ");
    const suffix = names.length > 2 ? t("selection.countSuffix") : "";
    bar.textContent = t("selection.count", { n: count, names: preview + suffix });
    bar.className = "selection-bar active";
    const n = Math.min(count, 8);
    analysisBtn.disabled = false;
    analysisBtn.textContent = count === 1 ? t("btn.analyze") : t("btn.analyzeMulti", { n });
    flowBtn.disabled = count < 2;
    writingBtn.disabled = false;
    writingBtn.textContent = t("btn.writingCheck", { n });
    if (count >= 2) {
      multiBtn.disabled = false;
      multiBtn.style.display = "block";
      multiBtn.textContent = t("btn.multiIndividual", { n });
    } else {
      multiBtn.disabled = true;
      multiBtn.style.display = "none";
    }
  }
}

// -------- Analysis mode switching --------
function switchAnalysisMode(mode: "hypothesis" | "usability") {
  analysisMode = mode;
  document.querySelectorAll(".analysis-mode-tab").forEach((el) => {
    const m = (el as HTMLElement).dataset.analysisMode;
    el.className = "analysis-mode-tab" + (m === mode ? " active" : "");
  });

  const hypothesisField = $("hypothesisField");
  const focusKeywordField = $("focusKeywordField");
  if (mode === "usability") {
    hypothesisField.style.display = "none";
    focusKeywordField.style.display = "block";
  } else {
    hypothesisField.style.display = "block";
    focusKeywordField.style.display = "none";
  }
}

// -------- Run analysis --------
function runAnalysis() {
  checkFreeMode();

  if (analysisMode === "hypothesis") {
    const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
    if (!hypothesis) {
      showError(t("error.noHypothesis"));
      return;
    }
  }

  hideError();
  showLoading();
  parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
}

// -------- Multi-frame individual analysis --------
function runMultiAnalysis() {
  checkFreeMode();
  if (analysisMode === "hypothesis") {
    const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
    if (!hypothesis) { showError(t("error.noHypothesis")); return; }
  }
  hideError();
  showLoading();
  updateLoadingMsg(t("multi.extracting"));
  pendingMultiAnalysis = true;
  parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
}

async function startMultiAnalysis() {
  const images = selectedImages.slice(0, 8);
  multiResults = [];
  currentResultIndex = 0;

  for (let i = 0; i < images.length; i++) {
    updateLoadingMsg(t("multi.analyzing", { current: i + 1, total: images.length, name: images[i].name }));
    try {
      const result = await analyzeSingleFrameViaBackend(images[i]);
      multiResults.push({ ...result, _frameName: images[i].name });
    } catch (e) {
      multiResults.push({
        verdict: t("report.verdict.fail"),
        score: 0,
        summary: t("multi.analysisFail", { msg: e instanceof Error ? e.message : String(e) }),
        _frameName: images[i].name,
      });
    }
  }

  showMultiReport(0);
}

async function analyzeSingleFrameViaBackend(img: ImageItem): Promise<AnalysisResult> {
  const apiKey = getApiKey();
  const baseUrl = getSimuloBaseUrl();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();

  const screenDescription = img.texts && img.texts.length > 0
    ? img.texts.map((t) => t.text).join(" / ")
    : "";

  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputType: "image",
      images: [img.base64],
      hypothesis: hypothesis || `화면 "${img.name}"의 사용성 분석`,
      targetUser: targetUser || t("form.defaultTargetUser"),
      screenDescription,
      locale: getLang(),
      mode: analysisMode,
      apiKey: apiKey || undefined,
      focusKeyword: analysisMode === "usability" ? (getFocusKeyword() || undefined) : undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || t("error.apiFail", { status: response.status }));
  }

  return response.json() as Promise<AnalysisResult>;
}

function showMultiReport(index: number) {
  currentResultIndex = index;
  const result = multiResults[index];

  // 페이지네이션 표시
  const paginationEl = $("multiPagination");
  paginationEl.style.display = "flex";
  $("paginationFrameName").textContent = result._frameName || t("multi.frameName", { n: index + 1 });
  $("paginationInfo").textContent = `${index + 1} / ${multiResults.length}`;
  ($("paginationPrev") as HTMLButtonElement).disabled = index === 0;
  ($("paginationNext") as HTMLButtonElement).disabled = index === multiResults.length - 1;

  showReport(result);
}

// -------- Run flow scenario analysis --------
function runFlowAnalysis() {
  checkFreeMode();

  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  if (!hypothesis) {
    showError(t("error.noFlowHypothesis"));
    return;
  }

  hideError();
  showLoading();
  updateLoadingMsg(t("flow.extracting"));
  parent.postMessage({ pluginMessage: { type: "get-selection-for-flow" } }, "*");
}

async function startFlowAnalysisWithImages() {
  const apiKey = getApiKey();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();
  const baseUrl = getSimuloBaseUrl();

  const flowSteps = selectedImages.slice(0, 8).map((img, i) => ({
    stepNumber: i + 1,
    stepName: img.name,
    image: img.base64,
  }));

  try {
    updateLoadingMsg(t("flow.analyzing", { n: flowSteps.length }));

    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputType: "flow",
        flowSteps,
        hypothesis,
        targetUser: targetUser || t("form.defaultTargetUser"),
        locale: getLang(),
        mode: "hypothesis",
        apiKey: apiKey || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || t("flow.apiFail", { status: response.status }));
    }

    const data = await response.json();
    showFlowReport(data);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("flow.error", { msg }));
  }
}

function showFlowReport(data: Record<string, unknown>) {
  hideLoading();

  const score = (data.score as number) ?? 0;
  const summary = (data.summary as string) ?? "";
  const issues = (data.issues as Array<Record<string, string>>) ?? [];
  const flowAnalysis = (data.flowAnalysis as Array<Record<string, unknown>>) ?? [];

  $("reportScore").textContent = String(score);
  const verdict = score >= 80 ? t("report.verdict.pass") : score >= 60 ? t("report.verdict.partial") : t("report.verdict.fail");
  $("reportVerdict").textContent = t("flow.label", { verdict });
  $("reportVerdict").className = `verdict-badge ${score >= 80 ? "pass" : score >= 60 ? "partial" : "fail"}`;
  $("reportSummary").textContent = summary;

  // Flow transition issues
  const flowIssues = issues.filter((i) => i.screen === "플로우" || i.screen?.includes("→") || i.type === "transition");
  const screenIssues = issues.filter((i) => !flowIssues.includes(i));

  let overviewHtml = "";
  if (flowAnalysis.length > 0) {
    overviewHtml += `<div style="margin-bottom:12px"><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${t("flow.screenTransition")}</div>`;
    for (const step of flowAnalysis) {
      const dropOff = step.dropOffAtTransition as number | undefined;
      const risk = step.dropOffRisk as string | undefined;
      const riskColor = risk === "High" || risk === "높음" ? "#ef4444" : risk === "보통" ? "#f59e0b" : "#22c55e";
      overviewHtml += `<div style="padding:6px 0;border-bottom:1px solid #1a1a1a;font-size:12px">
        <span style="color:#888">${step.stepName as string ?? ""}</span>
        ${dropOff !== undefined ? `<span style="float:right;color:${riskColor}">${t("flow.dropOffRisk", { n: dropOff })}</span>` : ""}
      </div>`;
    }
    overviewHtml += `</div>`;
  }

  if (flowIssues.length > 0) {
    overviewHtml += `<div style="font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${t("flow.frictionIssues")}</div>`;
    for (const issue of flowIssues) {
      overviewHtml += `<div style="padding:6px;margin-bottom:4px;background:#1a0f0f;border-radius:4px;border-left:2px solid #ef4444;font-size:12px">
        <div style="color:#e5e5e5;margin-bottom:2px">${issue.issue ?? ""}</div>
        <div style="color:#888">${issue.recommendation ?? ""}</div>
      </div>`;
    }
  }

  $("tab-overview").innerHTML = overviewHtml || `<p style='color:#555;font-size:12px'>${t("flow.noFriction")}</p>`;

  // Think aloud tab — per-screen thoughts
  const thinkAloud = (data.thinkAloud as Array<Record<string, string>>) ?? [];
  let thinkHtml = "";
  for (const t of thinkAloud) {
    thinkHtml += `<div style="padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:12px">
      <div style="color:#666;font-size:10px;margin-bottom:3px">${t.screen ?? ""}</div>
      <div style="color:#ccc">"${t.thought ?? ""}"</div>
    </div>`;
  }
  $("tab-think").innerHTML = thinkHtml || `<p style='color:#555;font-size:12px'>${t("report.noThinkAloud")}</p>`;

  // Issues tab
  let issuesHtml = "";
  for (const issue of screenIssues) {
    const sev = issue.severity ?? "낮음";
    const sevColor = sev === "심각" || sev === "Critical" ? "#ef4444" : sev === "보통" || sev === "Medium" ? "#f59e0b" : "#22c55e";
    issuesHtml += `<div style="padding:8px;margin-bottom:6px;background:#111;border-radius:6px;border-left:2px solid ${sevColor};font-size:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="color:#888">${issue.screen ?? ""}</span>
        <span style="color:${sevColor};font-size:10px">${sev}</span>
      </div>
      <div style="color:#e5e5e5;margin-bottom:3px">${issue.issue ?? ""}</div>
      <div style="color:#666">${issue.recommendation ?? ""}</div>
    </div>`;
  }
  $("tab-issues").innerHTML = issuesHtml || `<p style='color:#555;font-size:12px'>${t("report.noIssues")}</p>`;

  $("report").className = "report visible";
  switchTab("overview");
}

function getApiKey(): string {
  return $<HTMLInputElement>("apiKey").value.trim();
}

// -------- Claude API call --------
async function startAnalysisWithImages() {
  const apiKey = getApiKey();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();

  // 사용성 분석 모드: 항상 백엔드 /api/analyze 사용
  if (analysisMode === "usability") {
    return startUsabilityAnalysis(targetUser);
  }

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const content: ContentBlock[] = [];
  selectedImages.forEach((img, i) => {
    content.push({ type: "text", text: `[화면 ${i + 1}: ${img.name}]` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: img.base64 },
    });
    // 추출된 텍스트가 있으면 이미지 바로 뒤에 첨부
    if (img.texts && img.texts.length > 0) {
      let textList = `\n[화면 ${i + 1} 텍스트 — Figma에서 직접 추출 (OCR 아님)]\n`;
      for (const t of img.texts) {
        const meta: string[] = [];
        if (t.parentName) meta.push(t.parentName);
        if (t.fontSize) meta.push(`${t.fontSize}px`);
        if (t.fontWeight === "bold") meta.push("볼드");
        textList += `- "${t.text}"${meta.length ? ` (${meta.join(", ")})` : ""}\n`;
      }
      content.push({ type: "text", text: textList });
    }
  });
  content.push({
    type: "text",
    text: `가설: "${hypothesis}"\n타깃 유저: "${targetUser || t("form.defaultTargetUser")}"\n\n위 화면들을 분석하여 가설에 대한 사용성 평가를 JSON으로 반환해주세요.\n\n중요: 각 화면의 텍스트는 Figma 레이어에서 직접 추출한 것이므로 정확합니다. 이미지에서 텍스트를 OCR로 읽지 말고 추출된 텍스트를 기준으로 분석하세요.`,
  });

  const systemPrompt = `You are a professional UX analysis agent for YafitMove, a Korean fitness reward app. Analyze the provided design screens against the given hypothesis and target user profile. Respond ONLY in pure JSON, no markdown, no code blocks.

{
  "verdict": "통과" | "부분 통과" | "실패",
  "score": 0-100,
  "summary": "2-3문장 한국어 요약",
  "strengths": ["강점1", "강점2"],
  "taskSuccessLikelihood": "높음" | "보통" | "낮음",
  "thinkAloud": [{"screen": "화면명", "thought": "1인칭 한국어 발화"}],
  "issues": [{"screen": "화면명", "severity": "심각" | "보통" | "낮음", "issue": "한국어 설명", "recommendation": "한국어 권고"}]
}`;

  try {
    updateLoadingMsg(t("loading.analyzing"));

    let result: AnalysisResult;

    if (freeMode) {
      // 무료 모드: Simulo 백엔드 프록시를 통한 분석
      result = await callFreeMode("analysis", { systemPrompt, content }) as AnalysisResult;
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: getSelectedModel(),
          max_tokens: 4096,
          system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const status = response.status;
        // 429(rate limit) 또는 401(invalid key) → 무료 모드 전환
        if (status === 429 || status === 401) {
          freeMode = true;
          $("freeModeBanner").className = "free-mode-banner visible";
          result = await callFreeMode("analysis", { systemPrompt, content }) as AnalysisResult;
        } else {
          throw new Error(err?.error?.message || t("error.apiFail", { status }));
        }
      } else {
        const data = await response.json();
        const raw: string = data.content?.[0]?.text ?? "";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result = JSON.parse(cleaned);
      }
    }

    showReport(result);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("error.analysisFail", { msg }));
  }
}

// -------- Usability analysis (via backend API) --------
function getFocusKeyword(): string {
  return $<HTMLInputElement>("focusKeyword")?.value?.trim() || "";
}

async function startUsabilityAnalysis(targetUser: string) {
  const apiKey = getApiKey();
  const baseUrl = getSimuloBaseUrl();

  const images = selectedImages.slice(0, 8).map((img) => img.base64);

  // Figma 텍스트를 screenDescription으로 전달
  const screenDescriptions = selectedImages.slice(0, 8).map((img) => {
    if (!img.texts || img.texts.length === 0) return "";
    return img.texts.map((t) => t.text).join(" / ");
  });
  const screenDescription = screenDescriptions.filter(Boolean).join("\n");

  try {
    updateLoadingMsg(t("loading.usability"));

    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images,
        inputType: "image",
        mode: "usability",
        targetUser: targetUser || t("form.defaultTargetUser"),
        locale: getLang(),
        model: freeMode ? "haiku" : (getSelectedModel().includes("sonnet") ? "sonnet" : "haiku"),
        apiKey: apiKey || undefined,
        screenDescription: screenDescription || undefined,
        focusKeyword: getFocusKeyword() || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error || t("error.apiFail", { status: response.status }));
    }

    const data = await response.json();
    showUsabilityReport(data);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("error.analysisFail", { msg }));
  }
}

function showUsabilityReport(data: Record<string, unknown>) {
  hideLoading();

  const score = (data.score as number) ?? 0;
  const grade = (data.grade as string) ?? (data.verdict as string) ?? "개선 필요";
  const summary = (data.summary as string) ?? "";
  const strengths = (data.strengths as string[]) ?? [];
  const issues = (data.issues as Array<Record<string, string>>) ?? [];
  const quickWins = (data.quickWins as Array<Record<string, string>>) ?? [];
  const scoreBreakdown = data.scoreBreakdown as Record<string, { score: number; reason: string } | number> | undefined;

  $("reportScore").textContent = String(score);

  const verdictEl = $("reportVerdict");
  verdictEl.textContent = grade;
  const gradeClass = score >= 80 ? "verdict-pass" : score >= 60 ? "verdict-partial" : "verdict-fail";
  verdictEl.className = `verdict-badge ${gradeClass}`;

  $("reportSummary").textContent = summary;

  // Overview tab — scoreBreakdown + quickWins
  let overviewHtml = "";

  if (scoreBreakdown && typeof scoreBreakdown === "object") {
    overviewHtml += `<div class="section-label">${t("report.scoreBreakdown")}</div><div class="score-breakdown">`;
    for (const [key, val] of Object.entries(scoreBreakdown)) {
      const score = typeof val === "object" && val !== null ? val.score : val;
      overviewHtml += `<div class="score-breakdown-item"><span class="score-breakdown-label">${escapeHtml(key)}</span><span class="score-breakdown-value">${score}</span></div>`;
    }
    overviewHtml += `</div>`;
  }

  if (strengths.length > 0) {
    overviewHtml += `<div class="section-label">${t("report.strengths")}</div>`;
    for (const s of strengths) {
      overviewHtml += `<div class="strength-item">+ ${escapeHtml(s)}</div>`;
    }
  }

  if (quickWins.length > 0) {
    overviewHtml += `<div class="section-label" style="margin-top:12px">${t("report.quickWins")}</div><div class="quick-wins">`;
    for (const qw of quickWins) {
      overviewHtml += `<div class="quick-win-item"><div class="qw-title">${escapeHtml(qw.title || qw.issue || "")}</div><div class="qw-detail">${escapeHtml(qw.description || qw.recommendation || "")}</div></div>`;
    }
    overviewHtml += `</div>`;
  }

  $("tab-overview").innerHTML = overviewHtml || `<div class="empty">${t("report.noStrengths")}</div>`;

  // Think aloud — usability 모드에서는 비워둠
  $("tab-think").innerHTML = `<div class="empty">${t("report.usabilityNoThinkAloud")}</div>`;

  // Issues tab
  const sevClass = (s: string) =>
    s === "심각" || s === "Critical" ? "sev-critical" : s === "보통" || s === "Medium" ? "sev-medium" : "sev-low";
  let issuesHtml = "";
  for (const issue of issues) {
    const sev = issue.severity ?? "낮음";
    issuesHtml += `<div class="issue-item">
      <span class="issue-severity ${sevClass(sev)}">${escapeHtml(sev)}</span>
      <span class="issue-screen">${escapeHtml(issue.screen || "")}</span>
      <div class="issue-text">${escapeHtml(issue.issue || "")}</div>
      <div class="issue-rec">→ ${escapeHtml(issue.recommendation || "")}</div>
    </div>`;
  }
  $("tab-issues").innerHTML = issuesHtml || `<div class="empty">${t("report.noIssues")}</div>`;

  $("inputForm").style.display = "none";
  $("report").className = "report visible";
  switchTab("overview");

  renderFeedbackBar($("report"), "analysis", {
    frameName: selectedImages.map((img) => img.name).join(", "),
    score,
    issueCount: issues.length,
  });
}

// -------- Report rendering --------
function showReport(result: AnalysisResult) {
  hideLoading();
  // 단일 분석 모드에선 페이지네이션 숨김
  if (multiResults.length === 0) {
    $("multiPagination").style.display = "none";
  }

  $("reportScore").textContent = String(result.score ?? "-");

  const verdictEl = $("reportVerdict");
  verdictEl.textContent = result.verdict || "-";
  const passStr = t("report.verdict.pass");
  const partialStr = t("report.verdict.partial");
  const verdictClass =
    result.verdict === passStr || result.verdict === "Pass" || result.verdict === "合格"
      ? "verdict-pass"
      : result.verdict === partialStr || result.verdict === "Partial Pass" || result.verdict === "一部合格"
        ? "verdict-partial"
        : "verdict-fail";
  verdictEl.className = `verdict-badge ${verdictClass}`;

  $("reportSummary").textContent = result.summary || "";

  const strengthsHtml = (result.strengths || [])
    .map((s) => `<div class="strength-item">+ ${escapeHtml(s)}</div>`)
    .join("");
  $("reportStrengths").innerHTML =
    strengthsHtml || `<div class="empty">${t("report.noStrengths")}</div>`;

  const thinkHtml = (result.thinkAloud || [])
    .map(
      (th) => `
      <div class="think-wrap">
        <div class="think-screen">${escapeHtml(th.screen)}</div>
        <div class="think-aloud">&ldquo;${escapeHtml(th.thought)}&rdquo;</div>
      </div>`
    )
    .join("");
  $("reportThinkAloud").innerHTML =
    thinkHtml || `<div class="empty">${t("report.noThinkAloud")}</div>`;

  const sevClass = (s: string) =>
    s === "심각" || s === "Critical" || s === "重大" ? "sev-critical"
    : s === "보통" || s === "Medium" || s === "中" ? "sev-medium"
    : "sev-low";
  const issuesHtml = (result.issues || [])
    .map(
      (issue) => `
      <div class="issue-item">
        <span class="issue-severity ${sevClass(issue.severity)}">${escapeHtml(issue.severity)}</span>
        <span class="issue-screen">${escapeHtml(issue.screen || "")}</span>
        <div class="issue-text">${escapeHtml(issue.issue)}</div>
        <div class="issue-rec">→ ${escapeHtml(issue.recommendation)}</div>
      </div>`
    )
    .join("");
  $("reportIssues").innerHTML =
    issuesHtml || `<div class="empty">${t("report.noIssues")}</div>`;

  $("inputForm").style.display = "none";
  $("report").className = "report visible";

  // 피드백 바 추가
  renderFeedbackBar($("report"), "analysis", {
    frameName: selectedImages.map((img) => img.name).join(", "),
    score: result.score,
    issueCount: (result.issues || []).length,
  });
}

function switchTab(tab: string) {
  document.querySelectorAll(".tab").forEach((el) => {
    const name = (el as HTMLElement).dataset.tab;
    el.className = "tab" + (name === tab ? " active" : "");
  });
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.className = "tab-content";
  });
  const target = document.getElementById(`tab-${tab}`);
  if (target) target.className = "tab-content active";
}

function resetToInput() {
  $("report").className = "report";
  $("writingReport").className = "writing-report";
  $("writingActions").style.display = "none";
  selectedImages = [];
  lastWritingResults = [];

  if (currentMode === "analysis") {
    $("inputForm").style.display = "flex";
    $("writingForm").style.display = "none";
  } else {
    $("inputForm").style.display = "none";
    $("writingForm").style.display = "flex";
  }
}

// -------- Mode switching --------
function switchMode(mode: "analysis" | "writing" | "variants") {
  currentMode = mode;
  document.querySelectorAll(".mode-tab").forEach((el) => {
    const m = (el as HTMLElement).dataset.mode;
    el.className = "mode-tab" + (m === mode ? " active" : "");
  });

  // Show/hide form sections
  $("inputForm").style.display = mode === "analysis" ? "flex" : "none";
  $("writingForm").style.display = mode === "writing" ? "flex" : "none";
  $("variantsForm").style.display = mode === "variants" ? "flex" : "none";
  $("report").className = "report";
  $("writingReport").className = "writing-report";

  // Update button text
  updateSelectionBar(
    parseInt($("selectionBar").dataset.count || "0"),
    ($("selectionBar").dataset.names || "").split(",").filter(Boolean),
  );
}

// -------- UX Writing Check --------
function runWritingCheck() {
  checkFreeMode();

  hideError();
  showLoading();
  updateLoadingMsg(t("loading.writingFrame"));
  parent.postMessage({ pluginMessage: { type: "get-selection-for-writing" } }, "*");
}

function buildWritingUserPrompt(frame: ImageItem): string {
  let prompt = `이 UI 화면("${frame.name}")의 텍스트를 UX 라이팅 매뉴얼 기준으로 분석하세요.\n\n`;

  if (frame.texts && frame.texts.length > 0) {
    prompt += `## Figma에서 추출한 실제 텍스트 목록\n아래는 Figma 레이어에서 직접 추출한 정확한 텍스트입니다. 이미지의 텍스트를 OCR로 읽지 말고, 아래 텍스트를 기준으로 분석하세요.\n\n`;
    for (const t of frame.texts) {
      const meta: string[] = [];
      if (t.parentName) meta.push(`위치: ${t.parentName}`);
      if (t.fontSize) meta.push(`${t.fontSize}px`);
      if (t.fontWeight === "bold") meta.push("볼드");
      prompt += `- "${t.text}"${meta.length > 0 ? ` (${meta.join(", ")})` : ""}\n`;
    }
    prompt += `\n총 ${frame.texts.length}개 텍스트 노드.\n`;
  }

  prompt += `\n## 분석 순서 (이 순서대로 각 텍스트를 체크)
1. 해요체인가? (반말/합쇼체 → 해요체로)
2. 군더더기가 있는가? ("혹시", "잠깐", "한번", "지금 바로" 등)
3. CTA라면: 누르면 무엇이 일어나는지 예측 가능한가?
4. 한 문장에 메시지가 2개 이상 들어있는가?
5. 같은 단어가 화면에서 3회 이상 반복되는가?
6. 소리 내어 읽었을 때 자연스러운가?

기능 자체(게이미피케이션, 카드뽑기, 운세 등)는 평가하지 마세요. 문장 표현만 평가하세요.
suggestion은 원본과 비슷한 길이로, UI 공간을 벗어나지 않게 작성하세요.

JSON만 반환하세요.`;
  return prompt;
}

async function startWritingCheck(frames: ImageItem[]) {
  const apiKey = getApiKey();

  const systemPrompt = `당신은 야핏무브 UX 라이팅 전문가입니다. 야핏무브 UX 라이팅 매뉴얼(v1.0)에 근거하여 Figma 디자인 프레임의 모든 텍스트를 분석합니다.

## 절대 규칙 — 기획 판단 금지 (최우선)
당신은 **문장 표현의 품질만 평가**합니다. 기능/기획 자체에 대한 판단은 **절대 금지**입니다.
- 게이미피케이션, 운세, 카드뽑기, 랜덤보상, 이벤트, 챌린지 등 **모든 기능은 이미 확정된 기획**입니다.
- "이 기능이 4060에게 적합하지 않다", "건강 앱에 맞지 않다", "게이미피케이션이 사용자에게 혼란을 줄 수 있다" 같은 판단은 **하지 마세요.**
- "뽑기", "카드", "운세" 같은 단어가 있어도 기능 자체를 문제 삼지 마세요. 그 단어가 해요체인지, 명확한지, 군더더기가 없는지만 보세요.
- **위반 예시 (금지)**: "궁금한 카드를 뽑아주세요 → 게이미피케이션 요소가 4060에게 적합하지 않을 수 있음"
- **올바른 평가**: "궁금한 카드를 뽑아주세요 → '궁금한'이 군더더기. '카드를 선택해주세요'가 행동을 더 명확히 예측하게 함"

당신이 판단할 수 있는 것: 해요체 여부, 군더더기, CTA 명확성, 구어체, 단어 반복, 따뜻한 톤, 문장 길이.
당신이 판단할 수 없는 것: 기능의 적합성, 브랜드 방향성, 콘텐츠 전략, 제품 정체성.

## 제안 텍스트 작성 규칙
- suggestion은 **반드시 원본과 비슷한 길이**여야 합니다. 원본보다 2배 이상 길어지면 안 됩니다.
- UI 공간은 제한적입니다. 짧고 명확한 문장이 좋습니다.
- suggestion이 원본과 동일한 의미를 전달하되, 매뉴얼 원칙에 더 부합하도록 수정하세요.

## 타깃 사용자
야핏무브의 핵심 사용자는 **4060대 한국 여성**입니다. 이분들에게 화면 위의 글자는 매일 만나는 작은 대화입니다.

## 코어밸류 — 5가지 가치
1. **명확한(Clear)**: 4060 사용자가 한눈에 보고 무엇을 해야 할지 즉시 알 수 있어야 한다
2. **정중한(Respectful)**: 모든 문구는 해요체. 반말, 강요, 위협 없음. 가르치거나 재촉하지 않는다
3. **따뜻한(Warm)**: 격려하는 감정 표현을 환영. "잘하고 있어요", "내일 더 행복해질 거예요" 같은 표현
4. **깔끔한(Clean)**: 한 화면에 같은 단어/문장 반복하지 않는다. 군더더기를 뺀다
5. **정직한(Honest)**: 거짓 약속이나 과장 없음. 보상 액수는 확정 가능할 때만 명시

## 두두 캐릭터 원칙
두두는 시각적 마스코트다. **화자가 아니다.** 두두를 의인화해 말하게 하는 모든 표현은 금지.
- ✗ "두두가 마일리지 줄게" → ✓ "보너스 마일리지를 받았어요"
- ✗ "두두랑 같이 걸어볼래?" → ✓ "같이 걸어볼까요?"

## 8가지 라이팅 원칙 (문장 단위)

### 원칙1: 4060이 한눈에 이해할 수 있게 쓴다
화면을 보고 1~2초 안에 무엇이 가능한지 알 수 있어야 한다. **이 원칙이 다른 모든 원칙 위에 있다.**
- ✗ "본 서비스 이용 시 마일리지가 적립됩니다" → ✓ "광고를 보면 마일리지를 받아요"
- ✗ "보상 미수령 건이 있습니다" → ✓ "아직 받지 않은 보너스가 있어요"

### 원칙2: 다음 행동이 예측되는 문장을 쓴다
CTA는 누른 뒤 무엇이 일어날지 직접 말한다.
- ✗ "확인" → ✓ "마일리지 받기"
- ✗ "시작하기" → ✓ "잠자기 시간 정하기"
- ✗ "더 보기" → ✓ "오늘 받을 보너스 보기"

### 원칙3: 군더더기를 뺀다
뺐을 때 의미가 변하지 않는 단어는 빼야 한다.
금지 군더더기: "혹시", "잠깐", "한번", "지금 바로", "당장", "공짜", "열심히", "~하실 수 있는"

### 원칙4: 한 문장에 한 메시지를 담는다
여러 정보를 한 문장에 욱여넣으면 4060 사용자에게 부담스럽다.

### 원칙5: 따뜻한 감정으로 격려한다
사실만 건조하게 적시하지 않는다. 격려, 응원, 기대감을 준다.
- ✗ "오늘 5,034걸음을 걸었어요" → ✓ "오늘도 잘하고 있어요"

### 원칙6: 입으로 말할 수 있는 문장을 쓴다
소리 내어 읽었을 때 어색하면 다시 쓴다. 한자어, 문어체, 긴 호흡 문장 금지.
- ✗ "보상 지급이 완료되었습니다" → ✓ "보너스 마일리지를 받았어요"

### 원칙7: 권유하되 강요하지 않는다
손실 회피는 야핏무브의 핵심 메커니즘이나 표현이 공격적이지 않게 한다.

### 원칙8: 모두가 이해할 수 있는 말을 쓴다
외래어, 줄임말, 인터넷 밈은 거리감을 만든다.
야핏무브 내부 용어(에너지, 두두, 마일리지, 마일리지샵, 보너스 마일리지)는 허용.

## 제품 라이팅 원칙 (화면 단위)
- 한 화면, 하나의 핵심 메시지
- 같은 단어를 한 화면에서 반복하지 않는다 (동일 명사 3회 이상 = 정리되지 않은 인상)
- 원페이지 원액션: 타이틀 1줄 + CTA 1개만 봤을 때 행동할 수 있어야 한다

## 심각도 기준
- **critical**: 사용자가 오해하거나 행동하지 못하는 텍스트
- **warning**: 개선하면 전환율/만족도가 올라가는 텍스트
- **info**: 더 나은 대안이 있는 텍스트

## principle 값 (반드시 아래 중 하나)
"한눈에 이해", "행동 예측", "군더더기 제거", "한 문장 한 메시지", "따뜻한 격려", "구어체", "권유/비강요", "쉬운 말", "두두 원칙", "원페이지 원액션", "단어 반복 금지", "해요체", "정직한 표현"

## 응답 형식
반드시 아래 JSON 형식으로 응답하세요. JSON 외 다른 텍스트를 포함하지 마세요.

{
  "summary": "전체 UX 라이팅에 대한 1-2문장 요약",
  "score": 0-100,
  "issues": [
    {
      "location": "텍스트가 위치한 UI 요소",
      "original": "원본 텍스트",
      "suggestion": "개선된 텍스트",
      "reason": "어떤 원칙을 위반했는지 + 왜 변경해야 하는지",
      "severity": "critical | warning | info",
      "principle": "위 principle 값 중 하나"
    }
  ],
  "strengths": ["매뉴얼 기준으로 잘 작성된 텍스트에 대한 칭찬"],
  "screenLevel": {
    "hasOneKeyMessage": true/false,
    "hasWordRepetition": true/false,
    "repeatedWords": ["반복된 단어"],
    "ctaCount": 0,
    "ctaClarity": "CTA가 행동을 예측하게 하는지 평가"
  }
}`;

  try {
    const allResults: WritingCheckResult[] = [];

    for (let i = 0; i < frames.length; i++) {
      updateLoadingMsg(freeMode
        ? t("writing.frameAnalyzingFree", { i: i + 1, n: frames.length })
        : t("writing.frameAnalyzing", { i: i + 1, n: frames.length }));

      const userContent = [
        {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/png", data: frames[i].base64 },
        },
        {
          type: "text" as const,
          text: buildWritingUserPrompt(frames[i]),
        },
      ];

      let result;

      if (freeMode) {
        result = await callFreeMode("writing", {
          systemPrompt,
          content: [{ role: "user", content: userContent }],
          frameName: frames[i].name,
        });
      } else {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: getSelectedModel(),
            max_tokens: 4096,
            temperature: 0.2,
            system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userContent }],
          }),
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 429 || status === 401) {
            freeMode = true;
            $("freeModeBanner").className = "free-mode-banner visible";
            result = await callFreeMode("writing", {
              systemPrompt,
              content: [{ role: "user", content: userContent }],
              frameName: frames[i].name,
            });
          } else {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.error?.message || t("error.apiFail", { status }));
          }
        } else {
          const data = await response.json();
          const raw: string = data.content?.[0]?.text ?? "";
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          result = JSON.parse(cleaned);
        }
      }

      allResults.push({ ...result, frameName: frames[i].name, figmaNodeId: frames[i].nodeId });
    }

    showWritingReport(allResults);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(t("error.analysisFail", { msg }));
  }
}

function showWritingReport(results: WritingCheckResult[]) {
  hideLoading();
  $("inputForm").style.display = "none";
  $("writingForm").style.display = "none";

  // Reset applied state
  appliedFixes = new Set();

  const container = $("writingReport");

  let html = "";

  for (let fi = 0; fi < results.length; fi++) {
    const result = results[fi];
    const scoreClass = result.score >= 80 ? "score-good" : result.score >= 60 ? "score-ok" : "score-bad";
    const hasNodeId = !!result.figmaNodeId;
    const hasIssues = result.issues && result.issues.length > 0;

    html += `
      <div class="writing-frame-result">
        <div class="score-row">
          <span class="score-num ${scoreClass}">${result.score}</span>
          <span class="writing-frame-name">${escapeHtml(result.frameName)}</span>
        </div>
        <div class="summary">${escapeHtml(result.summary)}</div>
    `;

    // "전체 적용" button per frame
    if (hasNodeId && hasIssues) {
      html += `<button class="fix-all-btn" data-fix-all="${fi}">${t("writing.applyAllFixes")}</button>`;
    }

    // Screen-level checks
    if (result.screenLevel) {
      const sl = result.screenLevel;
      html += `<div class="section-label">${t("writing.screenCheck")}</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">`;
      html += `<span class="issue-severity ${sl.hasOneKeyMessage ? "sev-low" : "sev-critical"}" style="font-size:10px">${sl.hasOneKeyMessage ? t("writing.oneKey") : t("writing.multiKey")}</span>`;
      html += `<span class="issue-severity ${!sl.hasWordRepetition ? "sev-low" : "sev-medium"}" style="font-size:10px">${!sl.hasWordRepetition ? t("writing.noRepeat") : t("writing.repeat", { words: sl.repeatedWords.map(w => escapeHtml(w)).join(", ") })}</span>`;
      html += `<span class="issue-severity sev-low" style="font-size:10px">${t("writing.ctaCount", { n: sl.ctaCount })}</span>`;
      html += `</div>`;
      if (sl.ctaClarity) {
        html += `<div style="font-size:11px;color:#666;margin-bottom:12px">${escapeHtml(sl.ctaClarity)}</div>`;
      }
    }

    // Strengths
    if (result.strengths && result.strengths.length > 0) {
      html += `<div class="section-label">${t("writing.goodPoints")}</div>`;
      for (const s of result.strengths) {
        html += `<div class="strength-item">✓ ${escapeHtml(s)}</div>`;
      }
    }

    // Issues
    if (hasIssues) {
      html += `<div class="section-label" style="margin-top:12px">${t("writing.improvements", { n: result.issues.length })}</div>`;
      for (let ii = 0; ii < result.issues.length; ii++) {
        const issue = result.issues[ii];
        const sevClass = issue.severity === "critical" ? "sev-critical" : issue.severity === "warning" ? "sev-medium" : "sev-low";
        const sevLabel = issue.severity === "critical" ? t("writing.sev.critical") : issue.severity === "warning" ? t("writing.sev.warning") : t("writing.sev.info");
        html += `
          <div class="writing-issue">
            <div class="writing-issue-header">
              <span class="issue-severity ${sevClass}">${escapeHtml(sevLabel)}</span>
              <span class="issue-screen">${escapeHtml(issue.location)}</span>
              <span class="writing-principle">${escapeHtml(issue.principle)}</span>
              ${hasNodeId ? `<span class="fix-badge" data-fix-badge="${fi}-${ii}">${t("writing.pending")}</span>` : ""}
            </div>
            <div class="writing-compare">
              <div class="writing-before">
                <span class="writing-label">${t("writing.current")}</span>
                <span class="writing-text-del">${escapeHtml(issue.original)}</span>
              </div>
              <div class="writing-after">
                <span class="writing-label writing-label-good">${t("writing.suggestion")}</span>
                <span class="writing-text-new">${escapeHtml(issue.suggestion)}</span>
              </div>
            </div>
            <div class="writing-reason">${escapeHtml(issue.reason)}</div>
          </div>
        `;
      }
    }

    html += `</div>`;
  }

  container.innerHTML = html;
  container.className = "writing-report visible";

  // Attach click handlers for "전체 적용" buttons
  container.querySelectorAll(".fix-all-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const frameIdx = parseInt((btn as HTMLElement).dataset.fixAll || "0", 10);
      applyFixesForFrame(frameIdx);
    });
  });

  // Store results for export
  lastWritingResults = results;

  // Show action buttons
  $("writingActions").style.display = "block";

  // 피드백 바 추가
  const totalIssues = results.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;
  renderFeedbackBar(container, "writing", {
    frameName: results.map((r) => r.frameName).join(", "),
    score: avgScore,
    issueCount: totalIssues,
  });
}

// -------- Loading / error helpers --------
function showLoading() {
  $("inputForm").style.display = "none";
  $("writingForm").style.display = "none";
  $("loading").className = "loading visible";
}
function hideLoading() {
  $("loading").className = "loading";
  if (currentMode === "analysis") {
    $("inputForm").style.display = "flex";
  } else {
    $("writingForm").style.display = "flex";
  }
}
function updateLoadingMsg(msg: string) {
  $("loadingMsg").textContent = msg;
}
function showError(msg: string) {
  const el = $("errorMsg");
  el.textContent = msg;
  el.className = "error-msg visible";
}
function hideError() {
  $("errorMsg").className = "error-msg";
}

// -------- Export functions --------

function writingResultsToCSV(results: WritingCheckResult[]): string {
  const BOM = "\uFEFF";
  const header = ["프레임", "위치", "심각도", "원칙", "현재 문구 (Don't)", "제안 문구 (Do)", "사유"].join(",");
  const rows: string[] = [];

  for (const frame of results) {
    if (frame.issues.length === 0) {
      rows.push([csvEsc(frame.frameName), "", "", "", "", "", "이슈 없음"].join(","));
      continue;
    }
    for (const issue of frame.issues) {
      rows.push([
        csvEsc(frame.frameName),
        csvEsc(issue.location),
        issue.severity === "critical" ? "심각" : issue.severity === "warning" ? "주의" : "참고",
        csvEsc(issue.principle),
        csvEsc(issue.original),
        csvEsc(issue.suggestion),
        csvEsc(issue.reason),
      ].join(","));
    }
  }

  return BOM + header + "\n" + rows.join("\n");
}

function csvEsc(value: string): string {
  if (!value) return "";
  return `"${value.replace(/"/g, '""')}"`;
}

function exportWritingCSV() {
  if (lastWritingResults.length === 0) return;
  const csv = writingResultsToCSV(lastWritingResults);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ux-writing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToSimulo() {
  if (lastWritingResults.length === 0) return;

  // 결과를 압축된 JSON으로 변환 (필수 필드만)
  const compact = {
    fk: lastFileKey,
    frames: lastWritingResults.map((frame) => ({
      f: frame.frameName,
      n: frame.figmaNodeId || "",
      s: frame.score,
      i: frame.issues.map((issue) => ({
        l: issue.location,
        o: issue.original,
        g: issue.suggestion,
        r: issue.reason,
        v: issue.severity,
        p: issue.principle,
      })),
    })),
  };

  const json = JSON.stringify(compact);
  const encoded = btoa(unescape(encodeURIComponent(json)));

  // JSON을 클립보드에도 복사 (수동 import 대안)
  try { navigator.clipboard.writeText(json); } catch { /* sandbox에서 실패 가능 */ }

  // URL hash로 데이터 전달
  const baseUrl = getSimuloBaseUrl();
  const url = `${baseUrl}/ux-writing?tab=checklist#import=${encoded}`;

  // Figma 플러그인 iframe에서는 window.open이 차단됨
  // plugin sandbox의 figma.openExternal()을 통해 외부 URL 열기
  parent.postMessage({ pluginMessage: { type: "open-external", url } }, "*");

  // 알림
  updateLoadingMsg(t("loading.simuloExport"));
  $("loading").className = "loading visible";
  setTimeout(() => { $("loading").className = "loading"; }, 1500);
}

function getSimuloBaseUrl(): string {
  const custom = $<HTMLInputElement>("simuloUrl").value.trim();
  return custom || "https://simulo.vercel.app";
}

// -------- Auto-fix helpers --------

function applyFixesForFrame(frameIdx: number) {
  const result = lastWritingResults[frameIdx];
  if (!result || !result.figmaNodeId) return;

  const fixes = result.issues.map((issue) => ({
    original: issue.original,
    suggestion: issue.suggestion,
  }));

  if (fixes.length === 0) return;

  // Store pending frame index for fix-result handler
  (window as unknown as Record<string, number>).__pendingFixFrameIdx = frameIdx;

  // Show loading indicator
  const btn = document.querySelector(`[data-fix-all="${frameIdx}"]`) as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("writing.applying");
  }

  parent.postMessage({
    pluginMessage: {
      type: "apply-writing-fixes",
      nodeId: result.figmaNodeId,
      fixes,
    },
  }, "*");
}

function updateFixButtons(frameIdx: number) {
  const result = lastWritingResults[frameIdx];
  if (!result) return;

  // Update "전체 적용" button
  const allBtn = document.querySelector(`[data-fix-all="${frameIdx}"]`) as HTMLButtonElement | null;
  if (allBtn) {
    allBtn.disabled = true;
    allBtn.textContent = t("writing.applyComplete");
    allBtn.classList.add("fix-applied");
  }

  // Update individual issue badges
  for (let i = 0; i < result.issues.length; i++) {
    const badge = document.querySelector(`[data-fix-badge="${frameIdx}-${i}"]`);
    if (badge) {
      badge.textContent = t("writing.applied");
      badge.className = "fix-badge fix-applied";
    }
  }
}

// -------- A/B Variant Generation --------
async function runVariantGeneration() {
  const original = $<HTMLInputElement>("variantOriginal")?.value?.trim();
  const goal = $<HTMLSelectElement>("variantGoal")?.value;

  if (!original) {
    showError(t("error.noVariantText"));
    return;
  }

  const apiKey = $<HTMLInputElement>("apiKey")?.value?.trim();
  const simuloUrl = ($<HTMLInputElement>("simuloUrl")?.value?.trim()) || "https://simulo.vercel.app";

  hideError();
  const variantsLoadingEl = $("variantsLoading");
  variantsLoadingEl.textContent = t("loading.variantsGen");
  variantsLoadingEl.style.display = "block";
  $("variantsResult").style.display = "none";
  $<HTMLButtonElement>("runVariantsBtn").disabled = true;

  try {
    const res = await fetch(`${simuloUrl}/api/plugin/generate-variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original, goal, apiKey }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "서버 오류" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json() as {
      original: string;
      goalLabel: string;
      variants: { text: string; reason: string }[];
    };

    renderVariants(data.original, data.goalLabel, data.variants);
  } catch (e) {
    showError(e instanceof Error ? e.message : t("error.variantFail"));
  } finally {
    $("variantsLoading").style.display = "none";
    $<HTMLButtonElement>("runVariantsBtn").disabled = false;
  }
}

function renderVariants(
  original: string,
  goalLabel: string,
  variants: { text: string; reason: string }[],
) {
  const container = $("variantsResult");
  let html = `<div style="font-size:11px;color:#666;margin-bottom:10px;">${t("variants.goalPrefix")}<span style="color:#93c5fd">${goalLabel}</span></div>`;

  for (const v of variants) {
    html += `
      <div class="variant-card" data-text="${v.text.replace(/"/g, "&quot;")}">
        <div class="variant-text">${v.text}</div>
        <div class="variant-reason">${v.reason}</div>
        <button class="variant-apply-btn" data-text="${v.text.replace(/"/g, "&quot;")}">${t("btn.applyToFigma")}</button>
      </div>`;
  }

  container.innerHTML = html;
  container.style.display = "block";

  container.querySelectorAll(".variant-apply-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const replacement = (btn as HTMLElement).dataset.text || "";
      if (!pendingVariantNodeId) {
        showError(t("error.variantApplyFail"));
        return;
      }
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).textContent = t("btn.applying");
      parent.postMessage({
        pluginMessage: {
          type: "apply-variant",
          nodeId: pendingVariantNodeId,
          original,
          replacement,
        },
      }, "*");
      setTimeout(() => {
        (btn as HTMLButtonElement).textContent = t("btn.applied");
      }, 800);
    });
  });
}

// -------- Feedback system --------

function renderFeedbackBar(
  container: HTMLElement,
  mode: "analysis" | "writing",
  context: { frameName?: string; score?: number; issueCount?: number },
) {
  // 기존 피드백 바 제거
  const existing = container.querySelector(".feedback-bar");
  if (existing) existing.remove();

  const bar = document.createElement("div");
  bar.className = "feedback-bar";
  bar.innerHTML = `
    <div class="feedback-prompt">${t("feedback.prompt")}</div>
    <div class="feedback-btns">
      <button class="feedback-btn" data-rating="good">${t("feedback.good")}</button>
      <button class="feedback-btn" data-rating="bad">${t("feedback.bad")}</button>
    </div>
    <div class="feedback-comment" id="feedbackComment-${mode}">
      <textarea placeholder="${t("feedback.placeholder")}"></textarea>
      <button class="feedback-submit">${t("feedback.submit")}</button>
    </div>
    <div class="feedback-done" style="display:none">${t("feedback.done")}</div>
  `;
  container.appendChild(bar);

  let selectedRating: "good" | "bad" | null = null;
  const btns = bar.querySelectorAll(".feedback-btn");
  const commentBox = bar.querySelector(".feedback-comment") as HTMLElement;
  const doneMsg = bar.querySelector(".feedback-done") as HTMLElement;

  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const rating = (btn as HTMLElement).dataset.rating as "good" | "bad";
      selectedRating = rating;

      // 버튼 상태 업데이트
      btns.forEach((b) => b.className = "feedback-btn");
      btn.className = `feedback-btn selected-${rating}`;

      if (rating === "good") {
        // 좋아요는 바로 전송
        commentBox.classList.remove("visible");
        submitFeedback(mode, "good", undefined, context);
        bar.querySelector(".feedback-btns")?.remove();
        bar.querySelector(".feedback-prompt")?.remove();
        commentBox.style.display = "none";
        doneMsg.style.display = "block";
      } else {
        // 아쉬워요는 코멘트 입력 표시
        commentBox.classList.add("visible");
      }
    });
  });

  // 코멘트 전송
  const submitBtn = bar.querySelector(".feedback-submit") as HTMLButtonElement;
  const textarea = bar.querySelector("textarea") as HTMLTextAreaElement;
  submitBtn.addEventListener("click", () => {
    if (!selectedRating) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "전송 중...";
    submitFeedback(mode, selectedRating, textarea.value.trim(), context);
    setTimeout(() => {
      bar.querySelector(".feedback-btns")?.remove();
      bar.querySelector(".feedback-prompt")?.remove();
      commentBox.style.display = "none";
      doneMsg.style.display = "block";
    }, 300);
  });
}

async function submitFeedback(
  type: "analysis" | "writing",
  rating: "good" | "bad",
  comment: string | undefined,
  context: { frameName?: string; score?: number; issueCount?: number },
) {
  const baseUrl = getSimuloBaseUrl();
  try {
    await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, rating, comment, context }),
    });
  } catch {
    // 피드백 전송 실패는 무시 (UX 차단하지 않음)
  }
}

// -------- Free mode (Simulo backend proxy) --------
async function callFreeMode(
  mode: "analysis" | "writing",
  payload: { systemPrompt: string; content: unknown; frameName?: string },
): Promise<AnalysisResult | WritingCheckResult> {
  const baseUrl = getSimuloBaseUrl();
  const response = await fetch(`${baseUrl}/api/analyze-free`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      systemPrompt: payload.systemPrompt,
      content: payload.content,
      frameName: payload.frameName,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || t("error.freeFail", { status: response.status }));
  }

  const data = await response.json();
  return data.result;
}

// -------- Google Sheets export --------

function updateSheetsButtonState() {
  const btn = $<HTMLButtonElement>("exportSheetsBtn");
  if (!btn) return;
  btn.textContent = googleTokens ? t("export.sheets") : t("export.sheetsConnect");
}

function generateSessionId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function startGoogleAuth(): Promise<boolean> {
  const baseUrl = getSimuloBaseUrl();
  const sessionId = generateSessionId();

  // Open auth URL in external browser
  parent.postMessage({
    pluginMessage: { type: "open-external", url: `${baseUrl}/api/google/auth?plugin_session=${sessionId}` },
  }, "*");

  showFixToast(t("google.connectHint"), "success");

  // Poll for tokens
  return new Promise<boolean>((resolve) => {
    let attempts = 0;
    const maxAttempts = 60; // 2s * 60 = 2분 타임아웃

    if (googleAuthPollTimer) clearInterval(googleAuthPollTimer);

    googleAuthPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (googleAuthPollTimer) clearInterval(googleAuthPollTimer);
        googleAuthPollTimer = null;
        showFixToast(t("google.timeout"), "error");
        resolve(false);
        return;
      }

      try {
        const res = await fetch(`${baseUrl}/api/google/token-check?session=${sessionId}`);
        const data = await res.json();
        if (data.status === "ready" && data.tokens) {
          if (googleAuthPollTimer) clearInterval(googleAuthPollTimer);
          googleAuthPollTimer = null;
          googleTokens = data.tokens;
          // Save to clientStorage
          parent.postMessage({
            pluginMessage: { type: "save-google-tokens", tokens: JSON.stringify(googleTokens) },
          }, "*");
          updateSheetsButtonState();
          showFixToast(t("google.connected"), "success");
          resolve(true);
        }
      } catch {
        // 네트워크 에러 무시, 계속 폴링
      }
    }, 2000);
  });
}

async function exportToGoogleSheets() {
  if (lastWritingResults.length === 0) return;

  // 인증 안 됐으면 인증 먼저
  if (!googleTokens) {
    const authenticated = await startGoogleAuth();
    if (!authenticated) return;
  }

  const btn = $<HTMLButtonElement>("exportSheetsBtn");
  btn.disabled = true;
  btn.textContent = t("loading.sheetsExport");

  const baseUrl = getSimuloBaseUrl();

  const sessions = [{
    createdAt: new Date().toISOString(),
    frames: lastWritingResults.map((r) => ({
      frameName: r.frameName,
      score: r.score,
      issues: r.issues.map((iss) => ({
        location: iss.location,
        original: iss.original,
        suggestion: iss.suggestion,
        reason: iss.reason,
        severity: iss.severity,
        principle: iss.principle,
      })),
    })),
  }];

  try {
    const res = await fetch(`${baseUrl}/api/google/sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: googleTokens?.access_token ?? "",
        refreshToken: googleTokens?.refresh_token ?? "",
        sessions,
        spreadsheetId: savedSpreadsheetId || undefined,
      }),
    });

    const data = await res.json();

    if (data.error === "google_token_expired") {
      // 토큰 만료 → 재인증
      googleTokens = null;
      parent.postMessage({ pluginMessage: { type: "save-google-tokens", tokens: "" } }, "*");
      updateSheetsButtonState();
      showFixToast(t("google.expired"), "error");
      btn.disabled = false;
      btn.textContent = t("export.sheetsConnect");
      return;
    }

    if (data.error) {
      throw new Error(data.error);
    }

    // 성공: spreadsheetId 저장 (다음번에 append)
    if (data.spreadsheetId) {
      savedSpreadsheetId = data.spreadsheetId;
      parent.postMessage({
        pluginMessage: { type: "save-spreadsheet-id", spreadsheetId: data.spreadsheetId },
      }, "*");
    }

    // 시트 열기
    if (data.url) {
      parent.postMessage({ pluginMessage: { type: "open-external", url: data.url } }, "*");
    }

    const label = data.appended ? t("export.sheetsAppended") : t("export.sheetsCreated");
    showFixToast(t("export.sheetsSuccess", { label }), "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : t("loading.sheetsExport");
    showFixToast(t("export.sheetsFail", { msg }), "error");
  } finally {
    btn.disabled = false;
    btn.textContent = googleTokens ? t("export.sheets") : t("export.sheetsConnect");
  }
}

function showFixToast(message: string, type: "success" | "error") {
  // Remove existing toast
  const existing = document.querySelector(".fix-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `fix-toast fix-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fix-toast-hide");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
