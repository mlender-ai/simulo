# SKILLS.md — Simulo 파이프라인 스킬 정의

## 스킬 = Intent (파이프라인)

각 스킬은 하나의 intent에 대응한다.
스킬은 입력(Context Stack에서 가져올 것), 출력(JSON 스키마), 프롬프트 위치를 정의한다.
모든 파이프라인은 `app/api/chat/route.ts`의 `buildSystemPrompt()` 내에서 조합된다.

---

### full-scan
- **설명:** Nielsen 10가지 사용성 휴리스틱 + 4축 관점 종합 분석
- **키워드:** 전체, 전반, 봐줘, 검토, 분석해, 뭐가 문제, 어때
- **입력:** frames (1~3장), ocrContext (자동 생성)
- **출력:**
  ```json
  {
    "type": "analysis",
    "quickSummary": "핵심 발견 한 줄 (35자 이내)",
    "findings": [{ "criterion", "severity", "oneLineFinding", "detail", "fix" }],
    "nextQuestion": null
  }
  ```
- **모델:** Sonnet | **max_tokens:** 2048 | **최대 findings:** 6개

### analyze-axis
- **설명:** 4축 중 1개 집중 분석 (ad-buffer, earning-motivation, retention-trigger, exchange-trust)
- **키워드:** 광고/적립/재방문/교환 등 축별 키워드
- **입력:** frames, axis (프레임워크 ID), subContext
- **출력:** full-scan과 동일 구조
- **프롬프트:** `AXIS_PROMPTS[axis]` 사용
- **모델:** Sonnet | **max_tokens:** 2048 | **최대 findings:** 6개

### copy-rewrite
- **설명:** 화면 텍스트(헤드라인, 버튼, 마이크로카피) UX 라이팅 개선
- **키워드:** 카피, 문구, 워딩, 다듬, 텍스트 고쳐, 라이팅
- **입력:** frames, ocrContext
- **출력:**
  ```json
  {
    "type": "copy",
    "quickSummary": "...",
    "findings": [{ "criterion", "severity", "oneLineFinding", "detail", "fix" }]
  }
  ```
- **기준:** 해요체, 군더더기 제거, CTA 명확성, 따뜻한 격려 톤
- **모델:** Haiku | **max_tokens:** 1024 | **최대 findings:** 4개

### ab-variant
- **설명:** A/B 테스트 가능한 변형 방향 제안
- **키워드:** A/B, ab, 변형, 테스트, 실험안
- **입력:** frames, ocrContext
- **출력:**
  ```json
  {
    "type": "ab",
    "quickSummary": "...",
    "findings": [{ "criterion", "severity", "oneLineFinding", "detail", "fix" }]
  }
  ```
- **모델:** Sonnet | **max_tokens:** 1536 | **최대 findings:** 4개

### competitor-compare
- **설명:** 머니워크/돈이돼지 대비 강약점 비교
- **키워드:** 비교, 경쟁사, 머니워크, 돈이돼지
- **입력:** frames, ocrContext
- **출력:**
  ```json
  {
    "type": "compare",
    "quickSummary": "...",
    "findings": [{ "criterion", "severity", "oneLineFinding", "detail", "fix" }]
  }
  ```
- **모델:** Haiku | **max_tokens:** 1024 | **최대 findings:** 4개

### suggestion
- **설명:** impact/effort 기준 UX 개선 우선순위. Quick Win 중심.
- **키워드:** 개선안, 개선해줘, 어떻게 고치, 솔루션, 제안해줘
- **입력:** frames, previousResults (있으면 참조)
- **출력:** analysis 타입과 동일
- **모델:** Sonnet | **max_tokens:** 1024 | **최대 findings:** 4개

### usability
- **설명:** 인지 부하, 탐색 장벽, 오류 가능성 집중 분석
- **모델:** Haiku | **max_tokens:** 1024

### visual
- **설명:** 레이아웃, 정보 계층, 색상 대비, 시선 흐름 분석
- **모델:** Haiku | **max_tokens:** 1024

### cta
- **설명:** CTA 버튼 명확성, 위치, 레이블, 전환 마찰 분석
- **모델:** Haiku | **max_tokens:** 1024

---

## 새 스킬 추가 체크리스트

1. `app/api/chat/route.ts` — `buildSystemPrompt()` switch-case에 새 intent 추가
2. `app/api/chat/route.ts` — `selectModel()`, `getMaxTokens()` 분기 추가
3. `figma-plugin/src/ui/ui.ts` — `KEYWORD_INTENT_MAP`에 키워드 추가
4. `figma-plugin/src/ui/ui.ts` — `INTENT_TO_CATEGORY`에 매핑 추가
5. `figma-plugin/src/ui/ui.ts` — `getLabelsForState()`에 라벨 추가
6. 이 파일(`SKILLS.md`)에 문서화
