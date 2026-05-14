import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

interface SheetFrame {
  frameName: string;
  score: number;
  issues: {
    location: string;
    original: string;
    suggestion: string;
    reason: string;
    severity: string;
    principle: string;
  }[];
}

interface SheetSession {
  createdAt: string;
  frames: SheetFrame[];
}

export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth 미설정" }, { status: 500 });
  }

  const body = await req.json();
  const { accessToken, refreshToken, sessions } = body as {
    accessToken: string;
    refreshToken: string;
    sessions: SheetSession[];
  };

  if (!accessToken || !sessions?.length) {
    return NextResponse.json({ error: "토큰 또는 세션 데이터가 필요합니다" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  try {
    // 1. 새 스프레드시트 생성
    const title = `UX Writing Checklist — ${new Date().toLocaleDateString("ko-KR")}`;
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          {
            properties: {
              title: "체크리스트",
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    if (!spreadsheetId) {
      return NextResponse.json({ error: "스프레드시트 생성 실패" }, { status: 500 });
    }

    // 2. 데이터 준비
    const SEVERITY_KR: Record<string, string> = {
      critical: "심각",
      warning: "주의",
      info: "참고",
    };

    const header = ["날짜", "프레임", "점수", "위치", "심각도", "원칙", "Don't (현재)", "Do (제안)", "사유"];
    const rows: string[][] = [];

    for (const session of sessions) {
      const date = new Date(session.createdAt).toLocaleDateString("ko-KR");
      for (const frame of session.frames) {
        if (frame.issues.length === 0) {
          rows.push([date, frame.frameName, String(frame.score), "", "", "", "", "", "이슈 없음"]);
          continue;
        }
        for (const issue of frame.issues) {
          rows.push([
            date,
            frame.frameName,
            String(frame.score),
            issue.location,
            SEVERITY_KR[issue.severity] ?? issue.severity,
            issue.principle,
            issue.original,
            issue.suggestion,
            issue.reason,
          ]);
        }
      }
    }

    // 3. 데이터 쓰기
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "체크리스트!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [header, ...rows],
      },
    });

    // 4. 스타일 적용 (헤더 볼드 + 배경색 + 열 너비)
    const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId ?? 0;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // 헤더 볼드 + 배경색
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.15, green: 0.15, blue: 0.15 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          // 자동 열 너비
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 },
            },
          },
        ],
      },
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return NextResponse.json({ url, spreadsheetId });
  } catch (err) {
    console.error("Google Sheets API error:", err);

    // 토큰 만료 감지
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("invalid_grant") || errorMessage.includes("Token has been expired")) {
      return NextResponse.json({ error: "google_token_expired" }, { status: 401 });
    }

    return NextResponse.json({ error: "스프레드시트 생성 실패: " + errorMessage }, { status: 500 });
  }
}
