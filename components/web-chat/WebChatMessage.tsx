"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { WebMiniReport, type MiniReportData } from "./WebMiniReport";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatMsg {
  id: string;
  role: "bot" | "user" | "system";
  content: string;
  labels?: Array<{ id: string; name: string }>;
  actions?: Array<{ id: string; label: string; primary?: boolean }>;
  miniReport?: MiniReportData;
  streaming?: boolean;
}

interface Props {
  msg: ChatMsg;
  onLabelClick: (labelId: string) => void;
  onActionClick: (actionId: string) => void;
}

// ── Markdown components ───────────────────────────────────────────────────────

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-white/90 font-semibold text-sm mt-3 mb-1">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-white/85 font-medium text-sm mt-2 mb-1">{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="text-white/75">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="text-white/95 font-semibold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="text-white/70 italic">{children}</em>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-2 border-white/20 pl-3 text-white/60 italic my-1">{children}</blockquote>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="px-1 py-0.5 bg-white/10 rounded text-xs mono">{children}</code>,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function WebChatMessage({ msg, onLabelClick, onActionClick }: Props) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<string | null>(null);

  const handleActionClick = useCallback(
    (actionId: string) => {
      onActionClick(actionId);
      if (actionId === "copy") {
        setSuccessAction(actionId);
        setTimeout(() => setSuccessAction(null), 1500);
      }
    },
    [onActionClick]
  );

  // System message
  if (msg.role === "system") {
    return (
      <div className="chat-anim-system text-center text-xs text-white/30 py-1 select-none">
        {msg.content}
      </div>
    );
  }

  // User message
  if (msg.role === "user") {
    return (
      <div className="chat-anim-user flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-white/10 text-sm text-white/90">
          {msg.content}
        </div>
      </div>
    );
  }

  // Bot message
  return (
    <div className="chat-anim-bot flex flex-col gap-2 max-w-[90%]">
      {/* Streaming: typing indicator → streaming cursor */}
      {msg.streaming ? (
        msg.content ? (
          <div className="streaming-cursor markdown-chat">
            <ReactMarkdown components={markdownComponents}>
              {msg.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="px-1 py-2">
            <span className="inline-flex items-center gap-[5px] px-3.5 py-2 rounded-2xl bg-white/[0.04]">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )
      ) : (
        <>
          {msg.content && (
            <div className="markdown-chat">
              <ReactMarkdown components={markdownComponents}>
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </>
      )}

      {/* Mini report */}
      {msg.miniReport && !msg.streaming && (
        <WebMiniReport data={msg.miniReport} />
      )}

      {/* Labels with stagger + selection interaction */}
      {msg.labels && msg.labels.length > 0 && !msg.streaming && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {msg.labels.map((label, i) => {
            const isSelected = selectedLabel === label.id;
            const isDismissed = selectedLabel !== null && !isSelected;
            return (
              <button
                key={label.id}
                onClick={() => {
                  if (selectedLabel) return;
                  setSelectedLabel(label.id);
                  setTimeout(() => onLabelClick(label.id), 280);
                }}
                disabled={!!selectedLabel}
                className={`chat-label-enter px-3 py-1.5 text-xs border rounded-full transition-all duration-150 ${
                  isSelected
                    ? "chat-label-selected border-white/30 text-white/90 bg-white/15"
                    : isDismissed
                      ? "chat-label-dismissed border-white/10 text-white/60"
                      : "border-white/10 text-white/60 hover:text-white/90 hover:border-white/25 hover:bg-white/5 hover:-translate-y-px active:scale-[0.97]"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Actions with CTA feedback */}
      {msg.actions && msg.actions.length > 0 && !msg.streaming && (
        <div className="flex flex-wrap gap-2 mt-1">
          {msg.actions.map((action) => {
            const isSuccess = successAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-all duration-150 hover:-translate-y-px active:scale-[0.97] ${
                  isSuccess
                    ? "cta-success border border-white/10"
                    : action.primary
                      ? "bg-[#0f1f0f] border border-[#2a4a2a] text-[#a3e635] hover:bg-[#162816]"
                      : "bg-white/5 border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/10"
                }`}
              >
                {isSuccess ? "✓ 복사됨" : action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
