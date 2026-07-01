import type { EventEmitter } from "node:events";
import type { Session } from "../types";

export function notifyText(s: Session): { title: string; body: string } {
  return {
    title: `⚓ ${s.title} needs you`,
    body: s.lastSummaryLine || `${s.agent} is waiting for your input`,
  };
}

function osascriptNotify(s: Session): void {
  const { title, body } = notifyText(s);
  const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`;
  Bun.spawn(["osascript", "-e", script]);
}

// Fires on waiting/error. No-ops under Electron, whose main process owns richer
// clickable notifications. `fire` is injectable for tests.
export function wireNotifications(events: EventEmitter, fire: (s: Session) => void = osascriptNotify): void {
  if (process.env.DECK_ELECTRON === "1") return;
  events.on("update", (s: Session) => {
    if (s.state === "waiting" || s.state === "error") fire(s);
  });
}
