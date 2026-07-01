import type { Registry } from "./registry";
import type { EventEmitter } from "node:events";
import type { AdapterEvent } from "../adapters/types";
import type { AgentKind } from "../types";
import { mapClaudeHook } from "../adapters/claude-code";
import { mapCodexNotify } from "../adapters/codex";
import { spawnAgent } from "../tmux/spawn";

// Agents POST their native hook/notify JSON as the body; deck's own sessionId
// and agent kind ride in the query string (that is what the installed hook adds).
// Either place works for sessionId/agent so tests can use whichever is simpler.
export function serve(port: number, registry: Registry, events: EventEmitter) {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/sessions") {
        return Response.json(registry.list());
      }

      if (req.method === "POST" && url.pathname === "/spawn") {
        const body = (await req.json().catch(() => ({}))) as { agent?: AgentKind };
        if (!body.agent) return new Response("missing agent", { status: 400 });
        const spawned = await spawnAgent({ agent: body.agent, name: `deck_${Date.now()}`, registry, hubPort: port });
        return Response.json({ id: spawned.id, target: spawned.target });
      }

      if (req.method === "POST" && url.pathname === "/events") {
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionId = url.searchParams.get("sessionId") ?? asString(body.sessionId);
        const agent = url.searchParams.get("agent") ?? asString(body.agent);
        if (!sessionId) return new Response("missing sessionId", { status: 400 });
        const evt: AdapterEvent =
          agent === "codex" ? mapCodexNotify(sessionId, body) : mapClaudeHook(sessionId, body);
        const updated = registry.applyEvent(evt);
        if (updated) events.emit("update", updated);
        return new Response("ok");
      }

      return new Response("agentdeck");
    },
  });
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
