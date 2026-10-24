"use client";

import { memo } from "react";
import { Pause, Play, Radio } from "lucide-react";
import {
  cn,
  formatFullTime,
  formatLatency,
  statusTone,
  type StatusTone,
} from "@/lib/format";
import type { ConnectionState, TelemetryEvent } from "@/lib/types";
import { Panel } from "./panel";

interface EventFeedProps {
  events: TelemetryEvent[];
  status: ConnectionState;
  paused: boolean;
  onTogglePause: () => void;
}

const ROW_GRID =
  "grid grid-cols-[62px_44px_minmax(0,1fr)_50px] items-center gap-2 lg:grid-cols-[74px_48px_minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.85fr)_54px]";

function latencyClass(latency: number): string {
  if (latency >= 1_000) return "text-rose-300";
  if (latency >= 300) return "text-amber-300";
  return "text-slate-400";
}

const EventRow = memo(function EventRow({ event }: { event: TelemetryEvent }) {
  const tone: StatusTone = statusTone(event.status);
  const isError = event.status >= 500;

  return (
    <div
      className={cn(
        "feed-row group border-b border-edge/40 px-4 py-1.5 transition-colors hover:bg-white/[0.025]",
        ROW_GRID,
        isError && "bg-rose-500/[0.035]",
      )}
    >
      <span className="font-mono text-[9px] text-slate-500 tabular-nums">
        {formatFullTime(event.ts)}
      </span>
      <span
        className={cn(
          "w-fit rounded border px-1 py-px font-mono text-[9px] leading-none tabular-nums",
          tone.chip,
        )}
      >
        {event.status}
      </span>
      <span className="truncate font-mono text-[10px] text-slate-300">{event.service}</span>
      <span className="hidden truncate font-mono text-[10px] text-slate-500 lg:block">
        {event.route}
      </span>
      <span className="hidden truncate font-mono text-[9px] text-slate-600 lg:block">
        {event.region}
      </span>
      <span
        className={cn(
          "text-right font-mono text-[9px] tabular-nums",
          latencyClass(event.latencyMs),
        )}
      >
        {formatLatency(event.latencyMs)}
      </span>
    </div>
  );
});

export function EventFeed({ events, status, paused, onTogglePause }: EventFeedProps) {
  const streaming = status === "live" || status === "connecting" || status === "reconnecting";

  return (
    <Panel
      title="Event stream"
      subtitle="Newest first · ring buffer capped at 220"
      icon={<Radio className="h-3.5 w-3.5" />}
      flush
      action={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] sm:inline-flex",
              paused ? "text-slate-500" : "text-emerald-400",
            )}
          >
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                paused ? "bg-slate-500" : "bg-emerald-400 live-dot",
              )}
            />
            {paused ? "frozen" : "streaming"}
          </span>
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? "Resume event stream" : "Freeze event stream"}
            className="flex h-6 w-6 items-center justify-center rounded border border-edge bg-ink-850 text-slate-400 transition-colors hover:border-edge-bright hover:text-white"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
        </div>
      }
    >
      <div
        className={cn(
          "border-y border-edge/60 bg-ink-900/50 px-4 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600",
          ROW_GRID,
        )}
      >
        <span>time utc</span>
        <span>code</span>
        <span>service</span>
        <span className="hidden lg:block">route</span>
        <span className="hidden lg:block">region</span>
        <span className="text-right">latency</span>
      </div>

      <div className="scroll-thin h-[300px] overflow-y-auto overscroll-contain">
        {events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Radio className="h-4 w-4 text-slate-700" />
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">
              waiting for events
            </p>
            <p className="max-w-[240px] text-[10px] text-slate-700">
              POST to /api/ingest or let the simulator warm up.
            </p>
          </div>
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
        <span>
          {events.length} rows buffered
          {paused ? " · updates held" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              streaming && !paused ? "bg-emerald-400" : "bg-slate-600",
            )}
          />
          sse /api/stream
        </span>
      </div>
    </Panel>
  );
}
