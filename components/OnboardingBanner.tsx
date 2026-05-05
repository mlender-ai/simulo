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
      className="overflow-hidden"
      style={{
        transition: "height 0.2s ease, opacity 0.2s ease, margin-bottom 0.2s ease",
        height: 0,
        opacity: 0,
        marginBottom: 0,
      }}
    >
      <div ref={innerRef}>
        <div className="relative bg-[#111] border border-[#2a2a2a] rounded-lg p-4 sm:p-5">
          <button
            onClick={onClose}
            className="absolute top-3 right-3.5 text-[#555] hover:text-white transition-colors text-base leading-none bg-transparent border-none cursor-pointer"
            aria-label="닫기"
          >
            ✕
          </button>

          <p className="text-[13px] font-semibold text-[#e0e0e0] mb-2.5">
            {t("onboardingTitle", locale)}
          </p>

          <div className="text-xs sm:text-sm leading-relaxed text-[#999] space-y-0.5">
            <p>{t("onboardingStep1", locale)}</p>
            <p>{t("onboardingStep2", locale)}</p>
            <p>{t("onboardingStep3", locale)}</p>
            <p>{t("onboardingStep4", locale)}</p>
          </div>

          <p className="text-[11px] text-[#555] mt-3 pt-2.5 border-t border-[#222]">
            {t("onboardingFootnote", locale)}
          </p>
        </div>
      </div>
    </div>
  );
}
