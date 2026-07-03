import { afterEach, expect, test } from "bun:test";
import { connectRemote, disconnectRemote, getRemoteHosts, getRemoteStatus, spawn } from "../web/src/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("spawn returns the spawned session id", async () => {
  globalThis.fetch = (async () => {
    return Response.json({ id: "deck_1" });
  }) as unknown as typeof fetch;

  const result = await spawn({ agent: "generic", cwd: "/tmp" });

  expect(result).toEqual({ ok: true, id: "deck_1" });
});

test("spawn returns a readable error response", async () => {
  globalThis.fetch = (async () => {
    return new Response("spawn failed: tmux missing", { status: 500 });
  }) as unknown as typeof fetch;

  const result = await spawn({ agent: "generic", cwd: "/tmp" });

  expect(result).toEqual({ ok: false, error: "spawn failed: tmux missing" });
});

test("spawn rejects successful responses without ids", async () => {
  globalThis.fetch = (async () => {
    return Response.json({});
  }) as unknown as typeof fetch;

  const result = await spawn({ agent: "generic", cwd: "/tmp" });

  expect(result).toEqual({ ok: false, error: "spawn response did not include an id" });
});

test("getRemoteHosts returns ssh aliases from the hub", async () => {
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
    expect(url).toBe("/remote/hosts");
    return Response.json([{ alias: "devbox", hostname: "10.0.0.5" }]);
  }) as unknown as typeof fetch;

  expect(await getRemoteHosts()).toEqual([{ alias: "devbox", hostname: "10.0.0.5" }]);
});

test("connectRemote and disconnectRemote return readable failures", async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    seen.push(`${init?.method}:${url}:${String(init?.body)}`);
    return new Response("ssh failed", { status: 500 });
  }) as unknown as typeof fetch;

  expect(await connectRemote("devbox")).toEqual({ ok: false, error: "ssh failed" });
  expect(await disconnectRemote("devbox")).toEqual({ ok: false, error: "ssh failed" });
  expect(seen).toEqual([
    'POST:/remote/connect:{"host":"devbox"}',
    'POST:/remote/disconnect:{"host":"devbox"}',
  ]);
});

test("getRemoteStatus returns reachability rows", async () => {
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
    expect(url).toBe("/remote/status");
    return Response.json([{ host: "devbox", reachable: false }]);
  }) as unknown as typeof fetch;

  expect(await getRemoteStatus()).toEqual([{ host: "devbox", reachable: false }]);
});
