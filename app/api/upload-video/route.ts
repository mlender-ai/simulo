import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { writeFile, mkdir, readFile, rm, readdir } from "fs/promises";
import path from "path";
import os from "os";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err: Error | null, metadata: ffmpeg.FfprobeData) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}

function extractFrames(
  videoPath: string,
  outputDir: string,
  interval: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const outputPattern = path.join(outputDir, "frame-%03d.png");
    ffmpeg(videoPath)
      .outputOptions([
        `-vf fps=1/${interval},scale=1080:-1`,
        "-q:v 2",
      ])
      .output(outputPattern)
      .on("end", async () => {
        try {
          const files = await readdir(outputDir);
          const framePaths = files
            .filter((f) => f.startsWith("frame-"))
            .sort()
            .map((f) => path.join(outputDir, f));
          resolve(framePaths);
        } catch (e) {
          reject(e);
        }
      })
      .on("error", reject)
      .run();
  });
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("video") as File | null;
  const interval = Math.max(1, Number(formData.get("interval") || 2));

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }

  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json(
      { error: "파일 크기는 200MB 이하여야 합니다" },
      { status: 400 }
    );
  }

  const tmpDir = path.join(os.tmpdir(), `simulo-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  const videoPath = path.join(tmpDir, "input.mp4");
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(videoPath, buffer);

  try {
    const duration = await getVideoDuration(videoPath);

    const maxFrames = 20;
    const actualInterval = Math.max(interval, Math.ceil(duration / maxFrames));

    const framePaths = await extractFrames(videoPath, tmpDir, actualInterval);

    const frames = await Promise.all(
      framePaths.map(async (framePath, index) => {
        const data = await readFile(framePath);
        return {
          index,
          timestamp: index * actualInterval,
          base64: data.toString("base64"),
          name: `프레임 ${index + 1} (${formatTimestamp(index * actualInterval)})`,
        };
      })
    );

    await rm(tmpDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      duration,
      frameCount: frames.length,
      interval: actualInterval,
      frames,
    });
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    console.error("[upload-video] Error:", error);
    return NextResponse.json(
      { error: "영상 처리에 실패했습니다" },
      { status: 500 }
    );
  }
}
