import type { Registry } from "./registry";
import type { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { AdapterEvent } from "../adapters/types";
import { isAgentKind } from "../types";
import { mapClaudeHook } from "../adapters/claude-code";
import { mapCodexNotify } from "../adapters/codex";
import { spawnAgent } from "../tmux/spawn";
import { sseResponse } from "./sse";
import { serveStatic } from "./static";
import { tmux } from "../tmux/tmux";
import type { HubOptions } from "./hub";
import { detectLocalAgents } from "../agents/availability";

// Agents POST their native hook/notify JSON as the body; deck's own sessionId
// and agent kind ride in the query string (that is what the installed hook adds).
// Either place works for sessionId/agent so tests can use whichever is simpler.
export function serve(port: number, registry: Registry, events: EventEmitter, opts: HubOptions = {}) {
  return Bun.serve({
    port,
    // SSE streams stay open indefinitely; the heartbeat keeps them under this.
    idleTimeout: 120,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/sessions") {
        return Response.json(registry.list());
      }

      if (req.method === "GET" && url.pathname === "/agents") {
        return Response.json({ agents: await detectLocalAgents() });
      }

      if (req.method === "GET" && url.pathname === "/events/stream") {
        return sseResponse(events, registry, opts.sseHeartbeatMs);
      }

      if (req.method === "POST" && url.pathname === "/spawn") {
        const body = (await req.json().catch(() => ({}))) as { agent?: unknown; cwd?: unknown };
        if (!body.agent) return new Response("missing agent", { status: 400 });
        if (!isAgentKind(body.agent)) return new Response("unknown agent", { status: 400 });
        const cwd = typeof body.cwd === "string" ? body.cwd.trim() : undefined;
        if (body.cwd != null && !cwd) return new Response("cwd must be a non-empty absolute directory", { status: 400 });
        const cwdError = cwd ? await validateCwd(cwd) : undefined;
        if (cwdError) return new Response(cwdError, { status: 400 });
        let spawned: Awaited<ReturnType<typeof spawnAgent>>;
        try {
          spawned = await spawnAgent({ agent: body.agent, name: `deck_${Date.now()}`, registry, hubPort: port, cwd });
        } catch (e) {
          return new Response(`spawn failed: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
        }
        const session = registry.get(spawned.id);
        if (session) events.emit("update", session); // push the new crew card to live clients
        return Response.json({ id: spawned.id, target: spawned.target });
      }

      if (req.method === "POST" && url.pathname === "/jump") {
        const body = (await req.json().catch(() => ({}))) as { sessionId?: unknown };
        const sessionId = url.searchParams.get("sessionId") ?? asString(body.sessionId);
        const session = sessionId ? registry.get(sessionId) : undefined;
        if (!session) return new Response("unknown session", { status: 404 });
        try {
          await tmux.switchClient(session.tmuxTarget);
          return new Response("ok");
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "jump failed", { status: 409 });
        }
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

      if (req.method === "GET") {
        const asset = await serveStatic(url.pathname);
        if (asset) return asset;
        const index = await serveStatic("/");
        if (index) return index; // SPA fallback
      }
      return new Response("agentdeck");
    },
  });
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

async function validateCwd(cwd: string): Promise<string | undefined> {
  if (!isAbsolute(cwd)) return "cwd must be an absolute directory";
  try {
    const s = await stat(cwd);
    if (!s.isDirectory()) return "cwd must be an existing directory";
  } catch {
    return "cwd must be an existing directory";
  }
}
