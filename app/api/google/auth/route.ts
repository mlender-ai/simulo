import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth가 설정되지 않았습니다. 환경변수를 확인해주세요." },
      { status: 500 },
    );
  }

  // 현재 호스트에서 콜백 URL 생성
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || "http://localhost:3000";

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/api/google/callback`,
  );

  // Figma 플러그인에서 plugin_session 파라미터를 보내면 state에 포함
  const pluginSession = req.nextUrl.searchParams.get("plugin_session");
  const state = pluginSession ? JSON.stringify({ pluginSession }) : undefined;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
    state,
  });

  return NextResponse.redirect(authUrl);
}
