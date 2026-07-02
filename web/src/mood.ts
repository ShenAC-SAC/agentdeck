import type { SessionState } from "./types";

export interface Mood {
  label: string;
  accent: string;
}

// Presentation mapping for the GUI; the face itself is drawn by <CrewFace/>.
// `accent` is a CSS custom-property reference so rows and chips tint from a
// single source of truth.
export function moodFor(state: SessionState): Mood {
  switch (state) {
    case "working":
      return { label: "Focused", accent: "var(--tone-working)" };
    case "waiting":
      return { label: "Needs you", accent: "var(--tone-waiting)" };
    case "error":
      return { label: "Distressed", accent: "var(--tone-error)" };
    default:
      return { label: "Resting", accent: "var(--tone-idle)" };
  }
}
