import { chromium } from "playwright";
import { analyzeWithClaude } from "@/lib/claude";
import type { HandlerResult, BaseHandlerParams } from "./types";

interface UrlHandlerParams extends BaseHandlerParams {
  url: string;
}

export async function handleUrlAnalysis(params: UrlHandlerParams): Promise<HandlerResult> {
  const { url, hypothesis, targetUser, task, locale, apiKey, model, mode, analysisOptions, screenDescription, ocrContext } = params;

  // Capture full-page screenshot via Playwright
  let screenshotBase64: string;
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800);
    const buf = await page.screenshot({ fullPage: false, type: "png" });
    screenshotBase64 = buf.toString("base64");
  } finally {
    await browser.close();
  }

  const urlContext = `\n\n[분석 대상 URL: ${url}]`;
  const result = await analyzeWithClaude({
    images: [screenshotBase64],
    hypothesis,
    targetUser,
    task,
    locale,
    apiKey,
    model,
    mode,
    analysisOptions,
    screenDescription: (screenDescription || "") + urlContext,
    ocrContext,
  });

  return {
    result: result as Record<string, unknown>,
    thumbnailUrls: [`data:image/png;base64,${screenshotBase64}`],
    isComparison: false,
    comparisonData: null,
  };
}
