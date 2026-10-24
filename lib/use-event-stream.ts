"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ConnectionState,
  ControlPayload,
  EventBatch,
  StreamSnapshot,
  TelemetryEvent,
} from "./types";

const MAX_FEED_EVENTS = 220;

interface StreamBuffer {
  snapshot: StreamSnapshot | null;
  events: TelemetryEvent[];
}

export interface EventStreamState {
  snapshot: StreamSnapshot | null;
  events: TelemetryEvent[];
  status: ConnectionState;
  paused: boolean;
  togglePause: () => void;
  setRate: (rate: number) => Promise<void>;
  trigger: (action: NonNullable<ControlPayload["action"]>) => Promise<void>;
}

export function useEventStream(): EventStreamState {
  const [snapshot, setSnapshot] = useState<StreamSnapshot | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [paused, setPaused] = useState(false);

  const pausedRef = useRef(false);
  const sourceRef = useRef<EventSource | null>(null);
  const bufferRef = useRef<StreamBuffer>({ snapshot: null, events: [] });
  const frameRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const flush = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (pausedRef.current) return;

      const buffered = bufferRef.current;
      bufferRef.current = { snapshot: null, events: [] };

      if (buffered.snapshot) setSnapshot(buffered.snapshot);

      if (buffered.events.length > 0) {
        const seen = seenIdsRef.current;
        const fresh: TelemetryEvent[] = [];
        for (const event of buffered.events) {
          if (seen.has(event.id)) continue;
          seen.add(event.id);
          fresh.push(event);
        }
        if (fresh.length > 0) {
          fresh.reverse();
          setEvents((previous) => {
            const merged = fresh.concat(previous);
            if (merged.length > MAX_FEED_EVENTS) {
              const dropped = merged.splice(MAX_FEED_EVENTS);
              for (const event of dropped) seen.delete(event.id);
            }
            return merged;
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/stream");
    sourceRef.current = source;

    source.onopen = () => {
      if (!pausedRef.current) setStatus("live");
    };

    source.onerror = () => {
      if (!pausedRef.current) setStatus("reconnecting");
    };

    const handleSnapshot = (message: MessageEvent<string>) => {
      if (pausedRef.current) return;
      try {
        bufferRef.current.snapshot = JSON.parse(message.data) as StreamSnapshot;
        flush();
      } catch {
        // Ignore malformed frames; the next snapshot will arrive shortly.
      }
    };

    const handleEvents = (message: MessageEvent<string>) => {
      if (pausedRef.current) return;
      try {
        const batch = JSON.parse(message.data) as EventBatch;
        if (Array.isArray(batch.events) && batch.events.length > 0) {
          bufferRef.current.events.push(...batch.events);
          flush();
        }
      } catch {
        // Ignore malformed frames.
      }
    };

    source.addEventListener("snapshot", handleSnapshot as EventListener);
    source.addEventListener("events", handleEvents as EventListener);

    return () => {
      source.removeEventListener("snapshot", handleSnapshot as EventListener);
      source.removeEventListener("events", handleEvents as EventListener);
      source.close();
      sourceRef.current = null;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [flush]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    bufferRef.current = { snapshot: null, events: [] };
    setPaused(next);
    setStatus(
      next
        ? "paused"
        : sourceRef.current?.readyState === EventSource.OPEN
          ? "live"
          : "reconnecting",
    );
  }, []);

  const setRate = useCallback(async (rate: number) => {
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate }),
      });
    } catch {
      // The stream remains the source of truth; the next snapshot reflects the rate.
    }
  }, []);

  const trigger = useCallback(async (action: NonNullable<ControlPayload["action"]>) => {
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Ignore transient failures from the demo control endpoint.
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
      event.preventDefault();
      togglePause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause]);

  return { snapshot, events, status, paused, togglePause, setRate, trigger };
}
