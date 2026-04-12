"use client";

import { useEffect, useState } from "react";

interface ScoreItem {
  productName: string;
  score: number;
  isOurs?: boolean;
}

interface ComparisonScoreBarProps {
  items: ScoreItem[];
}

export function ComparisonScoreBar({ items }: ComparisonScoreBarProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const width = animate ? Math.max(0, Math.min(100, item.score)) : 0;
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span
                className={`text-sm ${
                  item.isOurs ? "text-white font-medium" : "text-[var(--muted)]"
                }`}
              >
                {item.isOurs ? `★ ${item.productName}` : item.productName}
              </span>
              <span className="mono text-sm font-medium">{item.score}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04] border border-[var(--border)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-[600ms] ease-out ${
                  item.isOurs ? "bg-white" : "bg-white/40"
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
