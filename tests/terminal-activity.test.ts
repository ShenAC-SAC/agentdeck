import { afterEach, expect, test } from "bun:test";
import { markSessionActivity } from "../web/src/api";
import { isTerminalSubmit } from "../web/src/terminal-activity";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("terminal submit detection ignores typing and Shift+Enter but catches Enter", () => {
  expect(isTerminalSubmit("hello")).toBe(false);
  expect(isTerminalSubmit("\x1b[13;2u")).toBe(false);
  expect(isTerminalSubmit("\r")).toBe(true);
  expect(isTerminalSubmit("run this\n")).toBe(true);
});

test("markSessionActivity posts to the session activity endpoint", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method });
    return new Response("ok");
  }) as unknown as typeof fetch;

  await markSessionActivity("deck one");

  expect(calls).toEqual([{ url: "/sessions/deck%20one/activity", method: "POST" }]);
});
