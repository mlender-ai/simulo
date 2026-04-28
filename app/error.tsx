"use client";

/**
 * app/error.tsx — Next.js App Router global error boundary.
 *
 * Catches unhandled runtime errors in any route segment below the root layout.
 * Renders a simple, on-brand recovery UI instead of a blank white screen.
 */

import { useEffect } from "react";
import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to console so devtools still captures it
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <p className="mono text-xs text-[var(--muted)] mb-4">오류 발생</p>
        <h1 className="text-2xl font-semibold mb-3">문제가 발생했습니다</h1>
        <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
          예상치 못한 오류가 발생했습니다.
          {error.message ? ` ${error.message}` : ""}
        </p>

        {error.digest && (
          <p className="mono text-xs text-[var(--muted)] mb-6">
            오류 코드: {error.digest}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-md transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm text-[var(--muted)] hover:text-white rounded-md transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
