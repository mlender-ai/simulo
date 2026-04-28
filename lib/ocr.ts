import Anthropic from "@anthropic-ai/sdk";

/** A single text element extracted from a screen with its bounding box (percentages). */
export interface OCRElement {
  text: string;
  x: number;   // left edge, 0-100
  y: number;   // top edge,  0-100
  w: number;   // width,     0-100
  h: number;   // height,    0-100
  type: "heading" | "button" | "body" | "badge" | "label" | "nav" | "number" | "other";
}

export interface OCRResult {
  screenIndex: number;
  /** Raw text strings (backward-compat). Derived from elements. */
  texts: string[];
  /** Structured elements with bounding box coordinates. */
  elements: OCRElement[];
}

// YafitMove UI domain dictionary for Korean text correction
const UI_DICTIONARY = [
  "걷기", "걸음", "받기", "마일리지", "적립", "보상",
  "출석", "미션", "잠자고", "라이딩", "보너스", "이벤트",
  "쿠폰", "교환", "설정", "프로필", "홈", "샵", "알림",
  "걷고", "받음", "완료", "진행중", "시작", "오늘",
  "오늘의", "주간", "누적", "달성", "목표", "연속",
  "보너스", "광고", "시청", "획득",
];

const OCR_SYSTEM_PROMPT = `You are a spatial OCR engine for Korean mobile app UI screens.

For each visible text element, return its text AND its precise bounding box as percentages of the full image size.

Return a JSON array of objects with this exact schema:
[
  {
    "text": "exact text",
    "x": 0-100,
    "y": 0-100,
    "w": 0-100,
    "h": 0-100,
    "type": "heading" | "button" | "body" | "badge" | "label" | "nav" | "number" | "other"
  }
]

Coordinate rules:
- x, y = top-left corner of the element, as % of image width/height
- w, h = element width/height as % of image width/height
- x=0, y=0 is top-left corner of the image
- Keep bounding boxes TIGHT — minimum padding (1-2%)
- Group text that belongs to one UI component (e.g., a button's label) into one entry

Type assignment:
- "heading": large/bold title text
- "button": text inside a tappable button or CTA
- "body": regular paragraph or description text
- "badge": small pill/chip label (e.g., 이벤트, NEW)
- "label": field label or caption
- "nav": bottom nav bar items or tab labels
- "number": standalone numeric value (scores, counts)
- "other": anything else

Korean OCR rules:
- 'ㅓ'와 'ㅜ'를 혼동하지 마. 예: '걷고'를 '권고'로 읽지 마.
- 'ㅏ'와 'ㅗ'를 혼동하지 마. 예: '잠자고'를 '집자고'로 읽지 마.
- 앱 UI 단어: 걷기, 걸음, 받기, 마일리지, 적립, 보상, 출석, 미션, 잠자고, 라이딩, 보너스, 이벤트, 쿠폰, 교환, 설정
- 위 단어와 70% 이상 유사하면 그 단어로 인식해.
- 확실하지 않은 글자는 [?]로 표시.

Output: JSON array only. No explanation, no markdown.`;

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function findClosestMatch(text: string, dictionary: string[]): string | null {
  const THRESHOLD = 2;
  let bestMatch = null;
  let bestDistance = Infinity;
  for (const word of dictionary) {
    const distance = levenshtein(text, word);
    if (distance < bestDistance && distance <= THRESHOLD) {
      bestDistance = distance;
      bestMatch = word;
    }
  }
  return bestMatch;
}

function clampElement(el: OCRElement): OCRElement {
  const x = Math.max(0, Math.min(el.x, 99));
  const y = Math.max(0, Math.min(el.y, 99));
  const w = Math.max(3, Math.min(el.w, 100 - x));
  const h = Math.max(2, Math.min(el.h, 100 - y));
  return { ...el, x, y, w, h };
}

export async function extractTextFromImages(
  base64Images: string[],
  apiKey?: string
): Promise<OCRResult[]> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey: key });
  const results: OCRResult[] = [];

  for (let i = 0; i < base64Images.length; i++) {
    try {
      const response = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 2048,
        system: OCR_SYSTEM_PROMPT,
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
              {
                type: "text",
                text: "Extract all visible text with precise bounding box coordinates. Return JSON array only.",
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock?.type === "text" ? textBlock.text.trim() : "[]";

      let elements: OCRElement[] = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        // Validate and clamp each element
        elements = (Array.isArray(parsed) ? parsed : [])
          .filter(
            (el: unknown): el is OCRElement =>
              el !== null &&
              typeof el === "object" &&
              typeof (el as Record<string, unknown>).text === "string" &&
              typeof (el as Record<string, unknown>).x === "number" &&
              typeof (el as Record<string, unknown>).y === "number" &&
              typeof (el as Record<string, unknown>).w === "number" &&
              typeof (el as Record<string, unknown>).h === "number"
          )
          .map(clampElement);
      } catch {
        console.warn(`[ocr] Failed to parse OCR response for screen ${i}:`, raw.slice(0, 100));
        elements = [];
      }

      const texts = elements.map((el) => el.text);
      results.push({ screenIndex: i, texts, elements });
      console.log(`[ocr] Screen ${i}: extracted ${elements.length} elements with coordinates`);
    } catch (err) {
      console.error(`[ocr] Failed on screen ${i}:`, err);
      results.push({ screenIndex: i, texts: [], elements: [] });
    }
  }

  return results;
}

export function validateOCRResults(ocrResults: OCRResult[]): OCRResult[] {
  const hasUncertain = ocrResults.some((r) =>
    r.texts.some((t) => t.includes("[?]"))
  );

  if (!hasUncertain) return ocrResults;

  return ocrResults.map((result) => ({
    ...result,
    elements: result.elements.map((el) => {
      if (!el.text.includes("[?]")) return el;
      const cleaned = el.text.replace(/\[\?\]/g, "").trim();
      const match = findClosestMatch(cleaned, UI_DICTIONARY);
      return { ...el, text: match || el.text };
    }),
    texts: result.texts.map((text) => {
      if (!text.includes("[?]")) return text;
      const cleaned = text.replace(/\[\?\]/g, "").trim();
      const match = findClosestMatch(cleaned, UI_DICTIONARY);
      return match || text;
    }),
  }));
}

/**
 * Formats OCR results for inclusion in the analysis prompt.
 * Includes bounding box coordinates so Claude can use them directly for heatZone.
 */
export function formatOCRForPrompt(ocrResults: OCRResult[], locale: string): string {
  if (ocrResults.length === 0) return "";
  const isKo = locale === "ko";

  const header = isKo
    ? "=== OCR 추출 텍스트 + 위치 좌표 ===\n각 이슈의 heatZone은 아래 좌표를 최우선으로 사용하세요. 그리드 추정 금지.\n"
    : "=== OCR Extracted Text + Coordinates ===\nFor each issue heatZone, use these coordinates directly. Do NOT estimate from grid.\n";

  const lines = ocrResults.map((r) => {
    const label = isKo ? `화면 ${r.screenIndex + 1}:` : `Screen ${r.screenIndex + 1}:`;
    if (r.elements.length === 0) {
      return `${label} (텍스트 없음)`;
    }
    const elementLines = r.elements
      .map((el) =>
        `  [x=${el.x.toFixed(0)}, y=${el.y.toFixed(0)}, w=${el.w.toFixed(0)}, h=${el.h.toFixed(0)}, type=${el.type}] "${el.text}"`
      )
      .join("\n");
    return `${label}\n${elementLines}`;
  });

  return header + lines.join("\n\n");
}
