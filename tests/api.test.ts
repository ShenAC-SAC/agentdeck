import { afterEach, expect, test } from "bun:test";
import { spawn } from "../web/src/api";

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
