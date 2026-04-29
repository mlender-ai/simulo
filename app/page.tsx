"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  InputSection,
  type FlowStepInput,
  type InputTab,
  type FigmaState,
  type ComparisonState,
  type AnalysisPerspective,
  type AnalysisMode,
  type AnalysisOptionsState,
  type UploadedVideo,
} from "@/components/InputSection";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Tooltip } from "@/components/Tooltip";
import { storage, type AnalysisResult } from "@/lib/storage";
import { getLocale, t, type Locale } from "@/lib/i18n";
import OCRReviewModal from "@/components/OCRReviewModal";
import type { OCRResult } from "@/lib/ocr";
import { type ProductMode, getProductMode, setProductMode as persistProductMode } from "@/lib/productMode";

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
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [screenDescription, setScreenDescription] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [task, setTask] = useState("");
  const [projectTag, setProjectTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InputTab>("image");
  const [urlInput, setUrlInput] = useState("");
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
    ours: { productName: "", images: [], videos: [], description: "" },
    competitors: [{ productName: "", images: [], videos: [], description: "" }],
    focus: "",
  });
  const [analysisPerspective, setAnalysisPerspective] = useState<AnalysisPerspective>({
    usability: true,
    desire: true,
    comparison: false,
    accessibility: true,
  });
  const [mode, setMode] = useState<AnalysisMode>("hypothesis");
  const [pendingOCRReview, setPendingOCRReview] = useState<{ results: OCRResult[]; images: string[]; body: Record<string, unknown> } | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptionsState>({
    usability: true,
    desireAlignment: true,
    competitorComparison: false,
    accessibility: false,
  });
  const [productMode, setProductModeState] = useState<ProductMode>("yafit");

  const handleProductModeChange = (m: ProductMode) => {
    setProductModeState(m);
    persistProductMode(m);
    if (m === "general") {
      // Disable yafit-specific options
      setAnalysisOptions((prev) => ({
        ...prev,
        desireAlignment: false,
        accessibility: false,
      }));
    }
  };

  useEffect(() => {
    setLocale(getLocale());
    setProductModeState(getProductMode());
    const dismissed = localStorage.getItem("simulo_onboarding_dismissed");
    setBannerOpen(!dismissed);

    // Restore params from re-analyze
    const reanalyzeRaw = sessionStorage.getItem("simulo_reanalyze");
    if (reanalyzeRaw) {
      sessionStorage.removeItem("simulo_reanalyze");
      try {
        const params = JSON.parse(reanalyzeRaw);
        if (params.hypothesis) setHypothesis(params.hypothesis);
        if (params.targetUser) setTargetUser(params.targetUser);
        if (params.task) setTask(params.task);
        if (params.projectTag) setProjectTag(params.projectTag);
        if (params.mode) setMode(params.mode);
        if (params.inputType === "flow") setActiveTab("flow");
        else if (params.inputType === "figma") setActiveTab("figma");
        else if (params.inputType === "comparison") setActiveTab("comparison");
        else if (params.inputType === "url") setActiveTab("url");
        else setActiveTab("image");

        // Hydrate images from IndexedDB so the user doesn't have to re-upload
        if (params.analysisId && params.inputType === "image") {
          storage.getByIdWithImages(params.analysisId).then((analysis) => {
            if (!analysis) return;
            const imgs = (analysis.thumbnailUrls ?? []).filter(
              (u) => u && u !== "__stripped__"
            );
            if (imgs.length > 0) setImages(imgs);
          });
        } else if (params.analysisId && params.inputType === "flow") {
          storage.getByIdWithImages(params.analysisId).then((analysis) => {
            if (!analysis?.flowSteps?.length) return;
            setFlowSteps(
              analysis.flowSteps.map((s, i) => ({
                stepNumber: s.stepNumber ?? i + 1,
                stepName: s.stepName ?? "",
                image: s.image ?? "",
              }))
            );
          });
        }
      } catch { /* ignore parse errors */ }
    }

    const guideHandler = () => setBannerOpen(true);
    window.addEventListener("simulo:open-guide", guideHandler);
    return () => window.removeEventListener("simulo:open-guide", guideHandler);
  }, []);

  const isUrl = activeTab === "url";
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
  const urlReady = isUrl && urlInput.trim().length > 0;
  const imageReady = !isFlow && !isFigma && !isComparison && !isUrl && images.length > 0;
  const inputReady = imageReady || urlReady || flowReady || figmaReady || comparisonReady;
  const contextReady =
    mode === "usability"
      ? true
      : hypothesis.trim() !== "" && targetUser.trim() !== "";
  const canSubmit = inputReady && contextReady;

  const validationErrors: string[] = [];
  if (showErrors && !canSubmit) {
    if (!inputReady) {
      if (isFlow) validationErrors.push("플로우 단계마다 이미지를 업로드해주세요 (최소 2단계)");
      else if (isFigma) validationErrors.push("Figma 프레임을 1개 이상 선택해주세요");
      else if (isComparison) validationErrors.push("자사/경쟁사 제품명과 이미지를 모두 입력해주세요");
      else if (isUrl) validationErrors.push("분석할 URL을 입력해주세요");
      else validationErrors.push("화면 이미지를 1장 이상 업로드해주세요");
    }
    if (mode === "hypothesis") {
      if (!hypothesis.trim()) validationErrors.push("가설을 입력해주세요");
      if (!targetUser.trim()) validationErrors.push("타깃 유저를 입력해주세요");
    }
  }

  const loadingKeys = isComparison
    ? COMPARISON_LOADING_STEP_KEYS
    : isFlow
      ? FLOW_LOADING_STEP_KEYS
      : LOADING_STEP_KEYS;

  const buildAnalysisBody = (ocrReview?: OCRResult[]) => {
    const savedApiKey = localStorage.getItem("simulo_anthropic_key");
    const savedModel = localStorage.getItem("simulo_model") || "haiku";
    const effectivePerspective = isComparison
      ? { ...analysisPerspective, comparison: true }
      : analysisPerspective;
    const commonBody = {
      hypothesis: mode === "usability" ? undefined : hypothesis,
      targetUser: targetUser || undefined,
      task: task || undefined,
      projectTag: projectTag || undefined,
      screenDescription: screenDescription || undefined,
      locale,
      apiKey: savedApiKey || undefined,
      model: savedModel,
      mode,
      analysisOptions: mode === "usability" ? analysisOptions : undefined,
      analysisPerspective: effectivePerspective,
      productMode,
      ...(ocrReview ? { ocrReview } : {}),
    };
    return isComparison
      ? { ...commonBody, inputType: "comparison", ours: comparison.ours, competitors: comparison.competitors, comparisonFocus: comparison.focus || undefined }
      : isFlow
        ? { ...commonBody, inputType: "flow", flowSteps }
        : isFigma
          ? { ...commonBody, inputType: "figma", figmaToken: figma.token, figmaFileKey: figma.fileKey, figmaFrameIds: figma.selectedFrameIds }
          : isUrl
            ? { ...commonBody, inputType: "url", url: urlInput }
            : { ...commonBody, inputType: "image", images, videos };
  };

  const runAnalysis = async (body: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => prev < loadingKeys.length - 1 ? prev + 1 : prev);
    }, 3000);
    try {
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

  const handleAnalyze = async () => {
    if (!canSubmit) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);

    const ocrReviewEnabled = localStorage.getItem("simulo_ocr_review") === "true";
    const isImageMode = !isComparison && !isFlow && !isFigma && images.length > 0;

    if (ocrReviewEnabled && isImageMode) {
      // OCR review mode: extract text first, show review modal, then analyze
      setOcrLoading(true);
      setError(null);
      try {
        const savedApiKey = localStorage.getItem("simulo_anthropic_key");
        const ocrRes = await fetch("/api/ocr-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images, locale, apiKey: savedApiKey || undefined }),
        });
        if (!ocrRes.ok) throw new Error("OCR extraction failed");
        const { ocrResults } = await ocrRes.json();
        setPendingOCRReview({ results: ocrResults, images, body: buildAnalysisBody() as Record<string, unknown> });
      } catch (err) {
        // OCR failure — fall through to direct analysis
        console.warn("OCR extraction failed, proceeding without review:", err);
        await runAnalysis(buildAnalysisBody() as Record<string, unknown>);
      } finally {
        setOcrLoading(false);
      }
      return;
    }

    await runAnalysis(buildAnalysisBody() as Record<string, unknown>);
  };

  const handleOCRConfirm = async (reviewedOCR: OCRResult[]) => {
    setPendingOCRReview(null);
    await runAnalysis(buildAnalysisBody(reviewedOCR) as Record<string, unknown>);
  };

  if (ocrLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white">텍스트를 추출하고 있습니다...</p>
          <p className="text-xs text-[var(--muted)]">OCR Pass (claude-opus-4-7)</p>
        </div>
      </div>
    );
  }

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
    <>
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

        {/* Product mode toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-[var(--border)]">
            {([
              { key: "yafit" as const, label: "야핏무브" },
              { key: "general" as const, label: "일반 서비스" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleProductModeChange(key)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  productMode === key
                    ? "bg-white text-black"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!bannerOpen && (
            <button
              onClick={() => setBannerOpen(true)}
              className="text-xs text-[var(--muted)] hover:text-white transition-colors"
            >
              Guide
            </button>
          )}
        </div>

        {/* Section header row: 분석 대상 label */}
        <div className="flex items-center justify-between mb-5">
          <span className="flex items-center text-xs text-[var(--muted)] uppercase tracking-wider">
            {t("analysisTarget", locale)}
            <Tooltip content={t("tooltipAnalysisTarget", locale)} />
          </span>
        </div>

        <InputSection
          locale={locale}
          images={images}
          onImagesChange={setImages}
          videos={videos}
          onVideosChange={setVideos}
          screenDescription={screenDescription}
          onScreenDescriptionChange={setScreenDescription}
          urlInput={urlInput}
          onUrlInputChange={setUrlInput}
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
          analysisPerspective={analysisPerspective}
          onAnalysisPerspectiveChange={setAnalysisPerspective}
          mode={mode}
          onModeChange={setMode}
          analysisOptions={analysisOptions}
          onAnalysisOptionsChange={setAnalysisOptions}
          showErrors={showErrors}
          inputReady={inputReady}
          contextReady={contextReady}
          productMode={productMode}
        />

        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="mt-4 p-3 rounded-md border" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: "#f87171" }}>필수 항목을 입력해주세요</p>
            <ul className="space-y-1">
              {validationErrors.map((msg, i) => (
                <li key={i} className="flex items-center gap-1.5 text-sm" style={{ color: "#f87171" }}>
                  <span style={{ fontSize: 10 }}>●</span>
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={ocrLoading}
          className="mt-4 w-full py-3 rounded-md text-sm font-medium transition-colors bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-[var(--muted)] disabled:cursor-not-allowed"
        >
          {ocrLoading ? "텍스트 추출 중..." : t("runAnalysis", locale)}
        </button>
      </div>
    </div>
    {pendingOCRReview && (
      <OCRReviewModal
        ocrResults={pendingOCRReview.results}
        images={pendingOCRReview.images}
        onConfirm={handleOCRConfirm}
        onCancel={() => setPendingOCRReview(null)}
      />
    )}
    </>
  );
}
