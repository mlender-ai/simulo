"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AnalysisResult } from "@/lib/storage";
import { useExportStatus } from "@/hooks/useExportStatus";

interface ShareExportPanelProps {
  analysisId: string;
  analysisData?: AnalysisResult;
  /** PNG 버튼 노출 여부 — 리포트 DOM이 있는 리포트 페이지에서만 true */
  showPng?: boolean;
}

export function ShareExportPanel({ analysisId, analysisData, showPng = false }: ShareExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { get, isActive, run, clearError } = useExportStatus();

  // Collect any active error to display
  const formats = ["pdf", "docx", "png", "md", "jira"] as const;
  const activeError = formats.map((f) => get(f)).find((s) => s.stage === "error")?.error ?? null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${analysisId}`
      : `/share/${analysisId}`;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  /** Fetch export file — POST with analysisData if available, otherwise GET */
  const fetchExport = useCallback(
    async (path: string): Promise<Response> => {
      let data = analysisData;
      if (!data && typeof window !== "undefined") {
        const { storage } = await import("@/lib/storage");
        data = storage.getById(analysisId) ?? undefined;
      }

      if (data) {
        return fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysisData: data }),
        });
      }
      return fetch(path);
    },
    [analysisId, analysisData]
  );

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = useCallback(
    (format: "pdf" | "docx") => {
      run(
        format,
        () => fetchExport(`/api/export/${format}/${analysisId}`),
        (blob) => triggerDownload(blob, `simulo-report-${analysisId}.${format}`)
      );
    },
    [analysisId, fetchExport, run]
  );

  const handlePNG = useCallback(async () => {
    run(
      "png",
      async () => {
        const { toPng } = await import("html-to-image");
        const el = document.getElementById("overview-tab-content");
        if (!el) throw new Error("리포트 화면이 열려있지 않아 PNG를 생성할 수 없습니다");
        const dataUrl = await toPng(el, { quality: 0.95, backgroundColor: "#0a0a0a" });
        // Return a synthetic Response wrapping the dataUrl blob
        const res = await fetch(dataUrl);
        return res;
      },
      (blob) => triggerDownload(blob, `simulo-overview-${analysisId}.png`)
    );
  }, [analysisId, run]);

  const handleMarkdown = useCallback(() => {
    run(
      "md",
      () => fetchExport(`/api/export/md/${analysisId}`),
      (blob) => triggerDownload(blob, `simulo-report-${analysisId}.md`)
    );
  }, [analysisId, fetchExport, run]);

  const handleJira = useCallback(() => {
    run(
      "jira",
      () => fetchExport(`/api/export/jira/${analysisId}`),
      (blob) => triggerDownload(blob, `simulo-jira-${analysisId}.md`)
    );
  }, [analysisId, fetchExport, run]);

  const handleErrorDismiss = () => {
    formats.forEach((f) => {
      if (get(f).stage === "error") clearError(f);
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors border border-[var(--border)]"
      >
        <span className="text-sm">↑</span>
        공유 및 내보내기
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl z-50 overflow-hidden">
          {/* Share link section */}
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-medium text-white/80 mb-2">공유 링크</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-[11px] bg-white/5 border border-[var(--border)] rounded px-2 py-1.5 text-white/60 outline-none"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors shrink-0"
              >
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">로그인 없이 열람 가능</p>
          </div>

          {/* File export section */}
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-medium text-white/80 mb-2">파일로 내보내기</p>
            <div className="flex gap-2">
              <ExportButton
                label="PDF"
                status={get("pdf")}
                disabled={isActive("pdf")}
                onClick={() => handleDownload("pdf")}
              />
              <ExportButton
                label="Word"
                status={get("docx")}
                disabled={isActive("docx")}
                onClick={() => handleDownload("docx")}
              />
              {showPng && (
                <ExportButton
                  label="PNG"
                  status={get("png")}
                  disabled={isActive("png")}
                  onClick={handlePNG}
                />
              )}
            </div>
          </div>

          {/* Action export section */}
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-medium text-white/80 mb-1">실무 연결</p>
            <p className="text-[10px] text-white/40 mb-2">분석 결과를 바로 업무에 활용</p>
            <div className="flex gap-2">
              <ExportButton
                label="Markdown"
                status={get("md")}
                disabled={isActive("md")}
                onClick={handleMarkdown}
                title="Markdown 파일로 내보내기"
              />
              <ExportButton
                label="Jira 드래프트"
                status={get("jira")}
                disabled={isActive("jira")}
                onClick={handleJira}
                title="Jira 티켓 드래프트 생성"
              />
            </div>
          </div>

          {/* Error message */}
          {activeError && (
            <div
              className="px-4 py-2.5 bg-red-400/10 border-t border-red-400/20 flex items-start justify-between gap-2 cursor-pointer"
              onClick={handleErrorDismiss}
            >
              <p className="text-[11px] text-red-400">{activeError}</p>
              <span className="text-[11px] text-red-400/60 shrink-0">✕</span>
            </div>
          )}

          {/* Note */}
          <div className="px-4 py-2.5">
            <p className="text-[10px] text-white/25">
              ※ 내보내기에는 분석 이미지가 포함되지 않을 수 있습니다
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExportButtonProps {
  label: string;
  status: { stage: string };
  disabled: boolean;
  onClick: () => void;
  title?: string;
}

function ExportButton({ label, status, disabled, onClick, title }: ExportButtonProps) {
  const { stage } = status;

  const content = (() => {
    if (stage === "validating") return <><Spinner /><span>확인 중</span></>;
    if (stage === "generating") return <><Spinner /><span>생성 중</span></>;
    if (stage === "ready") return <span className="text-emerald-400">✓ 완료</span>;
    if (stage === "error") return <span className="text-red-400">✕ 실패</span>;
    return <span>{label}</span>;
  })();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
    >
      {content}
    </button>
  );
}

function Spinner() {
  return <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />;
}
