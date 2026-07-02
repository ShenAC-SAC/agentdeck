import { expect, test } from "bun:test";
import { parseSshConfig } from "../src/remote/hosts";

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
