"use client";

import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisTime, formatLatency } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";
import { ChartTooltip } from "./chart-tooltip";

interface LatencyChartProps {
  data: SeriesPoint[];
}

const SERIES = [
  { key: "p50", label: "p50", color: "#34d399" },
  { key: "p95", label: "p95", color: "#fbbf24" },
  { key: "p99", label: "p99", color: "#fb7185" },
] as const;

export const LatencyChart = memo(function LatencyChart({ data }: LatencyChartProps) {
  const latest = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
          {SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          p95 <span className="text-amber-300">{latest ? formatLatency(latest.p95) : "—"}</span>
        </span>
      </div>

      <div className="h-[196px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
            waiting for telemetry
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" strokeDasharray="3 5" />
              <XAxis
                dataKey="t"
                tickFormatter={(value: number) => formatAxisTime(value)}
                tick={{ fill: "#5b6b80", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value: number) => formatLatency(value)}
                tick={{ fill: "#5b6b80", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={52}
                domain={[0, "auto"]}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip unit="ms" />}
                cursor={{ stroke: "rgba(148,163,184,0.18)", strokeWidth: 1 }}
              />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={series.key === "p95" ? 1.8 : 1.3}
                  dot={false}
                  activeDot={{ r: 2.5, strokeWidth: 0, fill: series.color }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
