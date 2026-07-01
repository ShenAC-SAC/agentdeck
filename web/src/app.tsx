import { useEffect, useMemo, useState } from "react";
import { getAgents, getSessions, jump, spawn, subscribe, type AgentAvailability } from "./api";
import type { AgentKind, Session, SessionState } from "./types";
import { CrewCard } from "./components/crew-card";
import { TerminalView } from "./components/terminal-view";
import { WorkspaceRail, type MainView } from "./components/workspace-rail";
import { pickFolder } from "./host";
import { hasPty } from "./pty";
import { groupByWorkspace } from "./workspace";

// Attention first: waiting/error rise to the top, resting sinks to the bottom.
const ORDER: Record<SessionState, number> = { waiting: 0, error: 1, working: 2, idle: 3 };

export function App() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [, setTick] = useState(0);
  const [view, setView] = useState<MainView>({ kind: "overview" });
  const [agent, setAgent] = useState<AgentKind>("claude-code");
  const [availableAgents, setAvailableAgents] = useState<AgentAvailability[]>([
    { agent: "generic", label: "Shell", available: true, command: "shell" },
  ]);
  const [toast, setToast] = useState("");

  // Shot/deep-link mode: ?open=<id> jumps straight into a session's terminal.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) setView({ kind: "session", id });
  }, []);

  useEffect(() => {
    let alive = true;
    getSessions().then((list) => {
      if (alive) setSessions(new Map(list.map((s) => [s.id, s])));
    });
    const unsub = subscribe((s) => setSessions((prev) => new Map(prev).set(s.id, s)));
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
  const waiting = all.filter((s) => s.state === "waiting").length;

  // Under Electron, selecting a session opens its embedded terminal; in a plain
  // browser there is no pty, so fall back to the tmux jump.
  async function onSelect(v: MainView) {
    if (v.kind === "overview") {
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

  async function openSpawn(agentToSpawn: AgentKind, host: string, cwd: string) {
    const id = await spawn({ agent: agentToSpawn, host, cwd });
    if (!id) {
      setToast("spawn failed");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    if (hasPty()) setView({ kind: "session", id });
  }

  async function onAddWorkspace() {
    const dir = await pickFolder();
    if (dir === null) return;
    await openSpawn(agent, "local", dir);
  }

  async function onNewTerminal(workspace: { host: string; cwd: string }) {
    if (workspace.host !== "local") {
      setToast("remote shell arrives in the next task");
      setTimeout(() => setToast(""), 4500);
      return;
    }
    await openSpawn(agent, workspace.host, workspace.cwd);
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
        onNewTerminal={onNewTerminal}
      />

      <section className="main">
        {showTerminal ? (
          openSession ? (
            <TerminalView session={openSession} onBack={() => setView({ kind: "overview" })} />
          ) : (
            <div className="main__connecting">
              <p className="muted">connecting to session…</p>
            </div>
          )
        ) : (
          <>
            <header className="main__bar">
              <div>
                <h1 className="main__title">Overview</h1>
                <p className="main__sub">
                  {all.length} crew{" "}
                  {waiting > 0 ? (
                    <>
                      · <span className="hot">{waiting} waiting</span>
                    </>
                  ) : (
                    <>· all steady</>
                  )}
                </p>
              </div>
            </header>

            {all.length === 0 ? (
              <div className="empty">
                <div className="porthole porthole--big" aria-hidden>
                  <span className="porthole__face">🫧</span>
                </div>
                <p className="empty__lead">No crew here yet.</p>
                <p className="muted">Spawn a session to bring someone on deck.</p>
              </div>
            ) : (
              <main className="grid">
                {all.map((s, i) => (
                  <CrewCard key={s.id} session={s} index={i} onJump={(id) => onSelect({ kind: "session", id })} />
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
