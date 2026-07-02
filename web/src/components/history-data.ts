import type { ArchivedSession } from "../types";

export interface HistoryRowModel {
  resumable: boolean;
  stateLabel: string;
  endedLabel: string;
}

const STATE_LABEL: Record<string, string> = {
  working: "Was working",
  waiting: "Was waiting",
  idle: "Ended",
  error: "Errored",
};

export function relativeTime(from: number | null, now: number = Date.now()): string {
  if (!from) return "";
  const seconds = Math.max(1, Math.round((now - from) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function historyRowModel(row: ArchivedSession, now?: number): HistoryRowModel {
  return {
    resumable: row.agent === "claude-code" && Boolean(row.claudeSessionId),
    stateLabel: STATE_LABEL[row.lastState] ?? row.lastState,
    endedLabel: relativeTime(row.endedAt, now),
  };
}
