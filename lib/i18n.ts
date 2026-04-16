export type Locale = "ko" | "en";

const LOCALE_KEY = "simulo_locale";

export function getLocale(): Locale {
  if (typeof window === "undefined") return "ko";
  return (localStorage.getItem(LOCALE_KEY) as Locale) ?? "ko";
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

const translations = {
  ko: {
    // Sidebar
    history: "히스토리",
    settings: "설정",

    // Home / Analyze
    imageUpload: "이미지 업로드",
    url: "URL",
    figma: "Figma",
    hypothesis: "가설",
    hypothesisPlaceholder:
      "검증하고 싶은 내용을 질문 형태로 작성하세요. 예: 사용자가 마일리지 적립 방법을 이해하고 첫 걷기 미션을 완료할 수 있는가?",
    targetUser: "타깃 유저",
    targetUserPlaceholder:
      "화면을 사용할 유저를 설명해주세요. 예: 30대 직장인, 야핏무브 설치 후 처음 앱을 켠 신규 유저",
    taskOptional: "태스크 (선택)",
    taskPlaceholder:
      "비워두면 가설에서 자동 추론합니다. 예: 메인 화면에서 마일리지 샵으로 이동해 첫 구매를 완료한다",
    projectTagOptional: "프로젝트 태그 (선택)",
    projectTagPlaceholder: "예: 온보딩 개선 v2, 마일리지샵 UX, 라이딩 화면",
    dropImages: "화면을 드래그하거나 클릭해서 업로드",
    maxImages: "최대 8장. PNG, JPG 지원.",
    runAnalysis: "분석 시작",
    remove: "삭제",
    advancedOptions: "+ 고급 옵션",

    // Loading
    loadingStep1: "화면을 분석하고 있습니다...",
    loadingStep2: "야핏무브 타깃 유저 페르소나를 구성 중...",
    loadingStep3: "Think Aloud 시뮬레이션 중...",
    loadingStep4: "리포트를 작성하고 있습니다...",

    // Score breakdown
    scoreBreakdown: "점수 근거",
    clarity: "정보 명확성",
    clarityDesc: "보상과 행동이 얼마나 명확한가",
    flowScore: "참여 흐름",
    flowScoreDesc: "다음 행동으로 자연스럽게 이어지는가",
    feedbackScore: "보상 피드백",
    feedbackScoreDesc: "적립/성취 피드백이 충분한가",
    efficiency: "목표 효율",
    efficiencyDesc: "마일리지 획득까지 마찰이 적은가",
    verdictReasonLabel: "판정 근거",

    // Report
    overview: "Overview",
    thinkAloud: "Think Aloud",
    issues: "이슈",
    usabilityScore: "사용성 점수",
    taskSuccessLikelihood: "태스크 성공 가능성",
    taskSuccessReasoning: "태스크 성공 근거",
    strengths: "강점",
    recommendation: "개선 권고",
    noIssues: "발견된 이슈 없음",
    reportNotFound: "리포트를 찾을 수 없습니다",
    backToHistory: "히스토리로",
    newAnalysis: "새 분석",

    // Verdict
    Pass: "통과",
    Partial: "부분 통과",
    Fail: "실패",

    // Severity
    Critical: "심각",
    Medium: "보통",
    Low: "낮음",

    // Likelihood
    High: "높음",

    // History
    analysesTotal: "개 분석",
    searchPlaceholder: "가설 또는 태그 검색...",
    all: "전체",
    noAnalysesFound:
      "아직 분석 기록이 없습니다. 야핏무브 화면을 업로드하고 첫 번째 UX 검증을 시작해보세요.",

    // Settings
    anthropicApiKey: "Anthropic API Key",
    apiKeyHint:
      "Claude API 키를 입력하세요. 분석 기능이 이 키를 사용합니다.",
    figmaToken: "Figma Personal Access Token",
    figmaTokenHint:
      "Figma Personal Access Token을 저장하면 매번 입력하지 않아도 됩니다. Figma 설정 → Security → Personal access tokens에서 발급",
    save: "저장",
    saved: "저장됨",
    integrations: "연동",
    comingSoon: "준비 중",
    language: "언어 / Language",

    // Model
    modelSelection: "분석 모델",
    modelHaikuDesc: "빠르고 저렴",
    modelSonnetDesc: "정밀 분석",
    modelHint:
      "Haiku는 Sonnet 대비 ~10배 저렴합니다. 대부분의 UX 분석에 충분합니다.",

    // URL tab
    urlPlaceholder: "https://example.com",
    urlHint: "라이브 페이지 분석 — 준비 중",
    figmaTokenPlaceholder: "Figma Personal Access Token",
    figmaUrlPlaceholder: "Figma File URL",
    figmaHint: "Figma Personal Access Token과 파일 URL을 입력 후 프레임을 불러오세요.",

    // Tooltips
    tooltipAnalysisTarget: "분석할 화면을 선택하세요. 이미지 파일, 웹 URL, 피그마 파일 중 선택할 수 있습니다.",
    tooltipImageUpload: "앱/웹 화면의 스크린샷을 업로드합니다. 야핏무브 앱 화면, 피그마 내보내기 이미지 모두 가능합니다. 여러 장 올리면 각 화면을 함께 분석합니다.",
    tooltipUrl: "분석할 웹페이지 주소를 입력합니다. 실제 서비스 중인 페이지나 스테이징 링크 모두 가능합니다.",
    tooltipFigma: "피그마 파일을 직접 연결합니다. 피그마에서 파일을 열고 브라우저 주소창 URL을 복사하세요. Personal Access Token은 피그마 설정 → Security → Personal access tokens에서 발급할 수 있습니다.",
    tooltipHypothesis: "검증하고 싶은 내용을 질문 형태로 적어주세요. 구체적인 행동과 기대 결과를 포함할수록 분석이 정확해집니다. 예: '신규 유저가 온보딩 화면만 보고 첫 마일리지 적립을 완료할 수 있는가?'",
    tooltipTargetUser: "이 화면을 사용할 유저를 묘사해주세요. 나이, 앱 사용 경험, 야핏무브 사용 이력 등을 포함하면 더 정확한 시뮬레이션이 가능합니다. 예: '20대 여성, 피트니스 앱 경험은 있지만 야핏무브는 처음인 신규 유저'",
    tooltipTask: "유저가 완료해야 하는 구체적인 행동을 적어주세요. 비워두면 가설에서 자동 추론합니다. 예: '메인 화면에서 마일리지 샵으로 이동해 아메리카노 쿠폰을 교환한다'",
    tooltipProjectTag: "분석을 프로젝트 단위로 묶어 히스토리에서 필터링할 때 사용합니다. 예: 온보딩 v3, 마일리지샵 리뉴얼, 라이딩 화면 개선",

    // Onboarding banner
    onboardingTitle: "Simulo 사용 가이드",
    onboardingStep1: "① 분석할 화면을 업로드하거나 URL/피그마를 연결하세요",
    onboardingStep2: "② 어떤 UX 가설을 검증할지 가설 항목에 적어주세요",
    onboardingStep3: "③ 이 화면을 사용할 유저가 어떤 사람인지 설명해주세요",
    onboardingStep4: "④ 분석 시작을 누르면 AI가 타깃 유저처럼 화면을 분석합니다",
    onboardingFootnote: "팀 내 누구나 사용할 수 있습니다. 디자인 지식이 없어도 됩니다.",

    // Report thumbnails
    analyzedScreens: "분석된 화면",
    screenLabel: "화면",

    // Flow
    flow: "플로우",
    flowGuide: "사용자 여정의 각 단계를 순서대로 업로드하세요. AI가 어느 단계에서 이탈이 발생할지 분석합니다.",
    addStep: "+ 단계 추가",
    stepNamePlaceholder: "예: 앱 진입, 마일리지샵, 쿠폰 선택, 교환 완료",
    flowTab: "플로우",
    dropOffSummary: "단계 중",
    dropOffSummaryEnd: "단계에서 이탈 위험",
    dropOffRisk: "이탈 위험",
    tooltipFlow: "여러 화면의 사용자 여정을 순서대로 분석합니다. 각 단계별 이탈 위험도를 평가합니다.",
    flowLoadingStep1: "플로우를 분석하고 있습니다...",
    flowLoadingStep2: "각 단계별 이탈 위험을 평가 중...",
    stepLabel: "단계",

    // Figma
    figmaValidating: "Figma 파일 확인 중...",
    figmaValidated: "프레임 로드 완료",
    figmaSelectFrames: "분석할 프레임을 선택하세요",
    figmaNoFrames: "프레임을 찾을 수 없습니다",
    figmaFileName: "파일",
    figmaFrameCount: "개 프레임",
    figmaTokenFromSettings: "설정에서 불러옴",
    figmaLoadFrames: "프레임 불러오기",

    // Section label
    analysisTarget: "분석 대상",

    // Comparison
    comparison: "비교 분석",
    tooltipComparison: "자사 제품과 경쟁사 제품을 동일 가설로 비교합니다. 강약점, 키 차이, 우선순위 개선점을 한 번에 확인할 수 있습니다.",
    comparisonBadge: "비교",
    ourProduct: "자사 제품",
    competitor: "경쟁사",
    competitorN: "경쟁사",
    productNamePlaceholder: "제품명 (예: 야핏무브)",
    competitorNamePlaceholder: "경쟁사명 (예: 캐시워크)",
    addCompetitor: "+ 경쟁사 추가",
    removeCompetitor: "경쟁사 삭제",
    comparisonFocus: "비교 기준 (선택)",
    comparisonFocusPlaceholder: "예: 온보딩 플로우, 리워드 경험, 정보 구조",
    comparisonGuide: "자사 제품과 비교할 경쟁사 제품의 스크린샷을 올려주세요. 최대 2개 경쟁사까지 추가할 수 있습니다.",
    productDescriptionLabel: "제품 설명 (선택)",
    productDescriptionHint: "각 버튼과 기능이 어떻게 동작하는지 간단히 적어주면 AI가 화면 외 맥락까지 고려합니다.",
    oursDescriptionPlaceholder:
      "예시) 야핏무브 메인 홈은 두 개의 탭으로 구성. '걷고 받기' 탭은 걸음수 기반 마일리지 적립 영역으로 0걸음→보너스→1,000걸음→2,000걸음 단계별 보상, '잠자고 받기' 탭은 수면 중 광고 시청 기반 보상. 하단 CTA는 광고 시청 후 보상 수령으로 이어짐.",
    competitorDescriptionPlaceholder:
      "예시) 메인 화면 최상단은 걸음 위젯, 중단은 광고 카드 리스트, 하단 탭바에 '리워드/내정보'. 카드 클릭 시 광고 시청 후 캐시 적립.",

    // Analysis perspective (체크박스)
    analysisPerspectiveTitle: "분석 관점",
    analysisPerspectiveHint: "리포트에 포함할 관점을 선택하세요. 체크하지 않은 관점은 리포트에서 제외됩니다.",
    perspectiveUsability: "사용성 전반",
    perspectiveUsabilityRequired: "(필수)",
    perspectiveUsabilityTooltip:
      "화면의 정보 구조, 버튼 위치, 피드백 등 기본 사용성을 평가합니다. 모든 리포트에 기본 포함되는 필수 관점입니다.",
    perspectiveDesire: "욕망 충족도 분석",
    perspectiveDesireTooltip:
      "4050 여성 유저의 3가지 욕망(효능감·건강과시·손실회피)을 기준으로 화면이 욕망을 얼마나 잘 충족하는지 평가합니다. 체크 해제 시 욕망 카드와 점수가 리포트에서 제외됩니다.",
    perspectiveComparison: "경쟁사 비교",
    perspectiveComparisonTooltip:
      "자사 제품 대비 경쟁사의 강점·약점·격차를 분석합니다. 비교 분석 탭에서는 항상 포함되어 해제할 수 없습니다.",
    perspectiveAccessibility: "접근성 (4050)",
    perspectiveAccessibilityTooltip:
      "40-50대 여성 유저 기준 시각 친화성(폰트·대비·버튼 크기)과 언어 친화성(용어·어조)을 평가합니다. 체크 해제 시 접근성 섹션이 리포트에서 제외됩니다.",
    perspectiveIncluded: "리포트에 포함됩니다",
    perspectiveExcluded: "리포트에서 제외됩니다",
    comparisonTabSummary: "비교 요약",
    comparisonTabDetails: "제품별 상세",
    comparisonTabSideBySide: "나란히 보기",
    winner: "가설 적합도 1위",
    winnerReason: "선정 이유",
    ourProductPosition: "자사 포지션",
    keyDifferences: "핵심 차이",
    topPriorities: "우선 개선 포인트",
    aspect: "관점",
    strengthsLabel: "강점",
    weaknessesLabel: "약점",
    comparisonLoadingStep1: "제품별 화면을 분석 중...",
    comparisonLoadingStep2: "동일 루브릭으로 비교 점수 산정 중...",
    comparisonLoadingStep3: "우선 개선 포인트를 도출 중...",

    // Desire Map & Retention
    desireAlignment: "욕망 충족도",
    desireAlignmentSub: "야핏무브 핵심 유저(4050 여성)의 3가지 욕망 기준",
    desireUtility: "효능감",
    desireUtilityDesc: "보상이 명확하게 인식되는가",
    desireHealthPride: "성취 & 과시",
    desireHealthPrideDesc: "성취감이 전달되고 공유 욕구가 자극되는가",
    desireLossAversion: "손실 회피",
    desireLossAversionDesc: "오늘 안 하면 손해라는 인식이 작동하는가",
    moneyLoopStage: "분석 화면 단계",
    retentionRisk: "리텐션 리스크",
    d1Risk: "D1 리스크",
    d7Risk: "D7 리스크",
    mainRiskReason: "핵심 원인",
    mainRiskReasonLabel: "주요 리스크 요인",
    topPrioritiesLabel: "지금 당장 바꿔야 할 것",
    topPrioritiesSub: "리텐션 임팩트 기준 우선순위",
    desireType: "욕망 유형",
    retentionImpact: "리텐션 영향",

    // Heatmap
    heatmapOn: "🔥 히트맵 보기",
    heatmapOff: "🔥 히트맵 끄기",
    noLocation: "위치 미특정",

    // Flow Builder
    flowBuilder: "플로우 빌더",
    flowBuilderDesc: "노드를 연결해 유저 여정을 구성하고 AI가 이탈 위험을 분석합니다",
    fbStart: "시작",
    fbScreen: "화면",
    fbEnd: "종료",
    fbAddStart: "+ 시작",
    fbAddScreen: "+ 화면",
    fbAddEnd: "+ 종료",
    fbScreenName: "화면 이름",
    fbUploadScreen: "+ 화면 업로드",
    fbEndLabel: "종료",
    fbEndLabelPlaceholder: "예: 교환 완료, 이탈",
    fbSave: "저장",
    fbLoad: "불러오기",
    fbReset: "초기화",
    fbRunAnalysis: "분석 시작",
    fbAnalyzing: "분석 중...",
    fbHypothesis: "가설",
    fbHypothesisPlaceholder: "검증하고 싶은 유저 여정을 입력하세요",
    fbTargetUser: "타깃 유저",
    fbTargetUserPlaceholder: "이 플로우를 사용할 유저를 설명하세요",
    fbDropOffHigh: "높음",
    fbDropOffMedium: "보통",
    fbDropOffLow: "낮음",
    fbDropOffPercent: "% 이탈 예상",
    fbDropOffBadge: "이탈",
    fbNoNodes: "좌측 패널에서 노드를 추가하거나 캔버스를 더블클릭하세요",
    fbResetConfirm: "플로우를 초기화하시겠습니까?",
    fbSavedFlows: "저장된 플로우",
    fbNoSavedFlows: "저장된 플로우 없음",
    fbFlowName: "플로우 이름",
    fbFlowNamePlaceholder: "예: 온보딩 플로우, 마일리지 교환",
    fbDesireUtility: "효능감",
    fbDesireHealthPride: "성취과시",
    fbDesireLossAversion: "손실회피",
  },
  en: {
    history: "History",
    settings: "Settings",

    imageUpload: "Image Upload",
    url: "URL",
    figma: "Figma",
    hypothesis: "Hypothesis",
    hypothesisPlaceholder:
      "What do you want to validate? e.g. Can users understand how to earn mileage and complete their first walking mission?",
    targetUser: "Target User",
    targetUserPlaceholder:
      "Describe who will use this. e.g. 30s office worker, new user who just installed YafitMove",
    taskOptional: "Task (optional)",
    taskPlaceholder:
      "Auto-inferred from hypothesis if empty. e.g. Navigate from main screen to mileage shop and complete first purchase",
    projectTagOptional: "Project Tag (optional)",
    projectTagPlaceholder: "e.g. Onboarding v2, Mileage Shop UX, Riding Screen",
    dropImages: "Drop screens here or click to upload",
    maxImages: "Max 8 images. PNG, JPG supported.",
    runAnalysis: "Run Analysis",
    remove: "Remove",
    advancedOptions: "+ Advanced Options",

    // Score breakdown
    scoreBreakdown: "Score Breakdown",
    clarity: "Info Clarity",
    clarityDesc: "How clear are rewards and actions?",
    flowScore: "Engagement Flow",
    flowScoreDesc: "Does it naturally lead to the next action?",
    feedbackScore: "Reward Feedback",
    feedbackScoreDesc: "Is reward/achievement feedback sufficient?",
    efficiency: "Goal Efficiency",
    efficiencyDesc: "Is there minimal friction to earn mileage?",
    verdictReasonLabel: "Verdict Reason",

    loadingStep1: "Analyzing screens...",
    loadingStep2: "Building YafitMove target user persona...",
    loadingStep3: "Running think aloud simulation...",
    loadingStep4: "Generating report...",

    overview: "Overview",
    thinkAloud: "Think Aloud",
    issues: "Issues",
    usabilityScore: "Usability Score",
    taskSuccessLikelihood: "Task Success Likelihood",
    taskSuccessReasoning: "Task Success Reasoning",
    strengths: "Strengths",
    recommendation: "Recommendation",
    noIssues: "No issues found",
    reportNotFound: "Report not found",
    backToHistory: "History",
    newAnalysis: "New Analysis",

    Pass: "Pass",
    Partial: "Partial",
    Fail: "Fail",

    Critical: "Critical",
    Medium: "Medium",
    Low: "Low",

    High: "High",

    analysesTotal: " analyses",
    searchPlaceholder: "Search hypotheses or tags...",
    all: "All",
    noAnalysesFound:
      "No analyses yet. Upload YafitMove screens and start your first UX validation.",

    anthropicApiKey: "Anthropic API Key",
    apiKeyHint:
      "Enter your Claude API key. The analysis feature uses this key.",
    figmaToken: "Figma Personal Access Token",
    figmaTokenHint:
      "Save your Figma token so you don't have to enter it every time. Generate at Figma Settings → Security → Personal access tokens",
    save: "Save",
    saved: "Saved",
    integrations: "Integrations",
    comingSoon: "Coming Soon",
    language: "Language / 언어",

    modelSelection: "Analysis Model",
    modelHaikuDesc: "Fast & cheap",
    modelSonnetDesc: "Precise",
    modelHint:
      "Haiku is ~10x cheaper than Sonnet. Sufficient for most UX analyses.",

    urlPlaceholder: "https://example.com",
    urlHint: "Live page analysis — coming soon",
    figmaTokenPlaceholder: "Figma Personal Access Token",
    figmaUrlPlaceholder: "Figma File URL",
    figmaHint: "Enter your Figma token and file URL, then load frames.",

    // Tooltips
    tooltipAnalysisTarget: "Choose how to provide the screens you want to analyze: image files, a web URL, or a Figma file.",
    tooltipImageUpload: "Upload screenshots of your app or web screens. YafitMove app screens and Figma exports both work. Upload multiple images to analyze them together.",
    tooltipUrl: "Enter the URL of the web page you want to analyze. Works with live services or staging links.",
    tooltipFigma: "Connect a Figma file directly. Open the file in Figma, then copy the URL from your browser's address bar. Generate a Personal Access Token at Figma Settings → Security → Personal access tokens.",
    tooltipHypothesis: "Write what you want to validate as a question. The more specific the action and expected outcome, the more accurate the analysis. e.g. 'Can a new user complete their first mileage earning just from the onboarding screens?'",
    tooltipTargetUser: "Describe who will use this screen. Including age, app experience, and YafitMove history leads to a more accurate simulation. e.g. 'Female in her 20s, familiar with fitness apps but new to YafitMove'",
    tooltipTask: "Describe the specific action the user needs to complete. Auto-inferred from the hypothesis if left empty. e.g. 'Navigate from the main screen to the mileage shop and redeem an Americano coupon'",
    tooltipProjectTag: "Group analyses by project for filtering in history. e.g. Onboarding v3, Mileage Shop Redesign, Riding Screen Improvement",

    // Report thumbnails
    analyzedScreens: "Analyzed Screens",
    screenLabel: "Screen",

    // Onboarding banner
    onboardingTitle: "How to use Simulo",
    onboardingStep1: "① Upload screens or connect a URL/Figma file",
    onboardingStep2: "② Write the UX hypothesis you want to validate",
    onboardingStep3: "③ Describe the target user for this screen",
    onboardingStep4: "④ Click Run Analysis — AI will simulate the target user's experience",
    onboardingFootnote: "Anyone on your team can use this. No design expertise required.",

    // Flow
    flow: "Flow",
    flowGuide: "Upload each step of the user journey in order. AI will analyze where drop-offs might occur.",
    addStep: "+ Add Step",
    stepNamePlaceholder: "e.g. App Entry, Mileage Shop, Coupon Select, Exchange Complete",
    flowTab: "Flow",
    dropOffSummary: "out of",
    dropOffSummaryEnd: "steps have drop-off risk",
    dropOffRisk: "Drop-off Risk",
    tooltipFlow: "Analyze a multi-screen user journey in sequence. Evaluates drop-off risk at each step.",
    flowLoadingStep1: "Analyzing flow...",
    flowLoadingStep2: "Evaluating drop-off risk per step...",
    stepLabel: "Step",

    // Figma
    figmaValidating: "Validating Figma file...",
    figmaValidated: "Frames loaded",
    figmaSelectFrames: "Select frames to analyze",
    figmaNoFrames: "No frames found",
    figmaFileName: "File",
    figmaFrameCount: " frames",
    figmaTokenFromSettings: "From settings",
    figmaLoadFrames: "Load Frames",

    // Section label
    analysisTarget: "Analysis Target",

    // Comparison
    comparison: "Comparison",
    tooltipComparison: "Compare your product against competitors against the same hypothesis. See strengths, key differences, and priority improvements in one view.",
    comparisonBadge: "Compare",
    ourProduct: "Our Product",
    competitor: "Competitor",
    competitorN: "Competitor",
    productNamePlaceholder: "Product name (e.g. YafitMove)",
    competitorNamePlaceholder: "Competitor name (e.g. CashWalk)",
    addCompetitor: "+ Add Competitor",
    removeCompetitor: "Remove competitor",
    comparisonFocus: "Comparison focus (optional)",
    comparisonFocusPlaceholder: "e.g. Onboarding flow, Reward experience, Information architecture",
    comparisonGuide: "Upload screenshots of your product and competitor products. Up to 2 competitors supported.",
    productDescriptionLabel: "Product description (optional)",
    productDescriptionHint:
      "Briefly describe how each button/feature actually works so the AI considers context beyond what is visible.",
    oursDescriptionPlaceholder:
      "Example) YafitMove main home has two tabs. 'Walk to earn' tab gives step-based mileage with reward stages 0 → bonus → 1,000 → 2,000 steps. 'Sleep to earn' tab rewards watching ads while asleep. The bottom CTA triggers ad view → reward claim.",
    competitorDescriptionPlaceholder:
      "Example) Main screen: step widget on top, ad card list in the middle, bottom tab bar with Reward/Profile. Tapping a card plays an ad then credits cash.",

    // Analysis perspective (checkboxes)
    analysisPerspectiveTitle: "Analysis perspective",
    analysisPerspectiveHint:
      "Choose which perspectives to include in the report. Unchecked perspectives will be excluded.",
    perspectiveUsability: "Overall usability",
    perspectiveUsabilityRequired: "(required)",
    perspectiveUsabilityTooltip:
      "Evaluates information architecture, button placement, and feedback. Always included as the baseline perspective.",
    perspectiveDesire: "Desire fulfillment",
    perspectiveDesireTooltip:
      "Evaluates how well the screens fulfill the 3 core desires of 40-50s women (Utility, Health & Pride, Loss Aversion). Uncheck to exclude desire cards and scores from the report.",
    perspectiveComparison: "Competitor comparison",
    perspectiveComparisonTooltip:
      "Analyzes strengths, weaknesses, and gaps versus competitors. Always included in the Comparison tab and cannot be unchecked there.",
    perspectiveAccessibility: "Accessibility (40-50s)",
    perspectiveAccessibilityTooltip:
      "Evaluates visual friendliness (font, contrast, button size) and linguistic friendliness (terminology, tone) for 40-50s female users. Uncheck to exclude the accessibility section.",
    perspectiveIncluded: "Included in report",
    perspectiveExcluded: "Excluded from report",
    comparisonTabSummary: "Summary",
    comparisonTabDetails: "By Product",
    comparisonTabSideBySide: "Side by Side",
    winner: "Best Fit",
    winnerReason: "Why",
    ourProductPosition: "Our Position",
    keyDifferences: "Key Differences",
    topPriorities: "Top Priorities",
    aspect: "Aspect",
    strengthsLabel: "Strengths",
    weaknessesLabel: "Weaknesses",
    comparisonLoadingStep1: "Analyzing screens per product...",
    comparisonLoadingStep2: "Scoring with a consistent rubric...",
    comparisonLoadingStep3: "Deriving top priorities...",

    // Desire Map & Retention
    desireAlignment: "Desire Fulfillment",
    desireAlignmentSub: "Based on 3 core desires of YafitMove's primary user (40-50s women)",
    desireUtility: "Utility",
    desireUtilityDesc: "Is the reward clearly perceived?",
    desireHealthPride: "Achievement & Pride",
    desireHealthPrideDesc: "Is achievement conveyed and sharing desire stimulated?",
    desireLossAversion: "Loss Aversion",
    desireLossAversionDesc: "Does 'skip today = lose out' perception work?",
    moneyLoopStage: "Screen Stage",
    retentionRisk: "Retention Risk",
    d1Risk: "D1 Risk",
    d7Risk: "D7 Risk",
    mainRiskReason: "Main Cause",
    mainRiskReasonLabel: "Main Risk Factor",
    topPrioritiesLabel: "Must-Fix Now",
    topPrioritiesSub: "Prioritized by retention impact",
    desireType: "Desire Type",
    retentionImpact: "Retention Impact",

    // Heatmap
    heatmapOn: "🔥 Heatmap",
    heatmapOff: "🔥 Heatmap Off",
    noLocation: "No location",

    // Flow Builder
    flowBuilder: "Flow Builder",
    flowBuilderDesc: "Connect nodes to build user journeys and let AI analyze drop-off risks",
    fbStart: "Start",
    fbScreen: "Screen",
    fbEnd: "End",
    fbAddStart: "+ Start",
    fbAddScreen: "+ Screen",
    fbAddEnd: "+ End",
    fbScreenName: "Screen name",
    fbUploadScreen: "+ Upload Screen",
    fbEndLabel: "End",
    fbEndLabelPlaceholder: "e.g. Purchase Complete, Drop-off",
    fbSave: "Save",
    fbLoad: "Load",
    fbReset: "Reset",
    fbRunAnalysis: "Analyze",
    fbAnalyzing: "Analyzing...",
    fbHypothesis: "Hypothesis",
    fbHypothesisPlaceholder: "Enter the user journey you want to validate",
    fbTargetUser: "Target User",
    fbTargetUserPlaceholder: "Describe who uses this flow",
    fbDropOffHigh: "High",
    fbDropOffMedium: "Medium",
    fbDropOffLow: "Low",
    fbDropOffPercent: "% drop-off",
    fbDropOffBadge: "Drop",
    fbNoNodes: "Add nodes from the left panel or double-click the canvas",
    fbResetConfirm: "Reset the flow?",
    fbSavedFlows: "Saved Flows",
    fbNoSavedFlows: "No saved flows",
    fbFlowName: "Flow name",
    fbFlowNamePlaceholder: "e.g. Onboarding Flow, Mileage Exchange",
    fbDesireUtility: "Utility",
    fbDesireHealthPride: "Achievement",
    fbDesireLossAversion: "Loss Aversion",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["ko"];

export function t(key: TranslationKey, locale?: Locale): string {
  const lang = locale ?? getLocale();
  return translations[lang][key] ?? translations.en[key] ?? key;
}

export function useT(): (key: TranslationKey) => string {
  const locale = getLocale();
  return (key: TranslationKey) => t(key, locale);
}
