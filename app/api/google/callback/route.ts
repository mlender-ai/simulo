import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "인증 코드가 없습니다" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth 미설정" }, { status: 500 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || "http://localhost:3000";

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/api/google/callback`,
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // state에 pluginSession이 있으면 Figma 플러그인 인증 플로우
    const stateParam = req.nextUrl.searchParams.get("state");
    let pluginSession: string | null = null;
    if (stateParam) {
      try {
        const parsed = JSON.parse(stateParam);
        pluginSession = parsed.pluginSession || null;
      } catch { /* not JSON state */ }
    }

    if (pluginSession) {
      // Figma 플러그인 플로우: DB에 토큰 저장
      const { prisma } = await import("@/lib/db");
      await prisma.pluginAuthSession.upsert({
        where: { id: pluginSession },
        create: {
          id: pluginSession,
          tokens: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
          }),
        },
        update: {
          tokens: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
          }),
        },
      });

      const html = `
<!DOCTYPE html>
<html>
<head><title>Google 연동 완료</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0d0d0d; color: #e5e5e5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { text-align: center; padding: 40px; }
  .check { font-size: 48px; margin-bottom: 16px; }
  h2 { font-size: 18px; margin-bottom: 8px; }
  p { color: #888; font-size: 14px; }
</style>
</head>
<body>
<div class="card">
  <div class="check">✓</div>
  <h2>Google 연동 완료!</h2>
  <p>Figma 플러그인으로 돌아가세요.<br>이 탭은 닫아도 됩니다.</p>
</div>
</body>
</html>`;
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 웹 브라우저 플로우: localStorage에 토큰 저장
    const html = `
<!DOCTYPE html>
<html>
<head><title>Google 연동 완료</title></head>
<body>
<script>
  const tokens = ${JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  })};
  localStorage.setItem("simulo_google_tokens", JSON.stringify(tokens));
  window.opener?.postMessage({ type: "google-auth-success" }, "*");
  document.body.innerText = "Google 연동 완료! 이 창을 닫아주세요.";
  setTimeout(() => window.close(), 1500);
</script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Google OAuth token error:", err);
    return NextResponse.json({ error: "토큰 교환 실패" }, { status: 500 });
  }
}
