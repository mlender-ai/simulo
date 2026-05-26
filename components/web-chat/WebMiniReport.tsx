"use client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MiniReportData {
  quickSummary: string;
  findings: Array<{
    criterion: string;
    severity: number;
    oneLineFinding: string;
    detail: string;
    fix: string;
  }>;
}

interface Props {
  data: MiniReportData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

const SEV_CONFIG: Record<number, { label: string; color: string; dot: string }> = {
  0: { label: "OK", color: "text-emerald-400", dot: "bg-emerald-400" },
  1: { label: "INFO", color: "text-sky-400", dot: "bg-sky-400" },
  2: { label: "WARN", color: "text-amber-400", dot: "bg-amber-400" },
  3: { label: "ERR", color: "text-orange-400", dot: "bg-orange-400" },
  4: { label: "CRIT", color: "text-red-400", dot: "bg-red-400" },
};

function sevConfig(sev: number) {
  return SEV_CONFIG[Math.min(4, Math.max(0, sev))] ?? SEV_CONFIG[2];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WebMiniReport({ data }: Props) {
  if (!data.findings || data.findings.length === 0) return null;

  const maxSev = Math.max(...data.findings.map((f) => f.severity));
  const overall = sevConfig(maxSev);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className={`w-2 h-2 rounded-full ${overall.dot}`} />
        <span className={`text-xs font-medium ${overall.color}`}>
          {overall.label}
        </span>
        <span className="text-xs text-white/40 ml-1">
          {data.findings.length}개 항목
        </span>
      </div>

      {/* Findings */}
      <div className="divide-y divide-white/5">
        {data.findings.map((f, i) => {
          const s = sevConfig(f.severity);
          return (
            <div key={i} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${s.dot}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 font-medium">
                      {f.criterion}
                    </span>
                    <span
                      className={`text-[10px] ${s.color} opacity-60`}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    {f.oneLineFinding}
                  </p>
                  {f.fix && (
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">
                      <span className="text-white/25 mr-1">fix:</span>
                      {f.fix}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
