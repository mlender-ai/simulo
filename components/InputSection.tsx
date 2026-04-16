/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useState,
  useEffect,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { t, type Locale } from "@/lib/i18n";
import { Tooltip } from "@/components/Tooltip";

export interface FlowStepInput {
  stepNumber: number;
  stepName: string;
  image: string;
}

export interface FigmaFrame {
  id: string;
  name: string;
  pageName: string;
}

export interface FigmaState {
  token: string;
  url: string;
  fileKey: string;
  fileName: string;
  frames: FigmaFrame[];
  selectedFrameIds: string[];
  status: "idle" | "validating" | "validated" | "error";
  error: string;
}

export interface ComparisonProductInput {
  productName: string;
  images: string[]; // base64
  description: string;
}

export type AnalysisPerspective = {
  usability: true; // always required
  desire: boolean;
  comparison: boolean;
  accessibility: boolean;
};

export interface ComparisonState {
  ours: ComparisonProductInput;
  competitors: ComparisonProductInput[];
  focus: string;
}

interface InputSectionProps {
  locale: Locale;
  images: string[];
  onImagesChange: (images: string[]) => void;
  hypothesis: string;
  onHypothesisChange: (value: string) => void;
  targetUser: string;
  onTargetUserChange: (value: string) => void;
  task: string;
  onTaskChange: (value: string) => void;
  projectTag: string;
  onProjectTagChange: (value: string) => void;
  activeTab: InputTab;
  onActiveTabChange: (tab: InputTab) => void;
  flowSteps: FlowStepInput[];
  onFlowStepsChange: (steps: FlowStepInput[]) => void;
  figma: FigmaState;
  onFigmaChange: (figma: FigmaState) => void;
  comparison: ComparisonState;
  onComparisonChange: (comparison: ComparisonState) => void;
  analysisPerspective: AnalysisPerspective;
  onAnalysisPerspectiveChange: (perspective: AnalysisPerspective) => void;
}

export type InputTab = "image" | "url" | "figma" | "flow" | "comparison";

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png", 0.85);
      resolve(dataUrl.split(",")[1]);
    };
    img.src = url;
  });
}

export function InputSection({
  locale,
  images,
  onImagesChange,
  hypothesis,
  onHypothesisChange,
  targetUser,
  onTargetUserChange,
  task,
  onTaskChange,
  projectTag,
  onProjectTagChange,
  activeTab,
  onActiveTabChange,
  flowSteps,
  onFlowStepsChange,
  figma,
  onFigmaChange,
  comparison,
  onComparisonChange,
  analysisPerspective,
  onAnalysisPerspectiveChange,
}: InputSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggingZone, setDraggingZone] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-fill Figma token from settings
  useEffect(() => {
    if (figma.token === "") {
      const saved = localStorage.getItem("simulo_figma_token");
      if (saved) {
        onFigmaChange({ ...figma, token: saved });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateFigma = useCallback(async () => {
    if (!figma.token || !figma.url) return;
    onFigmaChange({ ...figma, status: "validating", error: "", frames: [], selectedFrameIds: [], fileKey: "", fileName: "" });
    try {
      const res = await fetch("/api/figma-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl: figma.url, figmaToken: figma.token }),
      });
      const data = await res.json();
      if (!res.ok) {
        onFigmaChange({ ...figma, status: "error", error: data.error || "Validation failed", frames: [], selectedFrameIds: [] });
        return;
      }
      const allIds = data.frames.map((f: FigmaFrame) => f.id);
      onFigmaChange({
        ...figma,
        status: "validated",
        error: "",
        fileKey: data.fileKey,
        fileName: data.fileName,
        frames: data.frames,
        selectedFrameIds: allIds.slice(0, 8), // Select first 8 by default
      });
    } catch {
      onFigmaChange({ ...figma, status: "error", error: "Network error", frames: [], selectedFrameIds: [] });
    }
  }, [figma, onFigmaChange]);

  const toggleFigmaFrame = (id: string) => {
    const selected = figma.selectedFrameIds.includes(id)
      ? figma.selectedFrameIds.filter((fid) => fid !== id)
      : figma.selectedFrameIds.length < 8
        ? [...figma.selectedFrameIds, id]
        : figma.selectedFrameIds;
    onFigmaChange({ ...figma, selectedFrameIds: selected });
  };

  const handleFiles = useCallback(
    (files: FileList) => {
      const remaining = 8 - images.length;
      const toProcess = Array.from(files).slice(0, remaining);
      Promise.all(toProcess.map((file) => resizeImage(file, 1024))).then(
        (resized) => onImagesChange([...images, ...resized])
      );
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  // Flow step handlers
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

  // -------- Comparison handlers --------
  const updateOursName = (name: string) => {
    onComparisonChange({ ...comparison, ours: { ...comparison.ours, productName: name } });
  };

  const handleOursImages = (files: FileList) => {
    const remaining = 4 - comparison.ours.images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    Promise.all(toProcess.map((f) => resizeImage(f, 1024))).then((resized) => {
      onComparisonChange({
        ...comparison,
        ours: { ...comparison.ours, images: [...comparison.ours.images, ...resized] },
      });
    });
  };

  const removeOursImage = (index: number) => {
    onComparisonChange({
      ...comparison,
      ours: {
        ...comparison.ours,
        images: comparison.ours.images.filter((_, i) => i !== index),
      },
    });
  };

  const updateCompetitorName = (index: number, name: string) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, productName: name } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const handleCompetitorImages = (index: number, files: FileList) => {
    const comp = comparison.competitors[index];
    if (!comp) return;
    const remaining = 4 - comp.images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    Promise.all(toProcess.map((f) => resizeImage(f, 1024))).then((resized) => {
      const updated = comparison.competitors.map((c, i) =>
        i === index ? { ...c, images: [...c.images, ...resized] } : c
      );
      onComparisonChange({ ...comparison, competitors: updated });
    });
  };

  const removeCompetitorImage = (compIndex: number, imgIndex: number) => {
    const updated = comparison.competitors.map((c, i) =>
      i === compIndex ? { ...c, images: c.images.filter((_, j) => j !== imgIndex) } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const addCompetitor = () => {
    if (comparison.competitors.length >= 2) return;
    onComparisonChange({
      ...comparison,
      competitors: [
        ...comparison.competitors,
        { productName: "", images: [], description: "" },
      ],
    });
  };

  const updateOursDescription = (description: string) => {
    onComparisonChange({
      ...comparison,
      ours: { ...comparison.ours, description },
    });
  };

  const updateCompetitorDescription = (index: number, description: string) => {
    const updated = comparison.competitors.map((c, i) =>
      i === index ? { ...c, description } : c
    );
    onComparisonChange({ ...comparison, competitors: updated });
  };

  const removeCompetitor = (index: number) => {
    onComparisonChange({
      ...comparison,
      competitors: comparison.competitors.filter((_, i) => i !== index),
    });
  };

  const updateComparisonFocus = (focus: string) => {
    onComparisonChange({ ...comparison, focus });
  };

  const tabs: {
    key: InputTab;
    tooltipKey:
      | "tooltipImageUpload"
      | "tooltipUrl"
      | "tooltipFigma"
      | "tooltipFlow"
      | "tooltipComparison";
  }[] = [
    { key: "image", tooltipKey: "tooltipImageUpload" },
    { key: "url", tooltipKey: "tooltipUrl" },
    { key: "figma", tooltipKey: "tooltipFigma" },
    { key: "flow", tooltipKey: "tooltipFlow" },
    { key: "comparison", tooltipKey: "tooltipComparison" },
  ];

  const tabLabels: Record<InputTab, string> = {
    image: t("imageUpload", locale),
    url: t("url", locale),
    figma: t("figma", locale),
    flow: t("flow", locale),
    comparison: t("comparison", locale),
  };

  return (
    <div className="space-y-5">
      {/* Input Type Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-[var(--border)] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onActiveTabChange(tab.key)}
            className={`flex items-center px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === tab.key
                ? "bg-white/10 text-white"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {tabLabels[tab.key]}
            <Tooltip content={t(tab.tooltipKey, locale)} position="bottom" />
          </button>
        ))}
      </div>

      {/* Image Upload */}
      {activeTab === "image" && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging ? "border-white/40 bg-white/5" : "border-[var(--border)] hover:border-white/20"
            }`}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <p className="text-sm text-[var(--muted)]">{t("dropImages", locale)}</p>
            <p className="text-xs text-[var(--muted)] mt-1">{t("maxImages", locale)}</p>
            <input id="file-input" type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
          </div>
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group">
                  <img src={`data:image/png;base64,${img}`} alt={`Screen ${i + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs">
                    {t("remove", locale)}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* URL Tab */}
      {activeTab === "url" && (
        <div>
          <input type="url" placeholder={t("urlPlaceholder", locale)} className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30" />
          <p className="text-xs text-[var(--muted)] mt-2">{t("urlHint", locale)}</p>
        </div>
      )}

      {/* Figma Tab */}
      {activeTab === "figma" && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <input
                type="password"
                value={figma.token}
                onChange={(e) => onFigmaChange({ ...figma, token: e.target.value, status: "idle", error: "", frames: [], selectedFrameIds: [] })}
                placeholder={t("figmaTokenPlaceholder", locale)}
                className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
              />
              {figma.token && figma.token === localStorage.getItem("simulo_figma_token") && (
                <span className="text-xs text-emerald-400 shrink-0">{t("figmaTokenFromSettings", locale)}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={figma.url}
              onChange={(e) => onFigmaChange({ ...figma, url: e.target.value, status: "idle", error: "", frames: [], selectedFrameIds: [] })}
              placeholder={t("figmaUrlPlaceholder", locale)}
              className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
            />
            <button
              onClick={validateFigma}
              disabled={!figma.token || !figma.url || figma.status === "validating"}
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
                figma.token && figma.url && figma.status !== "validating"
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "bg-white/5 text-[var(--muted)] cursor-not-allowed"
              }`}
            >
              {figma.status === "validating" ? t("figmaValidating", locale) : t("figmaLoadFrames", locale)}
            </button>
          </div>

          {/* Error */}
          {figma.status === "error" && figma.error && (
            <div className="p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              {figma.error}
            </div>
          )}

          {/* Validated: show file info + frame list */}
          {figma.status === "validated" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-[var(--muted)]">{t("figmaFileName", locale)}:</span>
                <span className="font-medium">{figma.fileName}</span>
                <span className="text-[var(--muted)]">— {figma.frames.length}{t("figmaFrameCount", locale)}</span>
              </div>

              {figma.frames.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t("figmaNoFrames", locale)}</p>
              ) : (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-2">{t("figmaSelectFrames", locale)} (max 8)</p>
                  <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)]">
                    {figma.frames.map((frame) => {
                      const checked = figma.selectedFrameIds.includes(frame.id);
                      return (
                        <label
                          key={frame.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                            checked ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFigmaFrame(frame.id)}
                            className="accent-white"
                          />
                          <div className="min-w-0">
                            <span className="text-sm block truncate">{frame.name}</span>
                            <span className="text-xs text-[var(--muted)]">{frame.pageName}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1.5">
                    {figma.selectedFrameIds.length}/8 selected
                  </p>
                </div>
              )}
            </div>
          )}

          {figma.status === "idle" && (
            <p className="text-xs text-[var(--muted)]">{t("figmaHint", locale)}</p>
          )}
        </div>
      )}

      {/* Flow Tab */}
      {activeTab === "flow" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">{t("flowGuide", locale)}</p>

          {flowSteps.map((step, i) => (
            <div key={i} className="relative">
              {/* Connector arrow */}
              {i > 0 && (
                <div className="flex justify-center -mt-2 mb-2">
                  <div className="w-px h-6 bg-[var(--border)]" />
                </div>
              )}

              <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <div className="flex items-center gap-3 mb-3">
                  {/* Step badge */}
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

                {/* Image upload for this step */}
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
      )}

      {/* Comparison Tab */}
      {activeTab === "comparison" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">{t("comparisonGuide", locale)}</p>

          {/* Our product */}
          <div className="p-4 rounded-lg border border-white/20 bg-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-wider text-white/80">
                {t("ourProduct", locale)}
              </span>
            </div>
            <input
              value={comparison.ours.productName}
              onChange={(e) => updateOursName(e.target.value)}
              placeholder={t("productNamePlaceholder", locale)}
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 mb-3"
            />
            <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
              {t("productDescriptionLabel", locale)}
            </label>
            <textarea
              value={comparison.ours.description}
              onChange={(e) => updateOursDescription(e.target.value)}
              placeholder={t("oursDescriptionPlaceholder", locale)}
              rows={4}
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none mb-1.5"
            />
            <p className="text-xs text-[var(--muted)] mb-3">
              {t("productDescriptionHint", locale)}
            </p>
            <div
              className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                draggingZone === "cmp-ours"
                  ? "border-white/40 bg-white/5"
                  : "border-[var(--border)] hover:border-white/20"
              }`}
              onClick={() => document.getElementById("cmp-ours-file")?.click()}
              onDragOver={(e) => { e.preventDefault(); setDraggingZone("cmp-ours"); }}
              onDragLeave={() => setDraggingZone(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingZone(null);
                if (e.dataTransfer.files.length > 0) handleOursImages(e.dataTransfer.files);
              }}
            >
              <p className="text-xs text-[var(--muted)]">{t("dropImages", locale)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {comparison.ours.images.length}/4
              </p>
              <input
                id="cmp-ours-file"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleOursImages(e.target.files);
                }}
              />
            </div>
            {comparison.ours.images.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {comparison.ours.images.map((img, i) => (
                  <div
                    key={i}
                    className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group"
                  >
                    <img
                      src={`data:image/png;base64,${img}`}
                      alt={`Ours ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeOursImage(i)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                    >
                      {t("remove", locale)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Competitors */}
          {comparison.competitors.map((comp, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {t("competitorN", locale)} {i + 1}
                </span>
                <button
                  onClick={() => removeCompetitor(i)}
                  className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors"
                >
                  {t("remove", locale)}
                </button>
              </div>
              <input
                value={comp.productName}
                onChange={(e) => updateCompetitorName(i, e.target.value)}
                placeholder={t("competitorNamePlaceholder", locale)}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 mb-3"
              />
              <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                {t("productDescriptionLabel", locale)}
              </label>
              <textarea
                value={comp.description}
                onChange={(e) => updateCompetitorDescription(i, e.target.value)}
                placeholder={t("competitorDescriptionPlaceholder", locale)}
                rows={3}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none mb-3"
              />
              <div
                className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
                  draggingZone === `cmp-comp-${i}`
                    ? "border-white/40 bg-white/5"
                    : "border-[var(--border)] hover:border-white/20"
                }`}
                onClick={() => document.getElementById(`cmp-comp-file-${i}`)?.click()}
                onDragOver={(e) => { e.preventDefault(); setDraggingZone(`cmp-comp-${i}`); }}
                onDragLeave={() => setDraggingZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingZone(null);
                  if (e.dataTransfer.files.length > 0) handleCompetitorImages(i, e.dataTransfer.files);
                }}
              >
                <p className="text-xs text-[var(--muted)]">{t("dropImages", locale)}</p>
                <p className="text-xs text-[var(--muted)] mt-1">{comp.images.length}/4</p>
                <input
                  id={`cmp-comp-file-${i}`}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleCompetitorImages(i, e.target.files);
                  }}
                />
              </div>
              {comp.images.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {comp.images.map((img, j) => (
                    <div
                      key={j}
                      className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group"
                    >
                      <img
                        src={`data:image/png;base64,${img}`}
                        alt={`Competitor ${i + 1} ${j + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeCompetitorImage(i, j)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                      >
                        {t("remove", locale)}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {comparison.competitors.length < 2 && (
            <button
              onClick={addCompetitor}
              className="w-full py-2.5 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
            >
              {t("addCompetitor", locale)}
            </button>
          )}

          {/* Comparison focus */}
          <div>
            <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
              {t("comparisonFocus", locale)}
            </label>
            <input
              value={comparison.focus}
              onChange={(e) => updateComparisonFocus(e.target.value)}
              placeholder={t("comparisonFocusPlaceholder", locale)}
              className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
            />
          </div>
        </div>
      )}

      {/* Analysis perspective (checkboxes) */}
      <div className="pt-4 border-t border-[var(--border)]">
        <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
          {t("analysisPerspectiveTitle", locale)}
        </label>
        <p className="text-xs text-[var(--muted)] mb-3">
          {t("analysisPerspectiveHint", locale)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                key: "usability" as const,
                labelKey: "perspectiveUsability" as const,
                tooltipKey: "perspectiveUsabilityTooltip" as const,
                required: true,
                disabled: true,
                checked: true,
              },
              {
                key: "desire" as const,
                labelKey: "perspectiveDesire" as const,
                tooltipKey: "perspectiveDesireTooltip" as const,
                required: false,
                disabled: false,
                checked: analysisPerspective.desire,
              },
              {
                key: "comparison" as const,
                labelKey: "perspectiveComparison" as const,
                tooltipKey: "perspectiveComparisonTooltip" as const,
                required: activeTab === "comparison",
                disabled: activeTab === "comparison",
                checked:
                  activeTab === "comparison" ? true : analysisPerspective.comparison,
              },
              {
                key: "accessibility" as const,
                labelKey: "perspectiveAccessibility" as const,
                tooltipKey: "perspectiveAccessibilityTooltip" as const,
                required: false,
                disabled: false,
                checked: analysisPerspective.accessibility,
              },
            ]
          ).map((item) => (
            <label
              key={item.key}
              className={`flex flex-col gap-1.5 p-3 rounded-md border transition-colors ${
                item.checked
                  ? "border-white/20 bg-white/[0.04]"
                  : "border-[var(--border)] bg-white/[0.02]"
              } ${item.disabled ? "cursor-default" : "cursor-pointer hover:border-white/20"}`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={item.disabled}
                  onChange={(e) => {
                    if (item.key === "usability") return;
                    if (item.key === "comparison" && activeTab === "comparison") return;
                    onAnalysisPerspectiveChange({
                      ...analysisPerspective,
                      [item.key]: e.target.checked,
                    });
                  }}
                  className="accent-white"
                />
                <span className="text-sm">
                  {t(item.labelKey, locale)}
                  {item.required && (
                    <span className="ml-1 text-[11px] text-[var(--muted)]">
                      {t("perspectiveUsabilityRequired", locale)}
                    </span>
                  )}
                </span>
                <Tooltip content={t(item.tooltipKey, locale)} />
              </div>
              <div className="flex items-center gap-1.5 pl-6">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: item.checked ? "#86efac" : "#555" }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: item.checked ? "#86efac" : "#555",
                  }}
                >
                  {item.checked
                    ? t("perspectiveIncluded", locale)
                    : t("perspectiveExcluded", locale)}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Context Inputs */}
      <div className="space-y-3 pt-4 border-t border-[var(--border)]">
        <div>
          <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
            {t("hypothesis", locale)}
            <Tooltip content={t("tooltipHypothesis", locale)} />
          </label>
          <textarea
            value={hypothesis}
            onChange={(e) => onHypothesisChange(e.target.value)}
            placeholder={t("hypothesisPlaceholder", locale)}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30 resize-none"
          />
        </div>

        <div>
          <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
            {t("targetUser", locale)}
            <Tooltip content={t("tooltipTargetUser", locale)} />
          </label>
          <input
            value={targetUser}
            onChange={(e) => onTargetUserChange(e.target.value)}
            placeholder={t("targetUserPlaceholder", locale)}
            className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
          />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          {showAdvanced ? "- " : ""}{t("advancedOptions", locale)}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                {t("taskOptional", locale)}
                <Tooltip content={t("tooltipTask", locale)} />
              </label>
              <input
                value={task}
                onChange={(e) => onTaskChange(e.target.value)}
                placeholder={t("taskPlaceholder", locale)}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                {t("projectTagOptional", locale)}
                <Tooltip content={t("tooltipProjectTag", locale)} />
              </label>
              <input
                value={projectTag}
                onChange={(e) => onProjectTagChange(e.target.value)}
                placeholder={t("projectTagPlaceholder", locale)}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
