/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { FlowStepInput } from "../InputSection";
import { resizeImage } from "./ImageUploadTab";

interface FlowInputTabProps {
  locale: Locale;
  flowSteps: FlowStepInput[];
  onFlowStepsChange: (steps: FlowStepInput[]) => void;
}

export function FlowInputTab({ locale, flowSteps, onFlowStepsChange }: FlowInputTabProps) {
  const [draggingZone, setDraggingZone] = useState<string | null>(null);

  const addFlowStep = () => {
    if (flowSteps.length >= 8) return;
    onFlowStepsChange([
      ...flowSteps,
      { stepNumber: flowSteps.length + 1, stepName: "", image: "" },
    ]);
  };

  const removeFlowStep = (index: number) => {
    if (flowSteps.length <= 2) return;
    const updated = flowSteps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stepNumber: i + 1 }));
    onFlowStepsChange(updated);
  };

  const updateFlowStepName = (index: number, name: string) => {
    const updated = [...flowSteps];
    updated[index] = { ...updated[index], stepName: name };
    onFlowStepsChange(updated);
  };

  const handleFlowStepImage = (index: number, files: FileList) => {
    if (files.length === 0) return;
    resizeImage(files[0], 1024).then((base64) => {
      const updated = [...flowSteps];
      updated[index] = { ...updated[index], image: base64 };
      onFlowStepsChange(updated);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">{t("flowGuide", locale)}</p>

      {flowSteps.map((step, i) => (
        <div key={i} className="relative">
          {i > 0 && (
            <div className="flex justify-center -mt-2 mb-2">
              <div className="w-px h-6 bg-[var(--border)]" />
            </div>
          )}

          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium shrink-0">
                {step.stepNumber}
              </div>
              <input
                value={step.stepName}
                onChange={(e) => updateFlowStepName(i, e.target.value)}
                placeholder={t("stepNamePlaceholder", locale)}
                className="flex-1 px-3 py-1.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
              />
              {flowSteps.length > 2 && (
                <button
                  onClick={() => removeFlowStep(i)}
                  className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors px-2"
                >
                  {t("remove", locale)}
                </button>
              )}
            </div>

            {step.image ? (
              <div className="relative w-full h-32 rounded border border-[var(--border)] overflow-hidden group">
                <img
                  src={`data:image/png;base64,${step.image}`}
                  alt={`${t("stepLabel", locale)} ${step.stepNumber}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => {
                    const updated = [...flowSteps];
                    updated[i] = { ...updated[i], image: "" };
                    onFlowStepsChange(updated);
                  }}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                >
                  {t("remove", locale)}
                </button>
              </div>
            ) : (
              <div
                className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                  draggingZone === `flow-${i}`
                    ? "border-white/40 bg-white/5"
                    : "border-[var(--border)] hover:border-white/20"
                }`}
                onClick={() => document.getElementById(`flow-file-${i}`)?.click()}
                onDragOver={(e) => { e.preventDefault(); setDraggingZone(`flow-${i}`); }}
                onDragLeave={() => setDraggingZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingZone(null);
                  if (e.dataTransfer.files.length > 0) handleFlowStepImage(i, e.dataTransfer.files);
                }}
              >
                <p className="text-xs text-[var(--muted)]">{t("dropImages", locale)}</p>
                <input
                  id={`flow-file-${i}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFlowStepImage(i, e.target.files);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {flowSteps.length < 8 && (
        <button
          onClick={addFlowStep}
          className="w-full py-2.5 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
        >
          {t("addStep", locale)}
        </button>
      )}
    </div>
  );
}
