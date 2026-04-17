"use client";

import type { Locale } from "@/lib/i18n";

interface ThinkAloudTabProps {
  thinkAloud: { screen: string; thought: string }[];
  locale: Locale;
}

export function ThinkAloudTab({ thinkAloud }: ThinkAloudTabProps) {
  return (
    <div className="space-y-4">
      {thinkAloud.map((entry, i) => (
        <div key={i} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-xs text-[var(--muted)] mono mb-2">{entry.screen}</div>
          <p className="text-sm leading-relaxed italic">&ldquo;{entry.thought}&rdquo;</p>
        </div>
      ))}
    </div>
  );
}
