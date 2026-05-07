/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";

interface DraftTabProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  instruction: string;
  onInstructionChange: (value: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  showError?: boolean;
}

const QUICK_INSTRUCTIONS = [
  { label: "전체 디벨롭", value: "이 초안을 기반으로 전체적인 UI 퀄리티를 높여주세요. 시각적 계층구조, 여백, 색상 대비, 타이포그래피를 개선하고 모바일 네이티브 앱 수준으로 디벨롭해주세요." },
  { label: "UX 라이팅 개선", value: "화면의 모든 텍스트(제목, 설명, 버튼, 안내문 등)의 UX 라이팅을 개선해주세요. 더 명확하고 행동을 유도하는 문구로 바꿔주세요. 레이아웃은 변경하지 마세요." },
  { label: "CTA 강화", value: "메인 CTA(Call To Action) 버튼의 시인성과 클릭 유도력을 강화해주세요. 버튼 색상, 크기, 위치, 문구를 개선하되 나머지 요소는 유지해주세요." },
  { label: "정보 계층 정리", value: "화면의 정보 계층구조를 정리해주세요. 가장 중요한 정보가 먼저 눈에 들어오도록 시각적 우선순위를 재배치해주세요." },
  { label: "여백/간격 조정", value: "화면의 여백과 간격을 조정해주세요. 콘텐츠 간 적절한 공간을 확보하고, 그룹핑이 명확해지도록 패딩과 마진을 개선해주세요." },
  { label: "색상/톤 개선", value: "화면의 색상 체계를 개선해주세요. 브랜드 톤을 유지하면서 대비를 높이고, 강조할 요소와 배경 요소의 구분을 명확하게 해주세요." },
];

export function DraftTab({
  images,
  onImagesChange,
  instruction,
  onInstructionChange,
  referenceImages,
  onReferenceImagesChange,
  showError,
}: DraftTabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const results: string[] = [...images];
    let loaded = 0;
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        results.push(reader.result as string);
        loaded++;
        if (loaded === imageFiles.length) {
          onImagesChange(results);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRefFiles = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const results: string[] = [...referenceImages];
    let loaded = 0;
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        results.push(reader.result as string);
        loaded++;
        if (loaded === imageFiles.length) {
          onReferenceImagesChange(results);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    onImagesChange(images.filter((_, i) => i !== idx));
  };

  const removeRefImage = (idx: number) => {
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {/* Image upload area */}
      <div>
        <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
          원본 화면
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFileDrop(e.dataTransfer.files);
          }}
          onClick={() => images.length === 0 && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
            dragOver
              ? "border-white/40 bg-white/5"
              : showError && images.length === 0
                ? "border-red-400/40 bg-red-400/5"
                : "border-[var(--border)] hover:border-white/20"
          }`}
        >
          {images.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-white/40 text-sm">개선할 화면 이미지를 드래그하거나 클릭하세요</p>
              <p className="text-white/20 text-xs mt-1">PNG, JPG, WebP</p>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img}
                    alt={`screen-${i}`}
                    className="h-32 rounded border border-[var(--border)] object-cover"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="h-32 w-20 rounded border-2 border-dashed border-[var(--border)] hover:border-white/30 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors text-xl"
              >
                +
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFileDrop(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Quick instruction buttons */}
      <div>
        <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
          개선 방향 (선택하거나 직접 입력)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
          {QUICK_INSTRUCTIONS.map((qi) => (
            <button
              key={qi.label}
              onClick={() => onInstructionChange(qi.value)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                instruction === qi.value
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20"
              }`}
            >
              {qi.label}
            </button>
          ))}
        </div>
        <textarea
          value={instruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          placeholder="예: 이 초안을 기반으로 전체적으로 디벨롭해줘 / 하단 CTA 버튼을 더 눈에 띄게 / UX 라이팅을 자연스럽게 / 색상 톤을 밝게"
          rows={3}
          className={`w-full px-4 py-2.5 bg-white/[0.03] border rounded-md text-sm focus:outline-none focus:border-white/30 resize-none ${
            showError && !instruction.trim()
              ? "border-red-400/40"
              : "border-[var(--border)]"
          }`}
        />
      </div>

      {/* Reference images (optional) */}
      <div>
        <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">
          참고 이미지 <span className="normal-case font-normal">(선택)</span>
        </label>
        <div className="flex gap-2 items-center flex-wrap">
          {referenceImages.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={img}
                alt={`ref-${i}`}
                className="h-16 rounded border border-[var(--border)] object-cover"
              />
              <button
                onClick={() => removeRefImage(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
          <button
            onClick={() => refFileRef.current?.click()}
            className="h-16 px-4 rounded border border-dashed border-[var(--border)] hover:border-white/30 text-white/30 hover:text-white/60 transition-colors text-xs"
          >
            + 참고 이미지
          </button>
        </div>
        <input
          ref={refFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleRefFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-[10px] text-white/20 mt-1">
          디자인 방향이나 스타일을 참고할 이미지를 첨부하세요
        </p>
      </div>
    </div>
  );
}
