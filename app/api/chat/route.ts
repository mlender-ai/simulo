// app/api/chat/route.ts
// Conversational analysis endpoint — Phase C
// Replaces /api/analyze/chat for the new chat-based plugin UI.
// Accepts intent + subContext + frames[], returns SSE stream.

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

⚠ 환각 금지: 화면에 실제로 보이는 UI 요소만 분석하세요. 없는 버튼·텍스트를 추론하거나 가정하지 마세요.

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
  "quickSummary": "동료에게 말하듯 핵심 발견 한 줄 (40자 이내). 예: '전체적으로 깔끔한데 CTA가 좀 묻혀 있어요'",
  "findings": [
    {
      "criterion": "평가 기준명",
      "severity": 0,
      "oneLineFinding": "발견 요약 25자 이내",
      "detail": "상세 설명 2~3문장. 화면에서 실제 보이는 요소를 근거로 명시.",
      "fix": "구체적 수정 방법: 어떤 요소를 어떻게 변경. 모호한 표현 금지."
    }
  ],
  "nextQuestion": "후속 질문. 설문이 아닌 대화 이어가기. 예: '카피를 좀 다듬으면 느낌이 확 달라질 것 같은데, 봐볼까요?' / null이면 생략"
}

severity: 0=우수, 1=참고, 2=개선필요, 3=심각, 4=치명적
findings: severity 높은 순, 최대 ${maxFindings}개.
nextQuestion 규칙: "다음 작업을 선택해주세요" 같은 설문 말투 금지. "혹시 ~가 궁금한 거예요?", "이 부분이 좀 아쉬운데, 개선안을 같이 볼까요?" 식의 자연어 대화.
반드시 순수 JSON만 반환. \`\`\`json 블록 절대 사용 금지.`;
}

function getResponseType(intent: string): string {
  if (intent === "copy-rewrite") return "copy";
  if (intent === "ab-variant") return "ab";
  if (intent === "competitor-compare") return "compare";
  if (intent === "suggestion") return "suggestion";
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
  return 1024;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

interface FramePayload {
  nodeId: string;
  nodeName: string;
  imageBase64: string;
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
      conversationHistory?: Anthropic.MessageParam[];
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

    const apiKey = clientApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API 키가 없습니다" }, { status: 401 });
    }

    const firstFrame = resolvedFrames[0];
    const frameName = firstFrame.nodeName ?? "선택된 프레임";
    const systemPrompt = buildSystemPrompt(resolvedIntent, resolvedSubContext, ocrContext, persona);
    const model = selectModel(resolvedIntent);
    const maxTokens = getMaxTokens(resolvedIntent);

    const client = new Anthropic({ apiKey });

    // Build user content: up to 3 frame images + text
    const imageBlocks: Anthropic.ImageBlockParam[] = resolvedFrames
      .slice(0, 3)
      .map((f) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/png" as const, data: f.imageBase64 },
      }));

    const textPrompt = userMessage
      ? `화면: "${frameName}"\n\n유저 요청: ${userMessage}`
      : `화면: "${frameName}"을 분석해주세요.`;

    const userContent: Anthropic.ContentBlockParam[] = [
      ...imageBlocks,
      { type: "text" as const, text: textPrompt },
    ];

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      { role: "user", content: userContent },
    ];

    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
                )
              );
            }
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
