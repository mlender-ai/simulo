import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

const SYSTEM_PROMPT = `당신은 UX 라이팅 전문가입니다. Figma 디자인 프레임 이미지를 분석하여 화면에 보이는 모든 텍스트의 UX 라이팅 품질을 평가합니다.

## 평가 기준

1. **명확성(Clarity)**: 사용자가 즉시 이해할 수 있는가?
2. **간결성(Conciseness)**: 불필요한 단어 없이 핵심만 전달하는가?
3. **행동 유도(Actionability)**: CTA와 버튼이 구체적 행동을 유도하는가?
4. **일관성(Consistency)**: 톤, 높임말, 용어가 일관적인가?
5. **공감(Empathy)**: 에러/빈 상태에서 사용자를 배려하는가?
6. **접근성(Accessibility)**: 전문 용어 없이 누구나 이해 가능한가?

## 심각도 기준

- **critical**: 사용자가 오해하거나 행동을 못 하는 텍스트 (예: 모호한 CTA, 이해 불가 에러 메시지)
- **warning**: 개선하면 전환율/만족도가 올라가는 텍스트 (예: 수동태, 불필요한 길이)
- **info**: 더 나은 대안이 있는 텍스트 (예: 미세한 톤 조정, 마이크로카피 최적화)

## principle 예시
"명확성", "간결성", "행동 유도", "일관성", "공감", "접근성", "마이크로카피"

## 응답 형식

반드시 아래 JSON 형식으로 응답하세요. JSON 외 다른 텍스트를 포함하지 마세요.

{
  "summary": "전체 UX 라이팅에 대한 1-2문장 요약",
  "score": 0-100,
  "issues": [
    {
      "location": "텍스트가 위치한 UI 요소 (예: 상단 타이틀, 하단 CTA 버튼, 안내 문구)",
      "original": "화면에서 발견한 원본 텍스트",
      "suggestion": "개선된 텍스트 제안",
      "reason": "왜 변경해야 하는지 설명",
      "severity": "critical | warning | info",
      "principle": "해당하는 UX 라이팅 원칙"
    }
  ],
  "strengths": ["잘 작성된 텍스트에 대한 칭찬 포인트"]
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
        model: "claude-sonnet-4-20250514",
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
                  media_type: "image/png",
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
