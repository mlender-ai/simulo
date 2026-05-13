// Simulo Figma Plugin — UI logic (iframe side)
// Communicates with plugin sandbox via parent.postMessage.

interface ExtractedText {
  text: string;
  parentName: string;
  fontSize: number | null;
  fontWeight: string | null;
}

interface ImageItem {
  name: string;
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
  screenLevel?: ScreenLevel;
}

let selectedImages: ImageItem[] = [];
let currentMode: "analysis" | "writing" = "analysis";
let lastWritingResults: WritingCheckResult[] = [];

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
  // Request saved API key and Simulo URL from plugin sandbox
  parent.postMessage({ pluginMessage: { type: "load-api-key" } }, "*");
  parent.postMessage({ pluginMessage: { type: "load-simulo-url" } }, "*");

  // Save API key on change
  $("apiKey").addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    if (val) {
      parent.postMessage({ pluginMessage: { type: "save-api-key", key: val } }, "*");
    }
  });

  // Save Simulo URL on change
  $("simuloUrl").addEventListener("change", (e) => {
    const val = (e.target as HTMLInputElement).value.trim();
    parent.postMessage({ pluginMessage: { type: "save-simulo-url", url: val } }, "*");
  });

  $("settingsToggle").addEventListener("click", () => {
    $("settingsPanel").classList.toggle("visible");
  });

  $("runBtn").addEventListener("click", runAnalysis);
  $("runWritingBtn").addEventListener("click", runWritingCheck);
  $("resetBtn").addEventListener("click", resetToInput);
  $("writingResetBtn").addEventListener("click", resetToInput);
  $("exportCsvBtn").addEventListener("click", exportWritingCSV);
  $("exportSimuloBtn").addEventListener("click", exportToSimulo);

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

  if (msg.type === "api-key-loaded") {
    const key = msg.key as string;
    if (key) {
      $<HTMLInputElement>("apiKey").value = key;
    }
  }

  if (msg.type === "simulo-url-loaded") {
    const url = msg.url as string;
    if (url) {
      $<HTMLInputElement>("simuloUrl").value = url;
    }
  }

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
  return $<HTMLInputElement>("apiKey").value.trim();
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
    text: `가설: "${hypothesis}"\n타깃 유저: "${targetUser || "일반 사용자"}"\n\n위 화면들을 분석하여 가설에 대한 사용성 평가를 JSON으로 반환해주세요.\n\n중요: 각 화면의 텍스트는 Figma 레이어에서 직접 추출한 것이므로 정확합니다. 이미지에서 텍스트를 OCR로 읽지 말고 추출된 텍스트를 기준으로 분석하세요.`,
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
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

function buildWritingUserPrompt(frame: ImageItem): string {
  let prompt = `이 UI 화면("${frame.name}")에 보이는 모든 텍스트의 UX 라이팅 품질을 분석해주세요.\n\n`;

  if (frame.texts && frame.texts.length > 0) {
    prompt += `## Figma에서 추출한 실제 텍스트 목록\n아래는 이 화면의 Figma 레이어에서 직접 추출한 정확한 텍스트입니다. 이미지의 텍스트를 OCR로 읽지 말고, 아래 텍스트를 기준으로 분석하세요. 이미지는 레이아웃과 시각적 맥락 파악용으로만 참고하세요.\n\n`;
    for (const t of frame.texts) {
      const meta: string[] = [];
      if (t.parentName) meta.push(`위치: ${t.parentName}`);
      if (t.fontSize) meta.push(`${t.fontSize}px`);
      if (t.fontWeight === "bold") meta.push("볼드");
      prompt += `- "${t.text}"${meta.length > 0 ? ` (${meta.join(", ")})` : ""}\n`;
    }
    prompt += `\n총 ${frame.texts.length}개 텍스트 노드.\n`;
  }

  prompt += `\nJSON만 반환하세요.`;
  return prompt;
}

async function startWritingCheck(frames: ImageItem[]) {
  const apiKey = getApiKey();

  const systemPrompt = `당신은 야핏무브 UX 라이팅 전문가입니다. 야핏무브 UX 라이팅 매뉴얼(v1.0)에 근거하여 Figma 디자인 프레임의 모든 텍스트를 분석합니다.

## 역할 범위 — 반드시 준수
당신의 역할은 **화면에 표시된 문장/문구의 표현 품질만 평가**하는 것입니다.
- 기능 기획 의도, 콘텐츠 방향성, 제품 정체성에 대한 판단은 **절대 하지 마세요.**
- 화면에 있는 기능(운세뽑기, 게이미피케이션, 이벤트 등)은 이미 결정된 기획입니다. 해당 기능이 브랜드에 적합한지 여부를 평가하지 마세요.
- 오직 **문장 표현이 매뉴얼 원칙에 맞는지**만 체크하세요: 해요체 여부, 군더더기, CTA 명확성, 구어체, 단어 반복, 따뜻한 톤 등.
- 예: "운세뽑기" 기능이 있다면, "운세뽑기가 건강 앱에 맞지 않음"이라고 하지 마세요. 대신 "운세뽑기" 버튼의 CTA 문구가 행동을 예측하게 하는지, 해요체인지, 군더더기가 없는지만 평가하세요.

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
          model: "claude-sonnet-4-20250514",
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
                text: buildWritingUserPrompt(frames[i]),
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

    // Screen-level checks
    if (result.screenLevel) {
      const sl = result.screenLevel;
      html += `<div class="section-label">화면 단위 체크</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">`;
      html += `<span class="issue-severity ${sl.hasOneKeyMessage ? "sev-low" : "sev-critical"}" style="font-size:10px">${sl.hasOneKeyMessage ? "✓ 핵심 메시지 1개" : "✗ 핵심 메시지 복수"}</span>`;
      html += `<span class="issue-severity ${!sl.hasWordRepetition ? "sev-low" : "sev-medium"}" style="font-size:10px">${!sl.hasWordRepetition ? "✓ 단어 반복 없음" : `✗ 반복: ${sl.repeatedWords.map(w => escapeHtml(w)).join(", ")}`}</span>`;
      html += `<span class="issue-severity sev-low" style="font-size:10px">CTA ${sl.ctaCount}개</span>`;
      html += `</div>`;
      if (sl.ctaClarity) {
        html += `<div style="font-size:11px;color:#666;margin-bottom:12px">${escapeHtml(sl.ctaClarity)}</div>`;
      }
    }

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

  // Store results for export
  lastWritingResults = results;

  // Show action buttons
  $("writingActions").style.display = "block";
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
  const compact = lastWritingResults.map((frame) => ({
    f: frame.frameName,
    s: frame.score,
    i: frame.issues.map((issue) => ({
      l: issue.location,
      o: issue.original,
      g: issue.suggestion,
      r: issue.reason,
      v: issue.severity,
      p: issue.principle,
    })),
  }));

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
  updateLoadingMsg("Simulo 페이지를 여는 중...");
  $("loading").className = "loading visible";
  setTimeout(() => { $("loading").className = "loading"; }, 1500);
}

function getSimuloBaseUrl(): string {
  const custom = $<HTMLInputElement>("simuloUrl").value.trim();
  return custom || "https://simulo.vercel.app";
}
