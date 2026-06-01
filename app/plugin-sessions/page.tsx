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

function ClipboardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="1" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
      <rect x="1" y="3" width="7" height="9" rx="1" fill="var(--bg)" stroke="currentColor" strokeWidth="1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [copied, setCopied] = useState(false);

  function copyFinding() {
    const severityLabel = SEVERITY_LABEL[f.severity] ?? "Low";
    const text = [
      `[${severityLabel}] ${f.oneLineFinding}`,
      f.fix ? `→ 수정: ${f.fix}` : null,
      `기준: ${f.criterion}`,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex gap-3">
      <SeverityBadge severity={f.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/90 font-medium mb-0.5">{f.oneLineFinding}</p>
        {f.fix && (
          <div className="mt-1.5 flex gap-1.5 items-start">
            <span className="text-[10px] font-mono text-emerald-400 shrink-0 mt-0.5">→ 수정</span>
            <p className="text-xs text-white/70 leading-relaxed">{f.fix}</p>
          </div>
        )}
        <p className="text-[10px] text-zinc-600 mono mt-1">[{f.criterion}]</p>
      </div>
      <button
        onClick={copyFinding}
        title="이 수정 가이드 복사"
        className={`shrink-0 mt-0.5 transition-all ${
          copied ? "opacity-100 text-emerald-400" : "opacity-40 hover:opacity-100 text-[var(--muted)]"
        }`}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>
    </div>
  );
}

function SessionCard({ session }: { session: ChatSession }) {
  const [open, setOpen] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const findings = session.findings ?? [];
  const date = new Date(session.createdAt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function copyAllFindings() {
    const lines: string[] = [`## [${session.frameName}] 수정 가이드`, ""];
    for (const f of findings) {
      const severityLabel = SEVERITY_LABEL[f.severity] ?? "Low";
      lines.push(`### [${severityLabel}] ${f.oneLineFinding}`);
      if (f.fix) lines.push(`→ ${f.fix}`);
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n").trimEnd()).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    });
  }

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

      {open && findings.length > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-2 flex justify-end">
          <button
            onClick={copyAllFindings}
            className={`text-xs mono transition-colors flex items-center gap-1.5 ${
              allCopied ? "text-emerald-400" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {allCopied ? <CheckIcon /> : <ClipboardIcon />}
            {allCopied ? "복사됨" : "전체 복사"}
          </button>
        </div>
      )}

      {open && (
        <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
          {findings.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">findings 데이터 없음</p>
          ) : (
            findings.map((f, i) => <FindingRow key={i} f={f} />)
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
  const [query, setQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string | null>(null);

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

  const uniqueIntents = Array.from(
    new Set(sessions.map((s) => s.intent).filter(Boolean))
  ) as string[];

  const filtered = sessions.filter((s) => {
    const matchQuery =
      !query ||
      s.frameName.toLowerCase().includes(query.toLowerCase()) ||
      (s.quickSummary ?? "").toLowerCase().includes(query.toLowerCase());
    const matchIntent = !intentFilter || s.intent === intentFilter;
    return matchQuery && matchIntent;
  });

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
        <>
          <div className="mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="프레임 이름 검색…"
              className="w-full bg-transparent border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {uniqueIntents.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setIntentFilter(null)}
                className={`text-xs mono px-3 py-1 rounded-full border transition-colors ${
                  intentFilter === null
                    ? "border-white/40 text-white bg-white/10"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-white/30 hover:text-white"
                }`}
              >
                전체
              </button>
              {uniqueIntents.map((intent) => (
                <button
                  key={intent}
                  onClick={() => setIntentFilter(intentFilter === intent ? null : intent)}
                  className={`text-xs mono px-3 py-1 rounded-full border transition-colors ${
                    intentFilter === intent
                      ? "border-white/40 text-white bg-white/10"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-white/30 hover:text-white"
                  }`}
                >
                  {intent}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-[var(--muted)]">
              <div className="mono text-2xl mb-4 opacity-40">◆</div>
              <p className="text-sm">검색 결과 없음</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
