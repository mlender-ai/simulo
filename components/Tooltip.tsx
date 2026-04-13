"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProps {
  content: string;
  position?: "top" | "bottom";
}

export function Tooltip({ content, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && iconRef.current && tooltipRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      if (position === "top" && iconRect.top - tooltipRect.height - 8 < 0) {
        setAdjustedPosition("bottom");
      } else if (
        position === "bottom" &&
        iconRect.bottom + tooltipRect.height + 8 > window.innerHeight
      ) {
        setAdjustedPosition("top");
      } else {
        setAdjustedPosition(position);
      }
    }
  }, [visible, position]);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (
        iconRef.current &&
        !iconRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [visible]);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <span
        ref={iconRef}
        role="button"
        tabIndex={0}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVisible((v) => !v); } }}
        className="text-[#666] hover:text-[#999] transition-colors leading-none focus:outline-none cursor-pointer"
        aria-label="도움말"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6.5" stroke="currentColor" />
          <text
            x="7"
            y="10.5"
            textAnchor="middle"
            fontSize="8"
            fill="currentColor"
            fontFamily="sans-serif"
            fontWeight="600"
          >
            i
          </text>
        </svg>
      </span>

      {visible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 left-1/2 -translate-x-1/2 ${
            adjustedPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ width: "280px" }}
        >
          {/* Arrow */}
          {adjustedPosition === "top" ? (
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] w-0 h-0"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid #333",
              }}
            />
          ) : (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-[-5px] w-0 h-0"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderBottom: "5px solid #333",
              }}
            />
          )}
          <div
            style={{
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: "6px",
              padding: "10px 12px",
              fontSize: "13px",
              lineHeight: "1.6",
              color: "#ccc",
            }}
          >
            {content}
          </div>
        </div>
      )}
    </span>
  );
}
