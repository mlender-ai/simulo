"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { t, getLocale, type Locale } from "@/lib/i18n";
import { storage, type AnalysisResult } from "@/lib/storage";

const VERDICT_COLORS: Record<string, string> = {
  Pass: "text-emerald-400",
  Partial: "text-amber-400",
  Fail: "text-red-400",
};

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>("ko");
  const [recent, setRecent] = useState<AnalysisResult[]>([]);
  const [showRecent, setShowRecent] = useState(true);

  useEffect(() => {
    setLocale(getLocale());

    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.analyses && data.analyses.length > 0) {
          setRecent(data.analyses.slice(0, 5));
        } else {
          setRecent(storage.getAll().slice(0, 5));
        }
      })
      .catch(() => {
        setRecent(storage.getAll().slice(0, 5));
      });
  }, []);

  const navItems = [
    { href: "/dashboard", label: "대시보드", icon: "◈" },
    { href: "/history", label: t("history", locale), icon: "≡" },
    { href: "/flow-builder", label: t("flowBuilder", locale), icon: "◇" },
    { href: "/code-to-figma", label: "코드 → Figma", icon: "⟨⟩" },
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
        {/* Close button — mobile only */}
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
          const isActive = pathname.startsWith(item.href);
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

      {/* Recent analyses */}
      {recent.length > 0 && (
        <div className="flex-1 mt-4 px-3 overflow-hidden flex flex-col min-h-0">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)] uppercase tracking-wider hover:text-white transition-colors w-full min-h-[36px]"
          >
            <span className="mono text-[10px]">{showRecent ? "▾" : "▸"}</span>
            최근 분석
          </button>
          {showRecent && (
            <div className="mt-1 space-y-0.5 overflow-y-auto flex-1">
              {recent.map((a) => (
                <Link
                  key={a.id}
                  href={`/report/${a.id}`}
                  onClick={handleNavClick}
                  className={`block px-3 py-2.5 rounded-md text-xs transition-colors truncate min-h-[40px] flex items-center ${
                    pathname === `/report/${a.id}`
                      ? "bg-white/10 text-white"
                      : "text-[var(--muted)] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full overflow-hidden">
                    <span className={`shrink-0 text-[10px] ${VERDICT_COLORS[a.verdict] ?? ""}`}>
                      ●
                    </span>
                    <span className="truncate">
                      {a.hypothesis.slice(0, 30)}
                      {a.hypothesis.length > 30 ? "..." : ""}
                    </span>
                  </div>
                </Link>
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
