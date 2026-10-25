import { getRuntime } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(getRuntime().snapshot().alerts, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let payload: { id?: unknown };
  try {
    payload = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: "invalid JSON payload" }, { status: 400 });
  }

  if (typeof payload.id !== "string" || payload.id.length === 0) {
    return Response.json({ error: "id must be a non-empty string" }, { status: 400 });
  }

  const runtime = getRuntime();
  if (!runtime.acknowledgeAlert(payload.id)) {
    return Response.json({ error: "alert not found" }, { status: 404 });
  }

  return Response.json({ ok: true, id: payload.id, at: new Date().toISOString() });
}
