import { useEffect, useMemo, useState } from "react";
import { getSessions, jump, spawn, subscribe } from "./api";
import { AGENT_KINDS } from "./types";
import type { AgentKind, Session, SessionState } from "./types";
import { CrewCard } from "./components/crew-card";
import { Sidebar, type NavItem } from "./components/sidebar";
import { TerminalView } from "./components/terminal-view";
import { hasPty } from "./pty";

// Attention first: waiting/error rise to the top, resting sinks to the bottom.
const ORDER: Record<SessionState, number> = { waiting: 0, error: 1, working: 2, idle: 3 };

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "claude-code", label: "Claude Code" },
  { key: "codex", label: "Codex" },
  { key: "opencode", label: "opencode" },
  { key: "others", label: "Others" },
] as const;
type Filter = (typeof CATEGORIES)[number]["key"];

function inCategory(s: Session, key: Filter): boolean {
  if (key === "all") return true;
  if (key === "others") return s.agent === "generic";
  return s.agent === key;
}

export function App() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [agent, setAgent] = useState<AgentKind>("claude-code");
  const [toast, setToast] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Shot/deep-link mode: ?open=<id> jumps straight into a session's terminal.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) setOpenId(id);
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

  const navItems: NavItem[] = useMemo(
    () =>
      CATEGORIES.map((c) => {
        const inCat = all.filter((s) => inCategory(s, c.key));
        return {
          key: c.key,
          label: c.label,
          total: inCat.length,
          waiting: inCat.filter((s) => s.state === "waiting").length,
        };
      }),
    [all],
  );

  const shown = all.filter((s) => inCategory(s, filter));
  const shownWaiting = shown.filter((s) => s.state === "waiting").length;
  const activeLabel = CATEGORIES.find((c) => c.key === filter)?.label ?? "All";

  // Under Electron, selecting a session opens its embedded terminal; in a plain
  // browser there is no pty, so fall back to the tmux jump.
  async function onSelect(id: string) {
    if (hasPty()) {
      setOpenId(id);
      return;
    }
    const res = await jump(id);
    if (!res.ok) {
      setToast((await res.text()) || "jump failed");
      setTimeout(() => setToast(""), 4500);
    }
  }

  async function onNewSession() {
    const id = await spawn(agent);
    if (id && hasPty()) setOpenId(id); // straight into the new session's terminal
  }

  const openSession = openId ? sessions.get(openId) : undefined;
  if (openId && hasPty()) {
    return openSession ? (
      <TerminalView session={openSession} onBack={() => setOpenId(null)} />
    ) : (
      <div className="app app--connecting">
        <p className="muted">connecting to session…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar items={navItems} active={filter} onSelect={(k) => setFilter(k as Filter)} />

      <section className="main">
        <header className="main__bar">
          <div>
            <h1 className="main__title">{activeLabel}</h1>
            <p className="main__sub">
              {shown.length} crew{" "}
              {shownWaiting > 0 ? (
                <>
                  · <span className="hot">{shownWaiting} waiting</span>
                </>
              ) : (
                <>· all steady</>
              )}
            </p>
          </div>
          <div className="spawn">
            <select
              className="spawn__select"
              value={agent}
              onChange={(e) => setAgent(e.target.value as AgentKind)}
            >
              {AGENT_KINDS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button className="spawn__btn" type="button" onClick={onNewSession}>
              ＋ New session
            </button>
          </div>
        </header>

        {shown.length === 0 ? (
          <div className="empty">
            <div className="porthole porthole--big" aria-hidden>
              <span className="porthole__face">🫧</span>
            </div>
            <p className="empty__lead">No crew here yet.</p>
            <p className="muted">Spawn a session to bring someone on deck.</p>
          </div>
        ) : (
          <main className="grid">
            {shown.map((s, i) => (
              <CrewCard key={s.id} session={s} index={i} onJump={onSelect} />
            ))}
          </main>
        )}
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
