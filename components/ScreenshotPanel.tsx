"use client";

import { useState, useCallback } from "react";

interface Shot {
  id: number;
  dataUrl: string;
  timestamp: string;
}

const MAX_SHOTS = 3;

interface ScreenshotPanelProps {
  analysisId: string;
}

export function ScreenshotPanel({ analysisId }: ScreenshotPanelProps) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    if (shots.length >= MAX_SHOTS) return;
    setCapturing(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const el = document.getElementById("report-main");
      if (!el) throw new Error("리포트 영역을 찾을 수 없습니다");
      const dataUrl = await toPng(el, {
        quality: 0.95,
        backgroundColor: "#0a0a0a",
        pixelRatio: 2,
      });
      setShots((prev) => [
        ...prev,
        {
          id: Date.now(),
          dataUrl,
          timestamp: new Date().toLocaleTimeString("ko-KR"),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "캡처 실패");
    } finally {
      setCapturing(false);
    }
  }, [shots.length]);

  const handleDownload = useCallback(
    (shot: Shot, index: number) => {
      const a = document.createElement("a");
      a.href = shot.dataUrl;
      a.download = `simulo-${analysisId}-시안${index + 1}.png`;
      a.click();
    },
    [analysisId]
  );

  const handleDownloadAll = () => {
    shots.forEach((shot, i) => handleDownload(shot, i));
  };

  const handleRemove = (id: number) => {
    setShots((prev) => prev.filter((s) => s.id !== id));
  };

  const canCapture = !capturing && shots.length < MAX_SHOTS;

  return (
    <div className="h-full flex flex-col p-5 overflow-y-auto">
      {/* Header */}
      <div className="mb-5">
        <p className="text-base font-medium text-white">스크린샷 저장</p>
        <p className="text-[13px] text-[var(--muted)] mt-0.5">
          현재 리포트 화면을 PNG로 캡처합니다 · 최대 {MAX_SHOTS}장
        </p>
      </div>

      {/* Capture button */}
      <button
        onClick={handleCapture}
        disabled={!canCapture}
        className="w-full py-2.5 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-40 mb-1"
      >
        {capturing
          ? "캡처 중…"
          : shots.length >= MAX_SHOTS
          ? `최대 ${MAX_SHOTS}장 캡처됨`
          : `캡처하기 (${shots.length} / ${MAX_SHOTS})`}
      </button>
      <p className="text-center text-[11px] text-white/25 mb-5">
        좌측 리포트 전체 영역이 PNG로 저장됩니다
      </p>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mb-3 px-1">{error}</p>
      )}

      {/* Shot cards + empty slots */}
      <div className="space-y-3 flex-1">
        {shots.map((shot, i) => (
          <div
            key={shot.id}
            className="border border-[var(--border)] rounded-lg overflow-hidden"
          >
            {/* Thumbnail */}
            <div className="relative bg-[#111] overflow-hidden" style={{ height: 140 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.dataUrl}
                alt={`시안 ${i + 1}`}
                className="w-full h-full object-cover object-top"
              />
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white mono">
                시안 {i + 1}
              </span>
            </div>

            {/* Actions row */}
            <div className="px-3 py-2.5 flex items-center justify-between">
              <p className="text-[11px] text-[var(--muted)]">{shot.timestamp}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleRemove(shot.id)}
                  className="px-2.5 py-1 rounded text-[11px] text-[var(--muted)] hover:text-white border border-[var(--border)] hover:border-white/20 transition-colors"
                >
                  삭제
                </button>
                <button
                  onClick={() => handleDownload(shot, i)}
                  className="px-2.5 py-1 rounded text-[11px] text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                >
                  ↓ PNG
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty slot placeholders */}
        {Array.from({ length: MAX_SHOTS - shots.length }).map((_, i) => (
          <button
            key={`empty-${i}`}
            onClick={handleCapture}
            disabled={!canCapture}
            className="w-full border border-dashed border-[var(--border)] rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors hover:border-white/20 disabled:cursor-default"
            style={{ height: 100 }}
          >
            <span className="text-lg text-white/15">+</span>
            <p className="text-[11px] text-white/25">시안 {shots.length + i + 1}</p>
          </button>
        ))}
      </div>

      {/* Download all */}
      {shots.length > 1 && (
        <button
          onClick={handleDownloadAll}
          className="w-full mt-4 py-2 rounded-md text-xs text-[var(--muted)] hover:text-white border border-[var(--border)] hover:border-white/20 transition-colors"
        >
          전체 저장 ({shots.length}장)
        </button>
      )}
    </div>
  );
}
