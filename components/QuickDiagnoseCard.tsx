"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface DiagIssue {
  severity: "critical" | "warning" | "good";
  title: string;
  detail: string;
}

interface DiagResult {
  issues: DiagIssue[];
  score: number;
  oneLiner: string;
}

const SEVERITY = {
  critical: { icon: "\u{1F534}", label: "심각", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  warning: { icon: "\u{1F7E1}", label: "주의", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  good: { icon: "\u{1F7E2}", label: "양호", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

export function QuickDiagnoseOverlay() {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dragCounter = useRef(0);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
    setCopied(false);
  }, []);

  const runDiagnosis = useCallback(async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = localStorage.getItem("simulo_anthropic_key") || undefined;
      const res = await fetch("/api/quick-diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, apiKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `진단 실패 (${res.status})`);
      }
      const data: DiagResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "진단 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        runDiagnosis(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }, [runDiagnosis]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith("image/")) {
        handleFile(file);
      }
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  const copyToClipboard = useCallback(() => {
    if (!result) return;
    const text = result.issues
      .map((i) => `${SEVERITY[i.severity].icon} ${i.title} — ${i.detail}`)
      .join("\n");
    const full = `즉시 진단 (${result.score}점)\n${text}\n\n${result.oneLiner}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  // Drop zone overlay
  if (isDragging) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="border-2 border-dashed border-white/30 rounded-2xl p-16 text-center">
          <p className="text-2xl text-white/80 mb-2">스크린샷을 여기에 드롭</p>
          <p className="text-sm text-white/40">즉시 UX 진단 카드를 생성합니다</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-[#111] border border-[var(--border)] rounded-xl p-8 text-center max-w-sm">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/80">화면을 진단하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={reset}>
        <div className="bg-[#111] border border-red-500/20 rounded-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button onClick={reset} className="w-full py-2 rounded-md text-xs bg-white/10 text-white/70 hover:bg-white/15">
            닫기
          </button>
        </div>
      </div>
    );
  }

  // Result card
  if (result) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={reset}>
        <div
          className="bg-[#111] border border-[var(--border)] rounded-xl overflow-hidden max-w-sm w-full mx-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">즉시 진단</span>
            </div>
            <span className={`text-2xl font-bold mono ${
              result.score >= 80 ? "text-emerald-400" : result.score >= 60 ? "text-amber-400" : "text-red-400"
            }`}>
              {result.score}
            </span>
          </div>

          {/* Issues */}
          <div className="px-5 space-y-2 pb-3">
            {result.issues.map((issue, i) => {
              const s = SEVERITY[issue.severity];
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${s.bg} border ${s.border}`}>
                  <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${s.color}`}>{issue.title}</p>
                    <p className="text-xs text-white/50 mt-0.5">{issue.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* One-liner */}
          <div className="px-5 pb-4">
            <p className="text-xs text-white/40 italic">{result.oneLiner}</p>
          </div>

          {/* Actions */}
          <div className="flex border-t border-[var(--border)]">
            <button
              onClick={copyToClipboard}
              className="flex-1 py-3 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors border-r border-[var(--border)]"
            >
              {copied ? "복사됨" : "클립보드 복사"}
            </button>
            <button
              onClick={reset}
              className="flex-1 py-3 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
