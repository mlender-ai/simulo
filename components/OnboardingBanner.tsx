"use client";

import { useState, useEffect, useRef } from "react";
import { t, type Locale } from "@/lib/i18n";

export const DISMISSED_KEY = "simulo_onboarding_dismissed";

interface OnboardingBannerProps {
  locale: Locale;
  open: boolean;
  onClose: () => void;
}

export function OnboardingBanner({ locale, open, onClose }: OnboardingBannerProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const outer = innerRef.current?.parentElement as HTMLDivElement | null;
    if (!outer) return;
    const inner = innerRef.current!;
    if (open) {
      outer.style.height = inner.offsetHeight + "px";
      outer.style.opacity = "1";
      outer.style.marginBottom = "24px";
    } else {
      outer.style.height = "0";
      outer.style.opacity = "0";
      outer.style.marginBottom = "0";
    }
  }, [open, mounted]);

  // Render nothing until mounted to avoid hydration mismatch
  if (!mounted) return null;

  return (
    <div
      style={{
        overflow: "hidden",
        transition: "height 0.2s ease, opacity 0.2s ease, margin-bottom 0.2s ease",
        height: 0,
        opacity: 0,
        marginBottom: 0,
      }}
    >
      <div ref={innerRef}>
        <div
          style={{
            background: "#111",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "16px 20px",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "12px",
              right: "14px",
              color: "#555",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
            }}
            aria-label="닫기"
          >
            ✕
          </button>

          <p style={{ fontSize: "13px", fontWeight: 600, color: "#e0e0e0", marginBottom: "10px" }}>
            {t("onboardingTitle", locale)}
          </p>

          <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#999" }}>
            <p>{t("onboardingStep1", locale)}</p>
            <p>{t("onboardingStep2", locale)}</p>
            <p>{t("onboardingStep3", locale)}</p>
            <p>{t("onboardingStep4", locale)}</p>
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#555",
              marginTop: "12px",
              borderTop: "1px solid #222",
              paddingTop: "10px",
            }}
          >
            {t("onboardingFootnote", locale)}
          </p>
        </div>
      </div>
    </div>
  );
}
