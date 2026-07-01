import { useEffect, useMemo, useState } from "react";
import { getSessions, jump, spawn, subscribe } from "./api";
import { AGENT_KINDS } from "./types";
import type { AgentKind, Session, SessionState } from "./types";
import { CrewCard } from "./components/crew-card";

// Attention first: waiting/error rise to the top, resting sinks to the bottom.
const ORDER: Record<SessionState, number> = { waiting: 0, error: 1, working: 2, idle: 3 };

export function App() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const [, setTick] = useState(0);
  const [agent, setAgent] = useState<AgentKind>("claude-code");
  const [toast, setToast] = useState("");

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

  const list = useMemo(
    () =>
      [...sessions.values()].sort(
        (a, b) => ORDER[a.state] - ORDER[b.state] || b.lastActivityAt - a.lastActivityAt,
      ),
    [sessions],
  );
  const waiting = list.filter((s) => s.state === "waiting").length;

  async function onJump(id: string) {
    const res = await jump(id);
    if (!res.ok) {
      setToast((await res.text()) || "jump failed");
      setTimeout(() => setToast(""), 4500);
    }
  }

  return (
    <div className="deck">
      <header className="deck__bar">
        <div className="brand">
          <span className="brand__mark">⚓</span>
          <div>
            <h1 className="brand__name">AgentDeck</h1>
            <p className="brand__sub">
              {list.length} crew{" "}
              {waiting > 0 ? (
                <>
                  · <span className="hot">{waiting} waiting</span>
                </>
              ) : (
                <>· all steady</>
              )}
            </p>
          </div>
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
          <button className="spawn__btn" type="button" onClick={() => spawn(agent)}>
            ＋ New session
          </button>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="empty">
          <div className="porthole porthole--big" aria-hidden>
            <span className="porthole__face">🫧</span>
          </div>
          <p className="empty__lead">No crew aboard yet.</p>
          <p className="muted">Spawn a session to bring someone on deck.</p>
        </div>
      ) : (
        <main className="grid">
          {list.map((s, i) => (
            <CrewCard key={s.id} session={s} index={i} onJump={onJump} />
          ))}
        </main>
      )}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
