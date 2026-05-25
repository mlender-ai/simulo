"use client";

import { useEffect, useState } from "react";

interface Finding {
  criterion: string;
  severity: number;
  oneLineFinding: string;
  detail?: string;
  fix: string;
}

interface ChatSession {
  id: string;
  frameId: string;
  frameName: string;
  intent: string | null;
  quickSummary: string | null;
  findings: Finding[] | null;
  createdAt: string;
}

const SEVERITY_COLORS: Record<number, string> = {
  3: "text-red-400 bg-red-400/10 border-red-400/20",
  2: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  1: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

const SEVERITY_LABEL: Record<number, string> = {
  3: "Critical",
  2: "Medium",
  1: "Low",
};

function SeverityBadge({ severity }: { severity: number }) {
  const cls = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[1];
  const label = SEVERITY_LABEL[severity] ?? "Low";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border mono shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

function SessionCard({ session }: { session: ChatSession }) {
  const [open, setOpen] = useState(false);
  const findings = session.findings ?? [];
  const date = new Date(session.createdAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="mono text-xs text-[var(--muted)]">◆</span>
            <span className="font-medium text-sm truncate">{session.frameName}</span>
          </div>
          {session.intent && (
            <p className="text-xs text-[var(--muted)] truncate">{session.intent}</p>
          )}
          {session.quickSummary && (
            <p className="text-xs text-white/70 mt-1 line-clamp-2">{session.quickSummary}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {findings.length > 0 && (
            <span className="text-xs text-[var(--muted)] mono">{findings.length}건</span>
          )}
          <span className="text-xs text-[var(--muted)] mono">{date}</span>
          <span className="text-[var(--muted)] text-xs mono">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
          {findings.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">findings 데이터 없음</p>
          ) : (
            findings.map((f, i) => (
              <div key={i} className="flex gap-3">
                <SeverityBadge severity={f.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/90 font-medium mb-0.5">{f.oneLineFinding}</p>
                  <p className="text-xs text-[var(--muted)]">
                    <span className="text-zinc-500 mono">[{f.criterion}]</span> {f.fix}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PluginSessionsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chat/sessions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight mb-1">플러그인 세션</h1>
        <p className="text-sm text-[var(--muted)]">Figma 플러그인 분석 결과 목록</p>
      </div>

      {loading && (
        <div className="text-sm text-[var(--muted)] mono animate-pulse">로딩 중…</div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          오류: {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="text-center py-20 text-[var(--muted)]">
          <div className="mono text-2xl mb-4 opacity-40">◆</div>
          <p className="text-sm">아직 플러그인 분석 세션이 없습니다.</p>
          <p className="text-xs mt-1 opacity-60">Figma 플러그인에서 분석을 실행해보세요.</p>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
