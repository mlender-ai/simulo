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

const SEVERITY_KR: Record<string, string> = {
  critical: "심각",
  warning: "주의",
  info: "참고",
};

const HEADER = ["날짜", "프레임", "점수", "위치", "심각도", "원칙", "Don't (현재)", "Do (제안)", "사유"];

function sessionsToRows(sessions: SheetSession[]): string[][] {
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
  return rows;
}

export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth 미설정" }, { status: 500 });
  }

  const body = await req.json();
  const { accessToken, refreshToken, sessions, spreadsheetId: existingId } = body as {
    accessToken: string;
    refreshToken: string;
    sessions: SheetSession[];
    spreadsheetId?: string;
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
  const rows = sessionsToRows(sessions);

  try {
    // ── Append to existing sheet ──
    if (existingId) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: existingId,
          range: "체크리스트!A1",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: rows },
        });

        const url = `https://docs.google.com/spreadsheets/d/${existingId}`;
        return NextResponse.json({ url, spreadsheetId: existingId, appended: true });
      } catch (appendErr) {
        // 시트 접근 실패 시 새로 생성으로 폴백
        console.warn("[sheets] Append failed, creating new sheet:", appendErr);
      }
    }

    // ── Create new spreadsheet ──
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

    // Write header + data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "체크리스트!A1",
      valueInputOption: "RAW",
      requestBody: { values: [HEADER, ...rows] },
    });

    // Style header
    const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId ?? 0;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
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

    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("invalid_grant") || errorMessage.includes("Token has been expired")) {
      return NextResponse.json({ error: "google_token_expired" }, { status: 401 });
    }

    return NextResponse.json({ error: "스프레드시트 생성 실패: " + errorMessage }, { status: 500 });
  }
}
