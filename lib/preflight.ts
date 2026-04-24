/**
 * Pre-flight Validation Layer
 *
 * Validates incoming images and OCR inputs before expensive Claude calls.
 * Returns structured errors so the caller can return a 400 with clear diagnostics.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PreflightError {
  code: string;
  message: string;
  index?: number;
}

export interface PreflightResult {
  ok: boolean;
  errors: PreflightError[];
  warnings: PreflightWarning[];
}

export interface PreflightWarning {
  code: string;
  message: string;
  index?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max base64 length per image (~10 MB decoded) */
const MAX_IMAGE_B64_LENGTH = 14_000_000;

/** Min base64 length — below this the image is probably empty or corrupt */
const MIN_IMAGE_B64_LENGTH = 100;

/** Supported image MIME prefixes */
const SUPPORTED_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/webp;base64,",
  "data:image/gif;base64,",
];

/** Max number of images per request */
const MAX_IMAGE_COUNT = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectFormat(dataUrl: string): string | null {
  for (const prefix of SUPPORTED_PREFIXES) {
    if (dataUrl.startsWith(prefix)) return prefix.split("/")[1].split(";")[0];
  }
  // Raw base64 without data URL prefix — client always produces PNG via canvas.toDataURL
  if (!dataUrl.startsWith("data:") && /^[A-Za-z0-9+/]+=*$/.test(dataUrl.slice(0, 64))) {
    return "png";
  }
  return null;
}

function isBase64Payload(dataUrl: string): boolean {
  const base64Part = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  if (!base64Part || base64Part.length < MIN_IMAGE_B64_LENGTH) return false;
  // Quick structural check: base64 chars only
  return /^[A-Za-z0-9+/]+=*$/.test(base64Part.slice(0, 64));
}

// ── Validators ────────────────────────────────────────────────────────────────

/**
 * Validate a list of base64 image data-URLs.
 * Returns errors for hard failures and warnings for soft issues.
 */
export function validateImages(images: string[]): PreflightResult {
  const errors: PreflightError[] = [];
  const warnings: PreflightWarning[] = [];

  if (!Array.isArray(images) || images.length === 0) {
    errors.push({ code: "NO_IMAGES", message: "이미지가 없습니다. 최소 1개 이상 업로드하세요." });
    return { ok: false, errors, warnings };
  }

  if (images.length > MAX_IMAGE_COUNT) {
    errors.push({
      code: "TOO_MANY_IMAGES",
      message: `이미지는 최대 ${MAX_IMAGE_COUNT}개까지 업로드 가능합니다. (현재: ${images.length}개)`,
    });
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    if (typeof img !== "string" || img.length === 0) {
      errors.push({ code: "EMPTY_IMAGE", message: `이미지 ${i + 1}번이 비어 있습니다.`, index: i });
      continue;
    }

    const format = detectFormat(img);
    if (!format) {
      errors.push({
        code: "UNSUPPORTED_FORMAT",
        message: `이미지 ${i + 1}번의 형식이 지원되지 않습니다. PNG, JPEG, WebP, GIF만 가능합니다.`,
        index: i,
      });
      continue;
    }

    if (!isBase64Payload(img)) {
      errors.push({
        code: "CORRUPT_IMAGE",
        message: `이미지 ${i + 1}번이 손상되었거나 내용이 없습니다.`,
        index: i,
      });
      continue;
    }

    if (img.length > MAX_IMAGE_B64_LENGTH) {
      warnings.push({
        code: "LARGE_IMAGE",
        message: `이미지 ${i + 1}번이 매우 큽니다 (${Math.round(img.length / 1_000_000)}MB+). 분석 속도가 느려질 수 있습니다.`,
        index: i,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validate Figma inputs before making the Figma API call.
 */
export function validateFigmaInputs(
  figmaToken?: string,
  figmaFileKey?: string,
  figmaFrameIds?: string[]
): PreflightResult {
  const errors: PreflightError[] = [];
  const warnings: PreflightWarning[] = [];

  if (!figmaToken || figmaToken.trim().length < 10) {
    errors.push({ code: "MISSING_FIGMA_TOKEN", message: "Figma 액세스 토큰이 없거나 너무 짧습니다." });
  }
  if (!figmaFileKey || figmaFileKey.trim().length === 0) {
    errors.push({ code: "MISSING_FIGMA_FILE_KEY", message: "Figma 파일 키가 없습니다." });
  }
  if (!Array.isArray(figmaFrameIds) || figmaFrameIds.length === 0) {
    errors.push({ code: "NO_FIGMA_FRAMES", message: "분석할 Figma 프레임을 1개 이상 선택하세요." });
  } else if (figmaFrameIds.length > 10) {
    warnings.push({
      code: "MANY_FIGMA_FRAMES",
      message: `Figma 프레임이 ${figmaFrameIds.length}개입니다. 10개 이하를 권장합니다.`,
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Validate flow steps before flow analysis.
 */
export function validateFlowSteps(
  flowSteps?: Array<{ stepNumber: number; stepName: string; image: string }>
): PreflightResult {
  const errors: PreflightError[] = [];
  const warnings: PreflightWarning[] = [];

  if (!Array.isArray(flowSteps) || flowSteps.length < 2) {
    errors.push({ code: "INSUFFICIENT_FLOW_STEPS", message: "플로우 분석은 최소 2단계 이상 필요합니다." });
    return { ok: false, errors, warnings };
  }

  for (let i = 0; i < flowSteps.length; i++) {
    const step = flowSteps[i];
    if (!step.stepName?.trim()) {
      warnings.push({ code: "MISSING_STEP_NAME", message: `단계 ${i + 1}의 이름이 없습니다.`, index: i });
    }
    if (!step.image || step.image.length < MIN_IMAGE_B64_LENGTH) {
      errors.push({ code: "MISSING_STEP_IMAGE", message: `단계 ${i + 1}의 이미지가 없거나 손상되었습니다.`, index: i });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Log warnings without throwing — used to surface non-fatal issues.
 */
export function logPreflightWarnings(warnings: PreflightWarning[], context: string): void {
  for (const w of warnings) {
    console.warn(`[preflight/${context}] ${w.code}:`, w.message);
  }
}
