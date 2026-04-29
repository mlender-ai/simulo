import { NextRequest, NextResponse } from "next/server";
import { preprocessImages } from "@/lib/imagePreprocess";
import { extractTextFromImages, validateOCRResults } from "@/lib/ocr";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images, locale, apiKey, productMode } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "images array is required" }, { status: 400 });
    }

    console.log("[ocr-extract] Preprocessing", images.length, "images");
    const processedImages = await preprocessImages(images as string[]);

    console.log("[ocr-extract] Extracting text with claude-opus-4-7");
    const rawOCR = await extractTextFromImages(
      processedImages,
      apiKey || process.env.ANTHROPIC_API_KEY,
      productMode
    );

    const validatedOCR = validateOCRResults(rawOCR, productMode);
    console.log("[ocr-extract] Done. Screens:", validatedOCR.length);

    return NextResponse.json({ ocrResults: validatedOCR, locale: locale || "ko" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OCR extraction failed";
    console.error("[ocr-extract] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
