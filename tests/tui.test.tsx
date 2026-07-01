import { test, expect } from "bun:test";
import { render } from "ink-testing-library";
import { CrewMember } from "../src/tui/crew-member";
import type { Session } from "../src/types";

const s: Session = {
  id: "s1",
  agent: "codex",
  title: "repo-foo",
  tmuxTarget: "deck:0.0",
  host: "local",
  state: "waiting",
  lastActivityAt: 0,
  lastSummaryLine: "approve?",
};

test("a waiting crew member shows the waving face and its title", () => {
  const { lastFrame } = render(<CrewMember session={s} selected={false} />);
  expect(lastFrame()).toContain("(o/)"); // waving mood
  expect(lastFrame()).toContain("repo-foo");
});
