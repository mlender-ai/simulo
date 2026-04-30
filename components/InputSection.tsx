/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import { t, tMode, type Locale } from "@/lib/i18n";
import type { ProductMode } from "@/lib/productMode";
import { getDomainFocuses } from "@/lib/domainFocuses";
import { HYPOTHESIS_TEMPLATES } from "@/lib/hypothesisTemplates";
import { Tooltip } from "@/components/Tooltip";
import { ImageUploadTab } from "./input/ImageUploadTab";
import { FigmaTab } from "./input/FigmaTab";
import { FlowInputTab } from "./input/FlowInputTab";
import { ComparisonTab } from "./input/ComparisonTab";
import { useInputValidation } from "@/hooks/useInputValidation";
export type { UploadedVideo, VideoFrame } from "./MediaUploader";

// ─── Re-exported types (used by parent components) ──────────────────

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
  videos: import("./MediaUploader").UploadedVideo[];
  description?: string;
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

export type InputTab = "image" | "url" | "figma" | "flow" | "comparison";

export type AnalysisMode = "hypothesis" | "usability";

export interface AnalysisOptionsState {
  usability: boolean;
  desireAlignment: boolean;
  competitorComparison: boolean;
  accessibility: boolean;
}

interface InputSectionProps {
  locale: Locale;
  images: string[];
  onImagesChange: (images: string[]) => void;
  videos: import("./MediaUploader").UploadedVideo[];
  onVideosChange: (videos: import("./MediaUploader").UploadedVideo[]) => void;
  screenDescription: string;
  onScreenDescriptionChange: (value: string) => void;
  urlInput: string;
  onUrlInputChange: (value: string) => void;
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
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  analysisOptions: AnalysisOptionsState;
  onAnalysisOptionsChange: (options: AnalysisOptionsState) => void;
  showErrors?: boolean;
  inputReady?: boolean;
  contextReady?: boolean;
  productMode?: ProductMode;
  domain?: string;
  onDomainChange?: (domain: string) => void;
  domainFocuses?: string[];
  onDomainFocusesChange?: (focuses: string[]) => void;
}

export function InputSection({
  locale,
  images,
  onImagesChange,
  videos,
  onVideosChange,
  screenDescription,
  onScreenDescriptionChange,
  urlInput,
  onUrlInputChange,
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
  mode,
  onModeChange,
  analysisOptions,
  onAnalysisOptionsChange,
  showErrors = false,
  inputReady: inputReadyProp = false,
  contextReady: contextReadyProp = false,
  productMode = "yafit",
  domain = "",
  onDomainChange,
  domainFocuses = [],
  onDomainFocusesChange,
}: InputSectionProps) {
  const isGeneral = productMode === "general";
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { fieldErrors, inputReady, contextReady } = useInputValidation({
    mode,
    activeTab,
    hypothesis,
    targetUser,
    images,
    videos,
    flowSteps,
    showErrors,
  });

  // Allow parent override (backward compat)
  const resolvedInputReady = inputReadyProp || inputReady;
  const resolvedContextReady = contextReadyProp || contextReady;

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

      {/* Tab content */}
      {activeTab === "image" && (
        <ImageUploadTab locale={locale} images={images} onImagesChange={onImagesChange} videos={videos} onVideosChange={onVideosChange} description={screenDescription} onDescriptionChange={onScreenDescriptionChange} showError={showErrors && !resolvedInputReady} />
      )}

      {activeTab === "url" && (
        <div className="space-y-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => onUrlInputChange(e.target.value)}
            placeholder={t("urlPlaceholder", locale)}
            className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
          />
          <p className="text-xs text-[var(--muted)]">{t("tooltipUrl", locale)}</p>
        </div>
      )}

      {activeTab === "figma" && (
        <FigmaTab locale={locale} figma={figma} onFigmaChange={onFigmaChange} />
      )}

      {activeTab === "flow" && (
        <FlowInputTab locale={locale} flowSteps={flowSteps} onFlowStepsChange={onFlowStepsChange} />
      )}

      {activeTab === "comparison" && (
        <ComparisonTab locale={locale} comparison={comparison} onComparisonChange={onComparisonChange} />
      )}

      {/* Domain category — general mode only */}
      {isGeneral && (
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          <div>
            <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
              서비스 도메인 <span className="normal-case font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "ecommerce", label: "이커머스/쇼핑" },
                { key: "fintech", label: "금융/핀테크" },
                { key: "health", label: "헬스/피트니스" },
                { key: "social", label: "소셜/커뮤니티" },
                { key: "saas", label: "SaaS/생산성" },
                { key: "travel", label: "여행/숙박" },
                { key: "education", label: "교육" },
                { key: "other", label: "기타" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const next = domain === key ? "" : key;
                    onDomainChange?.(next);
                    // auto-select all focuses for the new domain
                    if (next) {
                      const items = getDomainFocuses(next);
                      onDomainFocusesChange?.(items.map((i) => i.key));
                    } else {
                      onDomainFocusesChange?.([]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                    domain === key
                      ? "border-white/50 bg-white/10 text-white"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Domain focus checkboxes */}
          {domain && (() => {
            const focuses = getDomainFocuses(domain);
            return (
              <div>
                <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
                  집중 분석 영역
                  <span className="ml-1.5 normal-case font-normal text-[10px]">
                    — 선택한 항목을 AI가 집중 관찰합니다
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {focuses.map((item) => {
                    const checked = domainFocuses.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                          checked
                            ? "border-white/20 bg-white/[0.04] text-white"
                            : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:text-white hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...domainFocuses, item.key]
                              : domainFocuses.filter((k) => k !== item.key);
                            onDomainFocusesChange?.(next);
                          }}
                          className="mt-0.5 accent-white flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-medium">{item.label}</span>
                          <span className="ml-1.5 text-[11px] text-[var(--muted)]">{item.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
                yafitOnly: false,
              },
              {
                key: "desire" as const,
                labelKey: "perspectiveDesire" as const,
                tooltipKey: "perspectiveDesireTooltip" as const,
                required: false,
                disabled: false,
                checked: analysisPerspective.desire,
                yafitOnly: true,
              },
              {
                key: "comparison" as const,
                labelKey: "perspectiveComparison" as const,
                tooltipKey: "perspectiveComparisonTooltip" as const,
                required: activeTab === "comparison",
                disabled: activeTab === "comparison",
                checked:
                  activeTab === "comparison" ? true : analysisPerspective.comparison,
                yafitOnly: false,
              },
              {
                key: "accessibility" as const,
                labelKey: "perspectiveAccessibility" as const,
                tooltipKey: "perspectiveAccessibilityTooltip" as const,
                required: false,
                disabled: false,
                checked: analysisPerspective.accessibility,
                yafitOnly: true,
              },
            ]
          ).filter((item) => !item.yafitOnly || !isGeneral).map((item) => (
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


      {/* Mode selector */}
      <div className="pt-4 border-t border-[var(--border)]">
        <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
          {t("analysisMode", locale)}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["hypothesis", "usability"] as const).map((m) => {
            const selected = mode === m;
            const title = m === "hypothesis" ? t("modeHypothesis", locale) : t("modeUsability", locale);
            const desc = m === "hypothesis" ? t("modeHypothesisDesc", locale) : t("modeUsabilityDesc", locale);
            return (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`text-left px-4 py-3 rounded-md border transition-colors ${
                  selected
                    ? "border-white bg-[#1a1a1a] text-white"
                    : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:text-white hover:border-white/30"
                }`}
              >
                <div className="text-sm font-medium mb-0.5">
                  {selected ? "✓ " : ""}
                  {title}
                </div>
                <div className="text-xs opacity-70">{desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Context Inputs */}
      <div className="space-y-3">
        {mode === "hypothesis" && (
          <div>
            {(() => {
              const hasErr = !!fieldErrors.hypothesis;
              return (
                <>
                  <label
                    className="flex items-center text-xs mb-1.5 uppercase tracking-wider"
                    style={{ color: hasErr ? "#f87171" : "var(--muted)" }}
                  >
                    {t("hypothesis", locale)}
                    {hasErr && <span className="ml-1 normal-case font-normal">— {fieldErrors.hypothesis}</span>}
                    <Tooltip content={t("tooltipHypothesis", locale)} />
                    <HypothesisTemplateButton onSelect={onHypothesisChange} />
                  </label>
                  <textarea
                    value={hypothesis}
                    onChange={(e) => onHypothesisChange(e.target.value)}
                    placeholder={tMode("hypothesisPlaceholder", locale, productMode)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/[0.03] rounded-md text-sm focus:outline-none resize-none transition-colors"
                    style={{
                      border: `1px solid ${hasErr ? "rgba(239,68,68,0.6)" : "var(--border)"}`,
                    }}
                  />
                </>
              );
            })()}
          </div>
        )}

        <div>
          {(() => {
            const hasErr = !!fieldErrors.targetUser;
            return (
              <>
                <label
                  className="flex items-center mb-1.5 uppercase tracking-wider text-xs"
                  style={{ color: hasErr ? "#f87171" : "var(--muted)" }}
                >
                  {mode === "usability" ? t("targetUserOptional", locale) : t("targetUser", locale)}
                  {hasErr && <span className="ml-1 normal-case font-normal">— {fieldErrors.targetUser}</span>}
                  <Tooltip content={t("tooltipTargetUser", locale)} />
                </label>
                <input
                  value={targetUser}
                  onChange={(e) => onTargetUserChange(e.target.value)}
                  placeholder={
                    mode === "usability"
                      ? tMode("targetUserOptionalPlaceholder", locale, productMode)
                      : tMode("targetUserPlaceholder", locale, productMode)
                  }
                  className="w-full px-4 py-2.5 bg-white/[0.03] rounded-md text-sm focus:outline-none transition-colors"
                  style={{
                    border: `1px solid ${hasErr ? "rgba(239,68,68,0.6)" : "var(--border)"}`,
                  }}
                />
              </>
            );
          })()}
        </div>

        {mode === "usability" && (
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
              {t("analysisOptions", locale)}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "usability", labelKey: "optionUsability", locked: true, yafitOnly: false },
                  { key: "desireAlignment", labelKey: "optionDesireAlignment", locked: false, yafitOnly: true },
                  { key: "competitorComparison", labelKey: "optionCompetitorComparison", locked: false, yafitOnly: false },
                  { key: "accessibility", labelKey: "optionAccessibility", locked: false, yafitOnly: true },
                ] as const
              ).filter((opt) => !opt.yafitOnly || productMode === "yafit").map((opt) => {
                const checked = analysisOptions[opt.key];
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                      opt.locked
                        ? "border-[var(--border)] bg-white/[0.03] text-[var(--muted)] cursor-not-allowed"
                        : checked
                          ? "border-white/50 bg-white/[0.05] text-white cursor-pointer"
                          : "border-[var(--border)] bg-transparent text-[var(--muted)] hover:text-white hover:border-white/30 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={opt.locked}
                      onChange={(e) =>
                        onAnalysisOptionsChange({
                          ...analysisOptions,
                          [opt.key]: e.target.checked,
                        })
                      }
                      className="accent-white"
                    />
                    <span>{t(opt.labelKey, locale)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          {showAdvanced ? "- " : ""}{t("advancedOptions", locale)}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3">
            {mode === "hypothesis" && (
              <div>
                <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                  {t("taskOptional", locale)}
                  <Tooltip content={t("tooltipTask", locale)} />
                </label>
                <input
                  value={task}
                  onChange={(e) => onTaskChange(e.target.value)}
                  placeholder={tMode("taskPlaceholder", locale, productMode)}
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
                />
              </div>
            )}
            <div className={mode === "hypothesis" ? "" : "col-span-2"}>
              <label className="flex items-center text-xs text-[var(--muted)] mb-1.5 uppercase tracking-wider">
                {t("projectTagOptional", locale)}
                <Tooltip content={t("tooltipProjectTag", locale)} />
              </label>
              <input
                value={projectTag}
                onChange={(e) => onProjectTagChange(e.target.value)}
                placeholder={tMode("projectTagPlaceholder", locale, productMode)}
                className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hypothesis Template Picker ────────────────────────────────────────────
function HypothesisTemplateButton({ onSelect }: { onSelect: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-2 px-2 py-0.5 text-[10px] rounded border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors normal-case tracking-normal"
      >
        템플릿
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-lg border border-[var(--border)] bg-[#111] shadow-xl"
          style={{ width: 340 }}
        >
          {/* Category tabs */}
          <div className="flex overflow-x-auto gap-1 p-2 border-b border-[var(--border)] scrollbar-hide">
            {HYPOTHESIS_TEMPLATES.map((cat, i) => (
              <button
                key={cat.category}
                type="button"
                onClick={() => setActiveCat(i)}
                className={`shrink-0 px-2.5 py-1 text-[10px] rounded transition-colors ${
                  activeCat === i
                    ? "bg-white/10 text-white"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {cat.category}
              </button>
            ))}
          </div>
          {/* Templates */}
          <div className="p-2 space-y-1">
            {HYPOTHESIS_TEMPLATES[activeCat]?.templates.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => { onSelect(tpl.text); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-white/5 transition-colors group"
              >
                <div className="text-[11px] text-white/50 group-hover:text-white/70 mb-0.5">{tpl.label}</div>
                <div className="text-xs text-[var(--muted)] group-hover:text-white/60 leading-relaxed">{tpl.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
