/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useCallback } from "react";

interface DraftResultProps {
  html: string;
  changes: string[];
  originalImage: string;
  onBack: () => void;
  onRegenerate: () => void;
  generating: boolean;
}

export function DraftResult({
  html,
  changes,
  originalImage,
  onBack,
  onRegenerate,
  generating,
}: DraftResultProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [savingPng, setSavingPng] = useState(false);

  const handleSavePng = useCallback(async () => {
    if (!iframeRef.current?.contentDocument) return;
    setSavingPng(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const body = iframeRef.current.contentDocument.body;
      const canvas = await html2canvas(body, {
        width: 375,
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement("a");
      link.download = `draft-improvement-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("PNG save failed:", err);
    } finally {
      setSavingPng(false);
    }
  }, []);

  const handleCopyHtml = useCallback(() => {
    navigator.clipboard.writeText(html);
  }, [html]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          <span>&larr;</span>
          <span>다시 만들기</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={onRegenerate}
            disabled={generating}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            {generating ? "생성 중..." : "재생성"}
          </button>
        </div>
      </div>

      {/* Toggle: original vs improved */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-[var(--border)]">
          <button
            onClick={() => setShowOriginal(false)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              !showOriginal ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            개선안
          </button>
          <button
            onClick={() => setShowOriginal(true)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              showOriginal ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            원본
          </button>
        </div>
        {!showOriginal && (
          <div className="flex gap-1.5 ml-auto">
            <button
              onClick={handleSavePng}
              disabled={savingPng}
              className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors disabled:opacity-50"
            >
              {savingPng ? "저장 중..." : "PNG 저장"}
            </button>
            <button
              onClick={handleCopyHtml}
              className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors"
            >
              HTML 복사
            </button>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="flex justify-center">
        <div className="w-[375px] bg-white rounded-xl overflow-hidden shadow-2xl border border-[var(--border)]">
          {showOriginal ? (
            <img
              src={originalImage}
              alt="original"
              className="w-full"
            />
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full border-0"
              style={{ minHeight: 600 }}
              title="개선안 미리보기"
              onLoad={() => {
                // Auto-resize iframe to content height
                if (iframeRef.current?.contentDocument) {
                  const body = iframeRef.current.contentDocument.body;
                  const height = body.scrollHeight;
                  iframeRef.current.style.height = `${Math.max(height, 600)}px`;
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Changes list */}
      {changes.length > 0 && !showOriginal && (
        <div className="bg-white/[0.03] border border-[var(--border)] rounded-lg p-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
            변경 사항
          </p>
          <ul className="space-y-1.5">
            {changes.map((change, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/70">
                <span className="text-green-400 shrink-0">+</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
