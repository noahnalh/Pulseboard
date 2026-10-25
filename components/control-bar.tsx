"use client";

import { AlertTriangle, RotateCcw, Zap } from "lucide-react";
import { cn } from "@/lib/format";
import type { ControlPayload } from "@/lib/types";

interface ControlBarProps {
  rate: number | null;
  range: number;
  onRateChange: (rate: number) => void;
  onRangeChange: (range: number) => void;
  onTrigger: (action: NonNullable<ControlPayload["action"]>) => void;
}

const RATE_OPTIONS = [
  { value: 60, label: "60" },
  { value: 120, label: "120" },
  { value: 300, label: "300" },
  { value: 600, label: "600" },
  { value: 1_200, label: "1.2k" },
];

const RANGE_OPTIONS = [
  { value: 60, label: "60s" },
  { value: 120, label: "2m" },
  { value: 240, label: "4m" },
];

export function ControlBar({ rate, range, onRateChange, onRangeChange, onTrigger }: ControlBarProps) {
  return (
    <div className="panel mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 px-3.5 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="panel-title">Ingest rate</span>
        <div className="flex items-center rounded-lg border border-edge bg-ink-900 p-0.5">
          {RATE_OPTIONS.map((option) => {
            const active = rate === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onRateChange(option.value)}
                aria-pressed={active}
                className={cn(
                  "h-6 rounded-md px-2.5 font-mono text-[10px] transition-colors",
                  active
                    ? "bg-emerald-400/15 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
                )}
              >
                {option.label}
              </button>
            );
          })}
          <span className="pr-2 pl-1 font-mono text-[9px] text-slate-600">ev/s</span>
        </div>
      </div>

      <div className="hidden h-5 w-px bg-edge sm:block" />

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="panel-title">Chart window</span>
        <div className="flex items-center rounded-lg border border-edge bg-ink-900 p-0.5">
          {RANGE_OPTIONS.map((option) => {
            const active = range === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onRangeChange(option.value)}
                aria-pressed={active}
                className={cn(
                  "h-6 rounded-md px-2.5 font-mono text-[10px] transition-colors",
                  active
                    ? "bg-cyan-400/15 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden h-5 w-px bg-edge sm:block" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="panel-title">Scenarios</span>
        <button
          type="button"
          onClick={() => onTrigger("error-spike")}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-rose-400/20 bg-rose-400/[0.07] px-2.5 text-[10px] font-medium text-rose-300 transition-colors hover:border-rose-400/40 hover:bg-rose-400/10"
        >
          <AlertTriangle className="h-3 w-3" />
          Error spike
        </button>
        <button
          type="button"
          onClick={() => onTrigger("traffic-surge")}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-cyan-400/20 bg-cyan-400/[0.07] px-2.5 text-[10px] font-medium text-cyan-300 transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/10"
        >
          <Zap className="h-3 w-3" />
          Traffic surge
        </button>
        <button
          type="button"
          onClick={() => onTrigger("reset")}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-ink-850 px-2.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-edge-bright hover:text-slate-200"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="ml-auto hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600 xl:flex">
        <kbd className="rounded border border-edge bg-ink-800 px-1.5 py-0.5 text-[9px] text-slate-400">
          Space
        </kbd>
        freeze stream
      </div>
    </div>
  );
}
