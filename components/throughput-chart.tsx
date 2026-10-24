"use client";

import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisTime, formatCompact, formatInteger } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";
import { ChartTooltip } from "./chart-tooltip";

interface ThroughputChartProps {
  data: SeriesPoint[];
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        successful
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        errors
      </span>
    </div>
  );
}

export const ThroughputChart = memo(function ThroughputChart({ data }: ThroughputChartProps) {
  const chartData = useMemo(
    () =>
      data.map((point) => ({
        t: point.t,
        successful: Math.max(0, point.eps - point.errors),
        errors: point.errors,
      })),
    [data],
  );

  const latest = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <ChartLegend />
        <span className="font-mono text-[10px] text-slate-500">
          latest{" "}
          <span className="text-slate-300">{latest ? formatInteger(latest.eps) : "—"}</span> ev/s
        </span>
      </div>

      <div className="h-[236px] w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
            waiting for telemetry
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="throughput-success" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="throughput-errors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" strokeDasharray="3 5" />
              <XAxis
                dataKey="t"
                tickFormatter={(value: number) => formatAxisTime(value)}
                tick={{ fill: "#5b6b80", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={44}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value: number) => formatCompact(value)}
                tick={{ fill: "#5b6b80", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "rgba(148,163,184,0.18)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="successful"
                name="Successful"
                stackId="traffic"
                stroke="#34d399"
                strokeWidth={1.4}
                fill="url(#throughput-success)"
                isAnimationActive={false}
                activeDot={{ r: 2.5, strokeWidth: 0, fill: "#6ee7b7" }}
              />
              <Area
                type="monotone"
                dataKey="errors"
                name="Errors"
                stackId="traffic"
                stroke="#fb7185"
                strokeWidth={1.2}
                fill="url(#throughput-errors)"
                isAnimationActive={false}
                activeDot={{ r: 2.5, strokeWidth: 0, fill: "#fda4af" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
