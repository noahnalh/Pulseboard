"use client";

import { memo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatInteger, formatPercent, STATUS_TONES } from "@/lib/format";
import type { StatusSlice, StreamMetrics } from "@/lib/types";

interface StatusPanelProps {
  status: StatusSlice[];
  metrics: StreamMetrics | null;
}

export const StatusPanel = memo(function StatusPanel({ status, metrics }: StatusPanelProps) {
  const total = status.reduce((sum, slice) => sum + slice.value, 0);
  const successRate = metrics?.successRate ?? (total > 0 ? (1 - (status[3]?.value ?? 0) / total) * 100 : 0);

  return (
    <div className="flex h-full flex-col">
      <div className="relative mx-auto h-[172px] w-full max-w-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total > 0 ? status : [{ name: "2xx", value: 1 }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={74}
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {total > 0 ? (
                status.map((slice) => (
                  <Cell key={slice.name} fill={STATUS_TONES[slice.name].hex} fillOpacity={0.9} />
                ))
              ) : (
                <Cell fill="var(--chart-muted)" />
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-semibold leading-none text-white tabular-nums">
            {total > 0 ? formatPercent(successRate) : "—"}
          </span>
          <span className="mt-1.5 text-[8px] uppercase tracking-[0.2em] text-slate-500">success</span>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {status.map((slice) => {
          const tone = STATUS_TONES[slice.name];
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          return (
            <div key={slice.name} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.hex }} />
                <span className="font-mono text-[9px] text-slate-500">{slice.name}</span>
                {tone.label}
              </span>
              <span className="font-mono text-[10px] text-slate-300 tabular-nums">
                {formatInteger(slice.value)}
                <span className="ml-1.5 text-slate-600">{pct.toFixed(0)}%</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-edge/70 pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
        <span>window</span>
        <span className="text-slate-400">{formatInteger(total)} events</span>
      </div>
    </div>
  );
});
