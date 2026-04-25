"use client";

import { useMemo } from "react";
import {
  validateContextFields,
  isInputTabReady,
  type FieldErrors,
} from "@/lib/validation/inputSchema";
import type { InputTab, AnalysisMode, FlowStepInput } from "@/components/InputSection";
import type { UploadedVideo } from "@/components/MediaUploader";

interface UseInputValidationParams {
  mode: AnalysisMode;
  activeTab: InputTab;
  hypothesis: string;
  targetUser: string;
  images: string[];
  videos: UploadedVideo[];
  flowSteps: FlowStepInput[];
  showErrors: boolean;
}

interface UseInputValidationResult {
  fieldErrors: FieldErrors;
  inputReady: boolean;
  contextReady: boolean;
  isValid: boolean;
}

export function useInputValidation({
  mode,
  activeTab,
  hypothesis,
  targetUser,
  images,
  videos,
  flowSteps,
  showErrors,
}: UseInputValidationParams): UseInputValidationResult {
  const fieldErrors = useMemo<FieldErrors>(() => {
    if (!showErrors) return {};
    return validateContextFields(mode, hypothesis, targetUser);
  }, [showErrors, mode, hypothesis, targetUser]);

  const inputReady = useMemo(
    () => isInputTabReady(activeTab, images, videos, flowSteps),
    [activeTab, images, videos, flowSteps]
  );

  const contextReady = useMemo(() => {
    if (mode === "usability") return true;
    return hypothesis.trim().length > 0 && targetUser.trim().length > 0;
  }, [mode, hypothesis, targetUser]);

  return {
    fieldErrors,
    inputReady,
    contextReady,
    isValid: inputReady && contextReady,
  };
}
