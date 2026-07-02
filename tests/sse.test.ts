import { test, expect } from "bun:test";
import { startHub } from "../src/hub/hub";
import type { Session } from "../src/types";

const base: Session = {
  id: "sse1",
  agent: "generic",
  title: "t",
  tmuxTarget: "deck:0.0",
  cwd: "/tmp",
  host: "local",
  state: "idle",
  lastActivityAt: 0,
  lastSummaryLine: "",
};

test("SSE emits initial snapshot then live updates", async () => {
  const hub = startHub(8810);
  try {
    hub.registry.upsert(base);
    const res = await fetch("http://localhost:8810/events/stream");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acc = dec.decode((await reader.read()).value);
    expect(acc).toContain("sse1");
    hub.events.emit("update", { ...base, state: "waiting", lastSummaryLine: "hi" });
    while (!acc.includes("waiting")) acc += dec.decode((await reader.read()).value);
    expect(acc).toContain("waiting");
    await reader.cancel();
  } finally {
    hub.stop();
  }
});

test("SSE forwards a remove event with id, state, title, and reason", async () => {
  const hub = startHub(8823);
  try {
    hub.registry.upsert(base);
    const res = await fetch("http://localhost:8823/events/stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acc = dec.decode((await reader.read()).value); // snapshot first -> start() has run
    expect(acc).toContain("sse1");
    hub.events.emit("remove", { ...base, id: "z9", state: "working", title: "api" }, "reaped");
    while (!acc.includes("event: remove")) acc += dec.decode((await reader.read()).value);
    expect(acc).toContain('"id":"z9"');
    expect(acc).toContain('"state":"working"');
    expect(acc).toContain('"title":"api"');
    expect(acc).toContain('"reason":"reaped"');
    await reader.cancel();
  } finally {
    hub.stop();
  }
});

test("SSE sends heartbeat comments to keep the connection alive", async () => {
  const hub = startHub(8811, { sseHeartbeatMs: 10 });
  try {
    const res = await fetch("http://localhost:8811/events/stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acc = "";
    while (!acc.includes(":")) acc += dec.decode((await reader.read()).value);
    expect(acc).toContain(":"); // an SSE comment line ": hb"
    await reader.cancel();
  } finally {
    hub.stop();
  }
});
