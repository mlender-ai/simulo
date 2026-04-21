import sharp from "sharp";

export async function preprocessImageForOCR(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 1080;
  const height = meta.height ?? 1920;

  // Scale up small images; cap very large ones to keep token size reasonable
  const targetWidth = Math.min(Math.max(width, 1080), 2160);
  const scale = targetWidth / width;

  const processed = await sharp(buffer)
    .resize(Math.round(width * scale), Math.round(height * scale), {
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 2, m1: 0.5, m2: 0.5, x1: 2, y2: 10, y3: 20 })
    .linear(1.2, -(0.2 * 255))
    .png({ quality: 100, compressionLevel: 0 })
    .toBuffer();

  return processed.toString("base64");
}

export async function preprocessImages(base64Images: string[]): Promise<string[]> {
  return Promise.all(base64Images.map(preprocessImageForOCR));
}
