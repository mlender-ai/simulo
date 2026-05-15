// app/api/generate-draft/route.ts
//
// Direct improvement draft generation — no analysis step required.
// Takes an image + free-form instruction, returns improved HTML.
//
// Request:  { image: string (base64), instruction: string, referenceImages?: string[], apiKey?: string }
// Response: { html: string, changes: string[] }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveApiKey } from "@/lib/env";
import { extractApiError } from "@/lib/api-errors";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const image: string | undefined = body.image;
  const instruction: string = body.instruction || "";
  const referenceImages: string[] = Array.isArray(body.referenceImages) ? body.referenceImages : [];
  const userApiKey: string | undefined = typeof body.apiKey === "string" ? body.apiKey : undefined;

  if (!image) {
    return NextResponse.json({ error: "이미지를 첨부해주세요." }, { status: 400 });
  }

  if (!instruction.trim()) {
    return NextResponse.json({ error: "개선 지시사항을 입력해주세요." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = resolveApiKey(userApiKey);
  } catch {
    return NextResponse.json({ error: "API key not configured" }, { status: 503 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const content: Anthropic.MessageParam["content"] = [];

    // Attach original image
    content.push({
      type: "text",
      text: "## 원본 화면 — 이 화면을 기반으로 지시사항에 따라 개선하세요",
    });

    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mediaType = (mimeMatch?.[1] ?? "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: image.replace(/^data:image\/\w+;base64,/, ""),
      },
    });

    // Attach reference images
    if (referenceImages.length > 0) {
      content.push({
        type: "text",
        text: `## 참고 이미지 (${referenceImages.length}장 — 스타일 참고용, 콘텐츠를 복사하지 마세요)`,
      });
      for (const refImg of referenceImages) {
        const refMime = refImg.match(/^data:(image\/\w+);base64,/);
        const refMediaType = (refMime?.[1] ?? "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: refMediaType,
            data: refImg.replace(/^data:image\/\w+;base64,/, ""),
          },
        });
      }
    }

    // Instruction
    content.push({
      type: "text",
      text: `## 개선 지시사항\n${instruction}\n\n---\nPRE-ANALYSIS → CHANGES → HTML 순서로 출력하세요.`,
    });

    const systemPrompt = `당신은 모바일/웹 앱 전문 UI 개선 엔지니어입니다. 사용자가 첨부한 원본 화면을 기반으로 지시사항에 따라 개선된 HTML을 생성합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
핵심 원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**원칙 A — 원본 충실 재현**
원본 화면의 레이아웃, 색상, 폰트, 간격을 가능한 한 정확하게 재현합니다.
지시사항에서 변경을 요청한 부분만 수정하고, 나머지는 원본 그대로 유지합니다.

**원칙 B — 지시사항 최우선**
사용자의 개선 지시사항을 최우선으로 반영합니다.
"UX 라이팅 개선"이면 텍스트만, "레이아웃 변경"이면 구조만, "전체 디벨롭"이면 전반적 품질 향상에 집중합니다.

**원칙 C — 중복 금지**
모든 텍스트, UI 컴포넌트, 아이콘은 최대 1회만 등장합니다.
원본에 없던 요소를 무분별하게 추가하지 마세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
작업 프로세스
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[PRE-ANALYSIS]**
원본 화면을 분석하고, 지시사항에 따라 수정할 요소를 식별합니다:
→ "원본의 [요소]를 [이렇게] 수정"

**[STEP 1] 원본 충실 재현**
배경색, 폰트, 간격 등 시각 요소를 원본 그대로 재현

**[STEP 2] 지시사항 반영**
식별한 요소에만 개선 적용

**[STEP 3] 품질 체크**
□ 동일 텍스트 반복 없음
□ 불필요한 새 요소 추가 없음
□ 원본 요소 누락 없음

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HTML 기술 규격
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 단일 완전한 HTML 파일. 모든 스타일은 <head>의 <style> 블록 하나에만 작성. inline style= 금지.
- 고정 너비 375px. 높이는 콘텐츠에 맞게 자동 확장.
- 한국어 사용
- 외부 URL 없음. 이미지는 CSS로 근사.
- 폰트: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif
- 모바일 네이티브 앱처럼 보여야 함: 적절한 패딩(16px), 터치 타겟(44px+), 선명한 계층구조

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
출력 형식
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<ANALYSIS>
[PRE-ANALYSIS 결과]
</ANALYSIS>
<CHANGES>
- [변경 1]: 구체적으로 무엇을 어떻게 바꿨는지
- [변경 2]: ...
</CHANGES>
<HTML>
<!DOCTYPE html>
...개선된 완전한 HTML...
</HTML>`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 20000,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse CHANGES
    const changesMatch = responseText.match(/<CHANGES>([\s\S]*?)<\/CHANGES>/);
    const changesText = changesMatch?.[1] ?? "";
    const changes = changesText
      .split("\n")
      .map((line) => line.replace(/^[•\-*\[\]변경\d:\s]+/, "").trim())
      .filter(Boolean);

    // Parse HTML
    let html = "";
    const doctypeIdx = responseText.indexOf("<!DOCTYPE html>");
    if (doctypeIdx !== -1) {
      html = responseText.slice(doctypeIdx);
      html = html.replace(/<\/HTML>\s*$/, "").trim();
      if (!html.toLowerCase().includes("</html>")) {
        html += "\n</body>\n</html>";
      }
    } else {
      const htmlMatch = responseText.match(/<HTML>([\s\S]+?)(?:<\/HTML>|$)/);
      html = htmlMatch?.[1]?.trim() ?? "";
    }

    if (!html) {
      return NextResponse.json(
        { error: "HTML 생성에 실패했습니다. 다시 시도해주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({ html, changes: changes.length > 0 ? changes : ["개선 완료"] });
  } catch (err: unknown) {
    const { status, message, cause } = extractApiError(err);
    console.error("[generate-draft] error:", message, cause);
    return NextResponse.json(
      { error: "개선안 생성 실패", detail: message },
      { status }
    );
  }
}
