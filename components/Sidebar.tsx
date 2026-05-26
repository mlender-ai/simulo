"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { t, getLocale, type Locale } from "@/lib/i18n";

interface ChatSession {
  id: string;
  frameName: string;
  intent: string | null;
  quickSummary: string | null;
  createdAt: string;
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>("ko");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(true);

  useEffect(() => {
    setLocale(getLocale());

    fetch("/api/chat/sessions")
      .then((r) => r.json())
      .then((data: ChatSession[]) => {
        if (Array.isArray(data)) setSessions(data.slice(0, 10));
      })
      .catch(() => {});
  }, []);

  const navItems = [
    { href: "/", label: "새 분석", icon: "+" },
    { href: "/dashboard", label: "대시보드", icon: "◈" },
    { href: "/history", label: t("history", locale), icon: "≡" },
    { href: "/plugin-sessions", label: "플러그인 세션", icon: "◆" },
    { href: "/flow-builder", label: t("flowBuilder", locale), icon: "◇" },
    { href: "/settings", label: t("settings", locale), icon: "⚙" },
  ];

  const handleNavClick = () => {
    onClose?.();
  };

  return (
    <aside className="h-full flex flex-col bg-[var(--background)]">
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

      <nav className="px-3 pt-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors min-h-[44px] ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="mono text-xs w-4 text-center shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div className="flex-1 mt-4 px-3 overflow-hidden flex flex-col min-h-0">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)] uppercase tracking-wider hover:text-white transition-colors w-full min-h-[36px]"
          >
            <span className="mono text-[10px]">{showSessions ? "▾" : "▸"}</span>
            최근 세션
          </button>
          {showSessions && (
            <div className="mt-1 space-y-0.5 overflow-y-auto flex-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="block px-3 py-2.5 rounded-md text-xs text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors truncate min-h-[40px] flex items-center"
                >
                  <div className="flex items-center gap-1.5 w-full overflow-hidden">
                    <span className="shrink-0 text-[10px] text-white/20">●</span>
                    <span className="truncate">
                      {s.frameName}
                      {s.intent && (
                        <span className="text-white/20 ml-1">· {s.intent}</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-6 py-5 text-xs text-[var(--muted)] mono border-t border-[var(--border)] mt-auto">
        v1.0
      </div>
    </aside>
  );
}
