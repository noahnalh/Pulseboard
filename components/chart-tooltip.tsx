"use client";

import { formatFullTime, formatInteger, formatLatency } from "@/lib/format";

interface TooltipItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  unit?: "count" | "ms";
}

export function ChartTooltip({ active, payload, label, unit = "count" }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const timestamp = typeof label === "number" ? label : Number(label);
  const rows = payload.filter((item) => typeof item.value === "number");

  return (
    <div className="min-w-[160px] rounded-lg border border-edge-bright bg-ink-900/95 px-3 py-2 shadow-[0_16px_40px_-16px_var(--tooltip-shadow)] backdrop-blur">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
        {Number.isFinite(timestamp) ? `${formatFullTime(timestamp)} UTC` : "—"}
      </div>
      <div className="mt-1.5 space-y-1">
        {rows.map((item, index) => (
          <div
            key={`${String(item.dataKey ?? index)}`}
            className="flex items-center justify-between gap-4 text-[11px]"
          >
            <span className="flex items-center gap-1.5 text-slate-400">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: item.color ?? "#34d399" }}
              />
              {String(item.name ?? item.dataKey ?? "")}
            </span>
            <span className="font-mono text-slate-200 tabular-nums">
              {unit === "ms"
                ? formatLatency(Number(item.value))
                : formatInteger(Number(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
