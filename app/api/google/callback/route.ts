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

    // 토큰을 클라이언트로 전달 (localStorage에 저장)
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
