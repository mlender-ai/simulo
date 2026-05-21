// Simulo Figma Plugin — i18n (ko / en / ja)

export type Lang = "ko" | "en" | "ja";

let _lang: Lang = "ko";

export function getLang(): Lang { return _lang; }
export function setLang(lang: Lang) { _lang = lang; }

/** Translate a key with optional variable substitution: t("key", {n: 5}) → replaces {n} */
export function t(key: string, vars?: Record<string, string | number>): string {
  const str = (STRINGS[_lang] ?? STRINGS.ko)[key] ?? STRINGS.ko[key] ?? key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

const STRINGS: Record<Lang, Record<string, string>> = {
  ko: {
    // Settings
    "settings.toggle": "⚙ API 설정",
    "settings.apiKeyLabel": "Anthropic API Key",
    "settings.apiKeyHint": "입력한 키는 이 기기에만 저장됩니다. 없으면 무료 모드로 작동합니다.",
    "settings.modelLabel": "분석 모델",
    "settings.modelHaiku": "Haiku (빠르고 저렴 — 기본)",
    "settings.modelSonnet": "Sonnet (정밀 분석)",
    "settings.modelHint": "Haiku: 90% 비용 절감. Sonnet: 복잡한 화면 정밀 분석 시 추천",
    "settings.simuloUrlLabel": "Simulo URL (선택)",
    "settings.simuloUrlHint": "로컬 테스트 시 http://localhost:3000 입력",
    "settings.langLabel": "언어",

    // Free mode
    "freeMode.banner": "⚠ 무료 모드로 분석합니다. API 키가 없거나 사용량을 초과했습니다. 품질이 저하될 수 있습니다.",

    // Mode tabs
    "mode.analysis": "UX 분석",
    "mode.writing": "UX 라이팅",
    "mode.variants": "A/B 변형",

    // Selection bar
    "selection.empty": "프레임이나 레이어를 선택해주세요",
    "selection.count": "{n}개 선택됨 — {names}",
    "selection.countSuffix": " 외",

    // Analysis mode sub-tabs
    "analysisMode.hypothesis": "가설 검증",
    "analysisMode.usability": "사용성 분석",

    // Form labels & placeholders
    "form.hypothesis": "가설",
    "form.hypothesisPlaceholder": "예: 신규 유저가 마일리지 적립 방법을 이해하고 첫 미션을 완료할 수 있는가?",
    "form.targetUser": "타깃 유저",
    "form.targetUserPlaceholder": "예: 야핏무브 신규 설치 유저, 30대 직장인",
    "form.defaultTargetUser": "일반 사용자",
    "form.focusKeyword": "분석 관점 키워드",
    "form.focusKeywordPlaceholder": "예: 손실회피, 온보딩, 첫인상, CTA 전환",
    "form.focusKeywordHint": "입력 시 해당 관점을 중점으로 분석합니다",

    // Buttons
    "btn.noSelection": "선택된 항목 없음",
    "btn.analyze": "화면 분석 시작",
    "btn.analyzeMulti": "{n}개 화면 통합 분석",
    "btn.flow": "🔗 플로우 분석 (화면 간 전환 마찰)",
    "btn.multiIndividual": "📋 개별 분석 ({n}장 각각)",
    "btn.writingCheck": "{n}개 화면 UX 라이팅 체크",
    "btn.reset": "← 다시 분석",
    "btn.writingReset": "← 다시 체크",
    "btn.generateVariants": "변형 생성",
    "btn.applyToFigma": "Figma에 적용",
    "btn.applying": "적용 중...",
    "btn.applied": "✓ 적용됨",

    // Report tabs
    "tab.overview": "Overview",
    "tab.thinkAloud": "Think Aloud",
    "tab.issues": "이슈",

    // Report
    "report.strengths": "강점",
    "report.noStrengths": "강점 없음",
    "report.noThinkAloud": "Think Aloud 없음",
    "report.usabilityNoThinkAloud": "사용성 분석에서는 Think Aloud 없음",
    "report.noIssues": "발견된 이슈 없음",
    "report.scoreBreakdown": "점수 세부",
    "report.quickWins": "Quick Wins",
    "tab.improvements": "개선안",
    "report.improvements.quickWins": "빠른 개선 (Quick Wins)",
    "report.improvements.recommendations": "이슈별 권고안",
    "report.improvements.noData": "개선 데이터 없음",
    "report.effort": "노력",
    "report.impact": "임팩트",
    "report.scoreReason": "이유",
    "report.verdict.pass": "통과",
    "report.verdict.partial": "부분 통과",
    "report.verdict.fail": "실패",

    // Flow
    "flow.screenTransition": "화면 간 전환 분석",
    "flow.dropOffRisk": "{n}% 이탈 위험",
    "flow.frictionIssues": "전환 마찰 이슈",
    "flow.noFriction": "전환 마찰 없음",
    "flow.label": "플로우 분석 — {verdict}",
    "flow.analyzing": "{n}개 화면 플로우 분석 중...",
    "flow.extracting": "플로우 분석용 화면을 추출 중...",
    "flow.error": "플로우 분석 실패: {msg}",
    "flow.apiFail": "플로우 분석 실패 ({status})",

    // Multi-frame
    "multi.extracting": "선택된 프레임을 추출 중...",
    "multi.analyzing": "{current} / {total} 분석 중... \"{name}\"",
    "multi.frameName": "화면 {n}",
    "multi.analysisFail": "분석 실패: {msg}",

    // Loading
    "loading.default": "화면을 분석하고 있습니다...",
    "loading.analyzing": "AI가 화면을 분석 중...",
    "loading.usability": "사용성 분석 중...",
    "loading.writingFrame": "프레임 텍스트를 분석 중...",
    "loading.simuloExport": "Simulo 페이지를 여는 중...",
    "loading.sheetsExport": "내보내는 중...",
    "loading.variantsGen": "AI가 변형을 생성 중...",

    // Writing
    "writing.hint": "Figma에서 프레임을 선택한 후 아래 버튼을 누르면, 화면의 모든 텍스트를 분석하여 UX 라이팅 개선점을 찾아드립니다.",
    "writing.screenCheck": "화면 단위 체크",
    "writing.oneKey": "✓ 핵심 메시지 1개",
    "writing.multiKey": "✗ 핵심 메시지 복수",
    "writing.noRepeat": "✓ 단어 반복 없음",
    "writing.repeat": "✗ 반복: {words}",
    "writing.ctaCount": "CTA {n}개",
    "writing.goodPoints": "잘 된 점",
    "writing.improvements": "개선 사항 ({n})",
    "writing.applyAllFixes": "전체 수정 적용 (복제 프레임 생성)",
    "writing.applying": "적용 중...",
    "writing.applyComplete": "✓ 적용 완료",
    "writing.sev.critical": "심각",
    "writing.sev.warning": "주의",
    "writing.sev.info": "참고",
    "writing.pending": "수정 대기",
    "writing.applied": "적용됨",
    "writing.current": "현재",
    "writing.suggestion": "제안",
    "writing.frameSuffix": " (무료 모드)",
    "writing.frameAnalyzing": "프레임 {i}/{n} 분석 중...",
    "writing.frameAnalyzingFree": "프레임 {i}/{n} 분석 중 (무료 모드)...",

    // Export
    "export.csv": "CSV 내보내기",
    "export.simulo": "Simulo에 저장",
    "export.sheets": "구글 시트 내보내기",
    "export.sheetsConnect": "구글 연동 후 내보내기",
    "export.sheetsAppended": "기존 시트에 추가됨",
    "export.sheetsCreated": "새 시트 생성됨",
    "export.sheetsSuccess": "{label} — Google 시트가 열립니다.",
    "export.sheetsFail": "구글 시트 내보내기 실패: {msg}",

    // Google auth
    "google.connectHint": "브라우저에서 Google 계정을 연동해주세요.",
    "google.timeout": "Google 인증 시간 초과. 다시 시도해주세요.",
    "google.connected": "Google 연동 완료!",
    "google.expired": "Google 인증이 만료되었습니다. 다시 연동해주세요.",

    // Feedback
    "feedback.prompt": "분석 결과가 도움이 되었나요?",
    "feedback.good": "👍 좋아요",
    "feedback.bad": "👎 아쉬워요",
    "feedback.placeholder": "어떤 점이 아쉬웠나요? (예: 기획 의도와 맞지 않는 제안, 불필요한 수정 등)",
    "feedback.submit": "피드백 보내기",
    "feedback.done": "피드백이 전송되었습니다. 감사합니다!",

    // Errors
    "error.noHypothesis": "가설을 입력해주세요.",
    "error.noFlowHypothesis": "가설을 입력해주세요. (예: 신규 유저가 결제까지 완료할 수 있는가?)",
    "error.analysisFail": "분석 실패: {msg}",
    "error.freeFail": "무료 분석 실패 ({status})",
    "error.apiFail": "API 오류 {status}",
    "error.noVariantText": "원본 텍스트를 입력하세요",
    "error.variantApplyFail": "적용할 텍스트 노드를 Figma에서 선택해주세요",
    "error.variantFail": "변형 적용 실패",

    // Variants
    "variants.hint": "텍스트 노드를 선택하거나 직접 입력하고, 개선 목표를 선택하면 AI가 변형을 생성합니다.",
    "variants.original": "원본 텍스트",
    "variants.originalPlaceholder": "예: 시작하기",
    "variants.goal": "개선 목표",
    "variants.goal.conversion": "전환율 높이기",
    "variants.goal.trust": "신뢰 강화",
    "variants.goal.concise": "더 간결하게",
    "variants.goal.friendly": "더 친근하게",
    "variants.goal.urgency": "긴급감 부여",
    "variants.goal.clarity": "더 명확하게",
    "variants.goalPrefix": "목표: ",

    // Toast
    "toast.fixApplied": "{applied}/{total}개 수정이 복제 프레임에 적용되었습니다.",
    "toast.fixFail": "수정 실패: {msg}",

    // API system prompt verdict labels (for direct Claude call)
    "api.verdict.pass": "통과",
    "api.verdict.partial": "부분 통과",
    "api.verdict.fail": "실패",
    "api.sev.critical": "심각",
    "api.sev.medium": "보통",
    "api.sev.low": "낮음",
    "api.taskLikelihood.high": "높음",
    "api.taskLikelihood.medium": "보통",
    "api.taskLikelihood.low": "낮음",
  },

  en: {
    // Settings
    "settings.toggle": "⚙ API Settings",
    "settings.apiKeyLabel": "Anthropic API Key",
    "settings.apiKeyHint": "Keys are stored only on this device. Leave blank to use free mode.",
    "settings.modelLabel": "Analysis Model",
    "settings.modelHaiku": "Haiku (Fast & Cheap — Default)",
    "settings.modelSonnet": "Sonnet (Precise Analysis)",
    "settings.modelHint": "Haiku: 90% cost savings. Sonnet: recommended for complex screens.",
    "settings.simuloUrlLabel": "Simulo URL (Optional)",
    "settings.simuloUrlHint": "Enter http://localhost:3000 for local testing",
    "settings.langLabel": "Language",

    // Free mode
    "freeMode.banner": "⚠ Analyzing in free mode. No API key or quota exceeded. Quality may be reduced.",

    // Mode tabs
    "mode.analysis": "UX Analysis",
    "mode.writing": "UX Writing",
    "mode.variants": "A/B Variants",

    // Selection bar
    "selection.empty": "Select a frame or layer",
    "selection.count": "{n} selected — {names}",
    "selection.countSuffix": " more",

    // Analysis mode sub-tabs
    "analysisMode.hypothesis": "Hypothesis",
    "analysisMode.usability": "Usability",

    // Form
    "form.hypothesis": "Hypothesis",
    "form.hypothesisPlaceholder": "e.g. Can new users understand how to earn mileage and complete their first mission?",
    "form.targetUser": "Target User",
    "form.targetUserPlaceholder": "e.g. New YafitMove user, office worker in 30s",
    "form.defaultTargetUser": "General user",
    "form.focusKeyword": "Analysis Focus Keyword",
    "form.focusKeywordPlaceholder": "e.g. loss aversion, onboarding, first impression, CTA conversion",
    "form.focusKeywordHint": "When set, analysis will prioritize this perspective",

    // Buttons
    "btn.noSelection": "No selection",
    "btn.analyze": "Start Analysis",
    "btn.analyzeMulti": "Analyze {n} Screens",
    "btn.flow": "🔗 Flow Analysis (Transition Friction)",
    "btn.multiIndividual": "📋 Individual Analysis ({n} frames)",
    "btn.writingCheck": "UX Writing Check ({n} screens)",
    "btn.reset": "← Analyze Again",
    "btn.writingReset": "← Check Again",
    "btn.generateVariants": "Generate Variants",
    "btn.applyToFigma": "Apply to Figma",
    "btn.applying": "Applying...",
    "btn.applied": "✓ Applied",

    // Report tabs
    "tab.overview": "Overview",
    "tab.thinkAloud": "Think Aloud",
    "tab.issues": "Issues",

    // Report
    "report.strengths": "Strengths",
    "report.noStrengths": "No strengths",
    "report.noThinkAloud": "No Think Aloud",
    "report.usabilityNoThinkAloud": "No Think Aloud in usability analysis",
    "report.noIssues": "No issues found",
    "report.scoreBreakdown": "Score Breakdown",
    "report.quickWins": "Quick Wins",
    "tab.improvements": "Improvements",
    "report.improvements.quickWins": "Quick Wins",
    "report.improvements.recommendations": "Recommendations by Issue",
    "report.improvements.noData": "No improvement data",
    "report.effort": "Effort",
    "report.impact": "Impact",
    "report.scoreReason": "Reason",
    "report.verdict.pass": "Pass",
    "report.verdict.partial": "Partial Pass",
    "report.verdict.fail": "Fail",

    // Flow
    "flow.screenTransition": "Screen Transition Analysis",
    "flow.dropOffRisk": "{n}% Drop-off Risk",
    "flow.frictionIssues": "Transition Friction Issues",
    "flow.noFriction": "No transition friction",
    "flow.label": "Flow Analysis — {verdict}",
    "flow.analyzing": "Analyzing {n} screens for flow...",
    "flow.extracting": "Extracting screens for flow analysis...",
    "flow.error": "Flow analysis failed: {msg}",
    "flow.apiFail": "Flow analysis failed ({status})",

    // Multi-frame
    "multi.extracting": "Extracting selected frames...",
    "multi.analyzing": "{current} / {total} analyzing... \"{name}\"",
    "multi.frameName": "Screen {n}",
    "multi.analysisFail": "Analysis failed: {msg}",

    // Loading
    "loading.default": "Analyzing screens...",
    "loading.analyzing": "AI is analyzing screens...",
    "loading.usability": "Analyzing usability...",
    "loading.writingFrame": "Analyzing frame text...",
    "loading.simuloExport": "Opening Simulo page...",
    "loading.sheetsExport": "Exporting...",
    "loading.variantsGen": "Generating variants...",

    // Writing
    "writing.hint": "Select a frame in Figma and click the button to analyze all text for UX writing improvements.",
    "writing.screenCheck": "Screen-level Check",
    "writing.oneKey": "✓ One key message",
    "writing.multiKey": "✗ Multiple key messages",
    "writing.noRepeat": "✓ No word repetition",
    "writing.repeat": "✗ Repeated: {words}",
    "writing.ctaCount": "CTA x{n}",
    "writing.goodPoints": "Strengths",
    "writing.improvements": "Improvements ({n})",
    "writing.applyAllFixes": "Apply All Fixes (Clone Frame)",
    "writing.applying": "Applying...",
    "writing.applyComplete": "✓ Applied",
    "writing.sev.critical": "Critical",
    "writing.sev.warning": "Warning",
    "writing.sev.info": "Info",
    "writing.pending": "Pending",
    "writing.applied": "Applied",
    "writing.current": "Before",
    "writing.suggestion": "After",
    "writing.frameSuffix": " (free mode)",
    "writing.frameAnalyzing": "Analyzing frame {i}/{n}...",
    "writing.frameAnalyzingFree": "Analyzing frame {i}/{n} (free mode)...",

    // Export
    "export.csv": "Export CSV",
    "export.simulo": "Save to Simulo",
    "export.sheets": "Export to Google Sheets",
    "export.sheetsConnect": "Connect Google & Export",
    "export.sheetsAppended": "Added to existing sheet",
    "export.sheetsCreated": "New sheet created",
    "export.sheetsSuccess": "{label} — Opening Google Sheets.",
    "export.sheetsFail": "Google Sheets export failed: {msg}",

    // Google auth
    "google.connectHint": "Please connect your Google account in the browser.",
    "google.timeout": "Google auth timed out. Please try again.",
    "google.connected": "Google connected!",
    "google.expired": "Google auth expired. Please reconnect.",

    // Feedback
    "feedback.prompt": "Was this analysis helpful?",
    "feedback.good": "👍 Helpful",
    "feedback.bad": "👎 Not helpful",
    "feedback.placeholder": "What was unhelpful? (e.g. suggestions that didn't match design intent)",
    "feedback.submit": "Send Feedback",
    "feedback.done": "Feedback sent. Thank you!",

    // Errors
    "error.noHypothesis": "Please enter a hypothesis.",
    "error.noFlowHypothesis": "Please enter a hypothesis. (e.g. Can new users complete checkout?)",
    "error.analysisFail": "Analysis failed: {msg}",
    "error.freeFail": "Free analysis failed ({status})",
    "error.apiFail": "API error {status}",
    "error.noVariantText": "Please enter the original text",
    "error.variantApplyFail": "Select a text node in Figma to apply",
    "error.variantFail": "Variant apply failed",

    // Variants
    "variants.hint": "Select a text node or type directly, choose an improvement goal, and AI will generate variants.",
    "variants.original": "Original Text",
    "variants.originalPlaceholder": "e.g. Get Started",
    "variants.goal": "Improvement Goal",
    "variants.goal.conversion": "Improve Conversion",
    "variants.goal.trust": "Build Trust",
    "variants.goal.concise": "Make Concise",
    "variants.goal.friendly": "Make Friendly",
    "variants.goal.urgency": "Add Urgency",
    "variants.goal.clarity": "Make Clearer",
    "variants.goalPrefix": "Goal: ",

    // Toast
    "toast.fixApplied": "{applied}/{total} fixes applied to cloned frame.",
    "toast.fixFail": "Fix failed: {msg}",

    // API
    "api.verdict.pass": "Pass",
    "api.verdict.partial": "Partial Pass",
    "api.verdict.fail": "Fail",
    "api.sev.critical": "Critical",
    "api.sev.medium": "Medium",
    "api.sev.low": "Low",
    "api.taskLikelihood.high": "High",
    "api.taskLikelihood.medium": "Medium",
    "api.taskLikelihood.low": "Low",
  },

  ja: {
    // Settings
    "settings.toggle": "⚙ API 設定",
    "settings.apiKeyLabel": "Anthropic API Key",
    "settings.apiKeyHint": "キーはこのデバイスのみに保存されます。なければ無料モードで動作します。",
    "settings.modelLabel": "分析モデル",
    "settings.modelHaiku": "Haiku（高速・低コスト — デフォルト）",
    "settings.modelSonnet": "Sonnet（精密分析）",
    "settings.modelHint": "Haiku: 90%コスト削減。Sonnet: 複雑な画面の精密分析に推奨",
    "settings.simuloUrlLabel": "Simulo URL（任意）",
    "settings.simuloUrlHint": "ローカルテスト時は http://localhost:3000 を入力",
    "settings.langLabel": "言語",

    // Free mode
    "freeMode.banner": "⚠ 無料モードで分析します。APIキーがないか使用量を超過しました。品質が低下する場合があります。",

    // Mode tabs
    "mode.analysis": "UX 分析",
    "mode.writing": "UX ライティング",
    "mode.variants": "A/B 変形",

    // Selection bar
    "selection.empty": "フレームまたはレイヤーを選択してください",
    "selection.count": "{n}個選択済み — {names}",
    "selection.countSuffix": " 他",

    // Analysis mode sub-tabs
    "analysisMode.hypothesis": "仮説検証",
    "analysisMode.usability": "ユーザビリティ",

    // Form
    "form.hypothesis": "仮説",
    "form.hypothesisPlaceholder": "例: 新規ユーザーがマイレージの貯め方を理解し、最初のミッションを完了できるか？",
    "form.targetUser": "ターゲットユーザー",
    "form.targetUserPlaceholder": "例: YafitMove新規インストールユーザー、30代会社員",
    "form.defaultTargetUser": "一般ユーザー",
    "form.focusKeyword": "分析重点キーワード",
    "form.focusKeywordPlaceholder": "例: 損失回避、オンボーディング、第一印象、CTA転換",
    "form.focusKeywordHint": "入力すると、その観点を中心に分析します",

    // Buttons
    "btn.noSelection": "未選択",
    "btn.analyze": "分析開始",
    "btn.analyzeMulti": "{n}画面統合分析",
    "btn.flow": "🔗 フロー分析（画面遷移）",
    "btn.multiIndividual": "📋 個別分析（{n}フレーム）",
    "btn.writingCheck": "UXライティングチェック（{n}画面）",
    "btn.reset": "← 再分析",
    "btn.writingReset": "← 再チェック",
    "btn.generateVariants": "バリエーション生成",
    "btn.applyToFigma": "Figmaに適用",
    "btn.applying": "適用中...",
    "btn.applied": "✓ 適用済",

    // Report tabs
    "tab.overview": "Overview",
    "tab.thinkAloud": "Think Aloud",
    "tab.issues": "イシュー",

    // Report
    "report.strengths": "強み",
    "report.noStrengths": "強みなし",
    "report.noThinkAloud": "Think Aloudなし",
    "report.usabilityNoThinkAloud": "ユーザビリティ分析ではThink Aloudなし",
    "report.noIssues": "イシューなし",
    "report.scoreBreakdown": "スコア詳細",
    "report.quickWins": "Quick Wins",
    "tab.improvements": "改善案",
    "report.improvements.quickWins": "クイックウィン",
    "report.improvements.recommendations": "イシュー別推奨事項",
    "report.improvements.noData": "改善データなし",
    "report.effort": "工数",
    "report.impact": "インパクト",
    "report.scoreReason": "理由",
    "report.verdict.pass": "合格",
    "report.verdict.partial": "一部合格",
    "report.verdict.fail": "不合格",

    // Flow
    "flow.screenTransition": "画面遷移分析",
    "flow.dropOffRisk": "{n}%離脱リスク",
    "flow.frictionIssues": "遷移摩擦イシュー",
    "flow.noFriction": "遷移摩擦なし",
    "flow.label": "フロー分析 — {verdict}",
    "flow.analyzing": "{n}画面のフローを分析中...",
    "flow.extracting": "フロー分析用画面を抽出中...",
    "flow.error": "フロー分析失敗: {msg}",
    "flow.apiFail": "フロー分析失敗 ({status})",

    // Multi-frame
    "multi.extracting": "選択されたフレームを抽出中...",
    "multi.analyzing": "{current} / {total} 分析中... \"{name}\"",
    "multi.frameName": "画面 {n}",
    "multi.analysisFail": "分析失敗: {msg}",

    // Loading
    "loading.default": "画面を分析しています...",
    "loading.analyzing": "AIが画面を分析中...",
    "loading.usability": "ユーザビリティ分析中...",
    "loading.writingFrame": "フレームのテキストを分析中...",
    "loading.simuloExport": "Simuloページを開いています...",
    "loading.sheetsExport": "エクスポート中...",
    "loading.variantsGen": "AIがバリエーションを生成中...",

    // Writing
    "writing.hint": "Figmaでフレームを選択後、ボタンをクリックすると画面のすべてのテキストを分析してUXライティングの改善点を見つけます。",
    "writing.screenCheck": "画面レベルチェック",
    "writing.oneKey": "✓ キーメッセージ1つ",
    "writing.multiKey": "✗ キーメッセージ複数",
    "writing.noRepeat": "✓ 単語繰り返しなし",
    "writing.repeat": "✗ 繰り返し: {words}",
    "writing.ctaCount": "CTA {n}個",
    "writing.goodPoints": "良い点",
    "writing.improvements": "改善点 ({n})",
    "writing.applyAllFixes": "全修正適用（フレーム複製）",
    "writing.applying": "適用中...",
    "writing.applyComplete": "✓ 適用完了",
    "writing.sev.critical": "重大",
    "writing.sev.warning": "注意",
    "writing.sev.info": "参考",
    "writing.pending": "修正待ち",
    "writing.applied": "適用済",
    "writing.current": "現在",
    "writing.suggestion": "提案",
    "writing.frameSuffix": "（無料モード）",
    "writing.frameAnalyzing": "フレーム {i}/{n} 分析中...",
    "writing.frameAnalyzingFree": "フレーム {i}/{n} 分析中（無料モード）...",

    // Export
    "export.csv": "CSVエクスポート",
    "export.simulo": "Simuloに保存",
    "export.sheets": "Googleスプレッドシートへ",
    "export.sheetsConnect": "Google連携後エクスポート",
    "export.sheetsAppended": "既存シートに追加",
    "export.sheetsCreated": "新シート作成",
    "export.sheetsSuccess": "{label} — Googleスプレッドシートを開きます。",
    "export.sheetsFail": "Googleスプレッドシートエクスポート失敗: {msg}",

    // Google auth
    "google.connectHint": "ブラウザでGoogleアカウントを連携してください。",
    "google.timeout": "Google認証タイムアウト。もう一度お試しください。",
    "google.connected": "Google連携完了！",
    "google.expired": "Google認証が期限切れです。再連携してください。",

    // Feedback
    "feedback.prompt": "分析結果は役に立ちましたか？",
    "feedback.good": "👍 役立った",
    "feedback.bad": "👎 イマイチ",
    "feedback.placeholder": "何が役に立ちませんでしたか？（例：意図と合わない提案など）",
    "feedback.submit": "フィードバック送信",
    "feedback.done": "フィードバックを送信しました。ありがとうございます！",

    // Errors
    "error.noHypothesis": "仮説を入力してください。",
    "error.noFlowHypothesis": "仮説を入力してください。（例: 新規ユーザーが決済まで完了できるか？）",
    "error.analysisFail": "分析失敗: {msg}",
    "error.freeFail": "無料分析失敗 ({status})",
    "error.apiFail": "APIエラー {status}",
    "error.noVariantText": "元のテキストを入力してください",
    "error.variantApplyFail": "適用するテキストノードをFigmaで選択してください",
    "error.variantFail": "変形適用失敗",

    // Variants
    "variants.hint": "テキストノードを選択または直接入力し、改善目標を選択するとAIがバリエーションを生成します。",
    "variants.original": "元のテキスト",
    "variants.originalPlaceholder": "例: はじめる",
    "variants.goal": "改善目標",
    "variants.goal.conversion": "コンバージョン向上",
    "variants.goal.trust": "信頼強化",
    "variants.goal.concise": "より簡潔に",
    "variants.goal.friendly": "より親しみやすく",
    "variants.goal.urgency": "緊急感付与",
    "variants.goal.clarity": "より明確に",
    "variants.goalPrefix": "目標: ",

    // Toast
    "toast.fixApplied": "{applied}/{total}件の修正が複製フレームに適用されました。",
    "toast.fixFail": "修正失敗: {msg}",

    // API
    "api.verdict.pass": "合格",
    "api.verdict.partial": "一部合格",
    "api.verdict.fail": "不合格",
    "api.sev.critical": "重大",
    "api.sev.medium": "中",
    "api.sev.low": "低",
    "api.taskLikelihood.high": "高",
    "api.taskLikelihood.medium": "中",
    "api.taskLikelihood.low": "低",
  },
};
