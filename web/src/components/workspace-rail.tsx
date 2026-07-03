import { useState, type CSSProperties } from "react";
import { LayoutGrid, Pencil, Plus, Server, X } from "lucide-react";
import type { AgentKind } from "../types";
import { moodFor } from "../mood";
import type { WorkspaceGroup } from "../workspace";
import type { AgentAvailability, RemoteHost } from "../api";
import { visibleAgentChoices } from "../agent-options";
import { CrewFace } from "./crew-face";
import { InlineRename } from "./inline-rename";

export type MainView = { kind: "overview" } | { kind: "session"; id: string };

// Simplified line-art of the dock icon's anchor: brand mark and app icon
// stay the same drawing at two levels of detail.
function BrandAnchor() {
  return (
    <svg width="20" height="20" viewBox="0 0 120 120" aria-hidden>
      <g fill="none" stroke="var(--brass)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="60" cy="24" r="10" strokeWidth="7" />
        <line x1="60" y1="34" x2="60" y2="94" />
        <line x1="38" y1="46" x2="82" y2="46" strokeWidth="8" />
        <path d="M 22 68 Q 26 92 60 96 Q 94 92 98 68" />
        <path d="M 22 68 L 17 57 M 22 68 L 31 60" />
        <path d="M 98 68 L 103 57 M 98 68 L 89 60" />
      </g>
    </svg>
  );
}

export function WorkspaceRail({
  groups,
  selected,
  agent,
  availableAgents,
  remoteHosts,
  remoteReachability,
  onAgentChange,
  onSelect,
  onAddWorkspace,
  onConnectRemote,
  onNewTerminal,
  onRenameTerminal,
  onCloseTerminal,
}: {
  groups: WorkspaceGroup[];
  selected: MainView;
  agent: AgentKind;
  availableAgents: AgentAvailability[];
  remoteHosts: RemoteHost[];
  remoteReachability: Map<string, boolean>;
  onAgentChange: (agent: AgentKind) => void;
  onSelect: (view: MainView) => void;
  onAddWorkspace: () => void;
  onConnectRemote: (host: string) => void;
  onNewTerminal: (workspace: { host: string; cwd: string }) => void;
  onRenameTerminal: (sessionId: string, nextTitle: string) => void;
  onCloseTerminal: (sessionId: string, title: string) => void;
}) {
  const agents = visibleAgentChoices(availableAgents, remoteHosts.length > 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRemoteHost, setSelectedRemoteHost] = useState("");
  const remoteHost = selectedRemoteHost || remoteHosts[0]?.alias || "";
  return (
    <nav className="workspace-rail">
      <div className="sidebar__brand">
        <BrandAnchor />
        <span className="sidebar__title">AgentDeck</span>
      </div>

      <button
        type="button"
        className="nav-item workspace-rail__overview"
        data-active={selected.kind === "overview"}
        onClick={() => onSelect({ kind: "overview" })}
      >
        <span className="nav-item__label">
          <LayoutGrid size={14} strokeWidth={1.75} /> Overview
        </span>
        <span className="nav-item__count">{groups.reduce((n, g) => n + g.sessions.length, 0)}</span>
      </button>

      <div className="workspace-rail__groups">
        {groups.map((group) => (
          <section key={group.key} className="workspace-group">
            <div className="workspace-group__head" title={group.cwd}>
              <span className="workspace-group__label">
                <span className="workspace-group__host">{group.hostName}</span>
                <span className="workspace-group__name-row">
                  <span className="workspace-group__name">{group.name}</span>
                  {group.host !== "local" && remoteReachability.get(group.host) === false ? (
                    <span className="workspace-group__status">unreachable</span>
                  ) : null}
                </span>
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
                  <Plus size={13} strokeWidth={1.75} />
                </button>
              </span>
            </div>
            <div className="workspace-group__sessions">
              {group.sessions.map((session) => {
                const mood = moodFor(session.state);
                if (editingId === session.id) {
                  return (
                    <div
                      key={session.id}
                      className="workspace-session workspace-session--editing"
                      data-state={session.state}
                      style={{ "--accent": mood.accent } as CSSProperties}
                    >
                      <CrewFace state={session.state} size={20} />
                      <InlineRename
                        className="workspace-session__rename-input"
                        value={session.title}
                        onSubmit={(next) => {
                          setEditingId(null);
                          onRenameTerminal(session.id, next);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  );
                }
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
                      <CrewFace state={session.state} size={20} />
                      <span className="workspace-session__title">{session.title}</span>
                      <span className="workspace-session__dot" aria-hidden />
                    </button>
                    <span className="workspace-session__actions">
                      <button
                        className="workspace-session__rename"
                        type="button"
                        title={`Rename ${session.title}`}
                        aria-label={`Rename ${session.title}`}
                        onClick={() => setEditingId(session.id)}
                      >
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button
                        className="workspace-session__close"
                        type="button"
                        title={`Close ${session.title}`}
                        aria-label={`Close ${session.title}`}
                        onClick={() => onCloseTerminal(session.id, session.title)}
                      >
                        <X size={13} strokeWidth={1.75} />
                      </button>
                    </span>
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
          <Plus size={14} strokeWidth={2} /> Add workspace
        </button>
        <div className="workspace-rail__remote">
          <select
            className="remote-connect__select"
            aria-label="Remote host"
            value={remoteHost}
            disabled={remoteHosts.length === 0}
            onChange={(e) => setSelectedRemoteHost(e.target.value)}
          >
            {remoteHosts.length === 0 ? (
              <option value="">No servers</option>
            ) : (
              remoteHosts.map((host) => (
                <option key={host.alias} value={host.alias}>
                  {host.alias}
                </option>
              ))
            )}
          </select>
          <button
            className="remote-connect__button"
            type="button"
            disabled={!remoteHost}
            onClick={() => onConnectRemote(remoteHost)}
          >
            <Server size={14} strokeWidth={1.8} /> Connect
          </button>
        </div>
      </div>
    </nav>
  );
}
