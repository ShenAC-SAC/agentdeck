import { test, expect } from "bun:test";
import { serveStatic } from "../src/hub/static";

const fixture = `${import.meta.dir}/fixtures/static`;

test("serves an existing file with content", async () => {
  await Bun.write(`${fixture}/index.html`, "<h1>deck</h1>");
  const res = await serveStatic("/", fixture);
  expect(res).not.toBeNull();
  expect(await res!.text()).toContain("deck");
});

test("returns null for a missing file", async () => {
  const res = await serveStatic("/does-not-exist.js", fixture);
  expect(res).toBeNull();
});
