"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  InputSection,
  type FlowStepInput,
  type InputTab,
  type FigmaState,
  type ComparisonState,
} from "@/components/InputSection";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Tooltip } from "@/components/Tooltip";
import { storage, type AnalysisResult } from "@/lib/storage";
import { getLocale, t, type Locale } from "@/lib/i18n";

const LOADING_STEP_KEYS = [
  "loadingStep1",
  "loadingStep2",
  "loadingStep3",
  "loadingStep4",
] as const;

const FLOW_LOADING_STEP_KEYS = [
  "flowLoadingStep1",
  "flowLoadingStep2",
  "loadingStep3",
  "loadingStep4",
] as const;

const COMPARISON_LOADING_STEP_KEYS = [
  "comparisonLoadingStep1",
  "comparisonLoadingStep2",
  "comparisonLoadingStep3",
  "loadingStep4",
] as const;

export default function Home() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ko");
  const [images, setImages] = useState<string[]>([]);
  const [hypothesis, setHypothesis] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [task, setTask] = useState("");
  const [projectTag, setProjectTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InputTab>("image");
  const [bannerOpen, setBannerOpen] = useState(false);
  const [flowSteps, setFlowSteps] = useState<FlowStepInput[]>([
    { stepNumber: 1, stepName: "", image: "" },
    { stepNumber: 2, stepName: "", image: "" },
  ]);
  const [figma, setFigma] = useState<FigmaState>({
    token: "",
    url: "",
    fileKey: "",
    fileName: "",
    frames: [],
    selectedFrameIds: [],
    status: "idle",
    error: "",
  });
  const [comparison, setComparison] = useState<ComparisonState>({
    ours: { productName: "", images: [] },
    competitors: [{ productName: "", images: [] }],
    focus: "",
  });

  useEffect(() => {
    setLocale(getLocale());
    const dismissed = localStorage.getItem("simulo_onboarding_dismissed");
    setBannerOpen(!dismissed);

    const handler = () => setBannerOpen(true);
    window.addEventListener("simulo:open-guide", handler);
    return () => window.removeEventListener("simulo:open-guide", handler);
  }, []);

  const isFlow = activeTab === "flow";
  const isFigma = activeTab === "figma";
  const isComparison = activeTab === "comparison";
  const flowReady = isFlow && flowSteps.length >= 2 && flowSteps.every((s) => s.image !== "");
  const figmaReady = isFigma && figma.status === "validated" && figma.selectedFrameIds.length > 0;
  const comparisonReady =
    isComparison &&
    comparison.ours.productName.trim() !== "" &&
    comparison.ours.images.length > 0 &&
    comparison.competitors.length > 0 &&
    comparison.competitors.every(
      (c) => c.productName.trim() !== "" && c.images.length > 0
    );
  const imageReady = !isFlow && !isFigma && !isComparison && images.length > 0;
  const canSubmit =
    (imageReady || flowReady || figmaReady || comparisonReady) &&
    hypothesis.trim() !== "" &&
    targetUser.trim() !== "";

  const loadingKeys = isComparison
    ? COMPARISON_LOADING_STEP_KEYS
    : isFlow
      ? FLOW_LOADING_STEP_KEYS
      : LOADING_STEP_KEYS;

  const handleAnalyze = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) =>
        prev < loadingKeys.length - 1 ? prev + 1 : prev
      );
    }, 3000);

    try {
      const savedApiKey = localStorage.getItem("simulo_anthropic_key");
      const savedModel = localStorage.getItem("simulo_model") || "haiku";

      const body = isComparison
        ? {
            hypothesis,
            targetUser,
            task: task || undefined,
            projectTag: projectTag || undefined,
            inputType: "comparison",
            locale,
            apiKey: savedApiKey || undefined,
            model: savedModel,
            ours: comparison.ours,
            competitors: comparison.competitors,
            comparisonFocus: comparison.focus || undefined,
          }
        : isFlow
          ? {
              flowSteps,
              hypothesis,
              targetUser,
              task: task || undefined,
              projectTag: projectTag || undefined,
              inputType: "flow",
              locale,
              apiKey: savedApiKey || undefined,
              model: savedModel,
            }
          : isFigma
            ? {
                hypothesis,
                targetUser,
                task: task || undefined,
                projectTag: projectTag || undefined,
                inputType: "figma",
                locale,
                apiKey: savedApiKey || undefined,
                model: savedModel,
                figmaToken: figma.token,
                figmaFileKey: figma.fileKey,
                figmaFrameIds: figma.selectedFrameIds,
              }
            : {
                images,
                hypothesis,
                targetUser,
                task: task || undefined,
                projectTag: projectTag || undefined,
                inputType: "image",
                locale,
                apiKey: savedApiKey || undefined,
                model: savedModel,
              };

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Analysis failed");
      }

      const result: AnalysisResult = await response.json();
      storage.save(result);
      router.push(`/report/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            {loadingKeys.map((key, i) => (
              <p
                key={key}
                className={`text-sm transition-opacity duration-500 ${
                  i <= loadingStep
                    ? "text-white opacity-100"
                    : "text-[var(--muted)] opacity-30"
                }`}
              >
                {i < loadingStep ? "✓" : i === loadingStep ? "→" : " "}{" "}
                {t(key, locale)}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-[720px]">
        <OnboardingBanner
          locale={locale}
          open={bannerOpen}
          onClose={() => {
            localStorage.setItem("simulo_onboarding_dismissed", "1");
            setBannerOpen(false);
          }}
        />

        {/* Section header row: 분석 대상 label + Guide button */}
        <div className="flex items-center justify-between mb-5">
          <span className="flex items-center text-xs text-[var(--muted)] uppercase tracking-wider">
            {t("analysisTarget", locale)}
            <Tooltip content={t("tooltipAnalysisTarget", locale)} />
          </span>
          {!bannerOpen && (
            <button
              onClick={() => setBannerOpen(true)}
              className="text-xs text-[var(--muted)] hover:text-white transition-colors"
            >
              Guide
            </button>
          )}
        </div>

        <InputSection
          locale={locale}
          images={images}
          onImagesChange={setImages}
          hypothesis={hypothesis}
          onHypothesisChange={setHypothesis}
          targetUser={targetUser}
          onTargetUserChange={setTargetUser}
          task={task}
          onTaskChange={setTask}
          projectTag={projectTag}
          onProjectTagChange={setProjectTag}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          flowSteps={flowSteps}
          onFlowStepsChange={setFlowSteps}
          figma={figma}
          onFigmaChange={setFigma}
          comparison={comparison}
          onComparisonChange={setComparison}
        />

        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!canSubmit}
          className={`mt-6 w-full py-3 rounded-md text-sm font-medium transition-colors ${
            canSubmit
              ? "bg-white text-black hover:bg-white/90"
              : "bg-white/10 text-[var(--muted)] cursor-not-allowed"
          }`}
        >
          {t("runAnalysis", locale)}
        </button>
      </div>
    </div>
  );
}
