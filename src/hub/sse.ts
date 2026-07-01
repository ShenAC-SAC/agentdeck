import type { EventEmitter } from "node:events";
import type { Registry } from "./registry";
import type { Session } from "../types";

// Server-Sent Events stream of session truth: one `data:` line per current
// session as an initial snapshot, then one line per subsequent registry
// update. A periodic `:` comment heartbeat keeps the socket under the server's
// idle timeout so the connection stays live instead of being dropped and
// reconnected. Detaches its bus listener and timer when the client disconnects.
export function sseResponse(events: EventEmitter, registry: Registry, heartbeatMs = 20_000): Response {
  let onUpdate: (s: Session) => void = () => {};
  let onRemove: (s: { id: string }) => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const send = (s: Session) => controller.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`));
      for (const s of registry.list()) send(s);
      onUpdate = send;
      events.on("update", onUpdate);
      const sendRemove = (s: { id: string }) =>
        controller.enqueue(enc.encode(`event: remove\ndata: ${JSON.stringify({ id: s.id })}\n\n`));
      onRemove = sendRemove;
      events.on("remove", onRemove);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": hb\n\n"));
        } catch {
          // controller closed between disconnect and cancel(); ignore
        }
      }, heartbeatMs);
    },
    cancel() {
      events.off("update", onUpdate);
      events.off("remove", onRemove);
      if (heartbeat) clearInterval(heartbeat);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
