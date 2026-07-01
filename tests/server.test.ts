import { test, expect } from "bun:test";
import { startHub } from "../src/hub/hub";
import type { Session } from "../src/types";

const hasTmux = Bun.which("tmux") != null;

const base: Session = {
  id: "s1",
  agent: "claude-code",
  title: "t",
  tmuxTarget: "deck:0.0",
  cwd: "/tmp",
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

test("GET /sessions returns registered sessions", async () => {
  const hub = startHub(8802);
  try {
    hub.registry.upsert({ ...base, id: "s3" });
    const sessions = (await (await fetch("http://localhost:8802/sessions")).json()) as Session[];
    expect(sessions.some((s) => s.id === "s3")).toBe(true);
  } finally {
    hub.stop();
  }
});

test("GET /agents returns agent availability", async () => {
  const hub = startHub(8813);
  try {
    const res = await fetch("http://localhost:8813/agents");
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { agents: Array<{ agent: string; available: boolean }> };
    expect(body.agents.some((a) => a.agent === "generic" && a.available)).toBe(true);
  } finally {
    hub.stop();
  }
});

async function killSpawnedSession(res: Response): Promise<void> {
  if (!res.ok) return;
  const spawned = (await res.json().catch(() => ({}))) as { id?: string };
  if (spawned.id) {
    Bun.spawnSync(["tmux", "-L", "deck", "kill-session", "-t", spawned.id]);
  }
}

test("POST /spawn without agent -> 400", async () => {
  const hub = startHub(8803);
  try {
    const res = await fetch("http://localhost:8803/spawn", { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
  } finally {
    hub.stop();
  }
});

test("POST /spawn rejects a relative cwd", async () => {
  const hub = startHub(8806);
  try {
    const res = await fetch("http://localhost:8806/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: "relative" }),
    });
    await killSpawnedSession(res);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("absolute");
  } finally {
    hub.stop();
  }
});

test("POST /spawn rejects a missing cwd", async () => {
  const hub = startHub(8807);
  try {
    const res = await fetch("http://localhost:8807/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: "/tmp/agentdeck-missing-cwd" }),
    });
    await killSpawnedSession(res);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("directory");
  } finally {
    hub.stop();
  }
});

test("POST /spawn rejects a cwd that is not a directory", async () => {
  const path = "/tmp/agentdeck-cwd-file";
  await Bun.write(path, "not a directory");
  const hub = startHub(8808);
  try {
    const res = await fetch("http://localhost:8808/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: path }),
    });
    await killSpawnedSession(res);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("directory");
  } finally {
    hub.stop();
  }
});

test.skipIf(!hasTmux)("POST /spawn stores a validated cwd on the session", async () => {
  const hub = startHub(8809);
  try {
    const res = await fetch("http://localhost:8809/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: "/tmp" }),
    });
    expect(res.status).toBe(200);
    const spawned = (await res.json()) as { id: string };
    expect(hub.registry.get(spawned.id)?.cwd).toBe("/tmp");
    Bun.spawnSync(["tmux", "-L", "deck", "kill-session", "-t", spawned.id]);
  } finally {
    hub.stop();
  }
});

test.skipIf(!hasTmux)("POST /spawn reports spawn failures with a readable body", async () => {
  const path = "/tmp/agentdeck-tmpdir-file";
  await Bun.write(path, "not a directory");
  const oldTmp = process.env.TMPDIR;
  process.env.TMPDIR = path;
  const hub = startHub(8812);
  try {
    const res = await fetch("http://localhost:8812/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: "/tmp" }),
    });
    expect(res.ok).toBe(false);
    expect(await res.text()).toContain("spawn failed");
  } finally {
    if (oldTmp == null) delete process.env.TMPDIR;
    else process.env.TMPDIR = oldTmp;
    hub.stop();
  }
});

test("POST /jump for unknown session -> 404", async () => {
  const hub = startHub(8805);
  try {
    const res = await fetch("http://localhost:8805/jump?sessionId=nope", { method: "POST" });
    expect(res.status).toBe(404);
  } finally {
    hub.stop();
  }
});

test("POST /spawn rejects unknown agent names", async () => {
  const hub = startHub(8804);
  try {
    const res = await fetch("http://localhost:8804/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "claude" }),
    });
    if (res.ok) {
      const spawned = (await res.json()) as { id?: string };
      if (spawned.id) Bun.spawnSync(["tmux", "-L", "deck", "kill-session", "-t", spawned.id]);
    }
    expect(res.status).toBe(400);
  } finally {
    hub.stop();
  }
});
