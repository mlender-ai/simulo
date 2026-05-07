"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AnalysisResult } from "@/lib/storage";

const SERIES_COLORS = [
  "#93c5fd",
  "#86efac",
  "#fca5a5",
  "#d8b4fe",
  "#fdba74",
  "#67e8f9",
  "#f0abfc",
  "#a5f3fc",
];

interface ChartPoint {
  date: string;
  timestamp: number;
  [key: string]: string | number | undefined;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload: ChartPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[#111] shadow-xl px-3 py-2.5 max-w-xs">
      <p className="text-xs text-[var(--muted)] mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="mb-1 last:mb-0">
          <p className="text-[11px] font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}점
          </p>
          <p className="text-[10px] text-white/50 line-clamp-2">
            {entry.payload[`${entry.name}__label`] as string}
          </p>
        </div>
      ))}
      <p className="text-[10px] text-white/30 mt-1.5">클릭하여 리포트 보기</p>
    </div>
  );
}

interface TrendChartProps {
  analyses: AnalysisResult[];
}

export function TrendChart({ analyses }: TrendChartProps) {
  const router = useRouter();

  const { seriesKeys, data } = useMemo(() => {
    const groups = new Map<string, AnalysisResult[]>();
    for (const a of analyses) {
      const key = a.projectTag || "미분류";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    const groupEntries = Array.from(groups.entries());
    for (const [, items] of groupEntries) {
      items.sort((a: AnalysisResult, b: AnalysisResult) => +new Date(a.createdAt) - +new Date(b.createdAt));
    }

    const seriesKeys = Array.from(groups.keys());

    type SeriesPoint = { timestamp: number; date: string; score: number; id: string; label: string };
    const seriesData = new Map<string, SeriesPoint[]>();
    for (const [key, items] of groupEntries) {
      seriesData.set(
        key,
        items.map((a) => ({
          timestamp: +new Date(a.createdAt),
          date: new Date(a.createdAt).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
          }),
          score: a.score,
          id: a.id,
          label: a.hypothesis || a.summary?.slice(0, 50) || "",
        }))
      );
    }

    const seriesDataEntries = Array.from(seriesData.entries());
    const allTimestamps = Array.from(
      new Set(
        Array.from(seriesData.values()).flatMap((pts: SeriesPoint[]) => pts.map((p) => p.timestamp))
      )
    ).sort((a: number, b: number) => a - b);

    const data: ChartPoint[] = allTimestamps.map((ts) => {
      const d = new Date(ts);
      const point: ChartPoint = {
        date: d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
        timestamp: ts,
      };
      for (const [key, pts] of seriesDataEntries) {
        const match = pts.find((p) => p.timestamp === ts);
        if (match) {
          point[key] = match.score;
          point[`${key}__id`] = match.id;
          point[`${key}__label`] = match.label;
        }
      }
      return point;
    });

    return { seriesKeys, data };
  }, [analyses]);

  if (data.length < 2) {
    return (
      <div className="text-center py-16 text-[var(--muted)]">
        <p className="text-sm">트렌드를 표시하려면 분석이 2개 이상 필요합니다</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
          {seriesKeys.length > 1 && (
            <Legend
              wrapperStyle={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                paddingTop: 12,
              }}
            />
          )}
          {seriesKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={1.5}
              dot={{ r: 4, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
              activeDot={{
                r: 6,
                cursor: "pointer",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick: (_event: unknown, payload: any) => {
                  const id = payload?.payload?.[`${key}__id`] as string | undefined;
                  if (id) router.push(`/report/${id}`);
                },
              }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
