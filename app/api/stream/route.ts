import { getRuntime } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

export async function GET(request: Request): Promise<Response> {
  const telemetry = getRuntime();
  const encoder = new TextEncoder();
  let closeStream = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: string, payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
        } catch {
          closed = true;
        }
      };

      const unsubscribe = telemetry.subscribe(send);
      const heartbeat = setInterval(
        () => send("ping", JSON.stringify({ t: Date.now() })),
        HEARTBEAT_MS,
      );
      heartbeat.unref?.();

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // The client may already have torn down the stream.
        }
      };

      closeStream = close;
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
