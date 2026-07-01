import type { EventEmitter } from "node:events";
import type { Registry } from "./registry";
import type { Session } from "../types";

// Server-Sent Events stream of session truth: one `data:` line per current
// session as an initial snapshot, then one line per subsequent registry
// update. Detaches its bus listener when the client disconnects.
export function sseResponse(events: EventEmitter, registry: Registry): Response {
  let onUpdate: (s: Session) => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const send = (s: Session) => controller.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`));
      for (const s of registry.list()) send(s);
      onUpdate = send;
      events.on("update", onUpdate);
    },
    cancel() {
      events.off("update", onUpdate);
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
