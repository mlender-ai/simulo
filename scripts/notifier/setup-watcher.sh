#!/bin/bash
#
# Simulo Agent Watcher 설치 스크립트
# 30분마다 GitHub에서 새 리포트를 확인하고 macOS 알림을 보냅니다.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLIST_NAME="dev.simulo.agent-watcher"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
NODE_PATH=$(which node)
NPX_PATH=$(which npx)

echo "=== Simulo Agent Watcher 설치 ==="
echo "프로젝트: $PROJECT_DIR"
echo "Node: $NODE_PATH"
echo ""

# 기존 서비스 중지
launchctl unload "$PLIST_PATH" 2>/dev/null

# plist 생성
cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${NPX_PATH}</string>
        <string>tsx</string>
        <string>${SCRIPT_DIR}/watcher.ts</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>

    <key>StartInterval</key>
    <integer>1800</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/logs/watcher.log</string>

    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/logs/watcher-error.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$(dirname $NODE_PATH)</string>
    </dict>
</dict>
</plist>
PLIST

# 로그 디렉토리 생성
mkdir -p "$PROJECT_DIR/logs"

# 서비스 등록 및 시작
launchctl load "$PLIST_PATH"

echo "✅ Watcher 설치 완료!"
echo ""
echo "상태 확인:  launchctl list | grep simulo"
echo "로그 확인:  tail -f $PROJECT_DIR/logs/watcher.log"
echo "중지:      launchctl unload $PLIST_PATH"
echo "수동 실행:  npx tsx scripts/notifier/watcher.ts"
echo "알림 테스트: npx tsx scripts/notifier/notify.ts check"
echo ""
echo "30분마다 GitHub에서 새 리포트를 확인합니다."
