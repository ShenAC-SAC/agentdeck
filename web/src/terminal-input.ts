export const SHIFT_ENTER_SEQUENCE = "\x1b[13;2u";

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
): void {
  term.attachCustomKeyEventHandler((event) => {
    if (shouldSendShiftEnter(event)) {
      write(SHIFT_ENTER_SEQUENCE);
      return false;
    }
    if (shouldBlockShiftEnter(event)) return false;
    return true;
  });
}
