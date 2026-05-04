"use client";

import type { Locale } from "@/lib/i18n";

interface ThinkAloudEntry {
  screen: string;
  persona?: string;
  thought: string;
}

interface ThinkAloudTabProps {
  thinkAloud: ThinkAloudEntry[];
  locale: Locale;
}

const PERSONA_COLORS = [
  { border: "#3b82f6", label: "#60a5fa", bg: "rgba(59,130,246,0.06)" },
  { border: "#a855f7", label: "#c084fc", bg: "rgba(168,85,247,0.06)" },
  { border: "#f59e0b", label: "#fbbf24", bg: "rgba(245,158,11,0.06)" },
];

export function ThinkAloudTab({ thinkAloud }: ThinkAloudTabProps) {
  // Group entries by screen while preserving order
  const screenOrder: string[] = [];
  const byScreen = new Map<string, ThinkAloudEntry[]>();
  for (const entry of thinkAloud) {
    if (!byScreen.has(entry.screen)) {
      screenOrder.push(entry.screen);
      byScreen.set(entry.screen, []);
    }
    byScreen.get(entry.screen)!.push(entry);
  }

  // Check if any entry has persona info
  const hasPersonas = thinkAloud.some((e) => e.persona);

  if (!hasPersonas) {
    // Legacy single-voice rendering
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

  return (
    <div className="space-y-6">
      {screenOrder.map((screen) => {
        const entries = byScreen.get(screen)!;
        return (
          <div key={screen}>
            <div className="text-xs text-[var(--muted)] mono mb-3 flex items-center gap-2">
              <span>{screen}</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <div className="space-y-3">
              {entries.map((entry, idx) => {
                const colors = PERSONA_COLORS[idx % PERSONA_COLORS.length];
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg"
                    style={{ border: `1px solid ${colors.border}22`, background: colors.bg }}
                  >
                    {entry.persona && (
                      <div
                        className="text-[11px] font-medium mb-1.5"
                        style={{ color: colors.label }}
                      >
                        {entry.persona}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed italic" style={{ color: "#ccc" }}>
                      &ldquo;{entry.thought}&rdquo;
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
