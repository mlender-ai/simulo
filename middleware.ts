import { NextRequest, NextResponse } from "next/server";

/**
 * CORS middleware — Figma 플러그인 iframe에서 API 호출 허용
 * Figma 플러그인 UI는 sandboxed iframe에서 실행되므로 CORS 필요
 */
export function middleware(request: NextRequest) {
  // Preflight OPTIONS 요청 처리
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version",
    "Access-Control-Max-Age": "86400",
  };
}

// API 라우트에만 적용
export const config = {
  matcher: "/api/:path*",
};
