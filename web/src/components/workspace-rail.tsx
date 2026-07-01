import type { CSSProperties } from "react";
import type { AgentKind } from "../types";
import { AGENT_KINDS } from "../types";
import { moodFor } from "../mood";
import type { WorkspaceGroup } from "../workspace";

export type MainView = { kind: "overview" } | { kind: "session"; id: string };

export function WorkspaceRail({
  groups,
  selected,
  agent,
  onAgentChange,
  onSelect,
  onNewSession,
}: {
  groups: WorkspaceGroup[];
  selected: MainView;
  agent: AgentKind;
  onAgentChange: (agent: AgentKind) => void;
  onSelect: (view: MainView) => void;
  onNewSession: () => void;
}) {
  return (
    <nav className="workspace-rail">
      <div className="sidebar__brand">
        <span className="brand__mark">⚓</span>
        <span className="sidebar__title">AgentDeck</span>
      </div>

      <button
        type="button"
        className="nav-item workspace-rail__overview"
        data-active={selected.kind === "overview"}
        onClick={() => onSelect({ kind: "overview" })}
      >
        <span className="nav-item__label">⊞ Overview</span>
        <span className="nav-item__count">{groups.reduce((n, g) => n + g.sessions.length, 0)}</span>
      </button>

      <div className="workspace-rail__groups">
        {groups.map((group) => (
          <section key={group.cwd} className="workspace-group">
            <div className="workspace-group__head" title={group.cwd}>
              <span className="workspace-group__name">{group.name}</span>
              <span className="nav-item__meta">
                {group.waiting > 0 ? <span className="nav-item__badge">{group.waiting}</span> : null}
                <span className="nav-item__count">{group.sessions.length}</span>
              </span>
            </div>
            <div className="workspace-group__sessions">
              {group.sessions.map((session) => {
                const mood = moodFor(session.state);
                return (
                  <button
                    key={session.id}
                    type="button"
                    className="workspace-session"
                    data-active={selected.kind === "session" && selected.id === session.id}
                    data-state={session.state}
                    style={{ "--accent": mood.accent } as CSSProperties}
                    onClick={() => onSelect({ kind: "session", id: session.id })}
                    title={session.title}
                  >
                    <span className="workspace-session__emoji" aria-hidden>
                      {mood.emoji}
                    </span>
                    <span className="workspace-session__title">{session.title}</span>
                    <span className="workspace-session__dot" aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="workspace-rail__new">
        <select
          className="spawn__select"
          value={agent}
          onChange={(e) => onAgentChange(e.target.value as AgentKind)}
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
    </nav>
  );
}
