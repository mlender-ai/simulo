/**
 * Domain-specific UX analysis focus options.
 * When a domain is selected in general mode, these focus items appear as checkboxes.
 * Selected items are injected into the analysis prompt as concentrated observation areas.
 */

export interface DomainFocusItem {
  key: string;
  label: string;
  desc: string;
  promptKo: string; // injected into Korean prompt
  promptEn: string; // injected into English prompt
}

export const DOMAIN_FOCUSES: Record<string, DomainFocusItem[]> = {
  ecommerce: [
    {
      key: "conversion_funnel",
      label: "구매 전환 퍼널",
      desc: "상품 발견→장바구니→결제 흐름",
      promptKo: "구매 전환 퍼널: 상품 발견부터 결제 완료까지 각 단계의 마찰 요소와 이탈 위험을 집중 분석하라.",
      promptEn: "Purchase conversion funnel: Closely analyze friction and drop-off risk at each step from product discovery to checkout completion.",
    },
    {
      key: "product_info",
      label: "상품 정보 충분도",
      desc: "구매 결정에 필요한 정보 제공",
      promptKo: "상품 정보 충분도: 이미지, 설명, 가격, 배송/반품 정보가 구매 결정을 내리기에 충분한지 평가하라.",
      promptEn: "Product information sufficiency: Evaluate whether images, descriptions, pricing, and shipping/return info are sufficient for a purchase decision.",
    },
    {
      key: "trust_signals",
      label: "신뢰/사회적 증명",
      desc: "리뷰, 평점, 배송 신뢰 신호",
      promptKo: "신뢰 신호: 리뷰·평점·구매 수·배송 보장 등 신뢰를 높이는 요소가 적절한 위치에 충분히 노출되는지 평가하라.",
      promptEn: "Trust signals: Assess whether reviews, ratings, purchase counts, and delivery guarantees are prominently and appropriately displayed.",
    },
    {
      key: "cart_abandonment",
      label: "이탈 유발 요인",
      desc: "장바구니/결제 중 이탈 위험",
      promptKo: "이탈 유발 요인: 장바구니 담기·결제 과정에서 예상치 못한 추가 비용, 필수 회원가입, 복잡한 입력 등 이탈을 유발하는 요소를 집중 파악하라.",
      promptEn: "Abandonment triggers: Identify unexpected costs, forced account creation, or complex inputs that cause cart and checkout abandonment.",
    },
    {
      key: "mobile_checkout",
      label: "모바일 결제 최적화",
      desc: "터치 친화성·입력 최소화",
      promptKo: "모바일 결제 최적화: 터치 타깃 크기, 키보드 입력 최소화, 자동완성 지원, 간편결제 연동 여부를 평가하라.",
      promptEn: "Mobile checkout optimization: Evaluate touch target sizes, input minimization, autocomplete support, and payment shortcut availability.",
    },
  ],

  fintech: [
    {
      key: "trust_security",
      label: "신뢰/보안 신호",
      desc: "보안 인증, 공식 마크, 개인정보",
      promptKo: "신뢰·보안 신호: 공식 인증 마크, 암호화 표시, 개인정보 처리 안내 등 금융 서비스에서 신뢰를 형성하는 요소가 충분한지 평가하라.",
      promptEn: "Trust & security signals: Evaluate whether official certifications, encryption indicators, and privacy disclosures adequately build trust for a financial service.",
    },
    {
      key: "info_clarity",
      label: "복잡한 정보 단순화",
      desc: "금융 용어·수수료·조건 가독성",
      promptKo: "정보 단순화: 금융 용어, 이자율, 수수료, 약관 등 복잡한 정보가 일반 사용자가 이해하기 쉽게 표현되는지 평가하라.",
      promptEn: "Information simplification: Evaluate whether complex financial terms, interest rates, fees, and terms are presented in a way that general users can easily understand.",
    },
    {
      key: "transaction_friction",
      label: "거래 마찰 최소화",
      desc: "이체·결제·투자 실행 단계",
      promptKo: "거래 마찰: 이체·결제·투자 등 핵심 금융 거래 실행에 필요한 단계 수와 인지 부하를 평가하라. 불필요한 확인 단계가 있는지 파악하라.",
      promptEn: "Transaction friction: Assess the number of steps and cognitive load required to execute core financial transactions. Identify unnecessary confirmation steps.",
    },
    {
      key: "error_prevention",
      label: "실수 방지 설계",
      desc: "돌이킬 수 없는 거래의 확인 단계",
      promptKo: "실수 방지: 취소·환불이 어려운 금융 거래에서 확인 단계, 경고 메시지, 되돌리기 옵션이 적절히 설계되었는지 평가하라.",
      promptEn: "Error prevention: Evaluate whether confirmation steps, warnings, and undo options are appropriately designed for irreversible financial transactions.",
    },
    {
      key: "onboarding_kyc",
      label: "인증/KYC 온보딩",
      desc: "신원확인·계좌 연결 흐름",
      promptKo: "인증 온보딩: 신원 확인, 계좌 연결, 약관 동의 등 복잡한 온보딩 단계에서 진행 상황 안내, 예상 소요 시간, 중단 후 재시작 가능 여부를 평가하라.",
      promptEn: "Authentication onboarding: Evaluate progress guidance, estimated time, and resumability for complex onboarding steps like identity verification and account linking.",
    },
  ],

  health: [
    {
      key: "motivation",
      label: "동기부여 요소",
      desc: "목표 설정·진행 시각화·성취감",
      promptKo: "동기부여: 목표 설정, 진행률 시각화, 완료 피드백 등 사용자의 운동/건강 행동을 지속하게 하는 동기부여 요소를 집중 평가하라.",
      promptEn: "Motivation elements: Closely evaluate goal-setting, progress visualization, and completion feedback that sustain user exercise or health behaviors.",
    },
    {
      key: "habit_loop",
      label: "습관 형성 패턴",
      desc: "알림·스트릭·루틴 강화",
      promptKo: "습관 형성: 알림, 스트릭(연속 달성), 루틴 반복을 강화하는 패턴이 사용자 행동을 습관화하는 데 효과적인지 평가하라.",
      promptEn: "Habit formation patterns: Evaluate how effectively notifications, streaks, and routine reinforcement patterns drive habitual user behavior.",
    },
    {
      key: "progress_viz",
      label: "진행상황 가시성",
      desc: "운동·건강 데이터 시각화",
      promptKo: "진행상황 시각화: 운동량, 건강 지표, 목표 달성률이 한눈에 파악되도록 충분히 가시화되어 있는지 평가하라.",
      promptEn: "Progress visibility: Evaluate whether exercise, health metrics, and goal completion rates are visualized clearly enough to be understood at a glance.",
    },
    {
      key: "personalization",
      label: "개인화 경험",
      desc: "개인 목표·수준 맞춤 콘텐츠",
      promptKo: "개인화: 사용자의 목표, 체력 수준, 과거 기록에 맞게 콘텐츠와 권장사항이 개인화되어 있는지 평가하라.",
      promptEn: "Personalization: Evaluate whether content and recommendations are tailored to the user's goals, fitness level, and history.",
    },
    {
      key: "social_challenge",
      label: "소셜/챌린지 기능",
      desc: "친구 비교·랭킹·함께 하기",
      promptKo: "소셜 기능: 친구와 비교, 랭킹, 함께 달성하기 등 사회적 참여를 유도하는 요소가 동기부여에 기여하는지 평가하라.",
      promptEn: "Social & challenge features: Evaluate whether friend comparisons, rankings, and group challenges contribute to motivation.",
    },
  ],

  social: [
    {
      key: "content_discovery",
      label: "콘텐츠 발견성",
      desc: "관심 콘텐츠를 빠르게 찾기",
      promptKo: "콘텐츠 발견성: 사용자가 관심 있는 콘텐츠를 빠르게 발견할 수 있도록 탐색, 추천, 검색 기능이 효과적으로 설계되었는지 평가하라.",
      promptEn: "Content discovery: Evaluate how effectively exploration, recommendations, and search help users find content they care about.",
    },
    {
      key: "engagement_cta",
      label: "참여 유도 설계",
      desc: "좋아요·댓글·공유 행동 유도",
      promptKo: "참여 유도: 좋아요, 댓글, 공유, 저장 등 참여 행동의 접근성과 마찰이 적은 유도 설계를 평가하라.",
      promptEn: "Engagement design: Evaluate the accessibility and low-friction design of likes, comments, shares, and saves.",
    },
    {
      key: "social_proof",
      label: "소셜 증명 요소",
      desc: "팔로워·반응 수·인기도 표시",
      promptKo: "소셜 증명: 팔로워 수, 반응 수, 조회수 등 사회적 신뢰와 인기를 나타내는 지표가 신뢰 형성에 기여하는지 평가하라.",
      promptEn: "Social proof: Evaluate how follower counts, reactions, and view counts contribute to trust and perceived popularity.",
    },
    {
      key: "creator_tools",
      label: "콘텐츠 생성 편의",
      desc: "게시물 작성·업로드·편집",
      promptKo: "콘텐츠 생성: 게시물 작성, 미디어 업로드, 편집 도구의 직관성과 마찰 수준을 평가하라. 첫 게시물 작성의 진입장벽을 파악하라.",
      promptEn: "Content creation: Evaluate the intuitiveness and friction of post creation, media upload, and editing tools. Identify barriers to a user's first post.",
    },
    {
      key: "feed_relevance",
      label: "피드 관련성",
      desc: "관심사에 맞는 콘텐츠 배치",
      promptKo: "피드 관련성: 상단에 노출되는 콘텐츠가 사용자 관심사와 얼마나 관련성 있게 배치되며, 광고와 오가닉 콘텐츠 비율이 적절한지 평가하라.",
      promptEn: "Feed relevance: Evaluate how well the top content matches user interests and whether the balance of ads vs. organic content is appropriate.",
    },
  ],

  saas: [
    {
      key: "feature_discovery",
      label: "기능 발견성",
      desc: "처음 사용자가 핵심 기능 찾기",
      promptKo: "기능 발견성: 처음 방문한 사용자가 핵심 기능을 설명 없이 찾을 수 있는지, 정보 구조와 내비게이션이 직관적인지 평가하라.",
      promptEn: "Feature discoverability: Evaluate whether first-time users can find core features without guidance, and whether the information architecture and navigation are intuitive.",
    },
    {
      key: "onboarding_complexity",
      label: "온보딩 복잡도",
      desc: "첫 사용 진입장벽·빠른 가치 실현",
      promptKo: "온보딩: 첫 사용까지의 단계 수, 필수 설정 항목, 빈 상태에서의 안내가 사용자가 빠르게 가치를 경험하도록 설계되었는지 평가하라.",
      promptEn: "Onboarding complexity: Evaluate steps to first use, required setup, and empty-state guidance to see if users can quickly realize value.",
    },
    {
      key: "task_efficiency",
      label: "작업 완료 효율",
      desc: "반복 업무의 클릭 수 최소화",
      promptKo: "작업 효율: 핵심 반복 업무를 완료하는 데 필요한 클릭 수와 인지 부하를 평가하라. 단축키, 일괄 처리, 자동화 옵션이 있는지 파악하라.",
      promptEn: "Task efficiency: Evaluate the number of clicks and cognitive load to complete core repetitive tasks. Identify shortcuts, bulk actions, or automation options.",
    },
    {
      key: "empty_state",
      label: "빈 상태 처리",
      desc: "데이터 없는 초기 상태 안내",
      promptKo: "빈 상태: 데이터가 없는 초기 상태에서 사용자가 무엇을 해야 할지 명확히 안내하는 빈 상태 디자인을 평가하라.",
      promptEn: "Empty state design: Evaluate how clearly the empty state guides users on what to do when there is no data yet.",
    },
    {
      key: "error_recovery",
      label: "오류/복구 경험",
      desc: "에러 메시지·되돌리기·도움말",
      promptKo: "오류 복구: 에러 발생 시 메시지의 명확성, 원인 설명, 해결 방법 안내, 실행 취소 기능 등 복구 경험을 평가하라.",
      promptEn: "Error recovery: Evaluate error message clarity, cause explanation, resolution guidance, and undo functionality when errors occur.",
    },
  ],

  travel: [
    {
      key: "search_filter",
      label: "검색/필터 효율",
      desc: "원하는 상품 빠르게 좁히기",
      promptKo: "검색·필터: 날짜, 인원, 예산, 카테고리 등 필터를 사용해 원하는 상품을 빠르게 좁히는 경험이 직관적인지 평가하라.",
      promptEn: "Search & filter efficiency: Evaluate how intuitively users can narrow results using date, group size, budget, and category filters.",
    },
    {
      key: "price_transparency",
      label: "가격 투명성",
      desc: "총 비용·추가 요금 명확 표시",
      promptKo: "가격 투명성: 세금, 수수료, 추가 요금이 결제 전 명확히 표시되는지, 최종 가격과 초기 표시 가격의 차이로 인한 신뢰 손실이 있는지 평가하라.",
      promptEn: "Price transparency: Evaluate whether taxes, fees, and add-ons are clearly shown before checkout, and whether price increases erode trust.",
    },
    {
      key: "booking_confidence",
      label: "예약 확신도",
      desc: "예약 전 정보 충분성·안심 신호",
      promptKo: "예약 확신도: 사진, 상세 정보, 정책, 취소 조건 등 예약 결정을 내리기 전 필요한 정보가 충분히 제공되는지 평가하라.",
      promptEn: "Booking confidence: Evaluate whether photos, details, policies, and cancellation terms provide sufficient information before committing to a booking.",
    },
    {
      key: "review_quality",
      label: "리뷰/사진 신뢰도",
      desc: "실제 경험 기반 정보 접근성",
      promptKo: "리뷰 신뢰도: 리뷰의 진정성, 최신성, 사진의 실제 환경 반영도, 부정적 리뷰 노출 여부 등 리뷰 신뢰성을 평가하라.",
      promptEn: "Review credibility: Evaluate review authenticity, recency, accuracy of photos, and whether negative reviews are visible.",
    },
    {
      key: "itinerary_mgmt",
      label: "예약·일정 관리",
      desc: "예약 확인·변경·취소 흐름",
      promptKo: "예약 관리: 예약 확인, 수정, 취소 프로세스의 명확성과 편의성, 긴급 상황 대응 안내를 평가하라.",
      promptEn: "Booking management: Evaluate the clarity and ease of confirming, modifying, and canceling bookings, including guidance for urgent situations.",
    },
  ],

  education: [
    {
      key: "learning_path",
      label: "학습 경로 명확성",
      desc: "무엇을 배워야 할지 방향 제시",
      promptKo: "학습 경로: 처음 사용자가 무엇을 먼저 배워야 할지, 전체 커리큘럼 구조가 어떻게 되는지 명확히 파악할 수 있는지 평가하라.",
      promptEn: "Learning path clarity: Evaluate whether first-time users can clearly understand what to learn first and how the overall curriculum is structured.",
    },
    {
      key: "engagement_retention",
      label: "학습 지속 유도",
      desc: "스트릭·배지·진도율 동기부여",
      promptKo: "학습 지속: 스트릭, 배지, 진도율, 학습 알림 등 이탈을 방지하고 꾸준한 학습을 유도하는 요소를 평가하라.",
      promptEn: "Learning retention: Evaluate streaks, badges, progress bars, and study reminders that prevent dropout and sustain consistent learning.",
    },
    {
      key: "content_clarity",
      label: "콘텐츠 이해도",
      desc: "난이도·가독성·학습 자료 품질",
      promptKo: "콘텐츠 이해도: 학습 자료의 난이도 조절, 가독성, 예시·시각자료의 충분성을 평가하라.",
      promptEn: "Content clarity: Evaluate the difficulty calibration, readability, and sufficiency of examples and visuals in learning materials.",
    },
    {
      key: "practice_feedback",
      label: "연습·피드백 루프",
      desc: "문제 풀이·즉각 피드백·오답 해설",
      promptKo: "연습·피드백: 문제 풀이 후 즉각적인 정오 피드백, 오답 해설, 반복 학습 권유 등 학습 효과를 높이는 피드백 루프를 평가하라.",
      promptEn: "Practice & feedback loop: Evaluate immediate right/wrong feedback, wrong-answer explanations, and spaced repetition features that reinforce learning.",
    },
    {
      key: "progress_tracking",
      label: "성취 추적",
      desc: "완료 학습·점수·약점 가시화",
      promptKo: "성취 추적: 완료한 학습 단위, 점수 추이, 취약 영역이 시각적으로 명확하게 표시되는지 평가하라.",
      promptEn: "Achievement tracking: Evaluate whether completed units, score trends, and weak areas are visually clear.",
    },
  ],

  other: [
    {
      key: "task_completion",
      label: "핵심 태스크 완료",
      desc: "핵심 사용자 목표 달성 용이성",
      promptKo: "핵심 태스크: 이 서비스에서 사용자가 달성해야 하는 핵심 목표를 중심으로, 경로의 단계 수·명확성·마찰을 집중 평가하라.",
      promptEn: "Core task completion: Focus evaluation on the primary user goal — assess step count, clarity, and friction in the main path.",
    },
    {
      key: "info_hierarchy",
      label: "정보 계층 구조",
      desc: "중요 정보의 시각적 우선순위화",
      promptKo: "정보 계층: 중요한 정보가 크기·색상·위치를 통해 시각적으로 우선순위화되어 있는지 평가하라.",
      promptEn: "Information hierarchy: Evaluate whether important information is visually prioritized through size, color, and placement.",
    },
    {
      key: "cta_clarity",
      label: "CTA 명확성",
      desc: "다음 행동 유도 버튼·링크 명확성",
      promptKo: "CTA 명확성: 사용자가 다음에 무엇을 해야 하는지 안내하는 버튼, 링크, CTA가 명확하고 충분히 눈에 띄는지 평가하라.",
      promptEn: "CTA clarity: Evaluate whether buttons, links, and calls-to-action clearly guide the user to the next step and are sufficiently prominent.",
    },
    {
      key: "error_handling",
      label: "에러 처리",
      desc: "오류 상황 안내·복구 경험",
      promptKo: "에러 처리: 입력 오류, 로딩 실패, 빈 결과 등 오류 상황에서 안내 메시지가 명확하고 해결 방법을 제시하는지 평가하라.",
      promptEn: "Error handling: Evaluate whether error messages for input errors, loading failures, and empty results are clear and provide resolution paths.",
    },
  ],
};

export function getDomainFocuses(domain: string): DomainFocusItem[] {
  return DOMAIN_FOCUSES[domain] ?? DOMAIN_FOCUSES.other;
}
