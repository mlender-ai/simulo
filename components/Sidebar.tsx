"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface ChatSession {
  id: string;
  frameName: string;
  intent: string | null;
  quickSummary: string | null;
  createdAt: string;
}

const INTENT_LABELS: Record<string, string> = {
  "full-scan": "전체 스캔",
  "analyze-axis": "축 분석",
  "copy-rewrite": "카피",
  "ab-variant": "A/B",
  "competitor-compare": "경쟁사",
  "suggestion": "개선안",
  "usability": "사용성",
  "visual": "시각",
  "cta": "CTA",
};

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((r) => r.json())
      .then((data: ChatSession[]) => {
        if (Array.isArray(data)) setSessions(data.slice(0, 20));
      })
      .catch(() => {});
  }, []);

  const handleNavClick = () => onClose?.();

  const filtered = search.trim()
    ? sessions.filter(
        (s) =>
          s.frameName.toLowerCase().includes(search.toLowerCase()) ||
          (s.intent && INTENT_LABELS[s.intent]?.includes(search)) ||
          s.quickSummary?.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  // Group sessions by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; items: ChatSession[] }[] = [];
  const todayItems: ChatSession[] = [];
  const yesterdayItems: ChatSession[] = [];
  const olderItems: ChatSession[] = [];

  for (const s of filtered) {
    const d = new Date(s.createdAt).toDateString();
    if (d === today) todayItems.push(s);
    else if (d === yesterday) yesterdayItems.push(s);
    else olderItems.push(s);
  }
  if (todayItems.length) groups.push({ label: "오늘", items: todayItems });
  if (yesterdayItems.length) groups.push({ label: "어제", items: yesterdayItems });
  if (olderItems.length) groups.push({ label: "이전", items: olderItems });

  return (
    <aside className="h-full flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <Link href="/" onClick={handleNavClick} className="text-lg font-semibold tracking-tight">
          Simulo
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-md text-[var(--muted)] hover:text-white transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3">
        <Link
          href="/"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors min-h-[44px] ${
            pathname === "/"
              ? "bg-white/10 text-white"
              : "text-[var(--muted)] hover:text-white hover:bg-white/5"
          }`}
        >
          <span className="mono text-xs w-4 text-center shrink-0">+</span>
          새 대화
        </Link>
      </div>

      {/* Session search */}
      {sessions.length > 3 && (
        <div className="px-3 pt-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="세션 검색..."
            className="w-full px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>
      )}

      {/* Session list grouped by date */}
      <div className="flex-1 mt-2 px-3 overflow-y-auto min-h-0">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-3 py-1.5 text-[10px] text-white/20 uppercase tracking-wider">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors cursor-default truncate min-h-[36px]"
                  title={s.quickSummary ?? s.frameName}
                >
                  <span className="shrink-0 text-[10px] text-white/15">●</span>
                  <span className="truncate">
                    {s.frameName}
                    {s.intent && (
                      <span className="text-white/15 ml-1">
                        · {INTENT_LABELS[s.intent] ?? s.intent}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && search && (
          <div className="px-3 py-4 text-xs text-white/20 text-center">
            검색 결과 없음
          </div>
        )}
      </div>

      {/* Footer: settings */}
      <div className="px-3 pb-2 border-t border-[var(--border)] pt-2 mt-auto">
        <Link
          href="/settings"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs transition-colors min-h-[40px] ${
            pathname.startsWith("/settings")
              ? "bg-white/10 text-white"
              : "text-[var(--muted)] hover:text-white hover:bg-white/5"
          }`}
        >
          <span className="mono text-xs w-4 text-center shrink-0">⚙</span>
          설정
        </Link>
        <div className="px-3 py-2 text-[10px] text-white/10 mono">v1.0</div>
      </div>
    </aside>
  );
}
