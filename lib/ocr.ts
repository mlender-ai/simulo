import Anthropic from "@anthropic-ai/sdk";

export interface OCRResult {
  screenIndex: number;
  texts: string[];
}

// YafitMove UI domain dictionary for Korean text correction
const UI_DICTIONARY = [
  "걷기", "걸음", "받기", "마일리지", "적립", "보상",
  "출석", "미션", "잠자고", "라이딩", "보너스", "이벤트",
  "쿠폰", "교환", "설정", "프로필", "홈", "샵", "알림",
  "걷고", "받음", "완료", "진행중", "시작", "오늘",
  "오늘의", "주간", "누적", "달성", "목표", "연속",
  "달성", "연속", "보너스", "광고", "시청", "획득",
];

const OCR_SYSTEM_PROMPT = `You are a precise OCR engine specialized in Korean mobile app UI screens.
Extract all visible text from the image. Return a JSON array of strings, one item per distinct UI text element.

Korean-specific rules:
- 'ㅓ'와 'ㅜ'를 혼동하지 마. 예: '걷고'를 '권고'로 읽지 마.
- 'ㅏ'와 'ㅗ'를 혼동하지 마. 예: '잠자고'를 '집자고'로 읽지 마.
- 앱 UI에서 자주 쓰이는 단어들: 걷기, 걸음, 받기, 마일리지, 적립, 보상, 출석, 미션, 잠자고, 라이딩, 보너스, 이벤트, 쿠폰, 교환, 설정
- 위 단어 목록과 유사하면 목록의 정확한 단어를 사용해.
- 확실하지 않은 글자는 [?]로 표시하되, 위 목록의 단어와 70% 이상 유사하면 그 단어로 인식해.

Output format: JSON array only, no explanation.
Example: ["걷고 받기", "오늘 적립 가능", "5,000", "마일리지 샵"]`;

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
        max_tokens: 1024,
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
                text: "Extract all visible text from this screen. Return a JSON array of strings only.",
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const raw = textBlock?.type === "text" ? textBlock.text.trim() : "[]";

      let texts: string[] = [];
      try {
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        texts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch {
        console.warn(`[ocr] Failed to parse OCR response for screen ${i}:`, raw.slice(0, 100));
        texts = [];
      }

      results.push({ screenIndex: i, texts });
      console.log(`[ocr] Screen ${i}: extracted ${texts.length} text elements`);
    } catch (err) {
      console.error(`[ocr] Failed on screen ${i}:`, err);
      results.push({ screenIndex: i, texts: [] });
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
    texts: result.texts.map((text) => {
      if (!text.includes("[?]")) return text;
      const cleaned = text.replace(/\[\?\]/g, "").trim();
      const match = findClosestMatch(cleaned, UI_DICTIONARY);
      return match || text;
    }),
  }));
}

export function formatOCRForPrompt(ocrResults: OCRResult[], locale: string): string {
  if (ocrResults.length === 0) return "";
  const isKo = locale === "ko";
  const lines = ocrResults.map((r) => {
    const label = isKo ? `화면 ${r.screenIndex + 1}` : `Screen ${r.screenIndex + 1}`;
    const texts = r.texts.length > 0 ? r.texts.join(", ") : (isKo ? "(텍스트 없음)" : "(no text)");
    return `${label}: ${texts}`;
  });
  const header = isKo
    ? "=== OCR 추출 텍스트 (이미지에서 정확히 읽은 한국어 텍스트) ===\n"
    : "=== OCR Extracted Text (accurately read from images) ===\n";
  return header + lines.join("\n");
}
