/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { resizeImage } from "./input/ImageUploadTab";

export interface VideoFrame {
  index: number;
  timestamp: number;
  base64: string;
  name: string;
}

export interface UploadedVideo {
  fileName: string;
  duration: number;
  frameCount: number;
  interval: number;
  frames: VideoFrame[];
}

interface MediaUploaderProps {
  maxImages?: number;
  maxVideos?: number;
  images: string[];
  videos: UploadedVideo[];
  onImagesChange: (images: string[]) => void;
  onVideosChange: (videos: UploadedVideo[]) => void;
  label?: string;
  uploadZoneId: string;
  showError?: boolean;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MediaUploader({
  maxImages = 8,
  maxVideos = 2,
  images,
  videos,
  onImagesChange,
  onVideosChange,
  uploadZoneId,
  showError = false,
}: MediaUploaderProps) {
  const [activeSubTab, setActiveSubTab] = useState<"image" | "video">("image");
  const [isDragging, setIsDragging] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState("");
  const [videoError, setVideoError] = useState("");
  const [frameInterval, setFrameInterval] = useState(2);

  // ── Image handlers ──────────────────────────────────────────────────
  const handleImageFiles = useCallback(
    (files: FileList) => {
      const remaining = maxImages - images.length;
      const toProcess = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);
      Promise.all(toProcess.map((f) => resizeImage(f, 1024))).then((resized) =>
        onImagesChange([...images, ...resized])
      );
    },
    [images, onImagesChange, maxImages]
  );

  const handleImageDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) handleImageFiles(e.dataTransfer.files);
    },
    [handleImageFiles]
  );

  const handleImageInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleImageFiles(e.target.files);
    },
    [handleImageFiles]
  );

  // ── Video handlers ──────────────────────────────────────────────────
  const handleVideoUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        setVideoError("MP4 또는 MOV 파일만 업로드할 수 있습니다.");
        return;
      }
      if (file.size > 200 * 1024 * 1024) {
        setVideoError("파일 크기는 200MB 이하여야 합니다.");
        return;
      }
      if (videos.length >= maxVideos) {
        setVideoError(`최대 ${maxVideos}개까지 업로드할 수 있습니다.`);
        return;
      }

      setVideoUploading(true);
      setVideoError("");
      setVideoProgress("영상 업로드 중...");

      const formData = new FormData();
      formData.append("video", file);
      formData.append("interval", String(frameInterval));

      try {
        setVideoProgress("프레임 추출 중...");
        const res = await fetch("/api/upload-video", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "영상 처리에 실패했습니다");

        setVideoProgress(`프레임 ${data.frameCount}장 추출 완료`);
        onVideosChange([
          ...videos,
          {
            fileName: file.name,
            duration: data.duration,
            frameCount: data.frameCount,
            interval: data.interval,
            frames: data.frames,
          },
        ]);
      } catch (err) {
        setVideoError(err instanceof Error ? err.message : "영상 처리에 실패했습니다. 다시 시도해주세요.");
        setVideoProgress("");
      } finally {
        setVideoUploading(false);
      }
    },
    [videos, onVideosChange, maxVideos, frameInterval]
  );

  const handleVideoDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleVideoUpload(file);
    },
    [handleVideoUpload]
  );

  const handleVideoInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleVideoUpload(file);
      e.target.value = "";
    },
    [handleVideoUpload]
  );

  const removeVideo = (index: number) => {
    onVideosChange(videos.filter((_, i) => i !== index));
    setVideoProgress("");
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex border-b border-[var(--border)] mb-3">
        <button
          onClick={() => setActiveSubTab("image")}
          className="px-3 py-1.5 text-[13px] transition-colors"
          style={{
            background: activeSubTab === "image" ? "#1a1a1a" : "transparent",
            borderBottom: activeSubTab === "image" ? "1px solid #fff" : "1px solid transparent",
            color: activeSubTab === "image" ? "#fff" : "var(--muted)",
          }}
        >
          📷 이미지
        </button>
        <button
          onClick={() => setActiveSubTab("video")}
          className="px-3 py-1.5 text-[13px] transition-colors"
          style={{
            background: activeSubTab === "video" ? "#1a1a1a" : "transparent",
            borderBottom: activeSubTab === "video" ? "1px solid #fff" : "1px solid transparent",
            color: activeSubTab === "video" ? "#fff" : "var(--muted)",
          }}
        >
          🎬 영상
        </button>
      </div>

      {/* Image tab */}
      {activeSubTab === "image" && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleImageDrop}
            className={`border border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-white/40 bg-white/5"
                : showError && images.length === 0
                  ? "border-red-500/60 hover:border-red-500/80"
                  : "border-[var(--border)] hover:border-white/20"
            }`}
            onClick={() => document.getElementById(`${uploadZoneId}-img`)?.click()}
          >
            <p className={`text-sm ${showError && images.length === 0 ? "text-red-400/80" : "text-[var(--muted)]"}`}>
              {showError && images.length === 0 ? "이미지를 1장 이상 업로드해주세요 (필수)" : "이미지를 드래그하거나 클릭해서 업로드"}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              JPG, PNG 지원 · 최대 {maxImages}장 ({images.length}/{maxImages})
            </p>
            <input
              id={`${uploadZoneId}-img`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageInput}
            />
          </div>
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative w-20 h-20 rounded border border-[var(--border)] overflow-hidden group"
                >
                  <img
                    src={`data:image/png;base64,${img}`}
                    alt={`Image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video tab */}
      {activeSubTab === "video" && (
        <div>
          {/* Frame interval selector */}
          <div className="mb-3 p-3 rounded-md border border-[var(--border)] bg-white/[0.02]">
            <p className="text-xs text-[var(--muted)] mb-2">프레임 추출 간격</p>
            <div className="flex gap-3">
              {[1, 2, 3].map((sec) => (
                <label key={sec} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name={`${uploadZoneId}-interval`}
                    checked={frameInterval === sec}
                    onChange={() => setFrameInterval(sec)}
                    className="accent-white"
                  />
                  <span className={frameInterval === sec ? "text-white" : "text-[var(--muted)]"}>
                    {sec}초마다
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Upload zone */}
          {videos.length < maxVideos && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleVideoDrop}
              className={`border border-dashed rounded-lg p-6 text-center transition-colors ${
                videoUploading
                  ? "border-white/20 cursor-not-allowed opacity-60"
                  : isDragging
                  ? "border-white/40 bg-white/5 cursor-pointer"
                  : "border-[var(--border)] hover:border-white/20 cursor-pointer"
              }`}
              onClick={() => {
                if (!videoUploading) document.getElementById(`${uploadZoneId}-vid`)?.click();
              }}
            >
              <svg
                className="mx-auto mb-2 opacity-40"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="m15 12-5-3v6l5-3z" fill="currentColor" stroke="none" />
              </svg>
              {videoUploading ? (
                <p className="text-sm text-[var(--muted)]">{videoProgress}</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--muted)]">영상을 드래그하거나 클릭해서 업로드</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    MP4, MOV 지원 · 최대 200MB · 최대 {maxVideos}개
                  </p>
                </>
              )}
              <input
                id={`${uploadZoneId}-vid`}
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                className="hidden"
                onChange={handleVideoInput}
              />
            </div>
          )}

          {videoError && (
            <p className="text-xs text-red-400 mt-2">{videoError}</p>
          )}

          {/* Uploaded videos */}
          {videos.map((video, vi) => (
            <div
              key={vi}
              className="mt-3 p-3 rounded-md border border-[var(--border)] bg-white/[0.02]"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-white truncate max-w-[200px]">{video.fileName}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatTimestamp(video.duration)} · {video.frameCount}프레임 추출됨 ({video.interval}초 간격)
                  </p>
                </div>
                <button
                  onClick={() => removeVideo(vi)}
                  className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors px-2"
                >
                  삭제
                </button>
              </div>

              {/* Frame thumbnails horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {video.frames.map((frame) => (
                  <div key={frame.index} className="flex flex-col items-center shrink-0">
                    <div className="w-10 h-[70px] rounded overflow-hidden border border-[var(--border)]">
                      <img
                        src={`data:image/png;base64,${frame.base64}`}
                        alt={frame.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] text-[var(--muted)] mt-0.5">
                      {formatTimestamp(frame.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {videoUploading && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <span className="text-xs text-[var(--muted)]">{videoProgress}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
