// app/api/chat/route.ts
// Conversational analysis endpoint — Phase C
// Replaces /api/analyze/chat for the new chat-based plugin UI.
// Accepts intent + subContext + frames[], returns SSE stream.

import { NextRequest } from "next/server";
import { streamLLM, type LLMMessage, type LLMImage } from "@/lib/llm";

export const maxDuration = 120;

// ── Intent → System Prompt ────────────────────────────────────────────────────

const AXIS_PROMPTS: Record<string, string> = {
  "ad-buffer":
    "광고 직후 복귀 화면의 UX를 집중 분석하세요. 광고 스트레스 완충, 즉각적 보상 체감, 이탈 방지 설계를 평가하세요.",
  "earning-motivation":
    "포인트/마일리지 적립의 체감도를 집중 분석하세요. 숫자 가시성, 진행감, 달성 욕구를 유발하는 UI 요소를 평가하세요.",
  "retention-trigger":
    "재방문 동기 유발 요소를 집중 분석하세요. 스트릭, 알림 유도, 목표 시각화, 소실 공포(FOMO) 설계를 평가하세요.",
  "exchange-trust":
    "교환/출금 단계의 신뢰 요소를 집중 분석하세요. 안전감, 투명성, 단계 명확성, 불안 요소 제거를 평가하세요.",
};

function buildSystemPrompt(
  intent: string,
  subContext: string,
  ocrContext: string | undefined,
  persona?: string
): string {
  const ocrBlock = ocrContext?.trim() ? `\n${ocrContext.trim()}\n` : "";

  // Extract axis if present in subContext
  const axisMatch = subContext.match(/axis:(\S+)/);
  const axis = axisMatch?.[1] ?? "";
  const cleanSubContext = subContext.replace(/axis:\S+\s*/g, "").trim();

  let categoryGuide = "";
  const maxFindings = intent === "full-scan" || intent === "analyze-axis" ? 6 : 4;

  switch (intent) {
    case "full-scan":
      categoryGuide =
        "Nielsen 10가지 사용성 휴리스틱 기준으로 화면 전체를 종합 평가하세요. " +
        "광고 완충, 적립 체감, 재방문 트리거, 교환 전환 4축 관점도 포함하세요.";
      break;
    case "analyze-axis":
      categoryGuide =
        AXIS_PROMPTS[axis] ?? "선택된 관점에서 화면을 집중 분석하세요.";
      break;
    case "copy-rewrite":
      categoryGuide =
        "화면의 모든 텍스트 요소(헤드라인, 버튼, 안내문, 마이크로카피)를 UX 라이팅 원칙 기준으로 평가하고 " +
        "개선안을 제시하세요. 기준: 해요체, 군더더기 제거, CTA 명확성, 따뜻한 격려 톤.";
      break;
    case "ab-variant":
      categoryGuide =
        "이 화면의 핵심 전환 요소를 파악하고 A/B 테스트 가능한 구체적 변형 방향을 제안하세요. " +
        "control(현재 안)과 variant(대안) 차이를 명확히 하세요.";
      break;
    case "competitor-compare":
      categoryGuide =
        "야핏무브 관점에서 이 화면을 경쟁사와 비교 분석하세요. " +
        "머니워크(글로벌 111국, 걷기+식사+수면), 돈이돼지(1:1 현금출금, 터치 무제한) 대비 " +
        "강약점과 차별화 포인트를 평가하세요.";
      break;
    case "suggestion":
      categoryGuide =
        "이 화면의 UX 개선 우선순위를 impact/effort 기준으로 정리하세요. " +
        "즉시 실행 가능한 Quick Win을 중심으로, 각 제안은 구체적이고 실현 가능해야 합니다.";
      break;
    case "usability":
      categoryGuide =
        "사용자가 이 화면에서 목표를 달성하는 데 방해가 되는 요소를 집중 분석하세요. " +
        "인지 부하, 탐색 장벽, 오류 가능성에 집중하세요.";
      break;
    case "visual":
      categoryGuide =
        "레이아웃, 정보 계층, 색상 대비, 시각적 무게감, 가독성을 분석하세요. " +
        "사용자 시선 흐름이 중요도 순서로 이동하는지 평가하세요.";
      break;
    case "cta":
      categoryGuide =
        "CTA 버튼의 명확성, 위치, 레이블, 전환 흐름의 마찰 요소를 분석하세요. " +
        "버튼 클릭 후 어떤 일이 일어날지 사용자가 예측할 수 있는지 평가하세요.";
      break;
    case "text-consistency":
      categoryGuide =
        "제공된 화면들의 텍스트를 크로스 비교하여 **의미적 불일치**를 탐지하세요.\n" +
        "같은 역할(CTA, 에러 메시지, 상태 표시 등)을 하는 텍스트가 화면마다 다른 표현을 쓰는 경우를 찾아내세요.\n" +
        "예: '확인'/'완료'/'저장'이 같은 역할의 CTA에서 혼용, '포인트'/'리워드'/'적립금' 용어 혼용\n" +
        "각 불일치 그룹마다:\n" +
        "- criterion: 불일치 카테고리 (예: 'CTA 레이블 불일치', '에러 메시지 톤 불일치')\n" +
        "- oneLineFinding: 어떤 표현들이 혼용되는지 나열\n" +
        "- detail: 어느 화면에서 각각 발견되는지 구체적으로\n" +
        "- fix: 권장 표준 표현 1개 제시\n" +
        "severity: 3=사용자 혼란 유발, 2=톤 불일치, 1=사소한 차이";
      break;
    case "typography-hierarchy":
      categoryGuide =
        "제공된 '타이포그래피 위계 분석 데이터'를 사용하여 시각 가중치(fontSize × bold배율) 순위 vs 정보 의미 중요도의 역전을 탐지하세요.\n" +
        "각 텍스트를 의미 카테고리로 분류하세요: CTA | 핵심정보 | 본문 | 장식 | 라벨\n" +
        "판별 기준: CTA/핵심정보보다 시각 가중치가 높은 장식/본문 텍스트 = 위계 역전\n" +
        "각 역전 케이스는 아래 형식으로 기술하세요:\n" +
        "  detail: '1순위 가장 큰 텍스트: \"[텍스트]\" [장식] — CTA \"[텍스트]\"보다 Npx 더 큼'\n" +
        "criterion 첫 번째 항목은 반드시 '위계 스코어'로 하고 0-100점 평가 결과와 근거를 포함하세요 (100=완벽, 0=완전 역전).\n" +
        "severity: 3=CTA가 장식보다 작음(심각), 2=핵심정보 가중치 역전, 1=미미한 불균형, 0=위계 양호\n" +
        "fix: 구체적 폰트 크기 조정 수치 포함 (예: 'CTA를 18px→22px, 배경 카피를 24px→16px로 조정')";
      break;
    case "cognitive-load":
      categoryGuide =
        "이 화면의 **인지 부하(Cognitive Load)**를 측정하세요.\n" +
        "다음 요인들을 종합적으로 평가하세요:\n" +
        "1. 정보 밀도 — 한 화면에 담긴 텍스트량, 요소 수, 선택지 수\n" +
        "2. 시각적 복잡도 — 색상 다양성, 레이아웃 불규칙성, 시각적 노이즈\n" +
        "3. 인지 단계 수 — 사용자가 목표 달성까지 거쳐야 할 판단/선택 횟수\n" +
        "4. 용어 난이도 — 전문 용어, 약어, 모호한 레이블\n" +
        "5. 시각적 계층 명확도 — 정보 우선순위가 시각적으로 구분되는 정도\n\n" +
        "criterion 첫 번째 항목은 반드시 '인지 부하 점수'로 하고 0-100점 평가:\n" +
        "- 0-30: 가벼움 (미니멀, 즉시 이해 가능)\n" +
        "- 31-50: 적정 (적절한 정보량)\n" +
        "- 51-70: 높음 (집중 필요, 시니어에게 부담)\n" +
        "- 71-100: 과부하 (정보 과잉, 이탈 위험)\n\n" +
        "이후 criterion에 각 부하 요인을 기술하세요:\n" +
        "- oneLineFinding: 요인명 + 현황 요약\n" +
        "- detail: 구체적 근거 (요소 수, 텍스트량 등 정량적 표현 포함)\n" +
        "- fix: 부하를 줄이기 위한 구체적 개선안 (프로그레시브 디스클로저, 그룹핑, 제거 등)\n" +
        "severity: 3=과부하(이탈 위험), 2=높음(개선 필요), 1=적정, 0=가벼움\n" +
        "특히 야핏무브 타깃(4060 여성)의 인지 처리 속도를 고려하여 평가하세요.";
      break;
    case "first-impression":
      categoryGuide =
        "이 화면을 처음 보는 사용자가 **5초 안에 기억할 요소**를 예측하세요.\n" +
        "시각적 가중치(크기·대비·위치·색상·공간 밀도)를 기준으로 주목도 Top 5 요소를 선정하세요.\n\n" +
        "분석 흐름:\n" +
        "1. 시각적 가중치 기반 주목도 순위 (Top 5): 각 요소가 왜 눈에 띄는지 근거 명시\n" +
        "2. 핵심 메시지 전달 여부: CTA, 브랜드, 혜택 수치 등 의도된 핵심 메시지가 Top 5에 포함되는지\n" +
        "3. 첫인상 갭 진단: 디자이너가 전달하고 싶은 것 vs 실제 눈에 먼저 띄는 것의 차이\n\n" +
        "criterion 첫 번째 항목은 반드시 '첫인상 스코어'로 하고 0-100점 평가:\n" +
        "- 100: 핵심 메시지가 즉시 전달됨\n" +
        "- 70-99: 대체로 전달되지만 경쟁 요소 존재\n" +
        "- 40-69: 핵심 메시지보다 부차적 요소가 더 눈에 띔\n" +
        "- 0-39: 핵심 메시지가 묻혀 있음\n\n" +
        "이후 criterion에 주목도 순위별 요소를 기술하세요:\n" +
        "- oneLineFinding: '1순위: [요소명] — [눈에 띄는 이유]'\n" +
        "- detail: 시각적 가중치 근거 + 핵심 메시지와의 관계\n" +
        "- fix: 핵심 메시지 전달력을 높이기 위한 구체적 조정 방법\n" +
        "severity: 3=핵심 메시지가 Top 5에 없음, 2=있지만 1순위 아님, 1=양호, 0=우수";
      break;
    case "conversion-friction":
      categoryGuide =
        "선택된 화면 흐름에서 **전환 경로 마찰**을 분석하세요.\n" +
        "전환 목표(가입, 미션 완료, 포인트 교환 등)를 향해 가는 각 단계에서:\n" +
        "1. 인지 부하 — 화면당 결정·입력·읽기 요구량이 적정한가\n" +
        "2. CTA 명확도 — 다음 행동이 즉시 명확한가, 레이블이 행동을 예측 가능하게 하는가\n" +
        "3. 불필요한 입력·단계 — 목표 달성에 불필요한 정보 수집·확인 단계가 있는가\n" +
        "4. 신뢰 저하 요소 — 불안, 혼란, 의심을 유발하는 텍스트·디자인이 있는가\n\n" +
        "criterion 첫 번째 항목은 반드시 '이탈 위험 점수'로 하고 0–100점 산출:\n" +
        "- 0–20: 마찰 없음 (전환 경로 매끄러움)\n" +
        "- 21–40: 경미한 마찰 (개선 권장)\n" +
        "- 41–60: 중간 마찰 (이탈 가능, 개선 필요)\n" +
        "- 61–80: 높은 마찰 (이탈 위험 높음)\n" +
        "- 81–100: 심각한 마찰 (전환 실패 위험)\n\n" +
        "이후 criterion에 마찰이 가장 높은 단계부터 기술하세요:\n" +
        "- oneLineFinding: '화면 N — [마찰 유형]: [한 줄 요약]'\n" +
        "- detail: 어떤 요소가 어떻게 이탈을 유발하는지 구체적 근거\n" +
        "- fix: 마찰을 줄이기 위한 구체적 개선안 (레이블 변경, 단계 제거, 배치 변경 등)\n" +
        "severity: 3=이탈 유발(심각), 2=마찰 높음(개선 필요), 1=경미, 0=마찰 없음\n" +
        "야핏무브 타깃(4060 여성)의 기술 친숙도를 고려하여 복잡한 흐름에 더 높은 마찰 점수를 부여하세요.";
      break;
    case "iteration-compare":
      categoryGuide =
        "제공된 두 이미지는 같은 화면의 **이전(v1)과 이후(v2) 버전**입니다.\n" +
        "야핏무브 UX 4축 기준으로 각 버전을 5점 만점으로 채점하고 개선/퇴보를 측정하세요.\n" +
        "4축:\n" +
        "- 광고 완충(ad-buffer): 광고 후 이탈 방지, 보상 즉시성, 심리적 완충 요소\n" +
        "- 수익 동기(earning-motivation): 포인트 가시성, 적립 체감, 목표 달성 욕구\n" +
        "- 리텐션 트리거(retention-trigger): 재방문 유도, 스트릭, FOMO 설계\n" +
        "- 교환 신뢰(exchange-trust): 출금/교환 단계 투명성, 안전감, 신뢰 단서\n\n" +
        "findings에 4축 각각의 비교 데이터를 포함하세요 (반드시 4개).\n" +
        "severity: 0=큰 개선, 1=소폭 개선, 2=변화 없음, 3=소폭 퇴보, 4=큰 퇴보";
      break;
    case "state-audit":
      categoryGuide =
        "이 화면의 '상태 완전성'을 감사하세요. 다음 상태가 설계되어 있는지 확인하세요:\n" +
        "1. 에러 상태 — API 실패, 네트워크 오류 시 사용자에게 보이는 화면\n" +
        "2. 빈 상태 (Empty State) — 데이터가 없을 때의 화면\n" +
        "3. 로딩 상태 — 데이터 로드 중 스켈레톤/스피너\n" +
        "4. 폼 검증 실패 — 입력값 오류 시 인라인 에러 메시지\n" +
        "5. 권한 없음 — 접근 제한 시 안내\n" +
        "6. 성공 완료 — 작업 완료 시 피드백\n" +
        "각 상태가 화면에 보이는지, 누락되었는지 판단하세요. " +
        "누락된 상태는 severity 3(심각)으로, 존재하지만 미흡한 상태는 severity 2(개선필요)로 평가하세요. " +
        "criterion 필드에 상태 유형명을 사용하세요 (예: '에러 상태', '빈 상태').";
      break;
    default:
      categoryGuide =
        "Nielsen 사용성 휴리스틱 기준으로 화면을 종합 평가하세요.";
  }

  if (cleanSubContext) {
    categoryGuide += `\n분석 맥락: ${cleanSubContext}`;
  }

  const personaBlock = persona
    ? `\n\n## 페르소나 관점 분석\n분석 대상 사용자: ${persona}\n이 사용자의 눈으로 모든 UI 요소를 평가하세요. "일반적으로 좋다"가 아니라 "이 사용자에게 이 요소가 이해되는가, 조작 가능한가, 불안하지 않은가"를 기준으로 판단하세요.\n`
    : "";

  return `당신은 야핏무브 팀의 시니어 UX 동료입니다. 야핏무브(만보기 리워드 앱, 4060 여성 타깃)의 Figma 화면을 같이 보면서 이야기합니다.

⚠ 환각 금지: 첨부된 화면 이미지를 반드시 직접 보고, 실제로 보이는 UI 요소만 분석하세요. 없는 버튼·텍스트를 추론하거나 가정하지 마세요.
⚠ 이미지 근거 의무: 각 finding의 detail에는 화면에서 실제로 보이는 텍스트·버튼·숫자를 최소 1개 그대로 인용하세요(예: "'포인트 교환하기' 버튼"). 화면과 무관한 일반론만 쓰면 안 됩니다.
⚠ 언어: 모든 출력 값(criterion, oneLineFinding, detail, fix 등)은 반드시 한국어로 작성하세요. 영어 휴리스틱명 금지 — 예: "Visibility of system status"(X) → "시스템 상태 가시성"(O), "User control and freedom"(X) → "사용자 제어와 자유"(O).

## 대화 톤 규칙
외부 컨설턴트가 아니라 옆자리에서 같이 화면을 보는 동료처럼 말하세요.
- 핵심을 먼저, 한 문장으로. 예: "전체적으로 괜찮은데, 하나 좀 걸리는 게 있어요"
- 심각한 이슈: "이건 좀 봐야겠어요" — 알람을 주되 공포를 주지 않음
- 양호할 때: "이 부분은 잘 되어 있어요" — 칭찬도 함
- 경쟁사 언급: "돈이돼지는 여기서 이렇게 하고 있거든요" — 자연스러운 참조
금지 표현: "분석 결과를 전달드립니다", "아래 항목을 참고하세요", "권장 드립니다", "검토 부탁드립니다"
사용 표현: "같이 봐볼게요", "이런 점이 눈에 띄어요", "이렇게 하면 좋겠어요"
${ocrBlock}${personaBlock}
분석 지침: ${categoryGuide}

응답 형식 (반드시 순수 JSON, 마크다운 코드 블록 없음):
{
  "type": "${getResponseType(intent)}",
  "quickSummary": "동료에게 말하듯 핵심 발견 한 줄 (40자 이내, 한국어). 예: '전체적으로 깔끔한데 CTA가 좀 묻혀 있어요'",
  "findings": [
    {
${getOutputSchema(intent).itemFields}
    }
  ],
  "nextQuestion": "후속 질문. 설문이 아닌 대화 이어가기. 예: '카피를 좀 다듬으면 느낌이 확 달라질 것 같은데, 봐볼까요?' / null이면 생략"
}

${getOutputSchema(intent).example}

severity: 0=우수, 1=참고, 2=개선필요, 3=심각, 4=치명적
findings: severity 높은 순, 최대 ${maxFindings}개.
nextQuestion 규칙: "다음 작업을 선택해주세요" 같은 설문 말투 금지. "혹시 ~가 궁금한 거예요?", "이 부분이 좀 아쉬운데, 개선안을 같이 볼까요?" 식의 자연어 대화.
반드시 순수 JSON만 반환. 모든 값은 한국어. \`\`\`json 블록 절대 사용 금지.`;
}

// intent(=응답 type)별로 findings 항목의 필드 스키마와 few-shot 예시를 반환.
// 약한 모델이 intent를 다른 과업으로 인식하도록 필드명 자체를 차별화한다.
function getOutputSchema(intent: string): { itemFields: string; example: string } {
  const type = getResponseType(intent);
  switch (type) {
    case "suggestion":
      return {
        itemFields:
          '      "criterion": "개선 항목명 (한국어)",\n' +
          '      "severity": 2,\n' +
          '      "oneLineFinding": "개선 포인트 요약 25자 이내 (한국어)",\n' +
          '      "impact": "【필수】 높음 | 중간 | 낮음 중 하나. 절대 비우지 말 것",\n' +
          '      "effort": "【필수】 높음 | 중간 | 낮음 중 하나. 절대 비우지 말 것",\n' +
          '      "detail": "왜 개선이 필요한지, 화면의 실제 요소를 인용해 (한국어)",\n' +
          '      "fix": "구체적 실행 방법 (한국어)"',
        example:
          '⚠ suggestion 분석은 각 항목에 impact와 effort를 반드시 채워야 합니다. 이 두 필드가 없으면 잘못된 응답입니다.\n' +
          '예시 findings 항목(이 형식·언어를 그대로 따르되 내용은 실제 화면 기준):\n' +
          '{"criterion":"적립 버튼 강조","severity":2,"oneLineFinding":"받기 버튼이 작아 눈에 안 띔","impact":"높음","effort":"낮음","detail":"화면 중앙 \'탭하여 받기\' 버튼이 주변 카드보다 작아 적립 행동 유도가 약합니다.","fix":"버튼 높이를 56px로 키우고 라임색 배경으로 대비를 높이세요."}\n' +
          'impact/effort 기준으로 Quick Win(임팩트 높고 노력 낮음)을 앞쪽에 배치하세요.',
      };
    case "copy":
      return {
        itemFields:
          '      "criterion": "카피 위치/역할 (한국어, 예: \'CTA 버튼\', \'메인 헤드라인\')",\n' +
          '      "severity": 1,\n' +
          '      "before": "【필수】 화면에 실제로 보이는 현재 카피를 그대로 인용. 절대 비우지 말 것",\n' +
          '      "after": "【필수】 개선 카피 제안 (한국어). 절대 비우지 말 것",\n' +
          '      "detail": "왜 이렇게 바꾸는지 (한국어)"',
        example:
          '⚠ copy 분석은 각 항목에 before(현재 카피)와 after(개선 카피)를 반드시 채워야 합니다. 이 두 필드가 없으면 잘못된 응답입니다.\n' +
          '예시 findings 항목(before는 반드시 화면 실제 텍스트를 인용):\n' +
          '{"criterion":"메인 헤드라인","severity":1,"before":"꿈의편지를 읽고 깊게 숙면해요","after":"편지 읽고 꿀잠 자기","detail":"4060 사용자에게는 짧고 구체적인 동사형이 더 빠르게 읽힙니다."}',
      };
    case "ab":
      return {
        itemFields:
          '      "criterion": "테스트 요소 (한국어, 예: \'CTA 문구\', \'버튼 위치\')",\n' +
          '      "severity": 1,\n' +
          '      "hypothesis": "가설 (한국어, \'~하면 ~가 오를 것이다\')",\n' +
          '      "control": "【필수】 현재 안 — 화면 실제 상태를 인용. 절대 비우지 말 것",\n' +
          '      "variant": "【필수】 변형 안 (한국어). 절대 비우지 말 것",\n' +
          '      "detail": "예상 효과와 근거 (한국어)"',
        example:
          '⚠ ab 분석은 각 항목에 control(현재)과 variant(변형)를 반드시 채워야 합니다.\n' +
          '예시 findings 항목(control은 화면 실제 상태를 인용):\n' +
          '{"criterion":"적립 CTA 문구","severity":1,"hypothesis":"행동을 명시하면 적립 전환이 오를 것","control":"탭하여 받기","variant":"120P 지금 받기","detail":"혜택 수치를 버튼에 노출하면 클릭 동기가 강해집니다."}',
      };
    case "compare":
      return {
        itemFields:
          '      "criterion": "비교 항목 (한국어, 예: \'출금 신뢰감\', \'적립 체감\')",\n' +
          '      "severity": 2,\n' +
          '      "us": "【필수】 야핏무브 화면의 현재 상태 — 화면 인용. 절대 비우지 말 것",\n' +
          '      "competitor": "【필수】 경쟁사(머니워크/돈이돼지) 방식. 절대 비우지 말 것",\n' +
          '      "gap": "격차 한 줄 (한국어)",\n' +
          '      "fix": "따라잡기 위한 구체안 (한국어)"',
        example:
          '⚠ compare 분석은 각 항목에 us(야핏)와 competitor(경쟁사)를 반드시 채워야 합니다.\n' +
          '예시 findings 항목(us는 화면 실제 상태를 인용):\n' +
          '{"criterion":"출금 신뢰감","severity":2,"us":"\'포인트 교환하기\' 버튼만 노출","competitor":"돈이돼지는 1:1 현금출금·실시간 처리를 강조","gap":"신뢰 단서가 부족해 교환을 망설이게 함","fix":"\'평균 N분 내 처리\'와 실제 출금 후기 배지를 버튼 근처에 추가하세요."}',
      };
    case "iteration":
      return {
        itemFields:
          '      "criterion": "4축 중 하나: 광고 완충 | 수익 동기 | 리텐션 트리거 | 교환 신뢰",\n' +
          '      "severity": 0,\n' +
          '      "beforeScore": 3.2,\n' +
          '      "afterScore": 4.1,\n' +
          '      "delta": 0.9,\n' +
          '      "direction": "improved | regressed | unchanged",\n' +
          '      "oneLineFinding": "변화 요약 25자 이내 (한국어)",\n' +
          '      "detail": "v1→v2 변화의 구체적 근거. 화면 요소를 인용해서 설명 (한국어)",\n' +
          '      "fix": "퇴보 시 개선안 / 개선 시 강화 방법 (한국어)"',
        example:
          '⚠ iteration 분석: findings는 반드시 4축 모두 포함 (4개). beforeScore/afterScore/delta/direction 필수.\n' +
          'beforeScore/afterScore: 0.0~5.0 소수점 1자리. delta = afterScore - beforeScore.\n' +
          '예시: {"criterion":"광고 완충","severity":1,"beforeScore":3.2,"afterScore":4.1,"delta":0.9,"direction":"improved","oneLineFinding":"광고 후 보상 유도 강화","detail":"v1에는 광고 직후 빈 화면이었으나 v2에서 \'120P 받기\' 버튼이 추가되어 이탈 방지가 개선됨","fix":"현재 방향 유지. 보상 수치를 더 크게 표시하면 효과 강화 가능"}',
      };
    default: // analysis (full-scan, usability, visual, cta, analyze-axis 등)
      return {
        itemFields:
          '      "criterion": "평가 기준명 (한국어, 영어 휴리스틱명 절대 금지)",\n' +
          '      "severity": 0,\n' +
          '      "oneLineFinding": "발견 요약 25자 이내 (한국어)",\n' +
          '      "detail": "상세 2~3문장. 화면에서 실제 보이는 텍스트/숫자/버튼을 1개 이상 인용 (한국어)",\n' +
          '      "fix": "구체적 수정 방법 (한국어)"',
        example:
          '예시 findings 항목(criterion은 한국어, detail은 화면 요소 인용):\n' +
          '{"criterion":"적립 체감","severity":2,"oneLineFinding":"걸음수는 크지만 보상이 약하게 보임","detail":"상단 \'8,432 오늘 걸음수\'는 크게 보이나 \'+120P 적립됨\'이 작아 보상 체감이 약합니다.","fix":"적립 포인트를 걸음수와 같은 위계로 키우고 획득 애니메이션을 추가하세요."}',
      };
  }
}

function getResponseType(intent: string): string {
  if (intent === "copy-rewrite") return "copy";
  if (intent === "ab-variant") return "ab";
  if (intent === "competitor-compare") return "compare";
  if (intent === "suggestion") return "suggestion";
  if (intent === "iteration-compare") return "iteration";
  return "analysis";
}

function selectModel(intent: string): string {
  // Sonnet for deep analysis, Haiku for quick text/copy tasks
  const needsSonnet = [
    "full-scan",
    "analyze-axis",
    "ab-variant",
    "flow-analysis",
    "suggestion",
    "state-audit",
    "text-consistency",
    "typography-hierarchy",
    "first-impression",
    "cognitive-load",
    "conversion-friction",
    "iteration-compare",
  ].includes(intent);
  return needsSonnet
    ? "claude-sonnet-4-20250514"
    : "claude-haiku-4-5-20251001";
}

function getMaxTokens(intent: string): number {
  if (intent === "full-scan") return 2048;
  if (intent === "analyze-axis") return 2048;
  if (intent === "ab-variant") return 1536;
  if (intent === "state-audit") return 2048;
  if (intent === "text-consistency") return 2048;
  if (intent === "typography-hierarchy") return 1536;
  if (intent === "first-impression") return 2048;
  if (intent === "cognitive-load") return 2048;
  if (intent === "conversion-friction") return 2048;
  if (intent === "iteration-compare") return 2048;
  return 1024;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

interface FramePayload {
  nodeId: string;
  nodeName: string;
  imageBase64: string;
  mimeType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      frames,
      intent = "full-scan",
      subContext = "",
      conversationHistory = [],
      userMessage = "",
      apiKey: clientApiKey,
      ocrContext,
      persona,
      // Legacy fallback: support old analyze/chat body shape
      image,
      categoryId,
      followUpContext,
      frameName: legacyFrameName,
    } = body as {
      frames?: FramePayload[];
      intent?: string;
      subContext?: string;
      conversationHistory?: LLMMessage[];
      userMessage?: string;
      apiKey?: string;
      ocrContext?: string;
      persona?: string;
      image?: string;
      categoryId?: string;
      followUpContext?: string;
      frameName?: string;
    };

    // Normalise: support both new (frames[]) and legacy (image + categoryId) shape
    const resolvedFrames: FramePayload[] = frames?.length
      ? frames
      : image
      ? [{ nodeId: "", nodeName: legacyFrameName ?? "프레임", imageBase64: image }]
      : [];
    const resolvedIntent = intent !== "full-scan" ? intent : categoryId ?? intent;
    const resolvedSubContext = subContext || followUpContext || "";

    if (resolvedFrames.length === 0) {
      return Response.json({ error: "프레임이 없습니다" }, { status: 400 });
    }

    const firstFrame = resolvedFrames[0];
    const frameName = firstFrame.nodeName ?? "선택된 프레임";
    const systemPrompt = buildSystemPrompt(resolvedIntent, resolvedSubContext, ocrContext, persona);
    const anthropicModel = selectModel(resolvedIntent);
    const maxTokens = getMaxTokens(resolvedIntent);

    const textPrompt = resolvedIntent === "iteration-compare" && resolvedFrames.length >= 2
      ? `첫 번째 이미지(이전 v1): "${resolvedFrames[0].nodeName}"\n두 번째 이미지(이후 v2): "${resolvedFrames[1].nodeName}"\n\n두 프레임을 4축 기준으로 이터레이션 비교 분석해주세요.`
      : userMessage
      ? `화면: "${frameName}"\n\n유저 요청: ${userMessage}`
      : `화면: "${frameName}"을 분석해주세요.`;

    // conversationHistory는 텍스트 메시지만 통과 (이미지 없는 과거 대화)
    const history: LLMMessage[] = (conversationHistory ?? [])
      .filter(
        (m): m is LLMMessage =>
          typeof m?.content === "string" &&
          (m.role === "user" || m.role === "assistant")
      )
      .map((m) => ({ role: m.role, content: m.content }));

    const images: LLMImage[] = resolvedFrames.map((f) => ({
      base64: f.imageBase64,
      mimeType: f.mimeType ?? "image/png",
    }));

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of streamLLM({
            system: systemPrompt,
            history,
            images,
            userText: textPrompt,
            maxTokens,
            clientAnthropicKey: clientApiKey,
            anthropicModel,
            jsonMode: true,
          })) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
