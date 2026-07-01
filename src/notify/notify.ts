import type { EventEmitter } from "node:events";
import type { Session } from "../types";

export function notifyText(s: Session): { title: string; body: string } {
  return {
    title: `⚓ ${s.title} needs you`,
    body: s.lastSummaryLine || `${s.agent} is waiting for your input`,
  };
}

export function notifyWaiting(s: Session): void {
  const { title, body } = notifyText(s);
  const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`;
  Bun.spawn(["osascript", "-e", script]);
}

// Wired by the CLI (not the hub core, so tests don't fire real notifications).
export function wireNotifications(events: EventEmitter): void {
  events.on("update", (s: Session) => {
    if (s.state === "waiting") notifyWaiting(s);
  });
}
