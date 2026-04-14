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

export function Sidebar() {
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
    { href: "/history", label: t("history", locale), icon: "≡" },
    { href: "/flow-builder", label: t("flowBuilder", locale), icon: "◇" },
    { href: "/settings", label: t("settings", locale), icon: "⚙" },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 border-r border-[var(--border)] bg-[var(--background)] flex flex-col z-50">
      <div className="p-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Simulo
        </Link>
      </div>

      <nav className="px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-[var(--muted)] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="mono text-xs w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Recent analyses */}
      {recent.length > 0 && (
        <div className="flex-1 mt-6 px-3 overflow-hidden flex flex-col min-h-0">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--muted)] uppercase tracking-wider hover:text-white transition-colors w-full"
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
                  className={`block px-3 py-1.5 rounded-md text-xs transition-colors truncate ${
                    pathname === `/report/${a.id}`
                      ? "bg-white/10 text-white"
                      : "text-[var(--muted)] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`shrink-0 text-[10px] ${VERDICT_COLORS[a.verdict] ?? ""}`}
                    >
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

      <div className="px-6 pb-6 text-xs text-[var(--muted)] mono">v1.0</div>
    </aside>
  );
}
