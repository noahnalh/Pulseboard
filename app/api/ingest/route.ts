import { normalizeEventList } from "@/lib/server/normalize";
import { getRuntime } from "@/lib/server/runtime";
import type { TelemetryEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000_000;
const MAX_EVENTS = 5_000;

export async function POST(request: Request): Promise<Response> {
  const token = process.env.INGEST_TOKEN;
  if (token && request.headers.get("x-ingest-token") !== token) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let payload: unknown;

  try {
    if (contentType.includes("ndjson") || contentType.includes("text/plain")) {
      payload = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as unknown);
    } else {
      payload = JSON.parse(raw) as unknown;
    }
  } catch {
    return Response.json({ error: "invalid JSON payload" }, { status: 400 });
  }

  let accepted: TelemetryEvent[] = [];
  let rejected = 0;

  if (Array.isArray(payload)) {
    const { accepted: normalized, rejected: invalid } = normalizeEventList(payload.slice(0, MAX_EVENTS));
    accepted = normalized;
    rejected = invalid + Math.max(0, payload.length - MAX_EVENTS);
  } else {
    const { accepted: normalized, rejected: invalid } = normalizeEventList(payload);
    accepted = normalized;
    rejected = invalid;
  }

  if (accepted.length === 0) {
    return Response.json(
      {
        accepted: 0,
        rejected,
        error: "no valid events; status and latencyMs are required",
      },
      { status: 422 },
    );
  }

  getRuntime().ingestMany(accepted);

  return Response.json({
    accepted: accepted.length,
    rejected,
    at: new Date().toISOString(),
  });
}

export async function GET(): Promise<Response> {
  return Response.json({
    endpoint: "POST /api/ingest",
    body: "A single event, an array of events, or { events: [...] }",
    required: ["status", "latencyMs"],
    optional: ["id", "ts", "service", "region", "route", "bytes"],
    formats: ["application/json", "application/x-ndjson", "text/plain"],
    maxEventsPerRequest: MAX_EVENTS,
  });
}
