import Link from "next/link";

/**
 * app/not-found.tsx — Next.js App Router 404 page.
 * Rendered for any route that doesn't match a segment.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <p className="mono text-xs text-[var(--muted)] mb-4">404</p>
        <h1 className="text-2xl font-semibold mb-3">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-md transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
