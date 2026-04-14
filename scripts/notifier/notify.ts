/**
 * Simulo 로컬 알림 시스템
 *
 * macOS 네이티브 알림 + 팝업 리포트 뷰어
 * 에이전트 실행 결과를 바탕화면에서 바로 확인
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

const ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(ROOT, "ideas");
const QA_DIR = path.join(ROOT, "qa-reports");

// macOS 네이티브 알림
function notify(title: string, message: string, sound = "Glass") {
  const escaped = (s: string) => s.replace(/"/g, '\\"').replace(/\n/g, " ");
  execSync(
    `osascript -e 'display notification "${escaped(message)}" with title "${escaped(title)}" sound name "${sound}"'`
  );
}

// 최신 리포트 파일 찾기
function getLatestReport(dir: string): { name: string; content: string } | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return {
    name: files[0],
    content: fs.readFileSync(path.join(dir, files[0]), "utf-8"),
  };
}

// 마크다운을 HTML로 간단 변환
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="color:#D97757;margin-top:16px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#fff;border-bottom:1px solid #333;padding-bottom:4px;margin-top:20px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#D97757;font-size:20px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code style="background:#1a1a1a;padding:2px 6px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/^\| (.+)$/gm, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      return `<tr>${cells.map((c) => `<td style="padding:4px 8px;border-bottom:1px solid #222">${c}</td>`).join("")}</tr>`;
    })
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #333;margin:16px 0">')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0">$1</li>')
    .replace(/\n/g, "<br>");
}

// 로컬 HTTP 서버로 리포트 팝업
function showReport(title: string, content: string) {
  const avatar = fs.existsSync(path.join(__dirname, "claude-avatar.svg"))
    ? fs.readFileSync(path.join(__dirname, "claude-avatar.svg"), "utf-8")
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Simulo Agent — ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif;
      background: #0a0a0a; color: #ccc;
      padding: 0; overflow-x: hidden;
    }
    .header {
      position: sticky; top: 0; z-index: 10;
      background: linear-gradient(180deg, #111 0%, #0a0a0a 100%);
      padding: 16px 24px; display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid #222;
    }
    .avatar { width: 40px; height: 40px; }
    .header-text h1 { font-size: 14px; color: #D97757; font-weight: 600; }
    .header-text p { font-size: 11px; color: #666; margin-top: 2px; }
    .content {
      padding: 20px 24px; font-size: 13px; line-height: 1.7;
      max-width: 700px;
    }
    h1 { font-size: 18px; }
    h2 { font-size: 15px; }
    h3 { font-size: 13px; }
    strong { color: #fff; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    li { margin-left: 16px; }
    code { font-family: 'SF Mono', monospace; }
    .close-btn {
      position: fixed; top: 16px; right: 20px;
      background: #222; border: 1px solid #333; color: #888;
      width: 28px; height: 28px; border-radius: 50%;
      cursor: pointer; font-size: 14px; z-index: 20;
      display: flex; align-items: center; justify-content: center;
    }
    .close-btn:hover { background: #333; color: #fff; }
  </style>
</head>
<body>
  <button class="close-btn" onclick="window.close()">✕</button>
  <div class="header">
    <div class="avatar">${avatar}</div>
    <div class="header-text">
      <h1>Simulo Agent</h1>
      <p>${title} — ${new Date().toLocaleDateString("ko-KR")}</p>
    </div>
  </div>
  <div class="content">
    ${mdToHtml(content)}
  </div>
</body>
</html>`;

  // 임시 서버로 브라우저 팝업
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    // 한번 보여주고 서버 종료
    setTimeout(() => server.close(), 2000);
  });

  server.listen(0, () => {
    const addr = server.address();
    if (addr && typeof addr === "object") {
      const url = `http://localhost:${addr.port}`;
      execSync(`open -a "Google Chrome" "${url}" || open "${url}"`);
      console.log(`[notify] 리포트 열림: ${url}`);
    }
  });
}

// 메인
const command = process.argv[2] || "check";

if (command === "idea") {
  const report = getLatestReport(REPORTS_DIR);
  if (report) {
    notify("Simulo Agent", `새 아이디어가 도착했습니다\n${report.name}`);
    showReport("제품 아이디어", report.content);
  } else {
    notify("Simulo Agent", "아직 생성된 아이디어가 없습니다");
  }
} else if (command === "qa") {
  const report = getLatestReport(QA_DIR);
  if (report) {
    const hasCritical = report.content.includes("CRITICAL");
    notify(
      "Simulo QA Agent",
      hasCritical ? "⚠️ CRITICAL 이슈 발견!" : "✅ QA 점검 완료",
      hasCritical ? "Basso" : "Glass"
    );
    showReport("QA 리포트", report.content);
  } else {
    notify("Simulo QA Agent", "아직 QA 리포트가 없습니다");
  }
} else if (command === "check") {
  // 새 리포트가 있는지 확인
  const idea = getLatestReport(REPORTS_DIR);
  const qa = getLatestReport(QA_DIR);

  console.log("[notify] 아이디어 리포트:", idea ? idea.name : "없음");
  console.log("[notify] QA 리포트:", qa ? qa.name : "없음");

  if (!idea && !qa) {
    notify("Simulo Agent", "확인할 리포트가 없습니다. 에이전트가 아직 실행되지 않았습니다.");
  }
} else {
  console.log("Usage: npx tsx scripts/notifier/notify.ts [idea|qa|check]");
}
