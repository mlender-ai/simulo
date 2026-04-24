"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ShareExportPanelProps {
  analysisId: string;
}

export function ShareExportPanel({ analysisId }: ShareExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const [mdLoading, setMdLoading] = useState(false);
  const [jiraLoading, setJiraLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${analysisId}`
      : `/share/${analysisId}`;

  // Close on outside click
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

  const handleDownload = useCallback(
    async (format: "pdf" | "docx") => {
      const setLoading = format === "pdf" ? setPdfLoading : setDocxLoading;
      setLoading(true);
      try {
        const res = await fetch(`/api/export/${format}/${analysisId}`);
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `simulo-report-${analysisId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(`[export] ${format} failed:`, err);
      } finally {
        setLoading(false);
      }
    },
    [analysisId]
  );

  const handlePNG = useCallback(async () => {
    setPngLoading(true);
    try {
      const { toPng } = await import("html-to-image");
      const el = document.getElementById("overview-tab-content");
      if (!el) {
        console.warn("[export] overview-tab-content element not found");
        return;
      }
      const dataUrl = await toPng(el, { quality: 0.95, backgroundColor: "#0a0a0a" });
      const a = document.createElement("a");
      a.download = `simulo-overview-${analysisId}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error("[export] PNG failed:", err);
    } finally {
      setPngLoading(false);
    }
  }, [analysisId]);

  const handleMarkdown = useCallback(async () => {
    setMdLoading(true);
    try {
      const res = await fetch(`/api/export/md/${analysisId}`);
      if (!res.ok) throw new Error("Markdown export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulo-report-${analysisId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[export] Markdown failed:", err);
    } finally {
      setMdLoading(false);
    }
  }, [analysisId]);

  const handleJira = useCallback(async () => {
    setJiraLoading(true);
    try {
      const res = await fetch(`/api/export/jira/${analysisId}`);
      if (!res.ok) throw new Error("Jira export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulo-jira-${analysisId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[export] Jira failed:", err);
    } finally {
      setJiraLoading(false);
    }
  }, [analysisId]);

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
            <p className="text-xs font-medium text-white/80 mb-2">
              공유 링크
            </p>
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
            <p className="text-[10px] text-white/30 mt-1.5">
              로그인 없이 열람 가능
            </p>
          </div>

          {/* File export section */}
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-medium text-white/80 mb-2">
              파일로 내보내기
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload("pdf")}
                disabled={pdfLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
              >
                {pdfLoading ? (
                  <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  "PDF"
                )}
              </button>
              <button
                onClick={() => handleDownload("docx")}
                disabled={docxLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
              >
                {docxLoading ? (
                  <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  "Word"
                )}
              </button>
              <button
                onClick={handlePNG}
                disabled={pngLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
              >
                {pngLoading ? (
                  <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  "PNG"
                )}
              </button>
            </div>
          </div>

          {/* Action export section */}
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-medium text-white/80 mb-1">
              실무 연결
            </p>
            <p className="text-[10px] text-white/40 mb-2">
              분석 결과를 바로 업무에 활용
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleMarkdown}
                disabled={mdLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
                title="Markdown 파일로 내보내기"
              >
                {mdLoading ? (
                  <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  "Markdown"
                )}
              </button>
              <button
                onClick={handleJira}
                disabled={jiraLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50"
                title="Jira 티켓 드래프트 생성"
              >
                {jiraLoading ? (
                  <span className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  "Jira 드래프트"
                )}
              </button>
            </div>
          </div>

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
