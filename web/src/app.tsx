import { useEffect, useMemo, useState } from "react";
import {
  closeSession,
  getAgents,
  getSessions,
  jump,
  renameSessionTitle,
  spawn,
  subscribe,
  type AgentAvailability,
} from "./api";
import type { AgentKind, Session, SessionState } from "./types";
import { TerminalView } from "./components/terminal-view";
import { WorkspaceRail, type MainView } from "./components/workspace-rail";
import { HistoryView } from "./components/history-view";
import { SessionRow } from "./components/session-row";
import { CrewFace } from "./components/crew-face";
import { attentionItems, type AttentionKind } from "./attention";
import { pickFolder } from "./host";
import { hasPty } from "./pty";
import { groupByWorkspace } from "./workspace";

// Attention first: waiting/error rise to the top, resting sinks to the bottom.
const ORDER: Record<SessionState, number> = { waiting: 0, error: 1, working: 2, idle: 3 };

const ATTENTION_TEXT: Record<AttentionKind, string> = {
  waiting: "Needs you",
  error: "Errored",
  stalled: "Stalled",
};

export function App() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [, setTick] = useState(0);
  const [view, setView] = useState<MainView>({ kind: "overview" });
  const [agent, setAgent] = useState<AgentKind>("claude-code");
  const [availableAgents, setAvailableAgents] = useState<AgentAvailability[]>([
    { agent: "generic", label: "Shell", available: true, command: "shell" },
  ]);
  const [toast, setToast] = useState("");

  const deckapp = (window as unknown as {
    deckapp?: {
      onOpenSession: (cb: (id: string) => void) => void;
      onOpenHistory?: (cb: () => void) => void;
      setOpenSession?: (id: string | null) => void;
    };
  }).deckapp;

  // Shot/deep-link mode: ?open=<id> jumps straight into a session's terminal.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) setView({ kind: "session", id });
  }, []);

  // Under Electron, clicking a native notification opens that session.
  useEffect(() => {
    deckapp?.onOpenSession((id) => setView({ kind: "session", id }));
  }, [deckapp]);

  useEffect(() => {
    deckapp?.onOpenHistory?.(() => setView({ kind: "history" }));
  }, [deckapp]);

  useEffect(() => {
    deckapp?.setOpenSession?.(view.kind === "session" ? view.id : null);
  }, [deckapp, view]);

  useEffect(() => {
    let alive = true;
    getSessions().then((list) => {
      if (alive) setSessions(new Map(list.map((s) => [s.id, s])));
    });
    const unsub = subscribe(
      (s) => setSessions((prev) => new Map(prev).set(s.id, s)),
      (id) => {
        setSessions((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        setView((v) => (v.kind === "session" && v.id === id ? { kind: "overview" } : v));
      },
    );
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getAgents().then((agents) => {
      if (!alive) return;
      setAvailableAgents(agents);
      const first = agents.find((a) => a.available)?.agent;
      if (first && !agents.some((a) => a.available && a.agent === agent)) setAgent(first);
    });
    return () => {
      alive = false;
    };
  }, [agent]);

  // Keep the "last activity" telemetry honest as time passes.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const all = useMemo(
    () =>
      [...sessions.values()].sort(
        (a, b) => ORDER[a.state] - ORDER[b.state] || b.lastActivityAt - a.lastActivityAt,
      ),
    [sessions],
  );

  const groups = useMemo(() => groupByWorkspace(all), [all]);
  const attention = useMemo(() => attentionItems(all), [all]);
  // The overview pins attention sessions on top; don't repeat them below.
  const needyIds = useMemo(() => new Set(attention.map((i) => i.session.id)), [attention]);
  const calm = useMemo(() => all.filter((s) => !needyIds.has(s.id)), [all, needyIds]);
  const overviewGroups = useMemo(() => groupByWorkspace(calm), [calm]);

  // Under Electron, selecting a session opens its embedded terminal; in a plain
  // browser there is no pty, so fall back to the tmux jump.
  async function onSelect(v: MainView) {
    if (v.kind !== "session") {
      setView(v);
      return;
    }
    if (hasPty()) {
      setView(v);
      return;
    }
    const res = await jump(v.id);
    if (!res.ok) {
      setToast((await res.text()) || "jump failed");
      setTimeout(() => setToast(""), 4500);
    }
  }

  async function openSpawn(agentToSpawn: AgentKind, host: string, cwd: string, mode: "agent" | "shell" = "agent") {
    const res = await spawn({ agent: agentToSpawn, host, cwd, mode });
    if (!res.ok || !res.id) {
      setToast(res.error || "spawn failed");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    if (hasPty()) setView({ kind: "session", id: res.id });
  }

  async function onAddWorkspace() {
    const dir = await pickFolder();
    if (dir === null) return;
    await openSpawn(agent, "local", dir);
  }

  function onRemoteShellDeferred() {
    setToast("Remote shell needs a real SSH target scenario before it is enabled.");
    setTimeout(() => setToast(""), 4500);
  }

  async function onNewTerminal(workspace: { host: string; cwd: string }) {
    if (workspace.host.startsWith("ssh:")) {
      await openSpawn("generic", workspace.host, workspace.cwd, "shell");
      return;
    }
    await openSpawn(agent, workspace.host, workspace.cwd);
  }

  // The rail/terminal own the inline edit UI and hand us the final name.
  async function onRenameTerminal(sessionId: string, nextTitle: string) {
    const title = nextTitle.trim();
    if (!title) return;
    const res = await renameSessionTitle(sessionId, title);
    if (!res.ok || !res.session) {
      setToast(res.error || "rename failed");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    const updated = res.session;
    setSessions((prev) => new Map(prev).set(updated.id, updated));
  }

  async function onCloseTerminal(sessionId: string, title: string) {
    if (!window.confirm(`Close "${title}"? This ends its tmux session.`)) return;
    const res = await closeSession(sessionId);
    if (!res.ok) {
      setToast(res.error || "close failed");
      setTimeout(() => setToast(""), 4500);
    }
    // The SSE remove event will drop the card; no optimistic delete needed.
  }

  const openSession = view.kind === "session" ? sessions.get(view.id) : undefined;
  const showTerminal = view.kind === "session" && hasPty();

  return (
    <div className="app">
      <WorkspaceRail
        groups={groups}
        selected={view}
        agent={agent}
        availableAgents={availableAgents}
        onAgentChange={setAgent}
        onSelect={onSelect}
        onAddWorkspace={onAddWorkspace}
        onRemoteShellDeferred={onRemoteShellDeferred}
        onNewTerminal={onNewTerminal}
        onRenameTerminal={onRenameTerminal}
        onCloseTerminal={onCloseTerminal}
      />

      <section className="main">
        {showTerminal ? (
          openSession ? (
            <TerminalView
              session={openSession}
              onBack={() => setView({ kind: "overview" })}
              onRename={onRenameTerminal}
            />
          ) : (
            <div className="main__connecting">
              <p className="muted">connecting to session…</p>
            </div>
          )
        ) : view.kind === "history" ? (
          <HistoryView onResumed={(id) => setView({ kind: "session", id })} />
        ) : (
          <>
            <header className="main__bar">
              <div>
                <h1 className="main__title">Overview</h1>
                <p className="main__sub">
                  {all.length} crew ·{" "}
                  {attention.length > 0 ? (
                    <span className="hot">{attention.length} need you</span>
                  ) : (
                    <>all steady — you can walk away</>
                  )}
                </p>
              </div>
            </header>

            {all.length === 0 ? (
              <div className="empty">
                <CrewFace state="idle" size={96} />
                <p className="empty__lead">No crew on deck yet.</p>
                <p className="muted">Spawn a session to bring someone aboard.</p>
              </div>
            ) : (
              <main className="deck">
                {attention.length > 0 ? (
                  <section className="session-group session-group--attention">
                    <h2 className="session-group__title">Needs you</h2>
                    {attention.map(({ session, kind }, i) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        index={i}
                        kindLabel={ATTENTION_TEXT[kind]}
                        onOpen={(id) => onSelect({ kind: "session", id })}
                        onRename={onRenameTerminal}
                        onClose={onCloseTerminal}
                      />
                    ))}
                  </section>
                ) : null}
                {overviewGroups.map((group) => (
                  <section key={group.key} className="session-group">
                    <h2 className="session-group__title" title={group.cwd}>
                      {group.hostName} · {group.name}
                    </h2>
                    {group.sessions.map((s, i) => (
                      <SessionRow
                        key={s.id}
                        session={s}
                        index={i}
                        onOpen={(id) => onSelect({ kind: "session", id })}
                        onRename={onRenameTerminal}
                        onClose={onCloseTerminal}
                      />
                    ))}
                  </section>
                ))}
              </main>
            )}
          </>
        )}
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
