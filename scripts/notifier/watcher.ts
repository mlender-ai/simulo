/**
 * Simulo Agent Watcher
 *
 * 백그라운드에서 실행되며:
 * 1. 주기적으로 git pull (GitHub에서 새 리포트 확인)
 * 2. 새 리포트 파일이 감지되면 macOS 알림 + 팝업
 * 3. launchd로 자동 시작 가능
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");
const STATE_FILE = path.join(__dirname, ".watcher-state.json");

interface WatcherState {
  lastIdeaFile: string;
  lastQAFile: string;
  lastCheck: string;
}

function loadState(): WatcherState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  }
  return { lastIdeaFile: "", lastQAFile: "", lastCheck: "" };
}

function saveState(state: WatcherState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 30000 }).trim();
  } catch {
    return "";
  }
}

function getLatestFile(dir: string): string {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return "";
  const files = fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
    .sort()
    .reverse();
  return files[0] || "";
}

function notify(title: string, message: string, sound = "Glass") {
  const escaped = (s: string) => s.replace(/"/g, '\\"').replace(/\n/g, " ");
  try {
    execSync(
      `osascript -e 'display notification "${escaped(message)}" with title "${escaped(title)}" sound name "${sound}"'`
    );
  } catch {
    // 알림 실패 무시
  }
}

function check() {
  const state = loadState();

  // git pull로 최신 리포트 가져오기
  const pullResult = run("git pull --rebase origin main 2>&1");
  if (pullResult.includes("error") || pullResult.includes("conflict")) {
    console.log("[watcher] git pull 실패, 스킵:", pullResult.slice(0, 100));
    return;
  }

  // 아이디어 리포트 확인
  const latestIdea = getLatestFile("ideas");
  if (latestIdea && latestIdea !== state.lastIdeaFile) {
    console.log(`[watcher] 새 아이디어 발견: ${latestIdea}`);
    notify("Simulo Agent", `새 아이디어가 도착했습니다\n${latestIdea}`);

    // 팝업 열기
    try {
      execSync(`npx tsx ${path.join(__dirname, "notify.ts")} idea`, {
        cwd: ROOT,
        timeout: 15000,
      });
    } catch {
      // 팝업 실패해도 알림은 전달됨
    }

    state.lastIdeaFile = latestIdea;
  }

  // QA 리포트 확인
  const latestQA = getLatestFile("qa-reports");
  if (latestQA && latestQA !== state.lastQAFile) {
    console.log(`[watcher] 새 QA 리포트 발견: ${latestQA}`);

    const qaContent = fs.readFileSync(path.join(ROOT, "qa-reports", latestQA), "utf-8");
    const hasCritical = qaContent.includes("CRITICAL");

    notify(
      "Simulo QA Agent",
      hasCritical ? `CRITICAL 이슈 발견!\n${latestQA}` : `QA 점검 완료\n${latestQA}`,
      hasCritical ? "Basso" : "Glass"
    );

    try {
      execSync(`npx tsx ${path.join(__dirname, "notify.ts")} qa`, {
        cwd: ROOT,
        timeout: 15000,
      });
    } catch {
      // 팝업 실패해도 알림은 전달됨
    }

    state.lastQAFile = latestQA;
  }

  state.lastCheck = new Date().toISOString();
  saveState(state);
  console.log(`[watcher] 체크 완료: ${state.lastCheck}`);
}

// 실행
check();
