import { expect, test } from "bun:test";
import { parseSshConfig, validateRemoteHostAlias } from "../src/remote/hosts";

test("parseSshConfig lists Host blocks with hostname/user, skips wildcards", () => {
  const cfg = `
Host devbox
  HostName 10.0.0.5
  User mac
Host *
  ForwardAgent yes
Host prod gpu
  HostName gpu.example.com
`;
  const hosts = parseSshConfig(cfg);
  expect(hosts.map((h) => h.alias)).toEqual(["devbox", "prod", "gpu"]);
  expect(hosts.find((h) => h.alias === "devbox")).toEqual({
    alias: "devbox",
    hostname: "10.0.0.5",
    user: "mac",
  });
  expect(hosts.find((h) => h.alias === "gpu")?.hostname).toBe("gpu.example.com");
});

test("validateRemoteHostAlias accepts only safe bare aliases", () => {
  expect(validateRemoteHostAlias("devbox")).toBeUndefined();
  expect(validateRemoteHostAlias("user@example.com")).toBeUndefined();
  expect(validateRemoteHostAlias("local")).toContain("remote host");
  expect(validateRemoteHostAlias("ssh:devbox")).toContain("bare ssh alias");
  expect(validateRemoteHostAlias("-F/tmp/config")).toContain("must not start with '-'");
  expect(validateRemoteHostAlias("dev box")).toContain("whitespace");
  expect(validateRemoteHostAlias("dev/box")).toContain("path separator");
});
