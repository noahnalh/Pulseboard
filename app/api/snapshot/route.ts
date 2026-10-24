import { getRuntime } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(getRuntime().snapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
