export interface HypothesisTemplate {
  label: string;
  text: string;
}

export interface HypothesisCategory {
  category: string;
  templates: HypothesisTemplate[];
}

export const HYPOTHESIS_TEMPLATES: HypothesisCategory[] = [
  {
    category: "온보딩",
    templates: [
      { label: "첫 화면 전환율", text: "첫 방문 사용자가 회원가입 버튼을 발견하고 클릭까지 도달할 수 있는가?" },
      { label: "튜토리얼 완주율", text: "신규 사용자가 온보딩 튜토리얼을 끝까지 완료할 수 있는가?" },
      { label: "소셜 로그인 신뢰도", text: "소셜 로그인 버튼이 충분히 눈에 띄고 신뢰감을 주는가?" },
    ],
  },
  {
    category: "탐색 / 내비게이션",
    templates: [
      { label: "메뉴 발견성", text: "사용자가 원하는 메뉴를 3초 이내에 찾을 수 있는가?" },
      { label: "뒤로가기 흐름", text: "이전 화면으로 돌아가는 경로가 직관적으로 인식되는가?" },
      { label: "검색 기능 접근성", text: "검색창을 즉시 발견하고 사용할 수 있는가?" },
    ],
  },
  {
    category: "결제 / 구매",
    templates: [
      { label: "결제 버튼 시인성", text: "결제/구매 버튼이 화면에서 가장 먼저 눈에 들어오는가?" },
      { label: "가격 정보 명확성", text: "총 결제금액과 세부 항목이 혼란 없이 이해되는가?" },
      { label: "장바구니 완료율", text: "장바구니에서 최종 구매까지 이탈 없이 완료할 수 있는가?" },
    ],
  },
  {
    category: "정보 구조 / 콘텐츠",
    templates: [
      { label: "핵심 정보 가독성", text: "가장 중요한 정보가 스크롤 없이 첫 화면에서 파악되는가?" },
      { label: "CTA 명확성", text: "다음 행동을 유도하는 버튼/링크가 맥락에 맞게 배치되었는가?" },
      { label: "빈 상태 안내", text: "데이터가 없는 상태에서 사용자가 다음 단계를 알 수 있는가?" },
    ],
  },
  {
    category: "피드백 / 상태 표시",
    templates: [
      { label: "로딩 상태 인지", text: "로딩 중임을 사용자가 즉시 인지하고 기다릴 수 있는가?" },
      { label: "오류 메시지 명확성", text: "오류 발생 시 원인과 해결 방법이 명확하게 전달되는가?" },
      { label: "완료 확인", text: "액션 완료 후 성공 여부를 사용자가 즉시 확인할 수 있는가?" },
    ],
  },
  {
    category: "폼 / 입력",
    templates: [
      { label: "필수 항목 식별", text: "어떤 항목이 필수인지 입력 전에 명확히 알 수 있는가?" },
      { label: "인라인 유효성 검사", text: "잘못된 입력에 대한 안내가 즉각적으로 표시되는가?" },
      { label: "자동완성 활용", text: "반복 입력이 자동완성으로 최소화되어 있는가?" },
    ],
  },
];
