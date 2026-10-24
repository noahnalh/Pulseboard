"use client";

import { memo } from "react";
import { formatInteger, formatLatency } from "@/lib/format";
import type { ServiceStat } from "@/lib/types";

interface ServicesPanelProps {
  services: ServiceStat[];
}

export const ServicesPanel = memo(function ServicesPanel({ services }: ServicesPanelProps) {
  const max = Math.max(1, ...services.map((service) => service.count));

  if (services.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
        awaiting service data
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="divide-y divide-edge/50">
        {services.map((service) => {
          const width = Math.max(2, (service.count / max) * 100);
          return (
            <div key={service.name} className="py-2.5 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
                  <span className="truncate font-mono text-[11px] text-slate-300">
                    {service.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {service.errors > 0 ? (
                    <span className="rounded border border-rose-400/20 bg-rose-400/10 px-1.5 py-px font-mono text-[9px] text-rose-300">
                      {formatInteger(service.errors)} err
                    </span>
                  ) : null}
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    {formatInteger(service.count)}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500/70 to-emerald-400/80 transition-[width] duration-700 ease-out"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="w-[42px] shrink-0 text-right font-mono text-[9px] text-slate-600">
                  {formatLatency(service.p95)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-edge/70 pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
        <span>bar · volume</span>
        <span>right · p95</span>
      </div>
    </div>
  );
});
