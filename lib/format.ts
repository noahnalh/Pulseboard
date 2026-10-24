import type { StatusClass } from "./types";

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const axisClockFormatter = new Intl.DateTimeFormat("en-GB", {
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const fullClockFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hour12: false,
  timeZone: "UTC",
});

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatLatency(value: number): string {
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}s`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function formatClock(ts: number): string {
  return clockFormatter.format(new Date(ts));
}

export function formatAxisTime(ts: number): string {
  return axisClockFormatter.format(new Date(ts));
}

export function formatFullTime(ts: number): string {
  return fullClockFormatter.format(new Date(ts));
}

export function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remaining = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
  return `${remaining}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} kB`;
  return `${bytes} B`;
}

export interface StatusTone {
  label: string;
  text: string;
  chip: string;
  dot: string;
  hex: string;
}

const STATUS_TONES: Record<StatusClass, StatusTone> = {
  "2xx": {
    label: "Success",
    text: "text-emerald-300",
    chip: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    dot: "bg-emerald-400",
    hex: "#34d399",
  },
  "3xx": {
    label: "Redirect",
    text: "text-sky-300",
    chip: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    dot: "bg-sky-400",
    hex: "#38bdf8",
  },
  "4xx": {
    label: "Client err",
    text: "text-amber-300",
    chip: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    dot: "bg-amber-400",
    hex: "#fbbf24",
  },
  "5xx": {
    label: "Server err",
    text: "text-rose-300",
    chip: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    dot: "bg-rose-400",
    hex: "#fb7185",
  },
};

export function statusTone(status: number): StatusTone {
  if (status >= 500) return STATUS_TONES["5xx"];
  if (status >= 400) return STATUS_TONES["4xx"];
  if (status >= 300) return STATUS_TONES["3xx"];
  return STATUS_TONES["2xx"];
}

export function statusClassOf(status: number): StatusClass {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

export { STATUS_TONES };
