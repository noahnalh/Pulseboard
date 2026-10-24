import { getRuntime } from "@/lib/server/runtime";
import type { ControlPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["error-spike", "traffic-surge", "reset"]);

export async function POST(request: Request): Promise<Response> {
  let payload: ControlPayload;
  try {
    payload = (await request.json()) as ControlPayload;
  } catch {
    return Response.json({ error: "invalid JSON payload" }, { status: 400 });
  }

  const runtime = getRuntime();
  const result: Record<string, unknown> = {};

  if (payload.rate !== undefined) {
    if (typeof payload.rate !== "number" || !Number.isFinite(payload.rate)) {
      return Response.json({ error: "rate must be a finite number" }, { status: 400 });
    }
    result.rate = runtime.setRate(payload.rate);
  }

  if (payload.action !== undefined) {
    if (!ACTIONS.has(payload.action)) {
      return Response.json({ error: "unknown action" }, { status: 400 });
    }
    runtime.trigger(payload.action);
    result.action = payload.action;
  }

  if (Object.keys(result).length === 0) {
    return Response.json({ error: "provide a rate or action" }, { status: 400 });
  }

  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function GET(): Promise<Response> {
  const snapshot = getRuntime().snapshot();
  return Response.json({
    rate: snapshot.meta.targetRate,
    actions: [...ACTIONS],
  });
}
