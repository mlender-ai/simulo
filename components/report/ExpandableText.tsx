"use client";

import { useState, useRef, useEffect } from "react";

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ExpandableText({ text, maxLines = 2, className = "", style }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="relative">
      <p
        ref={ref}
        className={className}
        style={{
          ...style,
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }),
        }}
      >
        {text}
      </p>
      {clamped && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="text-[11px] text-white/30 hover:text-white/60 transition-colors mt-0.5"
        >
          {expanded ? "접기" : "더 보기"}
        </button>
      )}
    </div>
  );
}
