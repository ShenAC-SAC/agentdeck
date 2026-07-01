import type { SessionState } from "../types";

export type Mood = "focused" | "waving" | "relaxed" | "distressed";

export function moodFor(state: SessionState): Mood {
  switch (state) {
    case "working":
      return "focused";
    case "waiting":
      return "waving";
    case "idle":
      return "relaxed";
    case "error":
      return "distressed";
  }
}

export const MOOD_FACE: Record<Mood, string> = {
  focused: "(-_-)⌨", // heads-down at the keyboard
  waving: "(o/)", // waving you over: your turn
  relaxed: "(˘ ³˘)☕", // done, sipping coffee
  distressed: "(×_×)!", // something broke
};
