"use client";

import { memo, useState } from "react";
import { cn, formatCompact, formatInteger, formatLatency } from "@/lib/format";
import type { ServiceStat, StatusClass } from "@/lib/types";

interface ServicesPanelProps {
  services: ServiceStat[];
}

const STATUS_COLUMNS: Array<{ key: StatusClass; color: string; label: string }> = [
  { key: "2xx", color: "var(--chart-emerald)", label: "2xx" },
  { key: "3xx", color: "var(--chart-sky)", label: "3xx" },
  { key: "4xx", color: "var(--chart-amber)", label: "4xx" },
  { key: "5xx", color: "var(--chart-rose)", label: "5xx" },
];

function RankedServices({ services }: { services: ServiceStat[] }) {
  const max = Math.max(1, ...services.map((service) => service.count));

  return (
    <div className="divide-y divide-edge/50">
      {services.map((service) => {
        const width = Math.max(2, (service.count / max) * 100);
        return (
          <div key={service.name} className="py-2.5 first:pt-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/80 shadow-[0_0_6px_var(--accent-glow)]" />
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
                  className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-[width] duration-700 ease-out"
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
  );
}

function ServiceMatrix({ services }: { services: ServiceStat[] }) {
  const maxCell = Math.max(
    1,
    ...services.flatMap((service) =>
      STATUS_COLUMNS.map((column) => service.status?.[column.key] ?? 0),
    ),
  );

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,38px)] items-center gap-1 border-b border-edge/60 pb-1.5 font-mono text-[7px] uppercase tracking-[0.12em] text-slate-600">
        <span>service</span>
        {STATUS_COLUMNS.map((column) => (
          <span key={column.key} className="text-center" style={{ color: column.color }}>
            {column.label}
          </span>
        ))}
      </div>
      <div className="divide-y divide-edge/40">
        {services.map((service) => (
          <div
            key={service.name}
            className="grid grid-cols-[minmax(0,1fr)_repeat(4,38px)] items-center gap-1 py-2"
          >
            <div className="min-w-0 pr-2">
              <p className="truncate font-mono text-[10px] text-slate-300">{service.name}</p>
              <p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-slate-600">
                {formatCompact(service.count)} total · {formatLatency(service.p95)}
              </p>
            </div>
            {STATUS_COLUMNS.map((column) => {
              const value = service.status?.[column.key] ?? 0;
              const intensity = Math.log1p(value) / Math.log1p(maxCell);
              return (
                <div
                  key={column.key}
                  title={`${service.name} ${column.label}: ${formatInteger(value)}`}
                  className="flex h-7 items-center justify-center rounded border border-white/[0.04] font-mono text-[8px] tabular-nums text-slate-300"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${column.color} ${
                      4 + intensity * 34
                    }%, transparent)`,
                    boxShadow: value > 0 ? `inset 0 0 12px color-mix(in srgb, ${column.color} 9%, transparent)` : undefined,
                  }}
                >
                  {value === 0 ? <span className="text-slate-700">·</span> : formatCompact(value)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-edge/70 pt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">
        <span>cell · volume</span>
        <span>darker = higher</span>
      </div>
    </div>
  );
}

export const ServicesPanel = memo(function ServicesPanel({ services }: ServicesPanelProps) {
  const [mode, setMode] = useState<"ranked" | "matrix">("ranked");

  if (services.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-edge/70 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
        awaiting service data
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2.5 flex items-center gap-1 self-start rounded-lg border border-edge bg-ink-900 p-0.5">
        {(["ranked", "matrix"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            aria-pressed={mode === option}
            className={cn(
              "h-6 rounded-md px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors",
              mode === option
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(var(--accent-rgb),0.25)]"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {mode === "ranked" ? (
          <RankedServices services={services} />
        ) : (
          <ServiceMatrix services={services} />
        )}
      </div>

      {mode === "ranked" ? (
        <div className="mt-auto flex items-center justify-between border-t border-edge/70 pt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
          <span>bar · volume</span>
          <span>right · p95</span>
        </div>
      ) : null}
    </div>
  );
});
