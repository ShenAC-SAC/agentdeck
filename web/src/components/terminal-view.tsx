import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Session } from "../types";
import { moodFor } from "../mood";
import { workspaceName } from "../workspace";
import { installTerminalInputOverrides } from "../terminal-input";
import { InlineRename } from "./inline-rename";

// Embedded terminal: an xterm bound to a node-pty that runs
// `tmux -L deck attach -t <session>` in the main process. You see the agent's
// live output and type straight into it — no separate window, no jump.
export function TerminalView({
  session,
  onBack,
  onRename,
}: {
  session: Session;
  onBack: () => void;
  onRename: (sessionId: string, nextTitle: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const bridge = window.deckpty;
    const host = hostRef.current;
    if (!bridge || !host) return;

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: "#14100c",
        foreground: "#f4ead9",
        cursor: "#e2a54c",
        selectionBackground: "#3a2d21",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    const id = session.id;
    void bridge.open(id, session.tmuxTarget, session.host, term.cols, term.rows);
    const offData = bridge.onData(id, (d) => term.write(d));
    const offExit = bridge.onExit(id, () => term.write("\r\n\x1b[2m[session detached]\x1b[0m\r\n"));
    installTerminalInputOverrides(term, (data) => bridge.write(id, data), session.agent);
    const input = term.onData((d) => bridge.write(id, d));
    const onResize = () => {
      fit.fit();
      bridge.resize(id, term.cols, term.rows);
    };
    window.addEventListener("resize", onResize);
    term.focus();

    return () => {
      window.removeEventListener("resize", onResize);
      offData();
      offExit();
      input.dispose();
      bridge.close(id);
      term.dispose();
    };
  }, [session.id, session.tmuxTarget, session.host, session.agent]);

  const mood = moodFor(session.state);
  const workspace = workspaceName(session.cwd);
  return (
    <section className="term">
      <header className="term__bar">
        <button className="term__back" type="button" onClick={onBack}>
          ← Deck
        </button>
        <span className="term__face" aria-hidden>
          {mood.emoji}
        </span>
        {editing ? (
          <InlineRename
            className="term__rename-input"
            value={session.title}
            onSubmit={(next) => {
              setEditing(false);
              onRename(session.id, next);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <span className="term__title">{session.title}</span>
            <button className="term__rename" type="button" onClick={() => setEditing(true)}>
              Rename
            </button>
          </>
        )}
        <span className="crew-card__agent">{session.agent}</span>
        <span className="term__workspace" title={session.cwd}>
          @{workspace}
        </span>
      </header>
      <div className="term__screen" ref={hostRef} />
    </section>
  );
}
