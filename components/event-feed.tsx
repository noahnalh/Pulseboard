"use client";

import { memo, useMemo, useState } from "react";
import { Download, Pause, Play, Radio, Search, X } from "lucide-react";
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

function csvField(value: string | number): string {
  const raw = String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(events: TelemetryEvent[]): void {
  const header = ["id", "timestamp", "status", "service", "route", "region", "latency_ms", "bytes"];
  const rows = events.map((event) =>
    [
      event.id,
      new Date(event.ts).toISOString(),
      event.status,
      event.service,
      event.route,
      event.region,
      event.latencyMs,
      event.bytes,
    ]
      .map(csvField)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pulseboard-events-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
  const [query, setQuery] = useState("");
  const [service, setService] = useState("all");
  const [errorsOnly, setErrorsOnly] = useState(false);

  const services = useMemo(
    () => [...new Set(events.map((event) => event.service))].sort(),
    [events],
  );
  const activeService =
    service === "all" || services.includes(service) ? service : "all";
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (activeService !== "all" && event.service !== activeService) return false;
      if (errorsOnly && event.status < 500) return false;
      if (!needle) return true;
      return `${event.service} ${event.route} ${event.region} ${event.status} ${event.id}`
        .toLowerCase()
        .includes(needle);
    });
  }, [events, query, activeService, errorsOnly]);
  const filtersActive = query.trim().length > 0 || activeService !== "all" || errorsOnly;

  const clearFilters = () => {
    setQuery("");
    setService("all");
    setErrorsOnly(false);
  };

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
      <div className="flex flex-wrap items-center gap-2 border-t border-edge/60 bg-ink-900/35 px-4 py-2">
        <label className="relative flex min-w-[150px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-3 w-3 text-slate-600" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter service, route, region…"
            aria-label="Filter events"
            className="h-7 w-full rounded-md border border-edge bg-ink-850 pl-7 pr-7 font-mono text-[10px] text-slate-300 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/15"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear event search"
              className="absolute right-1.5 flex h-4 w-4 items-center justify-center rounded text-slate-600 transition-colors hover:text-slate-300"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </label>

        <select
          value={activeService}
          onChange={(event) => setService(event.target.value)}
          aria-label="Filter by service"
          className="h-7 max-w-[132px] rounded-md border border-edge bg-ink-850 px-2 font-mono text-[10px] text-slate-300 focus:border-cyan-400/40 focus:outline-none"
        >
          <option value="all">All services</option>
          {services.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setErrorsOnly((value) => !value)}
          aria-pressed={errorsOnly}
          className={cn(
            "h-7 rounded-md border px-2 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors",
            errorsOnly
              ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
              : "border-edge bg-ink-850 text-slate-500 hover:border-edge-bright hover:text-slate-300",
          )}
        >
          5xx only
        </button>

        {filtersActive ? (
          <button
            type="button"
            onClick={clearFilters}
            className="h-7 rounded-md px-1.5 font-mono text-[9px] text-slate-600 transition-colors hover:text-slate-300"
          >
            clear
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          title="Download filtered events as CSV"
          aria-label="Export filtered events as CSV"
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-edge bg-ink-850 px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400 transition-colors hover:border-edge-bright hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          CSV
        </button>
      </div>

      <div
        className={cn(
          "border-b border-edge/60 bg-ink-900/50 px-4 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600",
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
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Search className="h-4 w-4 text-slate-700" />
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">
              no matching events
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="font-mono text-[9px] text-cyan-400 underline-offset-2 hover:underline"
            >
              reset filters
            </button>
          </div>
        ) : (
          filtered.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
        <span>
          {filtersActive ? `${filtered.length} / ${events.length}` : events.length} rows
          {filtersActive ? " matched" : " buffered"}
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
