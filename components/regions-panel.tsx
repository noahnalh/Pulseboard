"use client";

import { memo } from "react";
import { cn, formatInteger, formatPercent } from "@/lib/format";
import type { RegionStat } from "@/lib/types";

interface RegionsPanelProps {
  regions: RegionStat[];
}

export const RegionsPanel = memo(function RegionsPanel({ regions }: RegionsPanelProps) {
  const max = Math.max(1, ...regions.map((region) => region.count));

  if (regions.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
        awaiting region data
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2.5">
        {regions.map((region, index) => (
          <div key={region.name} className="flex items-center gap-2.5">
            <span className="w-3 shrink-0 font-mono text-[9px] text-slate-700">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-mono text-[10px] text-slate-300">{region.name}</span>
                <span className="shrink-0 font-mono text-[9px] text-slate-500 tabular-nums">
                  {formatInteger(region.count)}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500/60 to-cyan-400/80 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(3, (region.count / max) * 100)}%` }}
                />
              </div>
            </div>
            <span
              className={cn(
                "w-[52px] shrink-0 text-right font-mono text-[9px] tabular-nums",
                region.errorRate > 5
                  ? "text-rose-300"
                  : region.errorRate > 1
                    ? "text-amber-300"
                    : "text-slate-600",
              )}
            >
              {formatPercent(region.errorRate)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-edge/70 pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
        <span>region</span>
        <span>volume · 5xx</span>
      </div>
    </div>
  );
});
