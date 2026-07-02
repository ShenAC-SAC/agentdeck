import type { Session, AgentKind } from "./types";

export interface AgentAvailability {
  agent: AgentKind;
  label: string;
  available: boolean;
  command: string;
}

export async function getSessions(): Promise<Session[]> {
  const res = await fetch("/sessions");
  return res.ok ? ((await res.json()) as Session[]) : [];
}

export async function getAgents(): Promise<AgentAvailability[]> {
  const fallback: AgentAvailability[] = [{ agent: "generic", label: "Shell", available: true, command: "shell" }];
  const res = await fetch("/agents");
  if (!res.ok) return fallback;
  const body = (await res.json()) as { agents?: AgentAvailability[] };
  return body.agents?.length ? body.agents : fallback;
}

export function subscribe(
  onSession: (s: Session) => void,
  onRemove: (id: string) => void = () => {},
): () => void {
  const EventSourceCtor = globalThis.EventSource as unknown as new (url: string) => EventSource;
  const es = new EventSourceCtor("/events/stream");
  es.onmessage = (e) => onSession(JSON.parse(e.data) as Session);
  es.addEventListener("remove", (e) =>
    onRemove((JSON.parse((e as MessageEvent).data) as { id: string }).id),
  );
  return () => es.close();
}

export interface SpawnRequest {
  agent: AgentKind;
  cwd: string;
  host?: string;
  mode?: "agent" | "shell";
}

export async function spawn(req: SpawnRequest): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch("/spawn", { method: "POST", body: JSON.stringify(req) });
  if (!res.ok) return { ok: false, error: await res.text() };
  const { id } = (await res.json()) as { id?: string };
  return id ? { ok: true, id } : { ok: false, error: "spawn response did not include an id" };
}

export async function renameSessionTitle(
  sessionId: string,
  title: string,
): Promise<{ ok: boolean; session?: Session; error?: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true, session: (await res.json()) as Session };
}

export async function markSessionActivity(sessionId: string): Promise<void> {
  await fetch(`/sessions/${encodeURIComponent(sessionId)}/activity`, { method: "POST" });
}

export async function closeSession(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.ok ? { ok: true } : { ok: false, error: await res.text() };
}

export function jump(sessionId: string): Promise<Response> {
  return fetch(`/jump?sessionId=${encodeURIComponent(sessionId)}`, { method: "POST" });
}
