import type { AgentKind } from "./types";

export const SHIFT_ENTER_SEQUENCE = "\x1b[13;2u";
export const CODEX_SHIFT_ENTER_SEQUENCE = "\x1b[200~\n\x1b[201~";

export function shiftEnterDataForAgent(agent: AgentKind): string {
  return agent === "codex" ? CODEX_SHIFT_ENTER_SEQUENCE : SHIFT_ENTER_SEQUENCE;
}

export interface TerminalKeyEventLike {
  type: string;
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface KeyOverrideTerminal {
  attachCustomKeyEventHandler(handler: (event: TerminalKeyEventLike) => boolean): void;
}

function isBareShiftEnter(event: TerminalKeyEventLike): boolean {
  return (
    event.key === "Enter" &&
    event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}

export function shouldSendShiftEnter(event: TerminalKeyEventLike): boolean {
  return event.type === "keydown" && isBareShiftEnter(event);
}

export function shouldBlockShiftEnter(event: TerminalKeyEventLike): boolean {
  return isBareShiftEnter(event);
}

export function installTerminalInputOverrides(
  term: KeyOverrideTerminal,
  write: (data: string) => void,
  agent: AgentKind = "generic",
): void {
  term.attachCustomKeyEventHandler((event) => {
    if (shouldSendShiftEnter(event)) {
      write(shiftEnterDataForAgent(agent));
      return false;
    }
    if (shouldBlockShiftEnter(event)) return false;
    return true;
  });
}
