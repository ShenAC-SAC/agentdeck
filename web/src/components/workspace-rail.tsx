import type { CSSProperties } from "react";
import type { AgentKind } from "../types";
import { moodFor } from "../mood";
import type { WorkspaceGroup } from "../workspace";
import type { AgentAvailability } from "../api";

export type MainView = { kind: "overview" } | { kind: "session"; id: string };

export function WorkspaceRail({
  groups,
  selected,
  agent,
  availableAgents,
  onAgentChange,
  onSelect,
  onAddWorkspace,
  onRemoteShellDeferred,
  onNewTerminal,
  onRenameTerminal,
  onCloseTerminal,
}: {
  groups: WorkspaceGroup[];
  selected: MainView;
  agent: AgentKind;
  availableAgents: AgentAvailability[];
  onAgentChange: (agent: AgentKind) => void;
  onSelect: (view: MainView) => void;
  onAddWorkspace: () => void;
  onRemoteShellDeferred: () => void;
  onNewTerminal: (workspace: { host: string; cwd: string }) => void;
  onRenameTerminal: (sessionId: string, currentTitle: string) => void;
  onCloseTerminal: (sessionId: string, title: string) => void;
}) {
  const agents = availableAgents.filter((a) => a.available);
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
          <section key={group.key} className="workspace-group">
            <div className="workspace-group__head" title={group.cwd}>
              <span className="workspace-group__label">
                <span className="workspace-group__host">{group.hostName}</span>
                <span className="workspace-group__name">{group.name}</span>
              </span>
              <span className="nav-item__meta">
                {group.waiting > 0 ? <span className="nav-item__badge">{group.waiting}</span> : null}
                <span className="nav-item__count">{group.sessions.length}</span>
                <button
                  className="workspace-group__add"
                  type="button"
                  title={`New terminal in ${group.name}`}
                  onClick={() => onNewTerminal({ host: group.host, cwd: group.cwd })}
                >
                  +
                </button>
              </span>
            </div>
            <div className="workspace-group__sessions">
              {group.sessions.map((session) => {
                const mood = moodFor(session.state);
                return (
                  <div
                    key={session.id}
                    className="workspace-session"
                    data-active={selected.kind === "session" && selected.id === session.id}
                    data-state={session.state}
                    style={{ "--accent": mood.accent } as CSSProperties}
                    title={session.title}
                  >
                    <button
                      className="workspace-session__open"
                      type="button"
                      onClick={() => onSelect({ kind: "session", id: session.id })}
                    >
                      <span className="workspace-session__emoji" aria-hidden>
                        {mood.emoji}
                      </span>
                      <span className="workspace-session__title">{session.title}</span>
                      <span className="workspace-session__dot" aria-hidden />
                    </button>
                    <button
                      className="workspace-session__rename"
                      type="button"
                      title={`Rename ${session.title}`}
                      aria-label={`Rename ${session.title}`}
                      onClick={() => onRenameTerminal(session.id, session.title)}
                    >
                      ✎
                    </button>
                    <button
                      className="workspace-session__close"
                      type="button"
                      title={`Close ${session.title}`}
                      aria-label={`Close ${session.title}`}
                      onClick={() => onCloseTerminal(session.id, session.title)}
                    >
                      ✕
                    </button>
                  </div>
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
          {agents.map((a) => (
            <option key={a.agent} value={a.agent}>
              {a.label}
            </option>
          ))}
        </select>
        <button className="spawn__btn" type="button" onClick={onAddWorkspace}>
          ＋ Add workspace
        </button>
        <button
          className="workspace-rail__remote"
          type="button"
          onClick={onRemoteShellDeferred}
          title="Remote shell will be enabled after a real SSH target flow is designed"
        >
          Remote shell later
        </button>
      </div>
    </nav>
  );
}
