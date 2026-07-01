import { test, expect } from "bun:test";
import { moodFor, MOOD_FACE } from "../src/tui/mood";

test("waiting -> waving", () => {
  expect(moodFor("waiting")).toBe("waving");
});

test("working -> focused", () => {
  expect(moodFor("working")).toBe("focused");
});

test("idle -> relaxed", () => {
  expect(moodFor("idle")).toBe("relaxed");
});

test("error -> distressed", () => {
  expect(moodFor("error")).toBe("distressed");
});

test("every mood has a face", () => {
  for (const m of ["focused", "waving", "relaxed", "distressed"] as const) {
    expect(MOOD_FACE[m].length).toBeGreaterThan(0);
  }
});
