"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSubmit: (text: string) => void;
  onImagesUploaded: (files: File[]) => void;
  disabled: boolean;
  onReset: () => void;
  hasMessages: boolean;
}

export function WebChatInput({
  onSubmit,
  onImagesUploaded,
  disabled,
  onReset,
  hasMessages,
}: Props) {
  const [text, setText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clipboard image paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        onImagesUploaded(imageFiles);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [disabled, onImagesUploaded]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setText("");
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [text, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const images = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (images.length > 0) onImagesUploaded(images);
    },
    [onImagesUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      className={`border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 ${
        dragOver ? "ring-2 ring-inset ring-white/20" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        {/* Image upload */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-30"
          aria-label="이미지 업로드"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              dragOver
                ? "여기에 이미지를 놓으세요"
                : "메시지 입력... (Shift+Enter로 줄바꿈)"
            }
            rows={1}
            className="chat-input-bar w-full resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none disabled:opacity-40"
            style={{ maxHeight: 160 }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-md transition-all duration-200 ${
            text.trim() && !disabled
              ? "send-btn-active bg-white/10"
              : "bg-white/10 text-white/70 opacity-30"
          }`}
          aria-label="전송"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>

        {/* Reset button */}
        {hasMessages && (
          <button
            onClick={onReset}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            aria-label="새 대화"
            title="새 대화"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 1 3.5 7.1" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
