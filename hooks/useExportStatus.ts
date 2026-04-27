/**
 * useExportStatus — per-format 5-stage export state machine
 *
 * Stages: idle → validating → generating → ready → error
 * Each format tracks its own stage independently.
 */

import { useState, useCallback } from "react";

export type ExportStage = "idle" | "validating" | "generating" | "ready" | "error";

export type ExportFormat = "pdf" | "docx" | "png" | "md" | "jira";

export interface ExportStatus {
  stage: ExportStage;
  error?: string;
}

type StatusMap = Record<ExportFormat, ExportStatus>;

const INITIAL: StatusMap = {
  pdf: { stage: "idle" },
  docx: { stage: "idle" },
  png: { stage: "idle" },
  md: { stage: "idle" },
  jira: { stage: "idle" },
};

export function useExportStatus() {
  const [statuses, setStatuses] = useState<StatusMap>(INITIAL);

  const set = useCallback((format: ExportFormat, status: ExportStatus) => {
    setStatuses((prev) => ({ ...prev, [format]: status }));
  }, []);

  const transition = useCallback(
    (format: ExportFormat, stage: ExportStage, error?: string) => {
      set(format, { stage, error });
    },
    [set]
  );

  /** Run a full export lifecycle, returning the blob on success */
  const run = useCallback(
    async (
      format: ExportFormat,
      fetcher: () => Promise<Response>,
      onSuccess: (blob: Blob) => void
    ): Promise<void> => {
      transition(format, "validating");
      await new Promise((r) => setTimeout(r, 100)); // allow UI repaint

      let res: Response;
      try {
        transition(format, "generating");
        res = await fetcher();
      } catch (err) {
        transition(format, "error", err instanceof Error ? err.message : "네트워크 오류");
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        transition(format, "error", (json as { error?: string }).error || "내보내기에 실패했습니다");
        return;
      }

      const blob = await res.blob();
      transition(format, "ready");
      onSuccess(blob);

      // Reset to idle after brief success display
      setTimeout(() => transition(format, "idle"), 2000);
    },
    [transition]
  );

  const get = useCallback(
    (format: ExportFormat): ExportStatus => statuses[format],
    [statuses]
  );

  const isActive = useCallback(
    (format: ExportFormat): boolean => {
      const s = statuses[format].stage;
      return s === "validating" || s === "generating";
    },
    [statuses]
  );

  const clearError = useCallback(
    (format: ExportFormat) => transition(format, "idle"),
    [transition]
  );

  return { get, isActive, run, clearError, transition };
}
