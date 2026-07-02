import { siClaude, siOpenai } from "simple-icons";
import type { AgentKind } from "../types";

export interface AgentMarkSpec {
  title: string;
  path: string;
  secondaryPath?: string;
  fillRule?: "evenodd" | "nonzero";
  mode: "fill" | "stroke";
}

const OPENCODE_MARK_PATH = "M18 4.8H6V19.2H18V4.8ZM24 24H0V0H24V24Z";
const OPENCODE_MARK_SECONDARY_PATH = "M18 19.2H6V9.6H18V19.2Z";

// Vendor marks are tinted via currentColor. simple-icons paths are 24x24 fills;
// the OpenCode mark is adapted from the official brand glyph, and the generic
// shell mark is hand-inlined on the same 24px grid as a stroke.
export const AGENT_MARK: Record<AgentKind, AgentMarkSpec> = {
  "claude-code": { title: "Claude", path: siClaude.path, mode: "fill" },
  codex: { title: "Codex", path: siOpenai.path, mode: "fill" },
  opencode: {
    title: "OpenCode",
    path: OPENCODE_MARK_PATH,
    secondaryPath: OPENCODE_MARK_SECONDARY_PATH,
    fillRule: "evenodd",
    mode: "fill",
  },
  generic: {
    title: "Shell",
    path: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M7 11l2-2-2-2 M11 13h4",
    mode: "stroke",
  },
};
