"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";
import StorageWarningBanner from "./StorageWarningBanner";
import { QuickDiagnoseOverlay } from "./QuickDiagnoseCard";

export function LayoutShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSharePage = pathname.startsWith("/share");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  if (isSharePage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh">
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <div className="hidden md:block fixed left-0 top-0 h-screen w-56 border-r border-[var(--border)] z-50">
        <Sidebar />
      </div>

      {/* ── Mobile: top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 border-b border-[var(--border)] bg-[var(--background)]">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col justify-center gap-[5px] w-10 h-10 rounded-md hover:bg-white/5 transition-colors"
          aria-label="메뉴 열기"
        >
          <span className="block w-5 h-px bg-white/70 mx-auto" />
          <span className="block w-5 h-px bg-white/70 mx-auto" />
          <span className="block w-5 h-px bg-white/70 mx-auto" />
        </button>
        <Link href="/" className="ml-3 text-base font-semibold tracking-tight">
          Simulo
        </Link>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {/* Drawer panel */}
          <div
            className="relative w-64 max-w-[80vw] h-full border-r border-[var(--border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0">
        <StorageWarningBanner />
        {children}
      </main>

      {/* Global drag & drop quick diagnosis */}
      <QuickDiagnoseOverlay />
    </div>
  );
}
