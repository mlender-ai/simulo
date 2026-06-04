"use client";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReportType = "analysis" | "copy" | "ab" | "compare" | "suggestion";

export interface Finding {
  criterion: string;
  severity: number;
  oneLineFinding?: string;
  detail?: string;
  fix?: string;
  // suggestion
  impact?: string;
  effort?: string;
  // copy-rewrite
  before?: string;
  after?: string;
  // ab-variant
  hypothesis?: string;
  control?: string;
  variant?: string;
  // competitor-compare
  us?: string;
  competitor?: string;
  gap?: string;
}

export interface MiniReportData {
  type?: ReportType;
  quickSummary: string;
  findings: Finding[];
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

// ── Type-specific finding body ───────────────────────────────────────────────────

const IMPACT_COLOR: Record<string, string> = {
  높음: "text-emerald-400 border-emerald-400/30",
  중간: "text-amber-400 border-amber-400/30",
  낮음: "text-white/40 border-white/15",
};

function Tag({ label, value }: { label: string; value: string }) {
  const color = IMPACT_COLOR[value] ?? "text-white/50 border-white/15";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${color}`}>
      {label} {value}
    </span>
  );
}

function FindingBody({ f, type }: { f: Finding; type: ReportType }) {
  // copy-rewrite: before → after 대조
  if (type === "copy" && (f.before || f.after)) {
    return (
      <>
        {f.oneLineFinding && (
          <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.oneLineFinding}</p>
        )}
        <div className="mt-1.5 space-y-1">
          {f.before && (
            <p className="text-xs leading-relaxed">
              <span className="text-white/25 mr-1">현재</span>
              <span className="text-white/45 line-through">{f.before}</span>
            </p>
          )}
          {f.after && (
            <p className="text-xs leading-relaxed">
              <span className="text-white/25 mr-1">제안</span>
              <span className="text-emerald-300/90">{f.after}</span>
            </p>
          )}
        </div>
        {f.detail && <p className="text-xs text-white/40 mt-1 leading-relaxed">{f.detail}</p>}
      </>
    );
  }

  // ab-variant: 가설 + control/variant
  if (type === "ab" && (f.control || f.variant)) {
    return (
      <>
        {f.hypothesis && (
          <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
            <span className="text-white/30 mr-1">가설</span>
            {f.hypothesis}
          </p>
        )}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <div className="rounded border border-white/10 px-2 py-1.5">
            <div className="text-[10px] text-white/30 mb-0.5">A · 현재</div>
            <div className="text-xs text-white/60 leading-relaxed">{f.control ?? "—"}</div>
          </div>
          <div className="rounded border border-emerald-400/20 bg-emerald-400/[0.04] px-2 py-1.5">
            <div className="text-[10px] text-emerald-400/70 mb-0.5">B · 변형</div>
            <div className="text-xs text-emerald-300/90 leading-relaxed">{f.variant ?? "—"}</div>
          </div>
        </div>
        {f.detail && <p className="text-xs text-white/40 mt-1 leading-relaxed">{f.detail}</p>}
      </>
    );
  }

  // competitor-compare: us vs competitor + gap
  if (type === "compare" && (f.us || f.competitor)) {
    return (
      <>
        <div className="mt-1 space-y-1">
          {f.us && (
            <p className="text-xs leading-relaxed">
              <span className="text-white/30 mr-1">야핏</span>
              <span className="text-white/55">{f.us}</span>
            </p>
          )}
          {f.competitor && (
            <p className="text-xs leading-relaxed">
              <span className="text-white/30 mr-1">경쟁사</span>
              <span className="text-white/55">{f.competitor}</span>
            </p>
          )}
        </div>
        {f.gap && (
          <p className="text-xs text-amber-300/70 mt-1 leading-relaxed">
            <span className="text-white/25 mr-1">격차</span>
            {f.gap}
          </p>
        )}
        {f.fix && (
          <p className="text-xs text-white/40 mt-1 leading-relaxed">
            <span className="text-white/25 mr-1">fix:</span>
            {f.fix}
          </p>
        )}
      </>
    );
  }

  // suggestion: impact/effort 뱃지 + fix
  if (type === "suggestion" && (f.impact || f.effort)) {
    return (
      <>
        {f.oneLineFinding && (
          <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.oneLineFinding}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {f.impact && <Tag label="임팩트" value={f.impact} />}
          {f.effort && <Tag label="노력" value={f.effort} />}
        </div>
        {f.fix && (
          <p className="text-xs text-white/40 mt-1 leading-relaxed">
            <span className="text-white/25 mr-1">실행:</span>
            {f.fix}
          </p>
        )}
      </>
    );
  }

  // analysis (기본) + 모든 폴백
  return (
    <>
      {f.oneLineFinding && (
        <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{f.oneLineFinding}</p>
      )}
      {f.fix && (
        <p className="text-xs text-white/40 mt-1 leading-relaxed">
          <span className="text-white/25 mr-1">fix:</span>
          {f.fix}
        </p>
      )}
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WebMiniReport({ data }: Props) {
  if (!data.findings || data.findings.length === 0) return null;

  const maxSev = Math.max(...data.findings.map((f) => f.severity));
  const overall = sevConfig(maxSev);

  return (
    <div className="mini-report-enter rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Header — appears first */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-white/5"
        style={{ animation: "chat-msg-fade 0.4s ease-out both" }}
      >
        <span className={`w-2 h-2 rounded-full ${overall.dot} ${maxSev >= 3 ? "sev-pulse" : ""}`} />
        <span className={`text-xs font-medium ${overall.color}`}>
          {overall.label}
        </span>
        <span className="text-xs text-white/40 ml-1">
          {data.findings.length}개 항목
        </span>
      </div>

      {/* Findings — staggered reveal */}
      <div className="divide-y divide-white/5">
        {data.findings.map((f, i) => {
          const s = sevConfig(f.severity);
          return (
            <div
              key={i}
              className="finding-row-enter px-4 py-3"
              style={{ animationDelay: `${200 + i * 150}ms` }}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${s.dot} ${f.severity >= 3 ? "sev-pulse" : ""}`}
                  style={f.severity >= 3 ? { animationDelay: `${200 + i * 150}ms` } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 font-medium">
                      {f.criterion}
                    </span>
                    <span className={`text-[10px] ${s.color} opacity-60`}>
                      {s.label}
                    </span>
                  </div>
                  <FindingBody f={f} type={data.type ?? "analysis"} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
