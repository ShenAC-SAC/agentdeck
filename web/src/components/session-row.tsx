import { useState, type CSSProperties } from "react";
import { ArrowRight, Pencil, X } from "lucide-react";
import type { Session } from "../types";
import { moodFor } from "../mood";
import { CrewFace } from "./crew-face";
import { AgentMark } from "./agent-mark";
import { InlineRename } from "./inline-rename";

export function since(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// One instrument row: face, vendor mark, name, last transmission, age, and
// hover-revealed actions. The whole row opens the session's terminal.
export function SessionRow({
  session,
  index,
  kindLabel,
  onOpen,
  onRename,
  onClose,
}: {
  session: Session;
  index: number;
  kindLabel?: string;
  onOpen: (id: string) => void;
  onRename: (sessionId: string, nextTitle: string) => void;
  onClose: (sessionId: string, title: string) => void;
}) {
  const mood = moodFor(session.state);
  const [editing, setEditing] = useState(false);
  const style = { animationDelay: `${Math.min(index, 8) * 40}ms`, "--accent": mood.accent } as CSSProperties;

  if (editing) {
    return (
      <div className="session-row session-row--editing" data-state={session.state} style={style}>
        <CrewFace state={session.state} size={26} />
        <InlineRename
          className="session-row__rename-input"
          value={session.title}
          onSubmit={(next) => {
            setEditing(false);
            onRename(session.id, next);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      className="session-row"
      data-state={session.state}
      style={style}
      onClick={() => onOpen(session.id)}
      title={session.cwd}
    >
      <CrewFace state={session.state} size={26} />
      <AgentMark agent={session.agent} />
      <span className="session-row__title">{session.title}</span>
      <span className="session-row__summary">
        {kindLabel ? <span className="session-row__kind">{kindLabel}</span> : null}
        {session.lastSummaryLine || <span className="muted">no transmission yet</span>}
      </span>
      <span className="session-row__since">{since(session.lastActivityAt)}</span>
      <span className="session-row__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title={`Open ${session.title}`}
          aria-label={`Open ${session.title}`}
          onClick={() => onOpen(session.id)}
        >
          <ArrowRight size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title={`Rename ${session.title}`}
          aria-label={`Rename ${session.title}`}
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          title={`Close ${session.title}`}
          aria-label={`Close ${session.title}`}
          onClick={() => onClose(session.id, session.title)}
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </span>
    </div>
  );
}
