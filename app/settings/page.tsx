"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLocale,
  setLocale as saveLocale,
  t,
  type Locale,
} from "@/lib/i18n";
import { storage, type StorageUsage } from "@/lib/storage";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function SettingsPage() {
  const [locale, setLocaleState] = useState<Locale>("ko");
  const [apiKey, setApiKey] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [model, setModel] = useState<"haiku" | "sonnet">("haiku");
  const [saved, setSaved] = useState(false);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [clearMsg, setClearMsg] = useState("");

  const refreshStorageUsage = useCallback(async () => {
    const usage = await storage.getStorageUsageAsync();
    setStorageUsage(usage);
  }, []);

  useEffect(() => {
    setLocaleState(getLocale());
    setApiKey(localStorage.getItem("simulo_anthropic_key") ?? "");
    setFigmaToken(localStorage.getItem("simulo_figma_token") ?? "");
    setModel((localStorage.getItem("simulo_model") as "haiku" | "sonnet") || "haiku");
    refreshStorageUsage();
  }, [refreshStorageUsage]);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocaleState(newLocale);
    saveLocale(newLocale);
  };

  const handleSave = () => {
    localStorage.setItem("simulo_anthropic_key", apiKey);
    localStorage.setItem("simulo_figma_token", figmaToken);
    localStorage.setItem("simulo_model", model);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">
          {t("settings", locale)}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Language */}
        <div>
          <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            {t("language", locale)}
          </label>
          <div className="flex gap-2">
            {(["ko", "en"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLocaleChange(lang)}
                className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                  locale === lang
                    ? "bg-white/10 border-white/20 text-white"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20"
                }`}
              >
                {lang === "ko" ? "한국어" : "English"}
              </button>
            ))}
          </div>
        </div>

        {/* Anthropic API Key */}
        <div>
          <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            {t("anthropicApiKey", locale)}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            {t("apiKeyHint", locale)}
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            {t("modelSelection", locale)}
          </label>
          <div className="flex gap-2">
            {(["haiku", "sonnet"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                  model === m
                    ? "bg-white/10 border-white/20 text-white"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-white/20"
                }`}
              >
                <span className="font-medium">
                  {m === "haiku" ? "Haiku 4.5" : "Sonnet 4.5"}
                </span>
                <span className="ml-2 text-xs text-[var(--muted)]">
                  {m === "haiku"
                    ? t("modelHaikuDesc", locale)
                    : t("modelSonnetDesc", locale)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            {t("modelHint", locale)}
          </p>
        </div>

        {/* Figma Token */}
        <div>
          <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            {t("figmaToken", locale)}
          </label>
          <input
            type="password"
            value={figmaToken}
            onChange={(e) => setFigmaToken(e.target.value)}
            placeholder="figd_..."
            className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm focus:outline-none focus:border-white/30"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            {t("figmaTokenHint", locale)}
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors"
        >
          {saved ? t("saved", locale) : t("save", locale)}
        </button>

        {/* Storage Management */}
        <div className="pt-6 border-t border-[var(--border)] space-y-4">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-wider">
            {t("storageSection", locale)}
          </h2>

          {storageUsage && (
            <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-3">
              {/* Usage bar */}
              <div>
                <div className="flex justify-between text-xs text-[var(--muted)] mb-1.5">
                  <span>{t("storageUsage", locale)}</span>
                  <span>{storageUsage.usagePercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      storageUsage.usagePercent >= 80
                        ? "bg-yellow-500"
                        : storageUsage.usagePercent >= 95
                          ? "bg-red-500"
                          : "bg-white/30"
                    }`}
                    style={{ width: `${Math.min(storageUsage.usagePercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[var(--muted)] text-xs">{t("storageLocalStorage", locale)}</span>
                  <p className="font-mono text-xs mt-0.5">
                    {formatBytes(storageUsage.localStorageUsed)} / {formatBytes(storageUsage.localStorageQuota)}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--muted)] text-xs">{t("storageImages", locale)}</span>
                  <p className="font-mono text-xs mt-0.5">
                    {storageUsage.indexedDBUsed > 0
                      ? formatBytes(storageUsage.indexedDBUsed)
                      : "—"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--muted)]">
                {storageUsage.analysisCount}{t("storageAnalyses", locale)}
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    const count = storage.deleteOlderThan(30);
                    setClearMsg(`${count}${t("storageCleared", locale)}`);
                    await refreshStorageUsage();
                    setTimeout(() => setClearMsg(""), 3000);
                  }}
                  className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-md hover:border-white/20 transition-colors"
                >
                  30{t("storageClearOldDays", locale)}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(t("storageClearConfirm", locale))) return;
                    const count = await storage.clearAll();
                    setClearMsg(`${count}${t("storageCleared", locale)}`);
                    await refreshStorageUsage();
                    setTimeout(() => setClearMsg(""), 3000);
                  }}
                  className="px-3 py-1.5 text-xs border border-red-500/30 text-red-400 rounded-md hover:bg-red-500/10 transition-colors"
                >
                  {t("storageClearAll", locale)}
                </button>
              </div>

              {clearMsg && (
                <p className="text-xs text-green-400">{clearMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* Coming Soon */}
        <div className="pt-6 border-t border-[var(--border)] space-y-4">
          <h2 className="text-xs text-[var(--muted)] uppercase tracking-wider">
            {t("integrations", locale)}
          </h2>
          {["Slack Webhook", "Google Analytics", "Figma Plugin"].map(
            (name) => (
              <div
                key={name}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] opacity-50"
              >
                <span className="text-sm">{name}</span>
                <span className="text-xs text-[var(--muted)] mono">
                  {t("comingSoon", locale)}
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
