"use client";

import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesAnomaly } from "@/lib/detection";
import { formatAxisTime, formatCompact, formatInteger } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";
import { ChartTooltip } from "./chart-tooltip";

interface ThroughputChartProps {
  data: SeriesPoint[];
  anomalies: Map<number, SeriesAnomaly>;
}

function ChartLegend({ anomalyCount }: { anomalyCount: number }) {
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
      {anomalyCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {anomalyCount} anomalies
        </span>
      ) : null}
    </div>
  );
}

export const ThroughputChart = memo(function ThroughputChart({
  data,
  anomalies,
}: ThroughputChartProps) {
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
        <ChartLegend anomalyCount={anomalies.size} />
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
                  <stop offset="0%" stopColor="var(--chart-emerald)" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="var(--chart-emerald)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="throughput-errors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-rose)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--chart-rose)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
              {[...anomalies.values()].map((anomaly) => (
                <ReferenceLine
                  key={anomaly.t}
                  x={anomaly.t}
                  stroke="var(--chart-amber)"
                  strokeDasharray="2 4"
                  strokeOpacity={0.55}
                />
              ))}
              <XAxis
                dataKey="t"
                tickFormatter={(value: number) => formatAxisTime(value)}
                tick={{ fill: "var(--chart-axis)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={44}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(value: number) => formatCompact(value)}
                tick={{ fill: "var(--chart-axis)", fontSize: 9, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="successful"
                name="Successful"
                stackId="traffic"
                stroke="var(--chart-emerald)"
                strokeWidth={1.4}
                fill="url(#throughput-success)"
                isAnimationActive={false}
                activeDot={{ r: 2.5, strokeWidth: 0, fill: "var(--chart-emerald-soft)" }}
              />
              <Area
                type="monotone"
                dataKey="errors"
                name="Errors"
                stackId="traffic"
                stroke="var(--chart-rose)"
                strokeWidth={1.2}
                fill="url(#throughput-errors)"
                isAnimationActive={false}
                activeDot={{ r: 2.5, strokeWidth: 0, fill: "var(--chart-rose-soft)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
