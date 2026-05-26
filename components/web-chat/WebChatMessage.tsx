"use client";

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

// ── Component ──────────────────────────────────────────────────────────────────

export function WebChatMessage({ msg, onLabelClick, onActionClick }: Props) {
  // System message
  if (msg.role === "system") {
    return (
      <div className="text-center text-xs text-white/30 py-1 select-none">
        {msg.content}
      </div>
    );
  }

  // User message
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-white/10 text-sm text-white/90">
          {msg.content}
        </div>
      </div>
    );
  }

  // Bot message
  return (
    <div className="flex flex-col gap-2 max-w-[90%]">
      {/* Streaming indicator or content */}
      {msg.streaming ? (
        <div className="px-1 py-2">
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse [animation-delay:300ms]" />
          </span>
        </div>
      ) : (
        <>
          {msg.content && (
            <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>
          )}
        </>
      )}

      {/* Mini report */}
      {msg.miniReport && !msg.streaming && (
        <WebMiniReport data={msg.miniReport} />
      )}

      {/* Labels */}
      {msg.labels && msg.labels.length > 0 && !msg.streaming && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {msg.labels.map((label) => (
            <button
              key={label.id}
              onClick={() => onLabelClick(label.id)}
              className="px-3 py-1.5 text-xs text-white/60 border border-white/10 rounded-full hover:text-white/90 hover:border-white/25 hover:bg-white/5 transition-colors"
            >
              {label.name}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      {msg.actions && msg.actions.length > 0 && !msg.streaming && (
        <div className="flex flex-wrap gap-2 mt-1">
          {msg.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => onActionClick(action.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                action.primary
                  ? "bg-[#0f1f0f] border border-[#2a4a2a] text-[#a3e635] hover:bg-[#162816]"
                  : "bg-white/5 border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/10"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
