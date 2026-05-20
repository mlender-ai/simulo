import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { detectMediaType } from "@/lib/claude";
import { MODELS } from "@/lib/models";

export const maxDuration = 120;

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

const SYSTEM_PROMPT = `당신은 야핏무브 UX 라이팅 전문가입니다. 야핏무브 UX 라이팅 매뉴얼(v1.0)에 근거하여 Figma 디자인 프레임의 모든 텍스트를 분석합니다.

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
- ✗ "바로가기" → ✓ "출석체크하러 가기"

### 원칙3: 군더더기를 뺀다
뺐을 때 의미가 변하지 않는 단어는 빼야 한다.
금지 군더더기: "혹시", "잠깐", "한번", "지금 바로", "당장", "공짜", "열심히", "~하실 수 있는"
- ✗ "영상광고 보고 공짜 마일리지 받아가~" → ✓ "광고 보고 보너스 마일리지 받기"
- ✗ "혹시 지금 바로 받아보시겠어요?" → ✓ "지금 받기"

### 원칙4: 한 문장에 한 메시지를 담는다
여러 정보를 한 문장에 욱여넣으면 4060 사용자에게 부담스럽다.
- ✗ "매일 잠자고 보상을 받으시면 마일리지가 쌓여 더 많은 혜택을 누리실 수 있어요"
- ✓ "매일 잠자면 마일리지가 쌓여요"

### 원칙5: 따뜻한 감정으로 격려한다
사실만 건조하게 적시하지 않는다. 격려, 응원, 기대감을 준다.
- ✗ "오늘 5,034걸음을 걸었어요" → ✓ "오늘도 잘하고 있어요"
- ✗ "잠자기 보상이 예약되었습니다" → ✓ "내일 아침이 든든해요"
격려 자리에 사실만 적시하면 따뜻함이 사라진다. 사실 정보는 별도 영역에 둔다.

### 원칙6: 입으로 말할 수 있는 문장을 쓴다
소리 내어 읽었을 때 어색하면 다시 쓴다. 한자어, 문어체, 긴 호흡 문장 금지.
- ✗ "보상 지급이 완료되었습니다" → ✓ "보너스 마일리지를 받았어요"
- ✗ "잠자기 미션 완료 후 보상이 지급됩니다" → ✓ "잠자기를 끝내면 보너스를 받아요"

### 원칙7: 권유하되 강요하지 않는다
손실 회피는 야핏무브의 핵심 메커니즘이나 표현이 공격적이지 않게 한다.

### 원칙8: 모두가 이해할 수 있는 말을 쓴다
외래어, 줄임말, 인터넷 밈은 거리감을 만든다.
야핏무브 내부 용어(에너지, 두두, 마일리지, 마일리지샵, 보너스 마일리지)는 허용.

## 제품 라이팅 원칙 (화면 단위)

### 한 화면, 하나의 핵심 메시지
한 화면에 메시지가 여러 개 있으면 사용자가 무엇이 중요한지 판단 불가.

### 같은 단어를 한 화면에서 반복하지 않는다
동일 명사 3회 이상 등장 = 정리되지 않은 인상. 동일 동사 반복도 같은 문제.

### 원페이지 원액션
모든 화면은 사용자에게 단 하나의 행동을 요청한다. 타이틀 1줄 + CTA 1개만 봤을 때 "왜 해야 하는가"를 이해하고 바로 행동할 수 있어야 한다.
모달 표준 구조: 타이틀 1줄 + 메인 CTA 1개 + dismiss 1개 ("괜찮아요" / "닫기")

## 심각도 기준
- **critical**: 사용자가 오해하거나 행동하지 못하는 텍스트 (모호한 CTA, 이해 불가 문구, 두두 의인화, 강요적 표현)
- **warning**: 개선하면 전환율/만족도가 올라가는 텍스트 (군더더기, 문어체, 건조한 톤, 한 문장 복수 메시지)
- **info**: 더 나은 대안이 있는 텍스트 (미세한 톤 조정, 단어 반복, 마이크로카피 최적화)

## principle 값 (반드시 아래 중 하나)
"한눈에 이해", "행동 예측", "군더더기 제거", "한 문장 한 메시지", "따뜻한 격려", "구어체", "권유/비강요", "쉬운 말", "두두 원칙", "원페이지 원액션", "단어 반복 금지", "해요체", "정직한 표현"

## 응답 형식
반드시 아래 JSON 형식으로 응답하세요. JSON 외 다른 텍스트를 포함하지 마세요.

{
  "summary": "전체 UX 라이팅에 대한 1-2문장 요약 (코어밸류 기준)",
  "score": 0-100,
  "issues": [
    {
      "location": "텍스트가 위치한 UI 요소 (예: 상단 타이틀, 하단 CTA 버튼, 안내 문구)",
      "original": "화면에서 발견한 원본 텍스트 (정확히 그대로)",
      "suggestion": "야핏무브 매뉴얼 기준 개선된 텍스트",
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

async function fetchFigmaFrameImages(
  figmaToken: string,
  fileKey: string,
  frameIds: string[],
): Promise<{ base64Images: string[]; frameNames: string[] }> {
  // Get frame names
  const fileRes = await fetch(
    `https://api.figma.com/v1/files/${fileKey}?depth=1`,
    { headers: { "X-Figma-Token": figmaToken } },
  );
  if (!fileRes.ok) {
    throw new Error(`Figma API error: ${fileRes.status}`);
  }
  const fileData = await fileRes.json();
  const frameNameMap = new Map<string, string>();
  for (const page of fileData.document?.children ?? []) {
    for (const node of page.children ?? []) {
      frameNameMap.set(node.id, node.name);
    }
  }

  // Get image URLs
  const ids = frameIds.join(",");
  const imgRes = await fetch(
    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
    { headers: { "X-Figma-Token": figmaToken } },
  );
  if (!imgRes.ok) {
    throw new Error(`Figma image fetch failed: ${imgRes.status}`);
  }
  const imgData = await imgRes.json();

  const base64Images: string[] = [];
  const frameNames: string[] = [];

  for (const fid of frameIds) {
    const url = imgData.images?.[fid];
    if (!url) continue;
    const imgFetch = await fetch(url);
    const buffer = Buffer.from(await imgFetch.arrayBuffer());
    base64Images.push(buffer.toString("base64"));
    frameNames.push(frameNameMap.get(fid) ?? fid);
  }

  return { base64Images, frameNames };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      figmaToken,
      figmaFileKey,
      figmaFrameIds,
      images: rawImages,
      frameNames: rawFrameNames,
      apiKey,
      locale = "ko",
    } = body;

    let base64Images: string[];
    let frameNames: string[];

    if (figmaToken && figmaFileKey && Array.isArray(figmaFrameIds) && figmaFrameIds.length > 0) {
      // Figma mode: fetch frames
      const fetched = await fetchFigmaFrameImages(figmaToken, figmaFileKey, figmaFrameIds);
      base64Images = fetched.base64Images;
      frameNames = fetched.frameNames;
    } else if (Array.isArray(rawImages) && rawImages.length > 0) {
      // Direct image mode (for plugin or image upload)
      base64Images = rawImages.map((img: string) =>
        img.replace(/^data:image\/\w+;base64,/, ""),
      );
      frameNames = Array.isArray(rawFrameNames)
        ? rawFrameNames
        : base64Images.map((_, i) => `화면 ${i + 1}`);
    } else {
      return NextResponse.json({ error: "프레임 또는 이미지가 필요합니다" }, { status: 400 });
    }

    const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!effectiveKey) {
      return NextResponse.json({ error: "API 키가 설정되지 않았습니다" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: effectiveKey });

    const results: WritingCheckResult[] = [];

    for (let i = 0; i < base64Images.length; i++) {
      const userPrompt = locale === "en"
        ? `Analyze all visible text in this UI screen for UX writing quality. Frame name: "${frameNames[i]}". Return JSON only.`
        : `이 UI 화면에 보이는 모든 텍스트의 UX 라이팅 품질을 분석해주세요. 프레임명: "${frameNames[i]}". JSON만 반환하세요.`;

      const response = await client.messages.create({
        model: MODELS.sonnet,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: detectMediaType(base64Images[i]),
                  data: base64Images[i],
                },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => {
          if (b.type === "text") return b.text;
          return "";
        })
        .join("");

      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
        const raw = jsonMatch[1] ?? text;
        const parsed = JSON.parse(raw.trim());
        results.push({
          ...parsed,
          frameName: frameNames[i],
        });
      } catch {
        console.error("[ux-writing] Failed to parse response for frame:", frameNames[i]);
        results.push({
          summary: "분석 결과 파싱에 실패했습니다",
          score: 0,
          issues: [],
          strengths: [],
          frameName: frameNames[i],
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[ux-writing-check] Error:", error);
    const message = error instanceof Error ? error.message : "UX 라이팅 체크 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
