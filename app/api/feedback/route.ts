import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "mlender-ai/simulo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, rating, comment, context } = body as {
      type: "analysis" | "writing";
      rating: "good" | "bad";
      comment?: string;
      context?: {
        frameName?: string;
        score?: number;
        issueCount?: number;
      };
    };

    if (!type || !rating) {
      return NextResponse.json({ error: "type과 rating은 필수입니다." }, { status: 400 });
    }

    // GitHub 이슈 생성
    if (GITHUB_TOKEN) {
      const modeLabel = type === "writing" ? "UX 라이팅 체크" : "UX 사용성 분석";
      const ratingEmoji = rating === "good" ? "👍" : "👎";
      const title = `[피드백] ${ratingEmoji} ${modeLabel} — ${context?.frameName || "알 수 없음"}`;

      let issueBody = `## 사용자 피드백\n\n`;
      issueBody += `- **모드**: ${modeLabel}\n`;
      issueBody += `- **평가**: ${rating === "good" ? "좋음 👍" : "아쉬움 👎"}\n`;
      if (context?.score !== undefined) issueBody += `- **점수**: ${context.score}\n`;
      if (context?.issueCount !== undefined) issueBody += `- **발견 이슈 수**: ${context.issueCount}\n`;
      if (context?.frameName) issueBody += `- **프레임**: ${context.frameName}\n`;
      if (comment) issueBody += `\n### 상세 의견\n${comment}\n`;
      issueBody += `\n---\n_Simulo 플러그인 피드백 시스템에서 자동 생성_`;

      await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: "POST",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          title,
          body: issueBody,
          labels: ["user-feedback", rating === "bad" ? "needs-improvement" : "positive-feedback"],
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "피드백 저장 실패" },
      { status: 500 },
    );
  }
}
