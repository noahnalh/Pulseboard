"use client";

import { useSyncExternalStore } from "react";
import { Activity, Pause, Play, Radio, ShieldAlert, Users } from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import type { ConnectionState, StreamMeta } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  status: ConnectionState;
  paused: boolean;
  meta: StreamMeta | null;
  alertCount: number;
  criticalAlerts: number;
  onOpenAlerts: () => void;
  onTogglePause: () => void;
}

const STATUS_UI: Record<ConnectionState, { label: string; pill: string; dot: string }> = {
  connecting: {
    label: "Connecting",
    pill: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    dot: "bg-amber-400",
  },
  live: {
    label: "Live",
    pill: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
  reconnecting: {
    label: "Reconnecting",
    pill: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    dot: "bg-amber-400",
  },
  paused: {
    label: "Paused",
    pill: "border-slate-400/20 bg-slate-400/10 text-slate-300",
    dot: "bg-slate-400",
  },
};

function subscribeToClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
}

function getClockSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function getServerClockSnapshot(): number {
  return 0;
}

function UtcClock() {
  const now = useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);

  return (
    <span className="font-mono text-[11px] text-slate-400">
      {now > 0 ? formatClock(now) : "--:--:--"}
      <span className="ml-1.5 text-[9px] tracking-[0.18em] text-slate-600">UTC</span>
    </span>
  );
}

export function Header({
  status,
  paused,
  meta,
  alertCount,
  criticalAlerts,
  onOpenAlerts,
  onTogglePause,
}: HeaderProps) {
  const statusUi = STATUS_UI[status];
  const kafkaSource = !meta
    ? "ingest"
    : meta.kafkaMode === "off"
      ? "simulator"
      : "kafka";
  const kafkaTone =
    !meta
      ? "border-slate-400/20 bg-slate-400/10 text-slate-400"
      : meta.kafkaStatus === "live"
        ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"
        : meta.kafkaStatus === "error"
          ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
          : "border-slate-400/20 bg-slate-400/10 text-slate-300";

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 shadow-[0_0_40px_-12px_rgba(52,211,153,0.65)]">
          <Activity className="h-5 w-5 text-emerald-300" strokeWidth={2.2} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[19px] font-semibold tracking-tight text-white sm:text-xl">
              Pulseboard
            </h1>
            <span className="rounded border border-edge bg-ink-800 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] text-slate-500">
              v1.0
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Realtime event telemetry · 60s rolling window
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em]",
            kafkaTone,
          )}
          title={
            meta?.kafkaMode === "off"
              ? "In-process simulator feeding the event bus"
              : `Kafka ${meta?.kafkaMode ?? ""} mode · ${meta?.kafkaStatus ?? "off"}`
          }
        >
          <Radio className="h-3 w-3" />
          {kafkaSource}
          {meta && meta.kafkaMode !== "off" ? (
            <span className="text-[8px] opacity-70">{meta.kafkaStatus}</span>
          ) : null}
        </span>

        <span className="hidden items-center gap-1.5 rounded-full border border-edge bg-ink-850 px-2.5 py-1 font-mono text-[10px] text-slate-400 sm:inline-flex">
          <Users className="h-3 w-3 text-slate-500" />
          {meta?.subscribers ?? 1} {meta?.subscribers === 1 ? "client" : "clients"}
        </span>

        <span className="hidden rounded-full border border-edge bg-ink-850 px-2.5 py-1 md:inline-flex">
          <UtcClock />
        </span>

        <button
          type="button"
          onClick={onOpenAlerts}
          aria-label={`Open alert center, ${alertCount} active alerts`}
          title={alertCount > 0 ? `${alertCount} active alerts` : "Alert center"}
          className={cn(
            "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-colors",
            criticalAlerts > 0
              ? "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
              : alertCount > 0
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                : "border-edge bg-ink-850 text-slate-400 hover:border-edge-bright hover:text-white",
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="tabular-nums">{alertCount}</span>
        </button>

        <ThemeToggle />

        <button
          type="button"
          onClick={onTogglePause}
          aria-pressed={paused}
          className={cn(
            "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors",
            paused
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
              : "border-edge bg-ink-850 text-slate-300 hover:border-edge-bright hover:text-white",
          )}
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {paused ? "Resume" : "Pause"}
        </button>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            statusUi.pill,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", statusUi.dot, !paused && "live-dot")} />
          {statusUi.label}
        </span>
      </div>
    </header>
  );
}
