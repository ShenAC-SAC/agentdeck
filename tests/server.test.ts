import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { startHub } from "../src/hub/hub";
import { applySchema } from "../src/hub/db";
import { archive } from "../src/hub/persistence";
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

test("Codex agent-turn-complete (sessionId in body) -> waiting handoff", async () => {
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
    expect(hub.registry.get("s2")?.state).toBe("waiting");
    expect(hub.registry.get("s2")?.lastSummaryLine).toBe("done");
  } finally {
    hub.stop();
  }
});

test("generic turn-complete before work stays resting", async () => {
  const hub = startHub(8825);
  try {
    hub.registry.upsert({ ...base, id: "fresh", agent: "generic", state: "idle" });
    await fetch("http://localhost:8825/events?sessionId=fresh&agent=generic", {
      method: "POST",
      body: JSON.stringify({ type: "turn-complete" }),
    });
    expect(hub.registry.get("fresh")?.state).toBe("idle");
  } finally {
    hub.stop();
  }
});

test("POST /events with a Claude session_id captures it on the session", async () => {
  const hub = startHub(8826);
  try {
    hub.registry.upsert({ ...base, id: "cap1", agent: "claude-code" });
    const updates: Session[] = [];
    hub.events.on("update", (s: Session) => updates.push(s));
    await fetch("http://localhost:8826/events?sessionId=cap1&agent=claude-code", {
      method: "POST",
      body: JSON.stringify({
        hook_event_name: "Stop",
        last_assistant_message: "done",
        session_id: "native-xyz",
      }),
    });
    const sessions = (await (await fetch("http://localhost:8826/sessions")).json()) as Session[];
    expect(sessions.find((s) => s.id === "cap1")?.claudeSessionId).toBe("native-xyz");
    expect(updates.at(-1)?.claudeSessionId).toBe("native-xyz");
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

test("GET /history returns archived rows; DELETE removes them", async () => {
  const db = new Database(":memory:");
  applySchema(db);
  archive(db, { ...base, id: "hist1", state: "working" }, "reaped", 123);
  const hub = startHub(8827, { db });
  try {
    const list = (await (await fetch("http://localhost:8827/history")).json()) as Array<{ id: string }>;
    expect(list.length).toBeGreaterThan(0);
    const id = list[0].id;
    expect((await fetch(`http://localhost:8827/history/${encodeURIComponent(id)}`, { method: "DELETE" })).status).toBe(
      200,
    );
    const after = (await (await fetch("http://localhost:8827/history")).json()) as Array<{ id: string }>;
    expect(after.find((r) => r.id === id)).toBeUndefined();
  } finally {
    hub.stop();
    db.close();
  }
});

test("remote routes expose hosts, status, connect, and disconnect via controller", async () => {
  const calls: string[] = [];
  const hub = startHub(8829, {
    remote: {
      hosts: async () => [{ alias: "devbox", hostname: "10.0.0.5", user: "mac" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: false }],
      connect: async (host: string) => {
        calls.push(`connect:${host}`);
      },
      disconnect: async (host: string) => {
        calls.push(`disconnect:${host}`);
      },
    },
  });
  try {
    const hosts = (await (await fetch("http://localhost:8829/remote/hosts")).json()) as Array<{ alias: string }>;
    expect(hosts.map((h) => h.alias)).toContain("devbox");
    const status = (await (await fetch("http://localhost:8829/remote/status")).json()) as Array<{
      host: string;
      reachable: boolean;
    }>;
    expect(status).toEqual([{ host: "devbox", reachable: false }]);

    expect(
      (await fetch("http://localhost:8829/remote/connect", {
        method: "POST",
        body: JSON.stringify({ host: "devbox" }),
      })).status,
    ).toBe(200);
    expect(
      (await fetch("http://localhost:8829/remote/disconnect", {
        method: "POST",
        body: JSON.stringify({ host: "devbox" }),
      })).status,
    ).toBe(200);
    expect(calls).toEqual(["connect:devbox", "disconnect:devbox"]);
  } finally {
    hub.stop();
  }
});

test("remote routes reject unsafe host aliases", async () => {
  const hub = startHub(8832, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => [],
      status: () => [],
      connect: async () => {
        throw new Error("connect should not run");
      },
      disconnect: async () => {},
    },
  });
  try {
    const connect = await fetch("http://localhost:8832/remote/connect", {
      method: "POST",
      body: JSON.stringify({ host: "-F/tmp/config" }),
    });
    expect(connect.status).toBe(400);
    expect(await connect.text()).toContain("must not start");

    const spawn = await fetch("http://localhost:8832/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "codex", host: "ssh:devbox", mode: "agent", cwd: "/srv/app" }),
    });
    expect(spawn.status).toBe(400);
    expect(await spawn.text()).toContain("bare ssh alias");
  } finally {
    hub.stop();
  }
});

test("POST /remote/connect returns controller failures as readable errors", async () => {
  const hub = startHub(8837, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => [],
      status: () => [],
      connect: async () => {
        throw new Error("ssh timed out");
      },
      disconnect: async () => {},
    },
  });
  try {
    const res = await fetch("http://localhost:8837/remote/connect", {
      method: "POST",
      body: JSON.stringify({ host: "devbox" }),
    });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("ssh timed out");
  } finally {
    hub.stop();
  }
});

test("POST /history/:id/resume 400s a non-Claude or id-less archived row", async () => {
  const db = new Database(":memory:");
  applySchema(db);
  archive(db, { ...base, id: "g1", agent: "generic", state: "idle" }, "closed", 123);
  const hub = startHub(8828, { db });
  try {
    const res = await fetch("http://localhost:8828/history/g1/resume", { method: "POST" });
    expect(res.status).toBe(400);
  } finally {
    hub.stop();
    db.close();
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

test("POST /sessions/:id/activity marks an idle session working and emits", async () => {
  const hub = startHub(8824);
  try {
    hub.registry.upsert({ ...base, id: "active", state: "idle", lastSummaryLine: "ready" });
    const got = new Promise<Session>((res) => hub.events.once("update", res));
    const res = await fetch("http://localhost:8824/sessions/active/activity", { method: "POST" });
    expect(res.status).toBe(200);
    const s = await Promise.race([got, new Promise<undefined>((res) => setTimeout(() => res(undefined), 100))]);
    expect(s?.state).toBe("working");
    expect(s?.lastSummaryLine).toBe("ready");
    expect(hub.registry.get("active")?.state).toBe("working");
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

test("DELETE /sessions/:id kills a remote tmux session before removing it", async () => {
  const calls: string[] = [];
  const hub = startHub(8833, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: true }],
      connect: async () => {},
      disconnect: async () => {},
      killSession: async (host: string, id: string) => {
        calls.push(`${host}:${id}`);
      },
    },
  });
  hub.registry.upsert({ ...base, id: "deck_remote", host: "devbox", tmuxTarget: "deck_remote:0.0" });
  try {
    const res = await fetch("http://localhost:8833/sessions/deck_remote", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(calls).toEqual(["devbox:deck_remote"]);
    expect(hub.registry.get("deck_remote")).toBeUndefined();
  } finally {
    hub.stop();
  }
});

test("DELETE /sessions/:id keeps a remote session when remote kill fails", async () => {
  const hub = startHub(8834, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: false }],
      connect: async () => {},
      disconnect: async () => {},
      killSession: async () => {
        throw new Error("ssh timed out");
      },
    },
  });
  hub.registry.upsert({ ...base, id: "deck_remote", host: "devbox", tmuxTarget: "deck_remote:0.0" });
  try {
    const res = await fetch("http://localhost:8834/sessions/deck_remote", { method: "DELETE" });
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("ssh timed out");
    expect(hub.registry.get("deck_remote")).toBeDefined();
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

test("PATCH title persists remote titles through the remote controller", async () => {
  const calls: string[] = [];
  const hub = startHub(8835, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: true }],
      connect: async () => {},
      disconnect: async () => {},
      renameSession: async (host: string, id: string, title: string) => {
        calls.push(`${host}:${id}:${title}`);
      },
    },
  });
  hub.registry.upsert({ ...base, id: "deck_remote", host: "devbox", tmuxTarget: "deck_remote:0.0" });
  try {
    const res = await fetch("http://localhost:8835/sessions/deck_remote/title", {
      method: "PATCH",
      body: JSON.stringify({ title: "Remote review" }),
    });
    expect(res.status).toBe(200);
    expect(calls).toEqual(["devbox:deck_remote:Remote review"]);
    expect(hub.registry.get("deck_remote")?.title).toBe("Remote review");
  } finally {
    hub.stop();
  }
});

test("PATCH title keeps the old remote title when remote persistence fails", async () => {
  const hub = startHub(8836, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: false }],
      connect: async () => {},
      disconnect: async () => {},
      renameSession: async () => {
        throw new Error("ssh timed out");
      },
    },
  });
  hub.registry.upsert({
    ...base,
    id: "deck_remote",
    title: "Old remote",
    host: "devbox",
    tmuxTarget: "deck_remote:0.0",
  });
  try {
    const res = await fetch("http://localhost:8836/sessions/deck_remote/title", {
      method: "PATCH",
      body: JSON.stringify({ title: "Remote review" }),
    });
    expect(res.status).toBe(409);
    expect(await res.text()).toContain("ssh timed out");
    expect(hub.registry.get("deck_remote")?.title).toBe("Old remote");
  } finally {
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

test("POST /spawn routes a remote agent to the injected remote spawner", async () => {
  const calls: Array<{ host: string; agent: string; cwd: string }> = [];
  const hub = startHub(8815, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: true }],
      connect: async () => {},
      disconnect: async () => {},
    },
    remoteSpawn: {
      agent: async ({ host, agent, cwd, name, registry }) => {
        calls.push({ host, agent, cwd });
        registry.upsert({
          ...base,
          id: name,
          agent,
          cwd,
          host,
          tmuxTarget: `${name}:0.0`,
          state: "idle",
        });
        return { id: name, target: `${name}:0.0`, stop: () => {} };
      },
      shell: async () => {
        throw new Error("shell should not be called");
      },
    },
  });
  try {
    const res = await fetch("http://localhost:8815/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "codex", host: "devbox", mode: "agent", cwd: "/srv/app" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^deck_/);
    expect(calls).toEqual([{ host: "devbox", agent: "codex", cwd: "/srv/app" }]);
    expect(hub.registry.get(body.id)?.host).toBe("devbox");
  } finally {
    hub.stop();
  }
});

test("POST /spawn connects the remote host before spawning when needed", async () => {
  const calls: string[] = [];
  let connected = false;
  const hub = startHub(8831, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => (connected ? ["devbox"] : []),
      status: () => [{ host: "devbox", reachable: connected }],
      connect: async (host: string) => {
        calls.push(`connect:${host}`);
        connected = true;
      },
      disconnect: async () => {},
    },
    remoteSpawn: {
      agent: async ({ host, agent, cwd, name, registry }) => {
        calls.push(`spawn:${host}:${agent}:${cwd}`);
        registry.upsert({
          ...base,
          id: name,
          agent,
          cwd,
          host,
          tmuxTarget: `${name}:0.0`,
          state: "idle",
        });
        return { id: name, target: `${name}:0.0`, stop: () => {} };
      },
      shell: async () => {
        throw new Error("shell should not be called");
      },
    },
  });
  try {
    const res = await fetch("http://localhost:8831/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "codex", host: "devbox", mode: "agent", cwd: "/srv/app" }),
    });

    expect(res.status).toBe(200);
    expect(calls).toEqual(["connect:devbox", "spawn:devbox:codex:/srv/app"]);
  } finally {
    hub.stop();
  }
});

test("POST /spawn routes a remote shell to the injected shell spawner", async () => {
  const calls: Array<{ host: string; cwd: string }> = [];
  const hub = startHub(8816, {
    remote: {
      hosts: async () => [{ alias: "devbox" }],
      connected: () => ["devbox"],
      status: () => [{ host: "devbox", reachable: true }],
      connect: async () => {},
      disconnect: async () => {},
    },
    remoteSpawn: {
      agent: async () => {
        throw new Error("agent should not be called");
      },
      shell: async ({ host, cwd, name, registry }) => {
        calls.push({ host, cwd });
        registry.upsert({
          ...base,
          id: name,
          agent: "generic",
          cwd,
          host,
          tmuxTarget: `${name}:0.0`,
          state: "idle",
        });
        return { id: name, target: `${name}:0.0`, stop: () => {} };
      },
    },
  });
  try {
    const res = await fetch("http://localhost:8816/spawn", {
      method: "POST",
      body: JSON.stringify({ agent: "generic", host: "devbox", mode: "shell", cwd: "/srv/app" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(calls).toEqual([{ host: "devbox", cwd: "/srv/app" }]);
    expect(hub.registry.get(body.id)?.agent).toBe("generic");
  } finally {
    hub.stop();
  }
});
