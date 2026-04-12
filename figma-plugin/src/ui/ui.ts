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

let selectedImages: ImageItem[] = [];

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
  $("resetBtn").addEventListener("click", resetToInput);

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

  if (msg.type === "error") {
    hideLoading();
    showError(msg.message);
  }
};

// -------- Selection state --------
function updateSelectionBar(count: number, names: string[]) {
  const bar = $("selectionBar");
  const btn = $<HTMLButtonElement>("runBtn");

  if (count === 0) {
    bar.textContent = "프레임이나 레이어를 선택해주세요";
    bar.className = "selection-bar";
    btn.disabled = true;
    btn.textContent = "선택된 항목 없음";
  } else {
    const preview = names.slice(0, 2).join(", ");
    const suffix = names.length > 2 ? " 외" : "";
    bar.textContent = `${count}개 선택됨 — ${preview}${suffix}`;
    bar.className = "selection-bar active";
    btn.disabled = false;
    btn.textContent = `${Math.min(count, 8)}개 화면 분석 시작`;
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
  $("inputForm").style.display = "flex";
  selectedImages = [];
}

// -------- Loading / error helpers --------
function showLoading() {
  $("inputForm").style.display = "none";
  $("loading").className = "loading visible";
}
function hideLoading() {
  $("loading").className = "loading";
  $("inputForm").style.display = "flex";
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
