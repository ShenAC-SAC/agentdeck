import type { SessionState } from "../types";

// Single source of truth for the crew face's signal-lamp tint. Kept out of
// the .tsx component so the root DOM-less tsconfig can typecheck the test.
export const LAMP_TONE: Record<SessionState, string> = {
  working: "var(--tone-working)",
  waiting: "var(--tone-waiting)",
  idle: "var(--tone-idle)",
  error: "var(--tone-error)",
};
