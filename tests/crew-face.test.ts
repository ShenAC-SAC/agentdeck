import { test, expect } from "bun:test";
import { LAMP_TONE } from "../web/src/components/crew-face-data";

const STATES = ["working", "waiting", "idle", "error"] as const;

test("every session state has a lamp tone", () => {
  for (const s of STATES) {
    expect(LAMP_TONE[s]).toMatch(/^var\(--tone-/);
  }
});

test("waiting lamp is the waiting tone", () => {
  expect(LAMP_TONE.waiting).toBe("var(--tone-waiting)");
});
