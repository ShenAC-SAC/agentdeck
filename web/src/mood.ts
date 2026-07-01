import type { SessionState } from "./types";

export interface Mood {
  label: string;
  emoji: string;
  accent: string;
}

// Presentation mapping for the GUI — distinct from the TUI's ASCII faces.
// `accent` is a CSS custom-property reference so a card can tint its porthole
// ring and attention glow from a single source of truth.
export function moodFor(state: SessionState): Mood {
  switch (state) {
    case "working":
      return { label: "Focused", emoji: "🧑‍💻", accent: "var(--tone-working)" };
    case "waiting":
      return { label: "Needs you", emoji: "🙋", accent: "var(--tone-waiting)" };
    case "error":
      return { label: "Distressed", emoji: "😵", accent: "var(--tone-error)" };
    default:
      return { label: "Resting", emoji: "☕", accent: "var(--tone-idle)" };
  }
}
