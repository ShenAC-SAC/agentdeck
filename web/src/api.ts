import type { Session, AgentKind } from "./types";

export async function getSessions(): Promise<Session[]> {
  const res = await fetch("/sessions");
  return res.ok ? ((await res.json()) as Session[]) : [];
}

export function subscribe(onSession: (s: Session) => void): () => void {
  const es = new EventSource("/events/stream");
  es.onmessage = (e) => onSession(JSON.parse(e.data) as Session);
  return () => es.close();
}

export async function spawn(agent: AgentKind, cwd?: string): Promise<string | undefined> {
  const res = await fetch("/spawn", { method: "POST", body: JSON.stringify({ agent, cwd }) });
  if (!res.ok) return undefined;
  const { id } = (await res.json()) as { id?: string };
  return id;
}

export function jump(sessionId: string): Promise<Response> {
  return fetch(`/jump?sessionId=${encodeURIComponent(sessionId)}`, { method: "POST" });
}
