import type { APIRoute } from "astro";

import { activityStatusStore } from "./store";
import type { ActivitySnapshot } from "./types";

export const prerender = false;

const encoder = new TextEncoder();
const HEARTBEAT_INTERVAL_MS = 15_000;

function encodeSnapshot(snapshot: ActivitySnapshot | null): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`);
}

function encodeHeartbeat(): Uint8Array {
  return encoder.encode(`: heartbeat ${Date.now()}\n\n`);
}

export const GET: APIRoute = ({ request }) => {
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // Connection has already been closed by the runtime.
        }
      };

      const pushSnapshot = (snapshot: ActivitySnapshot | null) => {
        if (closed) return;
        controller.enqueue(encodeSnapshot(snapshot));
      };

      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        controller.enqueue(encodeHeartbeat());
      }, HEARTBEAT_INTERVAL_MS);

      heartbeatTimer.unref?.();

      const unsubscribe = activityStatusStore.subscribe(pushSnapshot);
      pushSnapshot(activityStatusStore.getSnapshot());

      const abortHandler = () => {
        close();
      };

      request.signal.addEventListener("abort", abortHandler, { once: true });

      cleanup = () => {
        clearInterval(heartbeatTimer);
        unsubscribe();
        request.signal.removeEventListener("abort", abortHandler);
      };
    },
    cancel() {
      cleanup();
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
};
