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

test("PATCH /sessions/:id/title renames an existing terminal", async () => {
  const hub = startHub(8821);
  try {
    hub.registry.upsert({ ...base, id: "rename-me", title: "Old title" });
    const got = new Promise<Session>((res) => hub.events.once("update", res));
    const res = await fetch("http://localhost:8821/sessions/rename-me/title", {
      method: "PATCH",
      body: JSON.stringify({ title: "Review PR 3887" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Session;
    expect(body.title).toBe("Review PR 3887");
    expect(hub.registry.get("rename-me")?.title).toBe("Review PR 3887");
    expect((await got).title).toBe("Review PR 3887");
  } finally {
    hub.stop();
  }
});

test("PATCH /sessions/:id/title rejects empty and unknown titles", async () => {
  const hub = startHub(8822);
  try {
    const missing = await fetch("http://localhost:8822/sessions/nope/title", {
      method: "PATCH",
      body: JSON.stringify({ title: "Name" }),
    });
    expect(missing.status).toBe(404);

    hub.registry.upsert({ ...base, id: "empty-title" });
    const empty = await fetch("http://localhost:8822/sessions/empty-title/title", {
      method: "PATCH",
      body: JSON.stringify({ title: "   " }),
    });
    expect(empty.status).toBe(400);
    expect(await empty.text()).toContain("title must be non-empty");
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

test.skipIf(!hasTmux)("POST /spawn gives local terminals a human title", async () => {
  const hub = startHub(8814);
  let spawnedId: string | undefined;
  try {
    const res = await fetch("http://localhost:8814/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: "/tmp" }),
    });
    expect(res.status).toBe(200);
    const spawned = (await res.json()) as { id: string };
    spawnedId = spawned.id;
    expect(hub.registry.get(spawned.id)?.title).toBe("Shell · tmp");
  } finally {
    if (spawnedId) Bun.spawnSync(["tmux", "-L", "deck", "kill-session", "-t", spawnedId]);
    hub.stop();
  }
});

test.skipIf(!hasTmux)("POST /spawn numbers duplicate terminals in a workspace", async () => {
  const hub = startHub(8820);
  const spawnedIds: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const res = await fetch("http://localhost:8820/spawn", {
        method: "POST",
        body: JSON.stringify({ agent: "generic", cwd: "/tmp" }),
      });
      expect(res.status).toBe(200);
      const spawned = (await res.json()) as { id: string };
      spawnedIds.push(spawned.id);
    }
    expect(hub.registry.get(spawnedIds[0])?.title).toBe("Shell · tmp");
    expect(hub.registry.get(spawnedIds[1])?.title).toBe("Shell #2 · tmp");
  } finally {
    for (const id of spawnedIds) Bun.spawnSync(["tmux", "-L", "deck", "kill-session", "-t", id]);
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

test("DELETE /sessions/:id removes an unknown-tmux session and returns ok", async () => {
  const hub = startHub(8817);
  try {
    hub.registry.upsert({ ...base, id: "gone", tmuxTarget: "gone:0.0" });
    const removed = new Promise<Session>((res) => hub.events.once("remove", res));
    const res = await fetch("http://localhost:8817/sessions/gone", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect((await removed).id).toBe("gone");
    expect(hub.registry.get("gone")).toBeUndefined();
  } finally {
    hub.stop();
  }
});

test("DELETE /sessions/:id for unknown session -> 404", async () => {
  const hub = startHub(8818);
  try {
    const res = await fetch("http://localhost:8818/sessions/nope", { method: "DELETE" });
    expect(res.status).toBe(404);
  } finally {
    hub.stop();
  }
});

test.skipIf(!hasTmux)("PATCH title persists @deck_title to tmux for rehydration", async () => {
  const hub = startHub(8819);
  let id: string | undefined;
  try {
    const spawned = (await (await fetch("http://localhost:8819/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", cwd: "/tmp" }),
    })).json()) as { id: string };
    id = spawned.id;
    await fetch(`http://localhost:8819/sessions/${id}/title`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Persisted name" }),
    });
    const { discoverDeckSessions } = await import("../src/hub/rehydrate");
    const found = await discoverDeckSessions();
    const mine = found.find((f) => f.id === id);
    expect(mine?.title).toBe("Persisted name");
    expect(mine?.titleLocked).toBe(true);
  } finally {
    if (id) Bun.spawnSync(["tmux", "-L", "deck", "kill-session", "-t", id]);
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

test("POST /spawn rejects remote agent mode in M2-lite", async () => {
  const hub = startHub(8815);
  try {
    const res = await fetch("http://localhost:8815/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "codex", host: "ssh:devbox", mode: "agent", cwd: "/srv/app" }),
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("remote agent mode is not implemented");
  } finally {
    hub.stop();
  }
});

test("POST /spawn rejects non-generic remote shell", async () => {
  const hub = startHub(8816);
  try {
    const res = await fetch("http://localhost:8816/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "codex", host: "ssh:devbox", mode: "shell", cwd: "/srv/app" }),
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("remote shell sessions must use generic");
  } finally {
    hub.stop();
  }
});
