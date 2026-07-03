import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addConnectedHost, readConnectedHosts, removeConnectedHost } from "../src/remote/connected-hosts";

test("connected host store reads missing files as empty", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-hosts-test-"));
  expect(await readConnectedHosts(join(dir, "hosts.json"))).toEqual([]);
});

test("connected host store persists sorted unique aliases", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-hosts-test-"));
  const path = join(dir, "hosts.json");

  await addConnectedHost(path, "devbox");
  await addConnectedHost(path, "gpu");
  await addConnectedHost(path, "devbox");

  expect(await readConnectedHosts(path)).toEqual(["devbox", "gpu"]);
});

test("connected host store removes aliases", async () => {
  const dir = await mkdtemp(join(tmpdir(), "deck-hosts-test-"));
  const path = join(dir, "hosts.json");

  await addConnectedHost(path, "devbox");
  await addConnectedHost(path, "gpu");
  await removeConnectedHost(path, "devbox");

  expect(await readConnectedHosts(path)).toEqual(["gpu"]);
});
