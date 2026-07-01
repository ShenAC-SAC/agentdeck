import { test, expect } from "bun:test";
import { startHub } from "../src/hub/hub";
import type { Session } from "../src/types";

const base: Session = {
  id: "s1",
  agent: "claude-code",
  title: "t",
  tmuxTarget: "deck:0.0",
  host: "local",
  state: "working",
  lastActivityAt: 0,
  lastSummaryLine: "",
};

test("CC Notification (sessionId+agent in query) -> waiting + emit", async () => {
  const hub = startHub(8799);
  try {
    hub.registry.upsert(base);
    const got = new Promise<Session>((res) => hub.events.once("update", res));
    await fetch("http://localhost:8799/events?sessionId=s1&agent=claude-code", {
      method: "POST",
      body: JSON.stringify({ hook_event_name: "Notification", message: "approve?" }),
    });
    const s = await got;
    expect(s.state).toBe("waiting");
    expect(s.lastSummaryLine).toBe("approve?");
    expect(hub.registry.get("s1")?.state).toBe("waiting");
  } finally {
    hub.stop();
  }
});

test("Codex agent-turn-complete (sessionId in body) -> idle", async () => {
  const hub = startHub(8800);
  try {
    hub.registry.upsert({ ...base, id: "s2" });
    await fetch("http://localhost:8800/events", {
      method: "POST",
      body: JSON.stringify({
        agent: "codex",
        sessionId: "s2",
        type: "agent-turn-complete",
        "last-assistant-message": "done",
      }),
    });
    expect(hub.registry.get("s2")?.state).toBe("idle");
    expect(hub.registry.get("s2")?.lastSummaryLine).toBe("done");
  } finally {
    hub.stop();
  }
});

test("missing sessionId -> 400", async () => {
  const hub = startHub(8801);
  try {
    const res = await fetch("http://localhost:8801/events", {
      method: "POST",
      body: JSON.stringify({ agent: "codex", type: "agent-turn-complete" }),
    });
    expect(res.status).toBe(400);
  } finally {
    hub.stop();
  }
});
