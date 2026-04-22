import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileContent {
  name: string;
  content: string;
}

interface GitHubInput {
  repoUrl: string;
  token?: string;
  path: string;
}

interface RequestBody {
  inputType: "github" | "upload" | "taxonomy";
  github?: GitHubInput;
  files?: FileContent[];
  taxonomy?: string;
  figmaFileUrl?: string;
  figmaToken?: string;
  apiKey?: string;
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

const CODE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];
const MAX_FILES = 30;
const MAX_FILE_SIZE = 60_000; // ~60 KB per file
const MAX_TOTAL_CHARS = 120_000; // hard cap for Claude context

async function fetchGitHubFiles(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<FileContent[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const results: FileContent[] = [];
  const queue: string[] = [path.replace(/^\//, "")];
  let fetched = 0;

  while (queue.length > 0 && fetched < MAX_FILES) {
    const current = queue.shift()!;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(current)}`;

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      console.warn(`[code-to-figma] GitHub fetch failed for ${current}: ${res.status}`);
      continue;
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [data];

    for (const item of items) {
      if (item.type === "dir") {
        queue.push(item.path);
      } else if (item.type === "file") {
        const ext = item.name.match(/(\.[^.]+)$/)?.[1] ?? "";
        if (!CODE_EXTENSIONS.includes(ext)) continue;
        if (item.size > MAX_FILE_SIZE) continue;

        const fileRes = await fetch(item.download_url);
        if (!fileRes.ok) continue;
        const text = await fileRes.text();
        results.push({ name: item.path, content: text });
        fetched++;
        if (fetched >= MAX_FILES) break;
      }
    }
  }

  return results;
}

// ─── Build code context string ────────────────────────────────────────────────

function buildCodeContext(files: FileContent[]): string {
  let total = 0;
  const parts: string[] = [];

  for (const f of files) {
    const block = `\n\n=== FILE: ${f.name} ===\n${f.content}`;
    if (total + block.length > MAX_TOTAL_CHARS) break;
    parts.push(block);
    total += block.length;
  }

  return parts.join("");
}

// ─── Claude call ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a design system analyst specialized in extracting design specifications from frontend code.
Analyze the provided frontend code and/or event taxonomy, then extract:

1. Design tokens (colors, typography, spacing, border-radius) — infer from CSS variables, Tailwind config, or inline styles
2. Component inventory (name, variants, props) — from React component definitions and TypeScript interfaces
3. Screen list (route → screen name mapping) — from Next.js App Router pages or React Router
4. User flow (screen transitions from routing/navigation/button handlers)
5. Event taxonomy mapping (screen → events → next screen) — from provided taxonomy or analytics calls in code

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "designTokens": {
    "colors": { "primary": "#...", "background": "#...", "surface": "#...", "text": "#...", "muted": "#...", "border": "#..." },
    "typography": { "fontFamily": "...", "sizes": { "sm": 13, "base": 16, "lg": 18, "xl": 20 } },
    "spacing": [4, 8, 12, 16, 24, 32, 48],
    "borderRadius": { "sm": 4, "md": 8, "lg": 12, "full": 9999 }
  },
  "components": [
    { "name": "ComponentName", "variants": ["variant1", "variant2"], "props": ["prop1", "prop2"], "usedIn": ["ScreenA", "ScreenB"] }
  ],
  "screens": [
    { "route": "/path", "name": "Screen Name", "components": ["ComponentA", "ComponentB"] }
  ],
  "userFlow": [
    { "from": "Screen A", "to": "Screen B", "trigger": "Button or action name" }
  ],
  "eventTaxonomy": [
    { "screen": "screen_name", "events": ["event_a", "event_b"], "nextScreens": ["next_screen"] }
  ]
}

If a section cannot be determined from the provided input, return an empty array/object for it.
Be thorough but accurate — only extract what is clearly present in the code or taxonomy.`;

async function analyzeWithClaude(
  codeContext: string,
  taxonomy: string,
  apiKey?: string,
): Promise<Record<string, unknown>> {
  const effectiveKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!effectiveKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. 설정 페이지에서 API 키를 입력해주세요.");
  }

  const client = new Anthropic({ apiKey: effectiveKey });

  const parts: string[] = [];
  if (codeContext) {
    parts.push(`=== FRONTEND CODE ===\n${codeContext}`);
  }
  if (taxonomy) {
    parts.push(`\n\n=== EVENT TAXONOMY ===\n${taxonomy}`);
  }

  const userMessage = parts.join("") || "(No input provided)";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const text = textBlock.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다");

  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

// ─── Figma Variables API ──────────────────────────────────────────────────────

function extractFigmaFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

interface DesignTokens {
  colors?: Record<string, string>;
  typography?: { fontFamily?: string; sizes?: Record<string, number> };
  spacing?: number[];
  borderRadius?: Record<string, number>;
}

async function createFigmaVariables(
  fileKey: string,
  figmaToken: string,
  designTokens: DesignTokens,
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  // 1. Get existing variable collections
  const collRes = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
    headers: { "X-Figma-Token": figmaToken },
  });

  if (!collRes.ok) {
    return { created: 0, errors: [`Figma Variables API 접근 실패 (${collRes.status})`] };
  }

  const collData = await collRes.json();
  const existingCollections = collData.meta?.variableCollections ?? {};

  // Find or note "Simulo Design Tokens" collection
  const collectionName = "Simulo Design Tokens";
  let collectionId = Object.values(existingCollections).find(
    (c: unknown) => (c as { name: string }).name === collectionName
  )
    ? (
        Object.values(existingCollections).find(
          (c: unknown) => (c as { name: string }).name === collectionName
        ) as { id: string }
      ).id
    : null;

  // Build variable create/update payload
  const variableCreates: Array<{
    action: "CREATE";
    name: string;
    variableCollectionId: string;
    resolvedType: "COLOR" | "FLOAT" | "STRING";
  }> = [];

  const valueSets: Array<{
    action: "CREATE";
    variableId: string;
    modeId: string;
    value: unknown;
  }> = [];

  // POST to Figma Variables batch API
  const payload: {
    variableCollections?: Array<{ action: "CREATE"; name: string; id: string }>;
    variables?: typeof variableCreates;
    variableModeValues?: typeof valueSets;
  } = {};

  // Create collection if not exists
  const tempCollId = "collection_1";
  if (!collectionId) {
    payload.variableCollections = [
      { action: "CREATE", name: collectionName, id: tempCollId },
    ];
    collectionId = tempCollId;
  }

  // Add color variables
  const colors = designTokens.colors ?? {};
  const colorVars: Array<{ id: string; name: string; value: string }> = [];
  Object.entries(colors).forEach(([name, hex], i) => {
    if (!hex || !hex.startsWith("#")) return;
    const varId = `color_${i}`;
    colorVars.push({ id: varId, name: `colors/${name}`, value: hex });
  });

  payload.variables = colorVars.map(({ id, name }) => ({
    action: "CREATE" as const,
    name,
    variableCollectionId: collectionId!,
    resolvedType: "COLOR" as const,
    id,
  }));

  // Parse hex to RGBA for Figma
  function hexToFigmaColor(hex: string): { r: number; g: number; b: number; a: number } {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }

  if (payload.variables && payload.variables.length > 0) {
    try {
      const batchRes = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables`, {
        method: "POST",
        headers: {
          "X-Figma-Token": figmaToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        // Now set values for created variables
        const createdVars = batchData.meta?.variables ?? {};
        const modeIds = batchData.meta?.variableCollections ?? {};
        const modeId = Object.values(modeIds)[0]
          ? (Object.values(modeIds)[0] as { defaultModeId: string }).defaultModeId
          : null;

        if (modeId) {
          const valueModes = colorVars.map(({ id, value }) => ({
            action: "CREATE" as const,
            variableId: Object.values(createdVars).find(
              (v: unknown) => (v as { name: string }).name === `colors/${id.replace("color_", "")}`
            )
              ? (Object.values(createdVars).find(
                  (v: unknown) => (v as { name: string }).name === `colors/${id.replace("color_", "")}`
                ) as { id: string }).id
              : id,
            modeId,
            value: hexToFigmaColor(value),
          }));

          await fetch(`https://api.figma.com/v1/files/${fileKey}/variables`, {
            method: "POST",
            headers: {
              "X-Figma-Token": figmaToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ variableModeValues: valueModes }),
          });
        }

        created = colorVars.length;
      } else {
        const errText = await batchRes.text();
        errors.push(`Variables 생성 실패: ${batchRes.status} — ${errText.slice(0, 200)}`);
      }
    } catch (e) {
      errors.push(`Figma API 오류: ${(e as Error).message}`);
    }
  }

  return { created, errors };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { inputType, github, files, taxonomy, figmaFileUrl, figmaToken, apiKey } = body;

    console.log("[code-to-figma] Request | inputType:", inputType);

    // ── 1. Collect code ──────────────────────────────────────────────────────
    let codeFiles: FileContent[] = [];

    if (inputType === "github" && github?.repoUrl) {
      const parsed = parseGitHubUrl(github.repoUrl);
      if (!parsed) {
        return NextResponse.json(
          { error: "GitHub URL을 파싱할 수 없습니다. https://github.com/owner/repo 형식으로 입력하세요." },
          { status: 400 },
        );
      }

      console.log("[code-to-figma] Fetching GitHub files:", parsed.owner, parsed.repo, github.path);
      codeFiles = await fetchGitHubFiles(parsed.owner, parsed.repo, github.path || "/", github.token);
      console.log("[code-to-figma] Fetched", codeFiles.length, "files");
    } else if (inputType === "upload" && Array.isArray(files)) {
      codeFiles = files;
    }

    const codeContext = buildCodeContext(codeFiles);
    const taxonomyText = taxonomy?.trim() ?? "";

    if (!codeContext && !taxonomyText) {
      return NextResponse.json(
        { error: "분석할 코드 또는 이벤트 택소노미를 입력하세요." },
        { status: 400 },
      );
    }

    // ── 2. Claude analysis ───────────────────────────────────────────────────
    console.log(
      "[code-to-figma] Sending to Claude | code chars:",
      codeContext.length,
      "| taxonomy chars:",
      taxonomyText.length,
    );

    const result = await analyzeWithClaude(codeContext, taxonomyText, apiKey);
    console.log("[code-to-figma] Claude analysis complete");

    // ── 3. Figma variables (optional) ────────────────────────────────────────
    let figmaResult: { created: number; errors: string[] } | null = null;
    if (figmaFileUrl && figmaToken) {
      const fileKey = extractFigmaFileKey(figmaFileUrl);
      if (fileKey) {
        console.log("[code-to-figma] Creating Figma variables for file:", fileKey);
        figmaResult = await createFigmaVariables(
          fileKey,
          figmaToken,
          (result.designTokens as DesignTokens) ?? {},
        );
        console.log("[code-to-figma] Figma result:", figmaResult);
      }
    }

    return NextResponse.json({
      result,
      fileCount: codeFiles.length,
      figma: figmaResult,
    });
  } catch (error: unknown) {
    console.error("[code-to-figma] Error:", error);
    const message = error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
