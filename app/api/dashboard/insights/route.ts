import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const client = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a product strategy advisor for YafitMove (야핏무브), a Korean health & reward app targeting 40-60s users.
Analyze the accumulated UX testing data and provide actionable product improvement suggestions.

Rules:
- Base suggestions ONLY on the data provided, not assumptions
- Each suggestion must cite specific data points as evidence
- Include assessment of backfire risk for each suggestion
- Prioritize by expected retention impact
- Suggest which screens/flows have NOT been analyzed yet (blind spots)
- Respond in pure JSON only. No markdown, no code fences, no backticks.

Response format:
{
  "summary": "2-3 sentence overview of the period's analysis results",
  "trends": [
    {
      "type": "positive" | "negative" | "neutral",
      "insight": "specific trend observation",
      "evidence": "data point supporting this trend"
    }
  ],
  "blindSpots": [
    "description of an area not yet analyzed or with low coverage"
  ],
  "productSuggestions": [
    {
      "priority": "높음" | "보통" | "낮음",
      "area": "screen or feature area",
      "suggestion": "specific actionable recommendation",
      "basedOn": "data evidence cited",
      "expectedImpact": "expected retention or UX impact"
    }
  ],
  "nextAnalysisSuggestions": [
    "specific screen or flow to analyze next"
  ]
}`;

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let body: {
    stats: Record<string, unknown>;
    period?: string;
    projectTag?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { stats, period = "30d", projectTag } = body;

  // ── Check cache ──
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db");
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const cached = await prisma.dashboardInsight.findFirst({
        where: {
          period,
          projectTag: projectTag ?? null,
          createdAt: { gte: twentyFourHoursAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      if (cached) {
        return NextResponse.json({ insights: cached.insights, cached: true });
      }
    } catch (err) {
      console.error("[dashboard/insights] cache check failed:", err);
    }
  }

  // ── Call Claude ──
  const userMessage = `
기간: ${period}
${projectTag ? `프로젝트 태그 필터: ${projectTag}` : "전체 프로젝트"}

## 집계 데이터

총 분석 횟수: ${stats.totalAnalyses}
이전 기간 분석 횟수: ${stats.prevTotalAnalyses}
현재 평균 사용성 점수: ${stats.avgScore}
이전 기간 평균 점수: ${stats.prevAvgScore}
해결된 이슈 비율: ${stats.resolvedIssueRate}%

욕망 충족도 평균:
- 효능감(Utility): ${(stats.avgDesire as Record<string, number>)?.utility ?? "N/A"}
- 성취·과시(Health Pride): ${(stats.avgDesire as Record<string, number>)?.healthPride ?? "N/A"}
- 손실회피(Loss Aversion): ${(stats.avgDesire as Record<string, number>)?.lossAversion ?? "N/A"}

## 점수 추이 (최근 데이터)
${JSON.stringify((stats.scoreTimeline as unknown[])?.slice(-20) ?? [], null, 2)}

## 반복 이슈 TOP 10
${JSON.stringify(stats.topIssues ?? [], null, 2)}

## 자주 사용된 가설 키워드
${JSON.stringify((stats.keywords as unknown[])?.slice(0, 15) ?? [], null, 2)}

## 욕망 충족도 추이
${JSON.stringify((stats.desireTimeline as unknown[])?.slice(-10) ?? [], null, 2)}

위 데이터를 종합해 제품 개선 인사이트를 JSON으로 반환하세요.
`.trim();

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    let insights: unknown;
    try {
      // Strip any accidental markdown fences
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();
      insights = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Claude returned invalid JSON", raw: rawText },
        { status: 500 }
      );
    }

    // ── Persist to cache ──
    if (process.env.DATABASE_URL) {
      try {
        const { prisma } = await import("@/lib/db");
        await prisma.dashboardInsight.create({
          data: {
            period,
            projectTag: projectTag ?? null,
            insights: insights as object,
          },
        });
      } catch (err) {
        console.error("[dashboard/insights] cache save failed:", err);
      }
    }

    return NextResponse.json({ insights, cached: false });
  } catch (error) {
    console.error("[dashboard/insights]", error);
    return NextResponse.json({ error: "Insight generation failed" }, { status: 500 });
  }
}
