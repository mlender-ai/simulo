"use client";

import { type Locale, t } from "@/lib/i18n";

interface FlowToolbarProps {
  locale: Locale;
  flowName: string;
  onFlowNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
}

export function FlowToolbar({
  locale,
  flowName,
  onFlowNameChange,
  onSave,
  onLoad,
  onReset,
}: FlowToolbarProps) {
  return (
    <div className="h-12 border-b border-[var(--border)] bg-[var(--surface)] flex items-center px-4 gap-3 shrink-0">
      <span className="text-sm font-medium text-white/80 mr-2">
        {t("flowBuilder", locale)}
      </span>

      <input
        value={flowName}
        onChange={(e) => onFlowNameChange(e.target.value)}
        placeholder={t("fbFlowNamePlaceholder", locale)}
        className="px-2 py-1 bg-[var(--background)] border border-[var(--border)] rounded text-xs text-white/70 placeholder:text-white/20 outline-none w-48 focus:border-white/30"
      />

      <div className="flex-1" />

      <button
        onClick={onSave}
        className="px-3 py-1 rounded text-xs text-white/60 border border-[var(--border)] hover:bg-white/5 hover:text-white/80 transition-colors"
      >
        {t("fbSave", locale)}
      </button>
      <button
        onClick={onLoad}
        className="px-3 py-1 rounded text-xs text-white/60 border border-[var(--border)] hover:bg-white/5 hover:text-white/80 transition-colors"
      >
        {t("fbLoad", locale)}
      </button>
      <button
        onClick={onReset}
        className="px-3 py-1 rounded text-xs text-red-400/60 border border-red-400/20 hover:bg-red-400/10 hover:text-red-400 transition-colors"
      >
        {t("fbReset", locale)}
      </button>
    </div>
  );
}
