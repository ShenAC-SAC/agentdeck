import type { CSSProperties } from "react";
import type { Session } from "../types";
import { moodFor } from "../mood";

function since(ts: number): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CrewCard({
  session,
  index,
  onJump,
}: {
  session: Session;
  index: number;
  onJump: (id: string) => void;
}) {
  const mood = moodFor(session.state);
  const style = { animationDelay: `${index * 70}ms`, "--accent": mood.accent } as CSSProperties;
  return (
    <article
      className="crew-card"
      data-state={session.state}
      style={style}
      onClick={() => onJump(session.id)}
      title="Jump to this session"
    >
      <div className="crew-card__top">
        <div className="porthole" aria-hidden>
          <span className="porthole__face">{mood.emoji}</span>
        </div>
        <div className="crew-card__ident">
          <h2 className="crew-card__title">{session.title}</h2>
          <span className="crew-card__agent">{session.agent}</span>
        </div>
      </div>

      <div className="crew-card__state">
        <span className="dot" />
        <span>{mood.label}</span>
        {session.state === "working" ? <span className="cursor">▊</span> : null}
      </div>

      <p className="crew-card__summary">
        {session.lastSummaryLine ? (
          session.lastSummaryLine
        ) : (
          <span className="muted">no transmission yet</span>
        )}
      </p>

      <div className="crew-card__foot">
        <span className="telemetry">{since(session.lastActivityAt)}</span>
        <button
          className="jump"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onJump(session.id);
          }}
        >
          Jump →
        </button>
      </div>
    </article>
  );
}
