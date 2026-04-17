"use client";

import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { t, getLocale } from "@/lib/i18n";

export default function StorageWarningBanner() {
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState(getLocale());

  useEffect(() => {
    setLocale(getLocale());
    setVisible(storage.isNearQuota(80));
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-4 mt-4 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-between gap-3">
      <p className="text-sm text-yellow-200/90">
        {t("storageWarning", locale)}
      </p>
      <button
        onClick={() => setVisible(false)}
        className="text-xs text-[var(--muted)] hover:text-white shrink-0"
      >
        {t("storageWarningDismiss", locale)}
      </button>
    </div>
  );
}
