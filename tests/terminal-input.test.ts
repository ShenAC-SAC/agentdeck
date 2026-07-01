import { expect, test } from "bun:test";
import {
  CODEX_SHIFT_ENTER_SEQUENCE,
  SHIFT_ENTER_SEQUENCE,
  installTerminalInputOverrides,
  shouldBlockShiftEnter,
  shouldSendShiftEnter,
  shiftEnterDataForAgent,
  type TerminalKeyEventLike,
} from "../web/src/terminal-input";

function key(overrides: Partial<TerminalKeyEventLike>): TerminalKeyEventLike {
  return {
    type: "keydown",
    key: "Enter",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  };
}

test("Shift+Enter sends the CSI-u modified Enter sequence", () => {
  expect(SHIFT_ENTER_SEQUENCE).toBe("\x1b[13;2u");
  expect(shouldSendShiftEnter(key({ shiftKey: true }))).toBe(true);
  expect(shouldSendShiftEnter(key({ shiftKey: false }))).toBe(false);
  expect(shouldSendShiftEnter(key({ shiftKey: true, altKey: true }))).toBe(false);
  expect(shouldSendShiftEnter(key({ shiftKey: true, ctrlKey: true }))).toBe(false);
  expect(shouldSendShiftEnter(key({ shiftKey: true, metaKey: true }))).toBe(false);
});

test("Claude Code and opencode use modified Enter for Shift+Enter", () => {
  expect(shiftEnterDataForAgent("claude-code")).toBe(SHIFT_ENTER_SEQUENCE);
  expect(shiftEnterDataForAgent("opencode")).toBe(SHIFT_ENTER_SEQUENCE);
  expect(shiftEnterDataForAgent("generic")).toBe(SHIFT_ENTER_SEQUENCE);
});

test("Codex uses bracketed-paste newline for Shift+Enter", () => {
  expect(CODEX_SHIFT_ENTER_SEQUENCE).toBe("\x1b[200~\n\x1b[201~");
  expect(shiftEnterDataForAgent("codex")).toBe(CODEX_SHIFT_ENTER_SEQUENCE);
});

test("Shift+Enter keyup is blocked without sending duplicate data", () => {
  expect(shouldBlockShiftEnter(key({ type: "keyup", shiftKey: true }))).toBe(true);
  expect(shouldSendShiftEnter(key({ type: "keyup", shiftKey: true }))).toBe(false);
});

test("installTerminalInputOverrides writes once and cancels xterm default handling", () => {
  let handler: ((event: TerminalKeyEventLike) => boolean) | undefined;
  const writes: string[] = [];
  const fakeTerm = {
    attachCustomKeyEventHandler(fn: (event: TerminalKeyEventLike) => boolean) {
      handler = fn;
    },
  };

  installTerminalInputOverrides(fakeTerm, (data) => writes.push(data));

  expect(handler?.(key({ shiftKey: true }))).toBe(false);
  expect(writes).toEqual(["\x1b[13;2u"]);
  expect(handler?.(key({ shiftKey: false }))).toBe(true);
});
