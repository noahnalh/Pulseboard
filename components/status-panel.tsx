"use client";

import { memo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn, formatInteger, formatPercent, STATUS_TONES } from "@/lib/format";
import type { ServiceStat, StatusSlice, StreamMetrics } from "@/lib/types";

interface StatusPanelProps {
  status: StatusSlice[];
  metrics: StreamMetrics | null;
  services: ServiceStat[];
}

const FLOW_STATUSES = ["2xx", "3xx", "4xx", "5xx"] as const;

function TrafficFlow({ services }: { services: ServiceStat[] }) {
  const sources = services.slice(0, 5);
  const sourceTop = 24;
  const sourceHeight = 168;
  const targetTop = 34;
  const targetHeight = 148;
  const maxLink = Math.max(
    1,
    ...sources.flatMap((service) =>
      FLOW_STATUSES.map((status) => service.status?.[status] ?? 0),
    ),
  );

  const sourceY = (index: number) =>
    sources.length <= 1 ? sourceTop + sourceHeight / 2 : sourceTop + (index / (sources.length - 1)) * sourceHeight;
  const targetY = (index: number) =>
    targetTop + (index / (FLOW_STATUSES.length - 1)) * targetHeight;

  return (
    <svg
      viewBox="0 0 320 200"
      className="h-[176px] w-full"
      role="img"
      aria-label="Traffic flow from services to response classes"
    >
      {sources.flatMap((service, sourceIndex) =>
        FLOW_STATUSES.map((status, targetIndex) => {
          const value = service.status?.[status] ?? 0;
          if (value <= 0) return null;
          const normalized = Math.log1p(value) / Math.log1p(maxLink);
          const sy = sourceY(sourceIndex);
          const ty = targetY(targetIndex);
          const color = STATUS_TONES[status].hex;
          return (
            <path
              key={`${service.name}-${status}`}
              d={`M 96 ${sy} C 154 ${sy}, 184 ${ty}, 232 ${ty}`}
              fill="none"
              stroke={color}
              strokeWidth={0.5 + normalized * 6.5}
              strokeOpacity={0.08 + normalized * 0.34}
              strokeLinecap="round"
            >
              <title>
                {service.name} → {status}: {formatInteger(value)}
              </title>
            </path>
          );
        }),
      )}

      {sources.map((service, index) => {
        const y = sourceY(index);
        return (
          <g key={service.name}>
            <circle cx="96" cy={y} r="2" fill="var(--accent)" />
            <text
              x="88"
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-400 font-mono text-[7px]"
            >
              {service.name}
            </text>
          </g>
        );
      })}

      {FLOW_STATUSES.map((status, index) => {
        const y = targetY(index);
        const total = sources.reduce((sum, service) => sum + (service.status?.[status] ?? 0), 0);
        return (
          <g key={status}>
            <circle cx="232" cy={y} r="2" fill={STATUS_TONES[status].hex} />
            <text
              x="240"
              y={y - 4}
              dominantBaseline="middle"
              fill={STATUS_TONES[status].hex}
              className="font-mono text-[7px]"
            >
              {status}
            </text>
            <text
              x="240"
              y={y + 6}
              dominantBaseline="middle"
              className="fill-slate-600 font-mono text-[6px] tabular-nums"
            >
              {formatInteger(total)}
            </text>
          </g>
        );
      })}

      <text
        x="96"
        y="12"
        textAnchor="middle"
        className="fill-slate-600 font-mono text-[6px] uppercase tracking-[0.16em]"
      >
        service
      </text>
      <text
        x="232"
        y="12"
        textAnchor="middle"
        className="fill-slate-600 font-mono text-[6px] uppercase tracking-[0.16em]"
      >
        outcome
      </text>
    </svg>
  );
}

export const StatusPanel = memo(function StatusPanel({
  status,
  metrics,
  services,
}: StatusPanelProps) {
  const [mode, setMode] = useState<"donut" | "flow">("donut");
  const total = status.reduce((sum, slice) => sum + slice.value, 0);
  const successRate =
    metrics?.successRate ?? (total > 0 ? (1 - (status[3]?.value ?? 0) / total) * 100 : 0);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center gap-1 self-start rounded-lg border border-edge bg-ink-900 p-0.5">
        {(["donut", "flow"] as const).map((option) => (
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

      {mode === "donut" ? (
        <div className="relative mx-auto h-[164px] w-full max-w-[204px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={total > 0 ? status : [{ name: "2xx", value: 1 }]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={72}
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
            <span className="mt-1.5 text-[8px] uppercase tracking-[0.2em] text-slate-500">
              success
            </span>
          </div>
        </div>
      ) : (
        <TrafficFlow services={services} />
      )}

      <div className="mt-1 space-y-1">
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
