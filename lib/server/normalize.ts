import type { TelemetryEvent } from "@/lib/types";
import { randomIdForEvent } from "./generator";

const MAX_CLOCK_SKEW_MS = 30_000;
const MAX_EVENT_AGE_MS = 5 * 60_000;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function firstDefined(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function toStringValue(value: unknown, fallback: string, maxLength = 64): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function toTimestamp(value: unknown): number {
  const now = Date.now();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return now;
}

function clampTimestamp(ts: number): number {
  const now = Date.now();
  return Math.min(now + MAX_CLOCK_SKEW_MS, Math.max(now - MAX_EVENT_AGE_MS, ts));
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Accepts loosely-shaped telemetry (structured events, access logs, or
 * Kafka message payloads) and returns a strictly typed event.
 */
export function normalizeEvent(input: unknown): TelemetryEvent | null {
  const record = asRecord(input);
  if (!record) return null;

  const rawStatus = toNumber(
    firstDefined(record, ["status", "statusCode", "code", "http_status", "responseStatus"]),
    NaN,
  );
  if (!Number.isFinite(rawStatus)) return null;
  const status = Math.round(rawStatus);
  if (status < 100 || status > 599) return null;

  const rawLatency = toNumber(
    firstDefined(record, ["latencyMs", "latency", "duration", "durationMs", "responseTime", "elapsed"]),
    NaN,
  );
  if (!Number.isFinite(rawLatency) || rawLatency < 0) return null;

  const ts = clampTimestamp(
    toTimestamp(firstDefined(record, ["ts", "timestamp", "time", "@timestamp", "date"])),
  );

  const service = toStringValue(
    firstDefined(record, ["service", "serviceName", "app", "source"]),
    "external",
  );

  const region = toStringValue(
    firstDefined(record, ["region", "zone", "availabilityZone", "location"]),
    "unknown",
    32,
  );

  const route = toStringValue(
    firstDefined(record, ["route", "path", "pathname", "url", "endpoint"]),
    "/external",
    128,
  );

  const bytes = Math.max(0, Math.round(toNumber(firstDefined(record, ["bytes", "size", "contentLength"]), 0)));
  const id = toStringValue(firstDefined(record, ["id", "eventId", "requestId", "traceId"]), "", 80);

  return {
    id: id || randomIdForEvent(),
    ts,
    service,
    region,
    route,
    status,
    latencyMs: Math.min(60_000, Math.round(rawLatency)),
    bytes,
  };
}

export function normalizeEventList(payload: unknown): {
  accepted: TelemetryEvent[];
  rejected: number;
} {
  let rawList: unknown[];
  if (Array.isArray(payload)) {
    rawList = payload;
  } else {
    const record = asRecord(payload);
    if (record && Array.isArray(record.events)) {
      rawList = record.events;
    } else if (record && record.events !== undefined) {
      rawList = [record.events];
    } else if (record && record.event !== undefined) {
      rawList = [record.event];
    } else {
      rawList = [payload];
    }
  }

  const accepted: TelemetryEvent[] = [];
  let rejected = 0;
  for (const item of rawList) {
    const event = normalizeEvent(item);
    if (event) accepted.push(event);
    else rejected += 1;
  }
  return { accepted, rejected };
}
