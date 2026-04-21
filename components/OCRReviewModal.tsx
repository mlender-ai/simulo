"use client";

import { useState } from "react";
import type { OCRResult } from "@/lib/ocr";

interface Props {
  ocrResults: OCRResult[];
  onConfirm: (results: OCRResult[]) => void;
  onCancel: () => void;
}

export default function OCRReviewModal({ ocrResults, onConfirm, onCancel }: Props) {
  const [editing, setEditing] = useState<OCRResult[]>(
    ocrResults.map((r) => ({ ...r, texts: [...r.texts] }))
  );

  const updateText = (screenIdx: number, textIdx: number, value: string) => {
    setEditing((prev) =>
      prev.map((r) =>
        r.screenIndex === screenIdx
          ? { ...r, texts: r.texts.map((t, i) => (i === textIdx ? value : t)) }
          : r
      )
    );
  };

  const removeText = (screenIdx: number, textIdx: number) => {
    setEditing((prev) =>
      prev.map((r) =>
        r.screenIndex === screenIdx
          ? { ...r, texts: r.texts.filter((_, i) => i !== textIdx) }
          : r
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        <div className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">추출된 텍스트를 확인해주세요</h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            잘못 읽힌 텍스트를 수정하거나 삭제할 수 있습니다. 확인 후 분석이 시작됩니다.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {editing.map((result) => (
            <div key={result.screenIndex}>
              <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                화면 {result.screenIndex + 1}
              </p>
              {result.texts.length === 0 ? (
                <p className="text-xs text-[var(--muted)] italic">(추출된 텍스트 없음)</p>
              ) : (
                <div className="space-y-1.5">
                  {result.texts.map((text, ti) => (
                    <div key={ti} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={text}
                        onChange={(e) => updateText(result.screenIndex, ti, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-white/30"
                      />
                      <button
                        onClick={() => removeText(result.screenIndex, ti)}
                        className="text-[var(--muted)] hover:text-white text-xs px-2 py-1 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-md hover:border-white/20 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(editing)}
            className="px-5 py-2 text-sm bg-white text-black font-medium rounded-md hover:bg-white/90 transition-colors"
          >
            이대로 분석 시작
          </button>
        </div>
      </div>
    </div>
  );
}
