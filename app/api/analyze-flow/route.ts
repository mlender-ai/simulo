import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────��─────────────────────────────────────────────────────

interface FlowNode {
  id: string;
  type: "start" | "screen" | "end";
  name: string;
  imageBase64: string | null;
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
}

interface NodeResult {
  dropOffRisk: "높음" | "보통" | "낮음";
  dropOffPercent: number;
  stayPercent: number;
  desireScore: { utility: number; healthPride: number; lossAversion: number };
  mainReason: string;
  frictionPoints: string[];
}

interface EdgeResult {
  transitionSmooth: boolean;
  dropOffAtTransition: number;
  reason: string;
  recommendation: string;
}

// ─── Config ──���──────────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20241022",
};

function getClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No API key provided");
  return new Anthropic({ apiKey: key });
}

// ─── Prompts ─────────────���──────────────────────────────────────────

const SCREEN_PROMPT_KO = `너는 UX 이탈 분석 전문가다. 유저 플로우의 단일 화면을 분석한다.
컨텍스트: 야핏무브 피트니스 리워드 앱, 타깃 유저는 4050 한국 여성.

이 화면을 분석하고 아래 JSON만 반환하라. 다른 텍스트는 절대 포함하지 마라.

{
  "dropOffRisk": "높음" 또는 "보통" 또는 "낮음",
  "dropOffPercent": 0~100 (이 화면에서 이탈할 확률),
  "stayPercent": 0~100 (계속 진행할 확률),
  "desireScore": { "utility": 0~10, "healthPride": 0~10, "lossAversion": 0~10 },
  "mainReason": "이탈 핵심 원인 한 문장",
  "frictionPoints": ["마찰 포인트 1", "마찰 포인트 2"]
}

평가 기준:
- 효능감(utility): 보상이 명확하게 인식되는가
- 성취과시(healthPride): 성취감이 전달되고 공유 욕구가 자극되는가
- 손실회피(lossAversion): "오늘 안 하면 손해"라는 인식이 작동하는가
- frictionPoints: 마찰을 유발하는 구체적 UI 요소
- dropOffPercent + stayPercent = 100`;

const SCREEN_PROMPT_EN = `You are a UX drop-off analysis expert. Analyze a single screen in a user flow.
Context: YafitMove fitness reward app, target user is 40-50s Korean women.

Analyze this screen and return ONLY the following JSON. No other text.

{
  "dropOffRisk": "높음" or "보통" or "낮음",
  "dropOffPercent": 0-100,
  "stayPercent": 0-100,
  "desireScore": { "utility": 0-10, "healthPride": 0-10, "lossAversion": 0-10 },
  "mainReason": "Main drop-off cause in one sentence",
  "frictionPoints": ["friction point 1", "friction point 2"]
}

dropOffPercent + stayPercent must equal 100.`;

const EDGE_PROMPT_KO = `너는 UX 전환 분석 전문가다. 두 화면 사이의 전���을 분석한다.
유저가 화면 A��서 화면 B로 이동할 때의 마찰과 이탈 위험을 평가하라.

아래 JSON만 반환하라. 다른 텍스트는 절대 포함하��� 마라.

{
  "transitionSmooth": true ���는 false,
  "dropOffAtTransition": 0~100 (전환 중 이탈 ��률),
  "reason": "이탈 가능한 이유",
  "recommendation": "전환 개선 방법"
}

평가 기준:
- 전환이 논리적이고 예상 가능한가?
- A에서 B로 충분한 맥락이 전달되는가?
- 시각적/기능적 연속성이 있는가?`;

const EDGE_PROMPT_EN = `You are a UX transition analyst. Analyze the transition between two screens.
Evaluate friction and drop-off risk when a user navigates from Screen A to Screen B.

Return ONLY the following JSON. No other text.

{
  "transitionSmooth": true or false,
  "dropOffAtTransition": 0-100,
  "reason": "why users might not make this transition",
  "recommendation": "how to improve this transition"
}`;

const INTEGRATION_PROMPT_KO = `너는 UX 플로우 통합 분석 전문가다.
전체 유저 여정(여러 화면을 순서대로 나열)을 종합적으로 분석한다.

개별 화면 분석 결과와 전환 분석 결과가 이미 존재한다.
전체 흐름 관점에서 종합하고 아래 JSON만 반환하라.

{
  "totalDropOffRisk": "높음" 또는 "보통" 또는 "낮음",
  "estimatedCompletionRate": 0~100 (전체 플로우 완료율 예측),
  "biggestDropOffNodeId": "가장 이탈 위험 높은 노드 ID",
  "criticalPath": ["노드 ID 배열 — 가장 위험한 경로"],
  "overallSummary": "전체 플로우 종합 평가 2~3문장"
}`;

const INTEGRATION_PROMPT_EN = `You are a UX flow integration analyst.
Analyze the entire user journey (multiple screens in sequence) holistically.

Individual screen analyses and transition analyses already exist.
Synthesize them from a full-flow perspective and return ONLY the following JSON.

{
  "totalDropOffRisk": "높음" or "보통" or "낮음",
  "estimatedCompletionRate": 0-100,
  "biggestDropOffNodeId": "node ID with highest drop-off risk",
  "criticalPath": ["array of node IDs forming the riskiest path"],
  "overallSummary": "2-3 sentence overall flow assessment"
}`;

// ─── Helpers ───────────────���────────────────────────────────────────

function extractJson(text: string): string {
  let s = text.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1);
  // Clean pipe literals from risk values
  s = s.replace(/"(높음|보통|낮���)"\s*\|\s*"[^"]*"/g, (_, first) => `"${first}"`);
  s = s.replace(/"[^"]*"\s*\|\s*"(높음|보통|낮음)"/g, (_, last) => `"${last}"`);
  return s;
}

function extractPaths(
  nodes: FlowNode[],
  edges: FlowEdge[]
): string[][] {
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const list = outgoing.get(e.source) || [];
    list.push(e.target);
    outgoing.set(e.source, list);
  }

  const startNodes = nodes.filter((n) => n.type === "start");
  const endIds = new Set(nodes.filter((n) => n.type === "end").map((n) => n.id));

  const allPaths: string[][] = [];

  function dfs(current: string, path: string[], visited: Set<string>) {
    path.push(current);
    if (endIds.has(current) || !(outgoing.get(current)?.length)) {
      allPaths.push([...path]);
      path.pop();
      return;
    }
    visited.add(current);
    for (const next of outgoing.get(current) ?? []) {
      if (!visited.has(next)) {
        dfs(next, path, visited);
      }
    }
    visited.delete(current);
    path.pop();
  }

  if (startNodes.length > 0) {
    for (const start of startNodes) {
      dfs(start.id, [], new Set());
    }
  } else {
    // No start node — use screen nodes with no incoming edges
    const hasIncoming = new Set(edges.map((e) => e.target));
    const roots = nodes.filter((n) => n.type === "screen" && !hasIncoming.has(n.id));
    for (const root of roots.length > 0 ? roots : nodes.filter((n) => n.type === "screen").slice(0, 1)) {
      dfs(root.id, [], new Set());
    }
  }

  return allPaths;
}

// ─── Route Handler ──────────────���───────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nodes,
      edges,
      hypothesis,
      targetUser,
      locale,
      apiKey,
      model,
    } = body as {
      nodes: FlowNode[];
      edges: FlowEdge[];
      hypothesis: string;
      targetUser: string;
      locale?: string;
      apiKey?: string;
      model?: string;
    };

    if (!hypothesis || !targetUser || !nodes || nodes.length === 0) {
      return NextResponse.json(
        { error: "hypothesis, targetUser, and nodes are required" },
        { status: 400 }
      );
    }

    const client = getClient(apiKey);
    const modelId = MODEL_MAP[model || "haiku"] ?? MODEL_MAP.haiku;
    const isKo = locale !== "en";

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const screenNodes = nodes.filter((n) => n.type === "screen");

    console.log(
      "[analyze-flow] Starting 3-phase analysis | screens:",
      screenNodes.length,
      "| edges:",
      edges.length,
      "| model:",
      modelId
    );

    // ─── Phase 1: Individual screen analysis (parallel) ─────────

    console.log("[analyze-flow] Phase 1: Analyzing", screenNodes.length, "screens in parallel");

    const screenPromises = screenNodes.map(async (node): Promise<[string, NodeResult]> => {
      const content: Anthropic.Messages.ContentBlockParam[] = [];

      content.push({
        type: "text" as const,
        text: isKo
          ? `화면 이름: ${node.name || "이름 없음"}\n가설: ${hypothesis}\n타깃 유저: ${targetUser}`
          : `Screen name: ${node.name || "Unnamed"}\nHypothesis: ${hypothesis}\nTarget User: ${targetUser}`,
      });

      if (node.imageBase64) {
        const base64Data = node.imageBase64.startsWith("data:")
          ? node.imageBase64.split(",")[1] || node.imageBase64
          : node.imageBase64;
        content.push({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: base64Data,
          },
        });
      } else {
        content.push({
          type: "text" as const,
          text: isKo
            ? "(이미지 없음 — 화면 이름만으로 평가)"
            : "(No image — evaluate by screen name only)",
        });
      }

      const response = await client.messages.create({
        model: modelId,
        max_tokens: 2048,
        system: isKo ? SCREEN_PROMPT_KO : SCREEN_PROMPT_EN,
        messages: [{ role: "user", content }],
      });

      const text = response.content.find(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      )?.text ?? "{}";

      const parsed = JSON.parse(extractJson(text));
      const result: NodeResult = {
        dropOffRisk: parsed.dropOffRisk ?? "보통",
        dropOffPercent: parsed.dropOffPercent ?? 50,
        stayPercent: parsed.stayPercent ?? 50,
        desireScore: parsed.desireScore ?? { utility: 5, healthPride: 5, lossAversion: 5 },
        mainReason: parsed.mainReason ?? "",
        frictionPoints: parsed.frictionPoints ?? [],
      };

      return [node.id, result];
    });

    const screenResults = await Promise.all(screenPromises);
    const nodeResults: Record<string, NodeResult> = Object.fromEntries(screenResults);

    console.log("[analyze-flow] Phase 1 complete:", Object.keys(nodeResults).length, "nodes analyzed");

    // ─── Phase 2: Transition analysis (edge pairs in parallel) ──

    // Only analyze edges between screen nodes (or start→screen, screen→end)
    const edgesWithScreens = edges.filter((e) => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      return src && tgt && (src.type === "screen" || src.type === "start") && (tgt.type === "screen" || tgt.type === "end");
    });

    console.log("[analyze-flow] Phase 2: Analyzing", edgesWithScreens.length, "transitions");

    const edgePromises = edgesWithScreens.map(async (edge): Promise<[string, EdgeResult]> => {
      const srcNode = nodeMap.get(edge.source)!;
      const tgtNode = nodeMap.get(edge.target)!;

      const content: Anthropic.Messages.ContentBlockParam[] = [];
      content.push({
        type: "text" as const,
        text: isKo
          ? `화면 A: ${srcNode.name || "시작"}\n화면 B: ${tgtNode.name || "���료"}\n가설: ${hypothesis}\n타깃 유저: ${targetUser}`
          : `Screen A: ${srcNode.name || "Start"}\nScreen B: ${tgtNode.name || "End"}\nHypothesis: ${hypothesis}\nTarget User: ${targetUser}`,
      });

      // Add images for both screens
      for (const node of [srcNode, tgtNode]) {
        if (node.imageBase64) {
          const base64Data = node.imageBase64.startsWith("data:")
            ? node.imageBase64.split(",")[1] || node.imageBase64
            : node.imageBase64;
          content.push({
            type: "text" as const,
            text: isKo ? `[${node.name || "화면"}]` : `[${node.name || "Screen"}]`,
          });
          content.push({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: "image/png" as const,
              data: base64Data,
            },
          });
        }
      }

      const response = await client.messages.create({
        model: modelId,
        max_tokens: 1024,
        system: isKo ? EDGE_PROMPT_KO : EDGE_PROMPT_EN,
        messages: [{ role: "user", content }],
      });

      const text = response.content.find(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      )?.text ?? "{}";

      const parsed = JSON.parse(extractJson(text));
      const result: EdgeResult = {
        transitionSmooth: parsed.transitionSmooth ?? true,
        dropOffAtTransition: parsed.dropOffAtTransition ?? 10,
        reason: parsed.reason ?? "",
        recommendation: parsed.recommendation ?? "",
      };

      return [edge.id, result];
    });

    const edgeResults: Record<string, EdgeResult> = Object.fromEntries(
      await Promise.all(edgePromises)
    );

    console.log("[analyze-flow] Phase 2 complete:", Object.keys(edgeResults).length, "edges analyzed");

    // ─── Phase 3: Integration analysis ──────────────────────────

    console.log("[analyze-flow] Phase 3: Integration analysis");

    // Build context summary for integration
    const screenSummaries = screenNodes
      .map((n) => {
        const r = nodeResults[n.id];
        return r
          ? `- ${n.name || n.id}: 이탈 ${r.dropOffRisk}(${r.dropOffPercent}%), 원인: ${r.mainReason}`
          : `- ${n.name || n.id}: 분석 없음`;
      })
      .join("\n");

    const edgeSummaries = edgesWithScreens
      .map((e) => {
        const r = edgeResults[e.id];
        const src = nodeMap.get(e.source)?.name || e.source;
        const tgt = nodeMap.get(e.target)?.name || e.target;
        return r
          ? `- ${src} → ${tgt}: 전환 이탈 ${r.dropOffAtTransition}%, 원인: ${r.reason}`
          : `- ${src} → ${tgt}: 분석 없음`;
      })
      .join("\n");

    // Build content with all screen images in order
    const integrationContent: Anthropic.Messages.ContentBlockParam[] = [];

    // Add a brief for each screen with its image
    for (const node of screenNodes) {
      integrationContent.push({
        type: "text" as const,
        text: `[${node.name || node.id}]`,
      });
      if (node.imageBase64) {
        const base64Data = node.imageBase64.startsWith("data:")
          ? node.imageBase64.split(",")[1] || node.imageBase64
          : node.imageBase64;
        integrationContent.push({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: base64Data,
          },
        });
      }
    }

    integrationContent.push({
      type: "text" as const,
      text: isKo
        ? `가설: ${hypothesis}
타깃 유저: ${targetUser}

개별 화면 분석 결과:
${screenSummaries}

전환 분석 결과:
${edgeSummaries}

노드 ID 목록: ${nodes.map((n) => n.id).join(", ")}

위 결과를 종합해서 전체 플로우를 평가하고 JSON을 반환하라.`
        : `Hypothesis: ${hypothesis}
Target User: ${targetUser}

Individual screen analysis results:
${screenSummaries}

Transition analysis results:
${edgeSummaries}

Node IDs: ${nodes.map((n) => n.id).join(", ")}

Synthesize the above into an overall flow assessment and return JSON.`,
    });

    const integrationResponse = await client.messages.create({
      model: modelId,
      max_tokens: 2048,
      system: isKo ? INTEGRATION_PROMPT_KO : INTEGRATION_PROMPT_EN,
      messages: [{ role: "user", content: integrationContent }],
    });

    const integrationText = integrationResponse.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text"
    )?.text ?? "{}";

    const flowSummary = JSON.parse(extractJson(integrationText));

    // Ensure required fields
    flowSummary.totalDropOffRisk = flowSummary.totalDropOffRisk ?? "보통";
    flowSummary.estimatedCompletionRate = flowSummary.estimatedCompletionRate ?? 50;
    flowSummary.biggestDropOffNode = flowSummary.biggestDropOffNodeId ?? flowSummary.biggestDropOffNode ?? null;
    flowSummary.criticalPath = flowSummary.criticalPath ?? [];
    flowSummary.overallSummary = flowSummary.overallSummary ?? "";

    console.log("[analyze-flow] Phase 3 complete | completion rate:", flowSummary.estimatedCompletionRate);

    // ─── Build paths ────────────────────────────────────────────

    const paths = extractPaths(nodes, edges).map((path) => {
      // Estimate completion rate for each path
      const screenIdsInPath = path.filter((id) => nodeMap.get(id)?.type === "screen");
      let cumulative = 100;
      for (const id of screenIdsInPath) {
        const nr = nodeResults[id];
        if (nr) cumulative = cumulative * (nr.stayPercent / 100);
      }
      // Also factor in edge drop-offs
      for (let i = 0; i < path.length - 1; i++) {
        const edge = edges.find((e) => e.source === path[i] && e.target === path[i + 1]);
        if (edge && edgeResults[edge.id]) {
          cumulative = cumulative * ((100 - edgeResults[edge.id].dropOffAtTransition) / 100);
        }
      }

      return {
        path,
        pathName: path.map((id) => nodeMap.get(id)?.name || id).join(" → "),
        estimatedCompletionRate: Math.round(cumulative),
      };
    });

    // ─── Response ───────────────────────────────────────────────

    const result = {
      flowSummary,
      nodeResults,
      edgeResults,
      paths,
    };

    // Persist to DB if configured
    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db");
        await prisma.flowAnalysis.create({
          data: {
            hypothesis,
            targetUser,
            flowData: JSON.parse(JSON.stringify({ nodes: nodes.map((n) => ({ ...n, imageBase64: null })), edges })),
            result: JSON.parse(JSON.stringify(result)),
          },
        });
        console.log("[analyze-flow] Saved to DB");
      } catch (dbErr) {
        console.error("[analyze-flow] DB save failed (non-fatal):", dbErr);
      }
    }

    console.log("[analyze-flow] Done | nodes:", Object.keys(nodeResults).length, "| edges:", Object.keys(edgeResults).length, "| paths:", paths.length);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-flow] Error:", error);
    const message = error instanceof Error ? error.message : "Flow analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
