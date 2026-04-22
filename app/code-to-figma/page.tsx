"use client";

import { useState, useCallback, useEffect, useRef, type DragEvent, type ChangeEvent } from "react";
import { getLocale } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type InputTab = "github" | "upload" | "taxonomy";

interface FileItem {
  name: string;
  content: string;
}

interface DesignTokens {
  colors?: Record<string, string>;
  typography?: { fontFamily?: string; sizes?: Record<string, number> };
  spacing?: number[];
  borderRadius?: Record<string, number>;
}

interface Component {
  name: string;
  variants?: string[];
  props?: string[];
  usedIn?: string[];
}

interface Screen {
  route: string;
  name: string;
  components?: string[];
}

interface UserFlow {
  from: string;
  to: string;
  trigger: string;
}

interface EventTaxonomyItem {
  screen: string;
  events: string[];
  nextScreens: string[];
}

interface AnalysisResult {
  designTokens?: DesignTokens;
  components?: Component[];
  screens?: Screen[];
  userFlow?: UserFlow[];
  eventTaxonomy?: EventTaxonomyItem[];
}

interface FigmaArtifacts {
  variables: { created: number; errors: string[] };
  svgs: {
    tokens: string;
    components: string;
    flow: string;
    taxonomy: string;
  };
}

// ─── Loading steps ────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "코드 파일을 수집하는 중...",
  "Claude가 디자인 토큰을 추출하는 중...",
  "컴포넌트 인벤토리를 분석하는 중...",
  "화면 구조와 유저 플로우를 매핑하는 중...",
];

const FIGMA_LOADING_STEPS = [
  "SVG 아티팩트를 생성하는 중...",
  "Figma Variables API에 토큰을 등록하는 중...",
  "완료 중...",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CODE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];

function isCodeFile(name: string) {
  return CODE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function downloadSVG(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-md transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-[var(--muted)] hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">{children}</p>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-white/20"
    />
  );
}

function ColorSwatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-white/10 shrink-0"
        style={{ backgroundColor: hex }}
      />
      <div>
        <p className="text-xs text-white mono">{hex}</p>
        <p className="text-[10px] text-[var(--muted)]">{name}</p>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-[var(--muted)] mono bg-white/5 px-2 py-0.5 rounded">
              {count}
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--muted)] mono">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="px-5 pb-5 border-t border-[var(--border)]">{children}</div>}
    </div>
  );
}

// ─── Figma artifact page card ─────────────────────────────────────────────────

function ArtifactCard({
  icon,
  title,
  description,
  svgContent,
  filename,
  varCount,
  errors,
}: {
  icon: string;
  title: string;
  description: string;
  svgContent?: string;
  filename: string;
  varCount?: number;
  errors?: string[];
}) {
  const ok = !errors || errors.length === 0;

  return (
    <div className="flex items-start gap-4 p-4 bg-white/[0.02] border border-[var(--border)] rounded-lg">
      <div className="text-xl shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
        {varCount !== undefined && varCount > 0 && (
          <p className="text-xs text-emerald-400 mt-1">✓ Figma 변수 {varCount}개 등록</p>
        )}
        {errors && errors.length > 0 && (
          <p className="text-xs text-amber-400 mt-1">{errors[0]}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`text-xs mono px-2 py-0.5 rounded ${
            ok
              ? "text-emerald-400 bg-emerald-400/10"
              : "text-amber-400 bg-amber-400/10"
          }`}
        >
          {ok ? "✓" : "⚠"}
        </span>
        {svgContent && (
          <button
            onClick={() => downloadSVG(svgContent, filename)}
            className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-md text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors"
          >
            SVG 다운로드
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CodeToFigmaPage() {
  const [activeTab, setActiveTab] = useState<InputTab>("github");
  const [, setLocale] = useState("ko");

  // GitHub state
  const [githubUrl, setGithubUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubPath, setGithubPath] = useState("/");

  // Upload state
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Taxonomy state
  const [taxonomy, setTaxonomy] = useState("");

  // Common Figma fields
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaToken, setFigmaToken] = useState("");

  // Analysis state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fileCount, setFileCount] = useState(0);

  // Figma generation state
  const [generatingFigma, setGeneratingFigma] = useState(false);
  const [figmaLoadingStep, setFigmaLoadingStep] = useState(0);
  const [figmaArtifacts, setFigmaArtifacts] = useState<FigmaArtifacts | null>(null);
  const [figmaError, setFigmaError] = useState<string | null>(null);

  // Figma panel inputs (reuse or override from main form)
  const [figmaUrlPanel, setFigmaUrlPanel] = useState("");
  const [figmaTokenPanel, setFigmaTokenPanel] = useState("");

  useEffect(() => {
    setLocale(getLocale());
    const savedGhToken = localStorage.getItem("simulo_github_token");
    const savedFigmaToken = localStorage.getItem("simulo_figma_token");
    if (savedGhToken) setGithubToken(savedGhToken);
    if (savedFigmaToken) {
      setFigmaToken(savedFigmaToken);
      setFigmaTokenPanel(savedFigmaToken);
    }
  }, []);

  // Sync panel fields from main form
  useEffect(() => {
    if (figmaUrl) setFigmaUrlPanel(figmaUrl);
    if (figmaToken) setFigmaTokenPanel(figmaToken);
  }, [figmaUrl, figmaToken]);

  // ── File upload handlers ──────────────────────────────────────────────────

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => isCodeFile(f.name));
    if (arr.length === 0) return;
    const items = await Promise.all(
      arr.map(async (f) => ({ name: f.name, content: await readFileAsText(f) })),
    );
    setUploadedFiles((prev) => {
      const names = new Set(prev.map((p) => p.name));
      return [...prev, ...items.filter((i) => !names.has(i.name))];
    });
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
      e.target.value = "";
    },
    [processFiles],
  );

  // ── Analysis submit ───────────────────────────────────────────────────────

  const canSubmit =
    !loading &&
    (activeTab === "github"
      ? githubUrl.trim() !== ""
      : activeTab === "upload"
        ? uploadedFiles.length > 0
        : taxonomy.trim() !== "");

  const handleAnalyze = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFigmaArtifacts(null);
    setFigmaError(null);
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      if (githubToken) localStorage.setItem("simulo_github_token", githubToken);
      if (figmaToken) localStorage.setItem("simulo_figma_token", figmaToken);

      const apiKey = localStorage.getItem("simulo_anthropic_key") || undefined;

      const body: Record<string, unknown> = {
        inputType: activeTab,
        apiKey,
        taxonomy: taxonomy.trim() || undefined,
      };

      if (activeTab === "github") {
        body.github = { repoUrl: githubUrl, token: githubToken || undefined, path: githubPath };
      } else if (activeTab === "upload") {
        body.files = uploadedFiles;
      }

      const res = await fetch("/api/code-to-figma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "분석 실패");
      }

      const data = await res.json();
      setResult(data.result);
      setFileCount(data.fileCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  // ── Figma generation ──────────────────────────────────────────────────────

  const handleGenerateFigma = async () => {
    if (!result || generatingFigma) return;
    setGeneratingFigma(true);
    setFigmaError(null);
    setFigmaArtifacts(null);
    setFigmaLoadingStep(0);

    const interval = setInterval(() => {
      setFigmaLoadingStep((prev) => (prev < FIGMA_LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);

    try {
      if (figmaTokenPanel) localStorage.setItem("simulo_figma_token", figmaTokenPanel);

      const res = await fetch("/api/code-to-figma/figma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec: result,
          figmaFileUrl: figmaUrlPanel.trim() || undefined,
          figmaToken: figmaTokenPanel.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Figma 생성 실패");
      }

      const data: FigmaArtifacts = await res.json();
      setFigmaArtifacts(data);
    } catch (err) {
      setFigmaError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      clearInterval(interval);
      setGeneratingFigma(false);
    }
  };

  // ── Copy result JSON ──────────────────────────────────────────────────────

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render: loading spinner
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            {LOADING_STEPS.map((step, i) => (
              <p
                key={step}
                className={`text-sm transition-opacity duration-500 ${
                  i <= loadingStep ? "text-white opacity-100" : "text-[var(--muted)] opacity-30"
                }`}
              >
                {i < loadingStep ? "✓" : i === loadingStep ? "→" : " "} {step}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: main UI
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="w-full max-w-[760px] mx-auto space-y-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-semibold text-white">코드 → Figma</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            프론트엔드 코드와 이벤트 택소노미에서 Figma 디자인 스펙을 추출합니다.
          </p>
        </div>

        {/* ── Input card ──────────────────────────────────────────────────── */}
        <div className="border border-[var(--border)] rounded-lg p-6 space-y-6">

          {/* Tabs */}
          <div className="flex gap-1">
            <TabButton active={activeTab === "github"} onClick={() => setActiveTab("github")}>
              GitHub 연동
            </TabButton>
            <TabButton active={activeTab === "upload"} onClick={() => setActiveTab("upload")}>
              파일 업로드
            </TabButton>
            <TabButton active={activeTab === "taxonomy"} onClick={() => setActiveTab("taxonomy")}>
              이벤트 택소노미
            </TabButton>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">

            {/* GitHub tab */}
            {activeTab === "github" && (
              <>
                <div>
                  <SectionLabel>GitHub 레포 URL</SectionLabel>
                  <Input
                    value={githubUrl}
                    onChange={setGithubUrl}
                    placeholder="https://github.com/owner/repo"
                  />
                </div>
                <div>
                  <SectionLabel>Personal Access Token (선택 — private repo)</SectionLabel>
                  <Input
                    value={githubToken}
                    onChange={setGithubToken}
                    placeholder="ghp_xxxxxxxxxxxx"
                    type="password"
                  />
                </div>
                <div>
                  <SectionLabel>분석할 경로</SectionLabel>
                  <Input
                    value={githubPath}
                    onChange={setGithubPath}
                    placeholder="/components 또는 /src/screens"
                  />
                </div>
              </>
            )}

            {/* Upload tab */}
            {activeTab === "upload" && (
              <div>
                <SectionLabel>코드 파일 업로드 (.tsx .ts .css .json)</SectionLabel>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg px-6 py-10 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-white/40 bg-white/5"
                      : "border-[var(--border)] hover:border-white/20 hover:bg-white/[0.02]"
                  }`}
                >
                  <p className="text-sm text-[var(--muted)]">
                    파일을 드래그하거나 클릭해서 업로드
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    .tsx .ts .jsx .js .css .json 지원
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".tsx,.ts,.jsx,.js,.css,.json"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {uploadedFiles.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-[var(--border)] rounded-md"
                      >
                        <span className="text-xs text-[var(--muted)] mono truncate">{f.name}</span>
                        <button
                          onClick={() =>
                            setUploadedFiles((prev) => prev.filter((p) => p.name !== f.name))
                          }
                          className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors shrink-0 ml-2"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Taxonomy tab */}
            {activeTab === "taxonomy" && (
              <div>
                <SectionLabel>이벤트 택소노미 (JSON 또는 텍스트)</SectionLabel>
                <textarea
                  value={taxonomy}
                  onChange={(e) => setTaxonomy(e.target.value)}
                  rows={10}
                  placeholder={`예시:\n[\n  {\n    "screen_name": "home",\n    "events": ["walk_start", "mileage_earned"],\n    "next_screens": ["shop", "ranking"]\n  }\n]`}
                  className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-white/20 mono resize-y"
                />
              </div>
            )}
          </div>

          {/* Optional taxonomy supplement (github/upload tabs) */}
          {activeTab !== "taxonomy" && (
            <div className="border-t border-[var(--border)] pt-5">
              <SectionLabel>이벤트 택소노미 추가 (선택)</SectionLabel>
              <textarea
                value={taxonomy}
                onChange={(e) => setTaxonomy(e.target.value)}
                rows={4}
                placeholder="코드와 함께 분석할 이벤트 택소노미를 붙여넣으세요"
                className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border)] rounded-md text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-white/20 mono resize-y"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className={`w-full py-3 rounded-md text-sm font-medium transition-colors ${
              canSubmit
                ? "bg-white text-black hover:bg-white/90"
                : "bg-white/10 text-[var(--muted)] cursor-not-allowed"
            }`}
          >
            분석 시작
          </button>
        </div>

        {/* ── Analysis results ─────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-4">

            {/* Result header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-white">분석 결과</h2>
                {fileCount > 0 && (
                  <p className="text-xs text-[var(--muted)] mt-0.5">{fileCount}개 파일 분석 완료</p>
                )}
              </div>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-md text-[var(--muted)] hover:text-white hover:border-white/20 transition-colors mono"
              >
                {copied ? "✓ 복사됨" : "JSON 복사"}
              </button>
            </div>

            {/* Spec summary chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "색상 토큰", count: Object.keys(result.designTokens?.colors ?? {}).length },
                { label: "컴포넌트", count: result.components?.length ?? 0 },
                { label: "화면", count: result.screens?.length ?? 0 },
                { label: "플로우", count: result.userFlow?.length ?? 0 },
                { label: "이벤트", count: result.eventTaxonomy?.length ?? 0 },
              ].map(({ label, count }) => (
                <div
                  key={label}
                  className="px-3 py-1.5 bg-white/[0.03] border border-[var(--border)] rounded-md text-xs"
                >
                  <span className="text-white mono font-medium">{count}</span>
                  <span className="text-[var(--muted)] ml-1.5">{label}</span>
                </div>
              ))}
            </div>

            {/* 1. Design Tokens */}
            {result.designTokens && (
              <ResultSection title="디자인 토큰" defaultOpen>
                <div className="pt-4 space-y-5">
                  {result.designTokens.colors &&
                    Object.keys(result.designTokens.colors).length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-3">색상</p>
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.entries(result.designTokens.colors).map(([name, hex]) => (
                            <ColorSwatch key={name} name={name} hex={String(hex)} />
                          ))}
                        </div>
                      </div>
                    )}

                  {result.designTokens.typography && (
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-2">타이포그래피</p>
                      {result.designTokens.typography.fontFamily && (
                        <p className="text-sm text-white mb-2">
                          폰트:{" "}
                          <span className="mono text-[var(--muted)]">
                            {result.designTokens.typography.fontFamily}
                          </span>
                        </p>
                      )}
                      {result.designTokens.typography.sizes && (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(result.designTokens.typography.sizes).map(
                            ([key, size]) => (
                              <div
                                key={key}
                                className="px-2.5 py-1 bg-white/[0.03] border border-[var(--border)] rounded text-xs mono"
                              >
                                <span className="text-[var(--muted)]">{key}: </span>
                                <span className="text-white">{size}px</span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {result.designTokens.spacing && result.designTokens.spacing.length > 0 && (
                    <div>
                      <p className="text-xs text-[var(--muted)] mb-2">스페이싱</p>
                      <div className="flex flex-wrap gap-2">
                        {result.designTokens.spacing.map((s) => (
                          <span
                            key={s}
                            className="px-2.5 py-1 bg-white/[0.03] border border-[var(--border)] rounded text-xs mono text-white"
                          >
                            {s}px
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.designTokens.borderRadius &&
                    Object.keys(result.designTokens.borderRadius).length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-2">Border Radius</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(result.designTokens.borderRadius).map(([key, val]) => (
                            <div
                              key={key}
                              className="px-2.5 py-1 bg-white/[0.03] border border-[var(--border)] rounded text-xs mono"
                            >
                              <span className="text-[var(--muted)]">{key}: </span>
                              <span className="text-white">{val}px</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </ResultSection>
            )}

            {/* 2. Components */}
            {result.components && result.components.length > 0 && (
              <ResultSection title="컴포넌트 인벤토리" count={result.components.length} defaultOpen>
                <div className="pt-4 space-y-3">
                  {result.components.map((comp) => (
                    <div
                      key={comp.name}
                      className="px-4 py-3 bg-white/[0.02] border border-[var(--border)] rounded-md"
                    >
                      <p className="text-sm font-medium text-white">{comp.name}</p>
                      {comp.variants && comp.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {comp.variants.map((v) => (
                            <span
                              key={v}
                              className="px-2 py-0.5 text-xs bg-white/5 border border-[var(--border)] rounded text-[var(--muted)]"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                      {comp.props && comp.props.length > 0 && (
                        <p className="text-xs text-[var(--muted)] mt-1.5 mono">
                          props: {comp.props.join(", ")}
                        </p>
                      )}
                      {comp.usedIn && comp.usedIn.length > 0 && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          사용: {comp.usedIn.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* 3. Screens */}
            {result.screens && result.screens.length > 0 && (
              <ResultSection title="화면 목록" count={result.screens.length} defaultOpen={false}>
                <div className="pt-4 space-y-2">
                  {result.screens.map((screen) => (
                    <div
                      key={screen.route}
                      className="flex items-start gap-4 px-4 py-3 bg-white/[0.02] border border-[var(--border)] rounded-md"
                    >
                      <span className="text-xs text-[var(--muted)] mono shrink-0 mt-0.5 w-36 truncate">
                        {screen.route}
                      </span>
                      <div>
                        <p className="text-sm text-white">{screen.name}</p>
                        {screen.components && screen.components.length > 0 && (
                          <p className="text-xs text-[var(--muted)] mt-0.5">
                            {screen.components.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* 4. User Flow */}
            {result.userFlow && result.userFlow.length > 0 && (
              <ResultSection title="유저 플로우" count={result.userFlow.length} defaultOpen={false}>
                <div className="pt-4 space-y-2">
                  {result.userFlow.map((flow, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-[var(--border)] rounded-md"
                    >
                      <span className="text-sm text-white shrink-0">{flow.from}</span>
                      <span className="text-[var(--muted)] text-xs shrink-0">→</span>
                      <span className="text-sm text-white shrink-0">{flow.to}</span>
                      {flow.trigger && (
                        <span className="text-xs text-[var(--muted)] mono ml-auto shrink-0">
                          {flow.trigger}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* 5. Event Taxonomy */}
            {result.eventTaxonomy && result.eventTaxonomy.length > 0 && (
              <ResultSection
                title="이벤트 택소노미"
                count={result.eventTaxonomy.length}
                defaultOpen={false}
              >
                <div className="pt-4 space-y-3">
                  {result.eventTaxonomy.map((item, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 bg-white/[0.02] border border-[var(--border)] rounded-md"
                    >
                      <p className="text-sm font-medium text-white mono">{item.screen}</p>
                      {item.events && item.events.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.events.map((ev) => (
                            <span
                              key={ev}
                              className="px-2 py-0.5 text-xs bg-white/5 border border-[var(--border)] rounded text-[var(--muted)] mono"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.nextScreens && item.nextScreens.length > 0 && (
                        <p className="text-xs text-[var(--muted)] mt-2">
                          다음 화면: {item.nextScreens.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ResultSection>
            )}

            {/* ── Figma generation card ──────────────────────────────────── */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-sm font-medium text-white">Figma에 생성</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  4개 페이지 SVG 아티팩트 생성 + Figma 변수 자동 등록
                </p>
              </div>

              <div className="px-5 py-5 space-y-4">
                {/* Figma credentials */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SectionLabel>Figma File URL</SectionLabel>
                    <Input
                      value={figmaUrlPanel}
                      onChange={setFigmaUrlPanel}
                      placeholder="https://figma.com/file/..."
                    />
                  </div>
                  <div>
                    <SectionLabel>Figma Personal Access Token</SectionLabel>
                    <Input
                      value={figmaTokenPanel}
                      onChange={setFigmaTokenPanel}
                      placeholder="figd_xxxxxxxxxxxx"
                      type="password"
                    />
                  </div>
                </div>

                {/* Figma generation button */}
                <button
                  onClick={handleGenerateFigma}
                  disabled={generatingFigma}
                  className={`w-full py-2.5 rounded-md text-sm font-medium transition-colors border ${
                    generatingFigma
                      ? "border-[var(--border)] text-[var(--muted)] cursor-not-allowed"
                      : "border-white/20 text-white hover:bg-white/5"
                  }`}
                >
                  {generatingFigma ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border border-white/20 border-t-white rounded-full animate-spin" />
                      {FIGMA_LOADING_STEPS[figmaLoadingStep]}
                    </span>
                  ) : (
                    "Figma에 생성"
                  )}
                </button>

                {/* Figma error */}
                {figmaError && (
                  <div className="p-3 rounded-md bg-red-400/10 border border-red-400/20 text-red-400 text-xs">
                    {figmaError}
                  </div>
                )}

                {/* Figma artifacts result */}
                {figmaArtifacts && (
                  <div className="space-y-3 pt-1">
                    {/* Variables summary */}
                    {figmaArtifacts.variables.created > 0 && (
                      <div className="p-3 rounded-md bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs">
                        Figma Variables에 토큰 {figmaArtifacts.variables.created}개 등록 완료
                        {figmaUrlPanel && (
                          <a
                            href={figmaUrlPanel}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 underline hover:no-underline"
                          >
                            Figma에서 열기 →
                          </a>
                        )}
                      </div>
                    )}
                    {figmaArtifacts.variables.errors.length > 0 && (
                      <div className="p-3 rounded-md bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs">
                        변수 등록 건너뜀: {figmaArtifacts.variables.errors[0]}
                        <span className="ml-1 text-amber-300">(SVG 다운로드는 정상 완료)</span>
                      </div>
                    )}

                    {/* 4 artifact cards */}
                    <ArtifactCard
                      icon="🎨"
                      title="Design Tokens"
                      description="색상 팔레트 · 타이포그래피 · 스페이싱 · Border Radius"
                      svgContent={figmaArtifacts.svgs.tokens}
                      filename="simulo-design-tokens.svg"
                      varCount={figmaArtifacts.variables.created}
                      errors={figmaArtifacts.variables.errors}
                    />
                    <ArtifactCard
                      icon="📦"
                      title="Components"
                      description="컴포넌트 인벤토리 · variants · props · 사용 화면"
                      svgContent={figmaArtifacts.svgs.components}
                      filename="simulo-components.svg"
                    />
                    <ArtifactCard
                      icon="🗺️"
                      title="User Flow"
                      description="화면 전환 다이어그램 · 트리거 레이블"
                      svgContent={figmaArtifacts.svgs.flow}
                      filename="simulo-user-flow.svg"
                    />
                    <ArtifactCard
                      icon="📊"
                      title="Event Taxonomy"
                      description="화면별 이벤트 맵 · 다음 화면 전환"
                      svgContent={figmaArtifacts.svgs.taxonomy}
                      filename="simulo-event-taxonomy.svg"
                    />

                    <p className="text-xs text-[var(--muted)] pt-1">
                      SVG 파일을 다운로드한 후 Figma에 드래그앤드롭하거나 [File → Place image]로 가져오세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
