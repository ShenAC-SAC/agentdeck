import { expect, test } from "bun:test";
import {
  SHIFT_ENTER_SEQUENCE,
  installTerminalInputOverrides,
  shouldBlockShiftEnter,
  shouldSendShiftEnter,
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
