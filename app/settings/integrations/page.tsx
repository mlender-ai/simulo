"use client";

import { useState, useEffect } from "react";

export default function IntegrationsPage() {
  const [slackUrl, setSlackUrl] = useState("");
  const [savedSlackUrl, setSavedSlackUrl] = useState<string | null>(null);
  const [savingSlack, setSavingSlack] = useState(false);
  const [slackSaved, setSlackSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/slack")
      .then((r) => r.json())
      .then((d: { webhookUrl?: string } | null) => {
        if (d?.webhookUrl) setSavedSlackUrl(d.webhookUrl);
      })
      .catch(() => {});
  }, []);

  async function saveSlack() {
    if (!slackUrl.trim()) return;
    setSavingSlack(true);
    try {
      await fetch("/api/settings/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: slackUrl.trim() }),
      });
      setSavedSlackUrl(slackUrl.trim());
      setSlackUrl("");
      setSlackSaved(true);
      setTimeout(() => setSlackSaved(false), 2000);
    } finally {
      setSavingSlack(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">통합 설정</h1>
          <p className="text-gray-400 mt-1 text-sm">외부 서비스 연동을 설정합니다.</p>
        </div>

        {/* Slack */}
        <section className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center text-white text-sm font-bold">
              S
            </div>
            <div>
              <div className="font-medium text-white">Slack</div>
              <div className="text-xs text-gray-500">
                분석 완료·경쟁사 변화·캘리브레이션 드리프트 알림
              </div>
            </div>
            {savedSlackUrl && (
              <span className="ml-auto text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                연결됨
              </span>
            )}
          </div>

          {savedSlackUrl && (
            <div className="text-xs text-gray-500 bg-gray-800 rounded px-3 py-2 font-mono truncate">
              {savedSlackUrl}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={saveSlack}
              disabled={savingSlack || !slackUrl.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {slackSaved ? "저장됨" : savingSlack ? "저장중..." : "저장"}
            </button>
          </div>
        </section>

        {/* GA4 — placeholder for future */}
        <section className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-3 opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center text-white text-sm font-bold">
              G
            </div>
            <div>
              <div className="font-medium text-white">Google Analytics 4</div>
              <div className="text-xs text-gray-500">
                실측 데이터 기반 캘리브레이션 (준비 중)
              </div>
            </div>
            <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
              Coming Soon
            </span>
          </div>
        </section>

        {/* Jira/Linear — placeholder */}
        <section className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-3 opacity-60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-sm font-bold">
              J
            </div>
            <div>
              <div className="font-medium text-white">Jira / Linear</div>
              <div className="text-xs text-gray-500">
                심각도 3+ 이슈 자동 태스크 생성 (준비 중)
              </div>
            </div>
            <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
              Coming Soon
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
