import { siAnthropic, siOpenai } from "simple-icons";
import type { AgentKind } from "../types";

export interface AgentMarkSpec {
  title: string;
  path: string;
  mode: "fill" | "stroke";
}

// Monochrome vendor marks (nominative use, tinted via currentColor).
// simple-icons paths are 24x24 fills; opencode/generic get hand-inlined
// terminal glyphs on the same 24px grid drawn as strokes.
export const AGENT_MARK: Record<AgentKind, AgentMarkSpec> = {
  "claude-code": { title: "Anthropic", path: siAnthropic.path, mode: "fill" },
  codex: { title: "Codex", path: siOpenai.path, mode: "fill" },
  opencode: {
    title: "opencode",
    path: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M7 11l2-2-2-2 M11 13h4",
    mode: "stroke",
  },
  generic: {
    title: "Shell",
    path: "M4 17l6-5-6-5 M12 19h8",
    mode: "stroke",
  },
};
