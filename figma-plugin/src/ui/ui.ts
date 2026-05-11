// Simulo Figma Plugin — UI logic (iframe side)
// Communicates with plugin sandbox via parent.postMessage.

interface ImageItem {
  name: string;
  base64: string;
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

interface WritingCheckResult {
  summary: string;
  score: number;
  issues: WritingIssue[];
  strengths: string[];
  frameName: string;
}

let selectedImages: ImageItem[] = [];
let currentMode: "analysis" | "writing" = "analysis";

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
window.addEventListener("DOMContentLoaded", () => {
  // Restore saved API key
  try {
    const savedKey = localStorage.getItem("simulo_api_key");
    if (savedKey) {
      $<HTMLInputElement>("apiKey").value = savedKey;
    }
  } catch {
    // localStorage may be blocked in iframe; ignore
  }

  // Wire up listeners
  $("apiKey").addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    try {
      if (val) localStorage.setItem("simulo_api_key", val);
    } catch {
      /* ignore */
    }
  });

  $("settingsToggle").addEventListener("click", () => {
    $("settingsPanel").classList.toggle("visible");
  });

  $("runBtn").addEventListener("click", runAnalysis);
  $("runWritingBtn").addEventListener("click", runWritingCheck);
  $("resetBtn").addEventListener("click", resetToInput);
  $("writingResetBtn").addEventListener("click", resetToInput);

  // Mode toggle
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = (tab as HTMLElement).dataset.mode as "analysis" | "writing";
      if (mode) switchMode(mode);
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = (tab as HTMLElement).dataset.tab;
      if (name) switchTab(name);
    });
  });

  // Request initial file info
  parent.postMessage({ pluginMessage: { type: "get-file-info" } }, "*");
});

// -------- Messages from plugin sandbox --------
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === "selection-changed") {
    updateSelectionBar(msg.count, msg.names);
  }

  if (msg.type === "file-info") {
    updateSelectionBar(msg.selectionCount, msg.names || []);
  }

  if (msg.type === "selection-ready") {
    selectedImages = msg.images as ImageItem[];
    startAnalysisWithImages();
  }

  if (msg.type === "writing-selection-ready") {
    const frames = msg.frames as ImageItem[];
    startWritingCheck(frames);
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
  const writingBtn = $<HTMLButtonElement>("runWritingBtn");

  if (count === 0) {
    bar.textContent = "프레임이나 레이어를 선택해주세요";
    bar.className = "selection-bar";
    analysisBtn.disabled = true;
    analysisBtn.textContent = "선택된 항목 없음";
    writingBtn.disabled = true;
    writingBtn.textContent = "선택된 항목 없음";
  } else {
    const preview = names.slice(0, 2).join(", ");
    const suffix = names.length > 2 ? " 외" : "";
    bar.textContent = `${count}개 선택됨 — ${preview}${suffix}`;
    bar.className = "selection-bar active";
    const n = Math.min(count, 8);
    analysisBtn.disabled = false;
    analysisBtn.textContent = `${n}개 화면 분석 시작`;
    writingBtn.disabled = false;
    writingBtn.textContent = `${n}개 화면 UX 라이팅 체크`;
  }
}

// -------- Run analysis --------
function runAnalysis() {
  const apiKey = getApiKey();
  if (!apiKey) {
    showError("API 키를 입력해주세요. 상단 API 설정에서 입력할 수 있습니다.");
    $("settingsPanel").classList.add("visible");
    return;
  }

  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  if (!hypothesis) {
    showError("가설을 입력해주세요.");
    return;
  }

  hideError();
  showLoading();
  parent.postMessage({ pluginMessage: { type: "get-selection" } }, "*");
}

function getApiKey(): string {
  const val = $<HTMLInputElement>("apiKey").value.trim();
  if (val) return val;
  try {
    return localStorage.getItem("simulo_api_key") || "";
  } catch {
    return "";
  }
}

// -------- Claude API call --------
async function startAnalysisWithImages() {
  const apiKey = getApiKey();
  const hypothesis = $<HTMLTextAreaElement>("hypothesis").value.trim();
  const targetUser = $<HTMLInputElement>("targetUser").value.trim();

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
  });
  content.push({
    type: "text",
    text: `가설: "${hypothesis}"\n타깃 유저: "${targetUser || "일반 사용자"}"\n\n위 화면들을 분석하여 가설에 대한 사용성 평가를 JSON으로 반환해주세요.`,
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
    updateLoadingMsg("AI가 화면을 분석 중...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 오류 ${response.status}`);
    }

    const data = await response.json();
    const raw: string = data.content?.[0]?.text ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result: AnalysisResult = JSON.parse(cleaned);

    showReport(result);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(`분석 실패: ${msg}`);
  }
}

// -------- Report rendering --------
function showReport(result: AnalysisResult) {
  hideLoading();

  $("reportScore").textContent = String(result.score ?? "-");

  const verdictEl = $("reportVerdict");
  verdictEl.textContent = result.verdict || "-";
  const verdictClass =
    result.verdict === "통과"
      ? "verdict-pass"
      : result.verdict === "부분 통과"
        ? "verdict-partial"
        : "verdict-fail";
  verdictEl.className = `verdict-badge ${verdictClass}`;

  $("reportSummary").textContent = result.summary || "";

  const strengthsHtml = (result.strengths || [])
    .map((s) => `<div class="strength-item">+ ${escapeHtml(s)}</div>`)
    .join("");
  $("reportStrengths").innerHTML =
    strengthsHtml || '<div class="empty">강점 없음</div>';

  const thinkHtml = (result.thinkAloud || [])
    .map(
      (t) => `
      <div class="think-wrap">
        <div class="think-screen">${escapeHtml(t.screen)}</div>
        <div class="think-aloud">&ldquo;${escapeHtml(t.thought)}&rdquo;</div>
      </div>`
    )
    .join("");
  $("reportThinkAloud").innerHTML =
    thinkHtml || '<div class="empty">Think Aloud 없음</div>';

  const sevClass = (s: string) =>
    s === "심각" ? "sev-critical" : s === "보통" ? "sev-medium" : "sev-low";
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
    issuesHtml || '<div class="empty">발견된 이슈 없음</div>';

  $("inputForm").style.display = "none";
  $("report").className = "report visible";
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
  $("writingResetBtn").style.display = "none";
  selectedImages = [];

  if (currentMode === "analysis") {
    $("inputForm").style.display = "flex";
    $("writingForm").style.display = "none";
  } else {
    $("inputForm").style.display = "none";
    $("writingForm").style.display = "flex";
  }
}

// -------- Mode switching --------
function switchMode(mode: "analysis" | "writing") {
  currentMode = mode;
  document.querySelectorAll(".mode-tab").forEach((el) => {
    const m = (el as HTMLElement).dataset.mode;
    el.className = "mode-tab" + (m === mode ? " active" : "");
  });

  // Show/hide form sections
  $("inputForm").style.display = mode === "analysis" ? "flex" : "none";
  $("writingForm").style.display = mode === "writing" ? "flex" : "none";
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
  const apiKey = getApiKey();
  if (!apiKey) {
    showError("API 키를 입력해주세요. 상단 API 설정에서 입력할 수 있습니다.");
    $("settingsPanel").classList.add("visible");
    return;
  }

  hideError();
  showLoading();
  updateLoadingMsg("프레임 텍스트를 분석 중...");
  parent.postMessage({ pluginMessage: { type: "get-selection-for-writing" } }, "*");
}

async function startWritingCheck(frames: ImageItem[]) {
  const apiKey = getApiKey();

  const systemPrompt = `당신은 UX 라이팅 전문가입니다. Figma 디자인 프레임 이미지를 분석하여 화면에 보이는 모든 텍스트의 UX 라이팅 품질을 평가합니다.

## 평가 기준
1. 명확성(Clarity): 사용자가 즉시 이해할 수 있는가?
2. 간결성(Conciseness): 불필요한 단어 없이 핵심만 전달하는가?
3. 행동 유도(Actionability): CTA와 버튼이 구체적 행동을 유도하는가?
4. 일관성(Consistency): 톤, 높임말, 용어가 일관적인가?
5. 공감(Empathy): 에러/빈 상태에서 사용자를 배려하는가?
6. 접근성(Accessibility): 전문 용어 없이 누구나 이해 가능한가?

## 심각도
- critical: 사용자가 오해하거나 행동을 못 하는 텍스트
- warning: 개선하면 전환율/만족도가 올라가는 텍스트
- info: 더 나은 대안이 있는 텍스트

JSON만 반환하세요:
{
  "summary": "전체 요약",
  "score": 0-100,
  "issues": [{"location":"UI 요소","original":"원본","suggestion":"제안","reason":"이유","severity":"critical|warning|info","principle":"원칙"}],
  "strengths": ["잘된 점"]
}`;

  try {
    const allResults: WritingCheckResult[] = [];

    for (let i = 0; i < frames.length; i++) {
      updateLoadingMsg(`프레임 ${i + 1}/${frames.length} 분석 중...`);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: frames[i].base64 },
              },
              {
                type: "text",
                text: `이 UI 화면("${frames[i].name}")에 보이는 모든 텍스트의 UX 라이팅 품질을 분석해주세요. JSON만 반환하세요.`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API 오류 ${response.status}`);
      }

      const data = await response.json();
      const raw: string = data.content?.[0]?.text ?? "";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(cleaned);
      allResults.push({ ...result, frameName: frames[i].name });
    }

    showWritingReport(allResults);
  } catch (error) {
    hideLoading();
    const msg = error instanceof Error ? error.message : String(error);
    showError(`분석 실패: ${msg}`);
  }
}

function showWritingReport(results: WritingCheckResult[]) {
  hideLoading();
  $("inputForm").style.display = "none";
  $("writingForm").style.display = "none";

  const container = $("writingReport");

  let html = "";

  for (const result of results) {
    const scoreClass = result.score >= 80 ? "score-good" : result.score >= 60 ? "score-ok" : "score-bad";

    html += `
      <div class="writing-frame-result">
        <div class="score-row">
          <span class="score-num ${scoreClass}">${result.score}</span>
          <span class="writing-frame-name">${escapeHtml(result.frameName)}</span>
        </div>
        <div class="summary">${escapeHtml(result.summary)}</div>
    `;

    // Strengths
    if (result.strengths && result.strengths.length > 0) {
      html += `<div class="section-label">잘 된 점</div>`;
      for (const s of result.strengths) {
        html += `<div class="strength-item">✓ ${escapeHtml(s)}</div>`;
      }
    }

    // Issues
    if (result.issues && result.issues.length > 0) {
      html += `<div class="section-label" style="margin-top:12px">개선 사항 (${result.issues.length})</div>`;
      for (const issue of result.issues) {
        const sevClass = issue.severity === "critical" ? "sev-critical" : issue.severity === "warning" ? "sev-medium" : "sev-low";
        html += `
          <div class="writing-issue">
            <div class="writing-issue-header">
              <span class="issue-severity ${sevClass}">${escapeHtml(issue.severity === "critical" ? "심각" : issue.severity === "warning" ? "주의" : "참고")}</span>
              <span class="issue-screen">${escapeHtml(issue.location)}</span>
              <span class="writing-principle">${escapeHtml(issue.principle)}</span>
            </div>
            <div class="writing-compare">
              <div class="writing-before">
                <span class="writing-label">현재</span>
                <span class="writing-text-del">${escapeHtml(issue.original)}</span>
              </div>
              <div class="writing-after">
                <span class="writing-label writing-label-good">제안</span>
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

  // Show reset button
  $("writingResetBtn").style.display = "block";
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
